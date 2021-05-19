/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationMode, MigrationStateModel, MigrationTargetType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { IconPathHelper } from '../constants/iconPathHelper';
import { SqlManagedInstance } from '../api/azure';

export class MigrationModePage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _businessCriticalFlexContainer!: azdata.FlexContainer;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_MIGRATION_MODE_LABEL, 'MigrationModePage'), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_MIGRATION_MODE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this._businessCriticalFlexContainer,
						title: ''
					},
					this.migrationModeContainer(view),
				]
			);
		await view.initializeModel(form.component());
	}

	public async onPageEnter(): Promise<void> {
		if (this.migrationStateModel._targetType === MigrationTargetType.SQLMI && (<SqlManagedInstance>this.migrationStateModel._targetServerInstance).sku.tier === 'BusinessCritical') {
			this._businessCriticalFlexContainer.display = 'inline';
		} else {
			this._businessCriticalFlexContainer.display = 'none';
		}
		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	public async onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator((e) => {
			return true;
		});
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationModeContainer(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'cutoverContainer';

		const onlineButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_LABEL,
			name: buttonGroup,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			},
			checked: true
		}).component();

		const onlineDescription = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_ONLINE_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'margin': '0 0 10px 20px'
			}
		}).component();

		this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.ONLINE;

		onlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				this.migrationStateModel._databaseBackup.migrationMode = MigrationMode.ONLINE;
			}
		});

		const offlineButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_LABEL,
			name: buttonGroup,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold'
			},
		}).component();

		const offlineDescription = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_MODE_OFFLINE_DESCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'margin': '0 0 10px 20px'
			}
		}).component();


		offlineButton.onDidChangeCheckedState((e) => {
			if (e) {
				vscode.window.showInformationMessage('Feature coming soon');
				onlineButton.checked = true;
				//this.migrationStateModel._databaseBackup.migrationCutover = MigrationCutover.OFFLINE; TODO: Enable when offline mode is supported.
			}
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				onlineButton,
				onlineDescription,
				offlineButton,
				offlineDescription
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			component: flexContainer
		};
	}
}
