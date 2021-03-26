/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, StateChangeEvent } from '../models/stateMachine';
import { AssessmentResultsDialog } from '../dialog/assessmentResults/assessmentResultsDialog';
import * as constants from '../constants/strings';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { IconPath, IconPathHelper } from '../constants/iconPathHelper';

export interface Product {
	type: MigrationTargetType;
	name: string,
	icon: IconPath;
}

export class SKURecommendationPage extends MigrationWizardPage {

	private _view!: azdata.ModelView;
	private _igComponent!: azdata.TextComponent;
	private _detailsComponent!: azdata.TextComponent;
	private _chooseTargetComponent!: azdata.DivContainer;
	private _azureSubscriptionText!: azdata.TextComponent;
	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _resourceDropdownLabel!: azdata.TextComponent;
	private _resourceDropdown!: azdata.DropDownComponent;
	private _rbg!: azdata.RadioCardGroupComponent;
	private eventListener!: vscode.Disposable;
	private _rbgLoader!: azdata.LoadingComponent;

	private _supportedProducts: Product[] = [
		{
			type: MigrationTargetType.SQLMI,
			name: constants.SKU_RECOMMENDATION_MI_CARD_TEXT,
			icon: IconPathHelper.sqlMiLogo
		},
		{
			type: MigrationTargetType.SQLVM,
			name: constants.SKU_RECOMMENDATION_VM_CARD_TEXT,
			icon: IconPathHelper.sqlVmLogo
		}
	];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.SKU_RECOMMENDATION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView) {
		this._view = view;
		this._igComponent = this.createStatusComponent(view); // The first component giving basic information
		this._detailsComponent = this.createDetailsComponent(view); // The details of what can be moved
		this._chooseTargetComponent = this.createChooseTargetComponent(view);
		this._azureSubscriptionText = this.createAzureSubscriptionText(view);


		const managedInstanceSubscriptionDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();
		this._managedInstanceSubscriptionDropdown = view.modelBuilder.dropDown().withProps({
			editable: true
		}).component();
		this._managedInstanceSubscriptionDropdown.onValueChanged((e) => {
			if (e) {
				const selectedIndex = (<azdata.CategoryValue[]>this._managedInstanceSubscriptionDropdown.values)?.findIndex(v => v.displayName === e);
				this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(selectedIndex);
				this.migrationStateModel._targetServerInstance = undefined!;
				this.migrationStateModel._sqlMigrationService = undefined!;
				this.populateLocationAndResourceGroupDropdown();
			}
		});
		this._resourceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();

		const azureLocationLabel = view.modelBuilder.text().withProps({
			value: constants.LOCATION
		}).component();
		this._azureLocationDropdown = view.modelBuilder.dropDown().component();
		this._azureLocationDropdown.onValueChanged((e) => {
			if (e.selected) {
				this.migrationStateModel._location = this.migrationStateModel.getLocation(e.index);
				this.populateResourceInstanceDropdown();
			}
		});
		this._resourceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();


		const azureResourceGroupLabel = view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP
		}).component();
		this._azureResourceGroupDropdown = view.modelBuilder.dropDown().component();
		this._azureResourceGroupDropdown.onValueChanged((e) => {
			if (e.selected) {
				this.migrationStateModel._resourceGroup = this.migrationStateModel.getAzureResourceGroup(e.index);
				this.populateResourceInstanceDropdown();
			}
		});
		this._resourceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();

		this._resourceDropdown = view.modelBuilder.dropDown().component();
		this._resourceDropdown.onValueChanged((e) => {
			if (e.selected &&
				e.selected !== constants.NO_MANAGED_INSTANCE_FOUND &&
				e.selected !== constants.NO_VIRTUAL_MACHINE_FOUND) {
				this.migrationStateModel._sqlMigrationServices = undefined!;
				if (this._rbg.selectedCardId === MigrationTargetType.SQLVM) {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getVirtualMachine(e.index);
				} else {
					this.migrationStateModel._targetServerInstance = this.migrationStateModel.getManagedInstance(e.index);
				}
			}
		});

		const targetContainer = view.modelBuilder.flexContainer().withItems(
			[
				managedInstanceSubscriptionDropdownLabel,
				this._managedInstanceSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._resourceDropdownLabel,
				this._resourceDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();



		this._view = view;
		const formContainer = view.modelBuilder.formContainer().withFormItems(
			[
				{
					title: '',
					component: this._igComponent
				},
				{
					title: '',
					component: this._detailsComponent
				},
				{
					title: constants.SKU_RECOMMENDATION_CHOOSE_A_TARGET,
					component: this._chooseTargetComponent
				},
				{
					component: this._azureSubscriptionText
				},
				{
					component: targetContainer
				}
			]
		);
		await view.initializeModel(formContainer.component());
	}

	private createStatusComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '14px'
			}
		}).component();
		return component;
	}

	private createDetailsComponent(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text().component();
		return component;
	}

	private createChooseTargetComponent(view: azdata.ModelView): azdata.DivContainer {

		this._rbg = this._view!.modelBuilder.radioCardGroup().withProps({
			cards: [],
			cardWidth: '600px',
			cardHeight: '40px',
			orientation: azdata.Orientation.Vertical,
			iconHeight: '30px',
			iconWidth: '30px'
		}).component();

		this._supportedProducts.forEach((product) => {
			const descriptions: azdata.RadioCardDescription[] = [
				{
					textValue: product.name,
					textStyles: {
						'font-size': '14px',
						'font-weight': 'bold',
						'line-height': '20px'
					},
					linkDisplayValue: 'Learn more',
					linkStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
					displayLinkCodicon: true,
					linkCodiconStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
				},
				{
					textValue: '0 selected',
					textStyles: {
						'font-size': '13px',
						'line-height': '18px'
					},
					linkStyles: {
						'font-size': '14px',
						'line-height': '20px'
					},
					linkDisplayValue: 'View/Change',
					displayLinkCodicon: true,
					linkCodiconStyles: {
						'font-size': '13px',
						'line-height': '18px'
					}
				}
			];

			this._rbg.cards.push({
				id: product.type,
				icon: product.icon,
				descriptions
			});
		});
		let miDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE, this, MigrationTargetType.SQLMI);
		let vmDialog = new AssessmentResultsDialog('ownerUri', this.migrationStateModel, constants.ASSESSMENT_TILE, this, MigrationTargetType.SQLVM);

		this._rbg.onLinkClick(async (value) => {
			if (value.cardId === MigrationTargetType.SQLVM) {
				this._rbg.selectedCardId = MigrationTargetType.SQLVM;
				if (value.description.linkDisplayValue === 'View/Change') {
					await vmDialog.openDialog();
				} else if (value.description.linkDisplayValue === 'Learn more') {
					vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/azure/azure-sql/virtual-machines/windows/sql-server-on-azure-vm-iaas-what-is-overview'));
				}
			} else if (value.cardId === MigrationTargetType.SQLMI) {
				this._rbg.selectedCardId = MigrationTargetType.SQLMI;
				if (value.description.linkDisplayValue === 'View/Change') {
					await miDialog.openDialog();
				} else if (value.description.linkDisplayValue === 'Learn more') {
					vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/azure/azure-sql/managed-instance/sql-managed-instance-paas-overview '));
				}
			}
		});

		this._rbg.onSelectionChanged((value) => {
			this.changeTargetType(value.cardId);
		});

		this._rbg.selectedCardId = MigrationTargetType.SQLMI;

		this._rbgLoader = this._view.modelBuilder.loadingComponent().withItem(
			this._rbg
		).component();

		const component = view.modelBuilder.divContainer().withItems(
			[
				this._rbgLoader
			]
		).component();
		return component;
	}

	private changeTargetType(newTargetType: string) {
		if (newTargetType === MigrationTargetType.SQLMI) {
			this._azureSubscriptionText.value = constants.SELECT_AZURE_MI;
			this.migrationStateModel._migrationDbs = this.migrationStateModel._miDbs;
		} else {
			this._azureSubscriptionText.value = constants.SELECT_AZURE_VM;
			this.migrationStateModel._migrationDbs = this.migrationStateModel._vmDbs;
		}
		this.migrationStateModel.refreshDatabaseBackupPage = true;
		this.populateResourceInstanceDropdown();
	}

	private async constructDetails(): Promise<void> {
		const serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
		this._igComponent.value = constants.ASSESSMENT_COMPLETED(serverName);
		try {
			await this.migrationStateModel.getServerAssessments();
			this._detailsComponent.value = constants.SKU_RECOMMENDATION_ALL_SUCCESSFUL(this.migrationStateModel._assessmentResults.databaseAssessments.length);
		} catch (e) {
			console.log(e);
		}
		this.refreshCardText();
	}

	private createAzureSubscriptionText(view: azdata.ModelView): azdata.TextComponent {
		const component = view.modelBuilder.text().withProps({
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px'
			}
		}).component();

		return component;
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		if (!this.migrationStateModel._targetSubscription) {
			this._managedInstanceSubscriptionDropdown.loading = true;
			this._resourceDropdown.loading = true;
			try {
				this._managedInstanceSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
				this._managedInstanceSubscriptionDropdown.value = this._managedInstanceSubscriptionDropdown.values[0];
			} catch (e) {
				console.log(e);
			} finally {
				this._managedInstanceSubscriptionDropdown.loading = false;
			}
		}
	}

	public async populateLocationAndResourceGroupDropdown(): Promise<void> {
		this._azureResourceGroupDropdown.loading = true;
		this._azureLocationDropdown.loading = true;
		try {
			this._azureResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._targetSubscription);
			this._azureLocationDropdown.values = await this.migrationStateModel.getAzureLocationDropdownValues(this.migrationStateModel._targetSubscription);
		} catch (e) {
			console.log(e);
		} finally {
			this._azureResourceGroupDropdown.loading = false;
			this._azureLocationDropdown.loading = false;
		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		this._resourceDropdown.loading = true;
		try {
			if (this._rbg.selectedCardId === MigrationTargetType.SQLVM) {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				this._resourceDropdown.values = await this.migrationStateModel.getSqlVirtualMachineValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);

			} else {
				this._resourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				this._resourceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._resourceDropdown.loading = false;
		}
	}


	public async onPageEnter(): Promise<void> {
		this.constructDetails();
		this.populateSubscriptionDropdown();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			const errors: string[] = [];
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}
			if (this.migrationStateModel._migrationDbs.length === 0) {
				errors.push('Please select databases to migrate');

			}
			if ((<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value).displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
			}
			if ((<azdata.CategoryValue>this._azureLocationDropdown.value).displayName === constants.NO_LOCATION_FOUND) {
				errors.push(constants.INVALID_LOCATION_ERROR);
			}

			if ((<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value).displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
				errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
			}
			const resourceDropdownValue = (<azdata.CategoryValue>this._resourceDropdown.value).displayName;
			if (resourceDropdownValue === constants.NO_MANAGED_INSTANCE_FOUND) {
				errors.push(constants.NO_MANAGED_INSTANCE_FOUND);
			}
			else if (resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
				errors.push(constants.NO_VIRTUAL_MACHINE_FOUND);
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
		this.eventListener?.dispose();
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	public refreshDatabaseCount(selectedDbs: string[]): void {
		this.migrationStateModel._migrationDbs = selectedDbs;
		this.refreshCardText();
	}

	public refreshCardText(): void {
		this._rbgLoader.loading = true;
		this.wizard.message = {
			text: '',
			level: azdata.window.MessageLevel.Error
		};

		if (this._rbg.selectedCardId === MigrationTargetType.SQLMI) {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._miDbs;
		} else {
			this.migrationStateModel._migrationDbs = this.migrationStateModel._vmDbs;
		}


		if (this.migrationStateModel._assessmentResults) {
			const dbCount = this.migrationStateModel._assessmentResults.databaseAssessments.length;

			const dbWithoutIssuesCount = this.migrationStateModel._assessmentResults.databaseAssessments.filter(db => db.issues.length === 0).length;
			const miCardText = `${dbWithoutIssuesCount} out of ${dbCount} databases can be migrated (${this.migrationStateModel._miDbs.length} selected)`;
			this._rbg.cards[0].descriptions[1].textValue = miCardText;

			const vmCardText = `${dbCount} out of ${dbCount} databases can be migrated (${this.migrationStateModel._vmDbs.length} selected)`;
			this._rbg.cards[1].descriptions[1].textValue = vmCardText;

			this._rbg.updateProperties({
				cards: this._rbg.cards
			});
		} else {

			const miCardText = `${this.migrationStateModel._miDbs.length} selected`;
			this._rbg.cards[0].descriptions[1].textValue = miCardText;

			const vmCardText = `${this.migrationStateModel._vmDbs.length} selected`;
			this._rbg.cards[1].descriptions[1].textValue = vmCardText;

			this._rbg.updateProperties({
				cards: this._rbg.cards
			});
		}
		this._rbgLoader.loading = false;
	}
}


