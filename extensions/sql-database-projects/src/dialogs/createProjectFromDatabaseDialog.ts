/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as newProjectTool from '../tools/newProjectTool';
import * as mssql from '../../../mssql';

import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { ImportDataModel } from '../models/api/import';
import { Deferred } from '../common/promise';
import { getConnectionName } from './utils';

export class CreateProjectFromDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public createProjectFromDatabaseTab: azdata.window.DialogTab;
	public sourceConnectionTextBox: azdata.InputBoxComponent | undefined;
	private selectConnectionButton: azdata.ButtonComponent | undefined;
	public sourceDatabaseDropDown: azdata.DropDownComponent | undefined;
	public projectNameTextBox: azdata.InputBoxComponent | undefined;
	public projectLocationTextBox: azdata.InputBoxComponent | undefined;
	public folderStructureDropDown: azdata.DropDownComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private connectionId: string | undefined;
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete!: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	public createNewProjectCallback: ((model: ImportDataModel) => any) | undefined;

	constructor(private profile: azdata.IConnectionProfile | undefined) {
		this.dialog = azdata.window.createModelViewDialog(constants.createProjectFromDatabaseDialogName);
		this.createProjectFromDatabaseTab = azdata.window.createTab(constants.createProjectFromDatabaseDialogName);
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.createProjectDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.createButtonClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;

		if (this.profile) {
			await this.updateConnectionComponents(getConnectionName(this.profile), this.profile.id, this.profile.databaseName!);
		}

		this.tryEnableCreateButton();
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializeCreateProjectFromDatabaseTab();
		this.dialog.content = [this.createProjectFromDatabaseTab];
	}

	private initializeCreateProjectFromDatabaseTab(): void {
		this.createProjectFromDatabaseTab.registerContent(async view => {

			const connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);
			const sourceDatabaseFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			sourceDatabaseFormSection.addItems([connectionRow, databaseRow]);

			const projectNameRow = this.createProjectNameRow(view);
			const projectLocationRow = this.createProjectLocationRow(view);
			const targetProjectFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			targetProjectFormSection.addItems([projectNameRow, projectLocationRow]);

			const folderStructureRow = this.createFolderStructureRow(view);
			const createProjectSettingsFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			createProjectSettingsFormSection.addItems([folderStructureRow]);

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.sourceDatabase,
						components: [
							{
								component: sourceDatabaseFormSection,
							}
						]
					},
					{
						title: constants.targetProject,
						components: [
							{
								component: targetProjectFormSection,
							}
						]
					},
					{
						title: constants.createProjectSettings,
						components: [
							{
								component: createProjectSettingsFormSection,
							}
						]
					}
				], {
					horizontal: false,
					titleFontSize: cssStyles.titleFontSize
				})
				.withLayout({
					width: '100%'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
			this.initDialogComplete?.resolve();
		});
	}

	private createConnectionRow(view: azdata.ModelView): azdata.FlexContainer {
		const sourceConnectionTextBox = this.createSourceConnectionComponent(view);
		const selectConnectionButton: azdata.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.labelWidth
		}).component();
		serverLabel.updateCssStyles({ 'font-weight': 'bold' });

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, sourceConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px', 'margin-top': '-20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.insertItem(selectConnectionButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdata.ModelView): azdata.FlexContainer {
		this.sourceDatabaseDropDown = view.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.databaseNameLabel,
			required: true,
			width: cssStyles.textboxWidth,
			editable: true,
			fireOnTextChange: true
		}).component();

		this.sourceDatabaseDropDown.onValueChanged(() => {
			this.setProjectName();
			this.tryEnableCreateButton();
		});

		const databaseLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.labelWidth
		}).component();
		databaseLabel.updateCssStyles({ 'font-weight': 'bold' });

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdata.DropDownComponent>this.sourceDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	public setProjectName() {
		this.projectNameTextBox!.value = newProjectTool.defaultProjectNameFromDb(<string>this.sourceDatabaseDropDown!.value);
	}

	private createSourceConnectionComponent(view: azdata.ModelView): azdata.InputBoxComponent {
		this.sourceConnectionTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			placeHolder: constants.selectConnection,
			width: cssStyles.textboxWidth,
			enabled: false
		}).component();

		this.sourceConnectionTextBox.onTextChanged(() => {
			this.tryEnableCreateButton();
		});

		return this.sourceConnectionTextBox;
	}

	private createSelectConnectionButton(view: azdata.ModelView): azdata.Component {
		this.selectConnectionButton = view.modelBuilder.button().withProperties({
			ariaLabel: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '16px',
			width: '16px'
		}).component();

		this.selectConnectionButton.onDidClick(async () => {
			let connection = await azdata.connection.openConnectionDialog();
			this.connectionId = connection.connectionId;

			let connectionTextboxValue: string;
			connectionTextboxValue = getConnectionName(connection);

			await this.updateConnectionComponents(connectionTextboxValue, this.connectionId, connection.options.database);
		});

		return this.selectConnectionButton;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string, databaseName?: string) {
		this.sourceConnectionTextBox!.value = connectionTextboxValue;
		this.sourceConnectionTextBox!.placeHolder = connectionTextboxValue;

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			const databaseValues = await azdata.connection.listDatabases(connectionId);

			this.sourceDatabaseDropDown!.values = databaseValues;
			this.connectionId = connectionId;
		}

		// change the database inputbox value to the connection's database if there is one
		if (databaseName && databaseName !== constants.master) {
			this.sourceDatabaseDropDown!.value = databaseName;
		}

		// change icon to the one without a plus sign
		this.selectConnectionButton!.iconPath = IconPathHelper.connect;
	}

	private createProjectNameRow(view: azdata.ModelView): azdata.FlexContainer {
		this.projectNameTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.projectNamePlaceholderText,
			required: true,
			width: cssStyles.textboxWidth,
			validationErrorMessage: constants.projectNameRequired
		}).component();

		this.projectNameTextBox.onTextChanged(() => {
			this.projectNameTextBox!.value = this.projectNameTextBox!.value?.trim();
			this.tryEnableCreateButton();
		});

		const projectNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectNameLabel,
			requiredIndicator: true,
			width: cssStyles.labelWidth
		}).component();
		projectNameLabel.updateCssStyles({ 'font-weight': 'bold' });

		const projectNameRow = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.projectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px', 'margin-top': '-20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return projectNameRow;
	}

	private createProjectLocationRow(view: azdata.ModelView): azdata.FlexContainer {
		const browseFolderButton: azdata.Component = this.createBrowseFolderButton(view);

		this.projectLocationTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.projectLocationLabel,
			placeHolder: constants.projectLocationPlaceholderText,
			width: cssStyles.textboxWidth,
			validationErrorMessage: constants.projectLocationRequired
		}).component();

		this.projectLocationTextBox.onTextChanged(() => {
			this.projectLocationTextBox!.placeHolder = this.projectLocationTextBox!.value;
			this.tryEnableCreateButton();
		});

		const projectLocationLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectLocationLabel,
			requiredIndicator: true,
			width: cssStyles.labelWidth
		}).component();
		projectLocationLabel.updateCssStyles({ 'font-weight': 'bold' });

		const projectLocationRow = view.modelBuilder.flexContainer().withItems([projectLocationLabel, this.projectLocationTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		projectLocationRow.insertItem(browseFolderButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return projectLocationRow;
	}

	private createBrowseFolderButton(view: azdata.ModelView): azdata.ButtonComponent {
		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.browseButtonText,
			iconPath: IconPathHelper.folder_blue,
			height: '18px',
			width: '18px'
		}).component();

		browseFolderButton.onDidClick(async () => {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.selectString,
				defaultUri: newProjectTool.defaultProjectSaveLocation()
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}

			this.projectLocationTextBox!.value = folderUris[0].fsPath;
			this.projectLocationTextBox!.placeHolder = folderUris[0].fsPath;

		});

		return browseFolderButton;
	}

	private createFolderStructureRow(view: azdata.ModelView): azdata.FlexContainer {
		this.folderStructureDropDown = view.modelBuilder.dropDown().withProperties({
			values: [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
			value: constants.schemaObjectType,
			ariaLabel: constants.folderStructureLabel,
			required: true,
			width: cssStyles.textboxWidth
		}).component();

		this.folderStructureDropDown.onValueChanged(() => {
			this.tryEnableCreateButton();
		});

		const folderStructureLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.folderStructureLabel,
			requiredIndicator: true,
			width: cssStyles.labelWidth
		}).component();
		folderStructureLabel.updateCssStyles({ 'font-weight': 'bold' });

		const folderStructureRow = view.modelBuilder.flexContainer().withItems([folderStructureLabel, <azdata.DropDownComponent>this.folderStructureDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-top': '-20px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return folderStructureRow;
	}

	// only enable Create button if all fields are filled
	public tryEnableCreateButton(): void {
		if (this.sourceConnectionTextBox!.value && this.sourceDatabaseDropDown!.value
			&& this.projectNameTextBox!.value && this.projectLocationTextBox!.value) {
			this.dialog.okButton.enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
		}
	}

	public async createButtonClick(): Promise<void> {
		const model: ImportDataModel = {
			serverId: this.connectionId!,
			database: <string>this.sourceDatabaseDropDown!.value,
			projName: this.projectNameTextBox!.value!,
			filePath: this.projectLocationTextBox!.value!,
			version: '1.0.0.0',
			extractTarget: this.mapExtractTargetEnum(<string>this.folderStructureDropDown!.value)
		};

		azdata.window.closeDialog(this.dialog);
		await this.createNewProjectCallback!(model);

		this.dispose();
	}

	private mapExtractTargetEnum(inputTarget: any): mssql.ExtractTarget {
		if (inputTarget) {
			switch (inputTarget) {
				case constants.file: return mssql.ExtractTarget['file'];
				case constants.flat: return mssql.ExtractTarget['flat'];
				case constants.objectType: return mssql.ExtractTarget['objectType'];
				case constants.schema: return mssql.ExtractTarget['schema'];
				case constants.schemaObjectType: return mssql.ExtractTarget['schemaObjectType'];
				default: throw new Error(constants.invalidInput(inputTarget));
			}
		} else {
			throw new Error(constants.extractTargetRequired);
		}
	}
}
