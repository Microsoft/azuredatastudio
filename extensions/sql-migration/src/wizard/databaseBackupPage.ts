/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azureResource';
import { getAvailableStorageAccounts, getBlobContainers, getFileShares, getSubscriptions, StorageAccount, Subscription } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { BlobContainer, FileShare, MigrationCutover, MigrationStateModel, NetworkContainerType, NetworkShare, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class DatabaseBackupPage extends MigrationWizardPage {

	private _networkShareContainer!: azdata.FlexContainer;
	private _networkShareContainerSubscriptionDropdown!: azdata.DropDownComponent;
	private _networkShareContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _networkShareLocationText!: azdata.InputBoxComponent;
	private _windowsUserAccountText!: azdata.InputBoxComponent;
	private _passwordText!: azdata.InputBoxComponent;

	private _blobContainer!: azdata.FlexContainer;
	private _blobContainerSubscriptionDropdown!: azdata.DropDownComponent;
	private _blobContainerStorageAccountDropdown!: azdata.DropDownComponent;
	private _blobContainerBlobDropdown!: azdata.DropDownComponent;

	private _fileShareContainer!: azdata.FlexContainer;
	private _fileShareSubscriptionDropdown!: azdata.DropDownComponent;
	private _fileShareStorageAccountDropdown!: azdata.DropDownComponent;
	private _fileShareFileShareDropdown!: azdata.DropDownComponent;

	private _networkShare = {} as NetworkShare;
	private _fileShare = {} as FileShare;
	private _blob = {} as BlobContainer;

	private _subscriptionDropdownValues: azdata.CategoryValue[] = [];
	private _subscriptionMap: Map<string, Subscription> = new Map();
	private _storageAccountMap: Map<string, StorageAccount> = new Map();

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.DATABASE_BACKUP_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.DATABASE_BACKUP_PAGE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {

		this._networkShareContainer = this.createNetworkShareContainer(view);
		this._blobContainer = this.createBlobContainer(view);
		this._fileShareContainer = this.createFileShareContainer(view);

		const networkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			this._networkShareContainer,
			this._blobContainer,
			this._fileShareContainer
		]).component();

		const form = view.modelBuilder.formContainer().withFormItems(
			[
				this.createBackupLocationComponent(view),
				{
					title: '',
					component: networkContainer
				},
				this.migrationCutoverContainer(view),
				this.emailNotificationContainer(view),
			]
		);
		await view.initializeModel(form.component());
		this.toggleNetworkContainerFields(NetworkContainerType.NETWORK_SHARE, this._networkShare);
		return;
	}

	private createBackupLocationComponent(view: azdata.ModelView): azdata.FormComponent {
		const buttonGroup = 'networkContainer';

		const networkShareButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_RADIO_LABEL,
			checked: true
		}).component();

		networkShareButton.onDidClick((e) => this.toggleNetworkContainerFields(NetworkContainerType.NETWORK_SHARE, this._networkShare));

		const blobContainerButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_BLOB_STORAGE_RADIO_LABEL,
		}).component();

		blobContainerButton.onDidClick((e) => this.toggleNetworkContainerFields(NetworkContainerType.BLOB_CONTAINER, this._blob));

		const fileShareButton = view.modelBuilder.radioButton().withProps({
			name: buttonGroup,
			label: constants.DATABASE_BACKUP_NC_FILE_SHARE_RADIO_LABEL,
		}).component();

		fileShareButton.onDidClick((e) => this.toggleNetworkContainerFields(NetworkContainerType.FILE_SHARE, this._fileShare));

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareButton,
				blobContainerButton,
				fileShareButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: '',
			component: flexContainer
		};
	}

	private createFileShareContainer(view: azdata.ModelView): azdata.FlexContainer {

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareSubscriptionDropdown = view.modelBuilder.dropDown().withProps({
			required: true,
		}).component();
		this._fileShareSubscriptionDropdown.onValueChanged(async (value) => {
			this._fileShare.subscriptionId = (this._fileShareSubscriptionDropdown.value as azdata.CategoryValue).name;
			await this.loadFileShareStorageDropdown();
		});

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareStorageAccountDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._fileShareStorageAccountDropdown.onValueChanged(async (value) => {
			this._fileShare.storageAccountId = (this._fileShareStorageAccountDropdown.value as azdata.CategoryValue).name;
			await this.loadFileShareDropdown();
		});

		const fileShareLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_FILE_SHARE_LABEL,
			requiredIndicator: true,
		}).component();
		this._fileShareFileShareDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._fileShareFileShareDropdown.onValueChanged((value) => {
			this._fileShare.fileShareId = (this._fileShareFileShareDropdown.value as azdata.CategoryValue).name;
		});


		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				subscriptionLabel,
				this._fileShareSubscriptionDropdown,
				storageAccountLabel,
				this._fileShareStorageAccountDropdown,
				fileShareLabel,
				this._fileShareFileShareDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private createBlobContainer(view: azdata.ModelView): azdata.FlexContainer {
		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._blobContainerSubscriptionDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._blobContainerSubscriptionDropdown.onValueChanged(async (value) => {
			this._blob.subscriptionId = (this._blobContainerSubscriptionDropdown.value as azdata.CategoryValue).name;
			await this.loadblobStorageDropdown();
		});

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		this._blobContainerStorageAccountDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._blobContainerStorageAccountDropdown.onValueChanged(async (value) => {
			this._blob.storageAccountId = (this._blobContainerStorageAccountDropdown.value as azdata.CategoryValue).name;
			await this.loadBlobContainerDropdown();
		});

		const containerLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_BLOB_STORAGE_ACCOUNT_CONTAINER_LABEL,
			requiredIndicator: true,
		}).component();
		this._blobContainerBlobDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._blobContainerBlobDropdown.onValueChanged((value) => {
			this._blob.containerId = (this._blobContainerBlobDropdown.value as azdata.CategoryValue).name;
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				subscriptionLabel,
				this._blobContainerSubscriptionDropdown,
				storageAccountLabel,
				this._blobContainerStorageAccountDropdown,
				containerLabel,
				this._blobContainerBlobDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private createNetworkShareContainer(view: azdata.ModelView): azdata.FlexContainer {
		const networkShareHelpText = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NC_NETWORK_SHARE_HELP_TEXT,
		}).component();

		const networkShareLocationLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_LOCATION_LABEL,
			requiredIndicator: true,
		}).component();
		this._networkShareLocationText = view.modelBuilder.inputBox().withProps({
			placeHolder: '\\\\Servername.domainname.com\\Backupfolder',
			required: true
		}).withValidation((component) => {
			if (component.value) {
				if (!/^(\\)(\\[\w\.-_]+){2,}(\\?)$/.test(component.value)) {
					return false;
				}
			}
			return true;
		}).component();
		this._networkShareLocationText.onTextChanged((value) => {
			this._networkShare.networkShareLocation = value;
		});

		const windowsUserAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_WINDOWS_USER_LABEL,
			requiredIndicator: true,
		}).component();
		this._windowsUserAccountText = view.modelBuilder.inputBox().withProps({
			placeHolder: 'Domain\\username',
			required: true
		}).withValidation((component) => {
			if (component.value) {
				if (!/^[a-zA-Z][a-zA-Z0-9\-\.]{0,61}[a-zA-Z]\\\w[\w\.\- ]*$/.test(component.value)) {
					return false;
				}
			}
			return true;
		}).component();
		this._windowsUserAccountText.onTextChanged((value) => {
			this._networkShare.windowsUser = value;
		});

		const passwordLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_LABEL,
			requiredIndicator: true,
		}).component();
		this._passwordText = view.modelBuilder.inputBox().withProps({
			placeHolder: constants.DATABASE_BACKUP_NETWORK_SHARE_PASSWORD_PLACEHOLDER,
			inputType: 'password',
			required: true
		}).component();
		this._passwordText.onTextChanged((value) => {
			this._networkShare.password = value;
		});

		const azureAccountHelpText = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_AZURE_ACCOUNT_HELP,
		}).component();

		const subscriptionLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_SUBSCRIPTION_LABEL,
			requiredIndicator: true,
		}).component();
		this._networkShareContainerSubscriptionDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._networkShareContainerSubscriptionDropdown.onValueChanged(async (value) => {
			this._networkShare.storageSubscriptionId = (this._networkShareContainerSubscriptionDropdown.value as azdata.CategoryValue).name;
			await this.loadNetworkShareStorageDropdown();
		});

		const storageAccountLabel = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_NETWORK_SHARE_NETWORK_STORAGE_ACCOUNT_LABEL,
			requiredIndicator: true,
		}).component();
		this._networkShareContainerStorageAccountDropdown = view.modelBuilder.dropDown().withProps({
			required: true
		}).component();
		this._networkShareContainerStorageAccountDropdown.onValueChanged((value) => {
			this._networkShare.storageAccountId = (this._networkShareContainerStorageAccountDropdown.value as azdata.CategoryValue).name;
		});

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				networkShareHelpText,
				networkShareLocationLabel,
				this._networkShareLocationText,
				windowsUserAccountLabel,
				this._windowsUserAccountText,
				passwordLabel,
				this._passwordText,
				azureAccountHelpText,
				subscriptionLabel,
				this._networkShareContainerSubscriptionDropdown,
				storageAccountLabel,
				this._networkShareContainerStorageAccountDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return flexContainer;
	}

	private emailNotificationContainer(view: azdata.ModelView): azdata.FormComponent {
		const emailCheckbox = view.modelBuilder.checkBox().withProps({
			label: constants.DATABASE_BACKUP_EMAIL_NOTIFICATION_CHECKBOX_LABEL
		}).component();

		emailCheckbox.onChanged((value) => this.migrationStateModel.databaseBackup.emailNotification = value);

		return {
			title: constants.DATABASE_BACKUP_EMAIL_NOTIFICATION_LABEL,
			component: emailCheckbox
		};
	}

	private migrationCutoverContainer(view: azdata.ModelView): azdata.FormComponent {
		const description = view.modelBuilder.text().withProps({
			value: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_DESCRIPTION
		}).component();

		const buttonGroup = 'cutoverContainer';

		const automaticButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_AUTOMATIC_LABEL,
			name: buttonGroup,
			checked: true
		}).component();

		this.migrationStateModel.databaseBackup.migrationCutover = MigrationCutover.AUTOMATIC;

		automaticButton.onDidClick((e) => this.migrationStateModel.databaseBackup.migrationCutover = MigrationCutover.AUTOMATIC);

		const manualButton = view.modelBuilder.radioButton().withProps({
			label: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_MANUAL_LABEL,
			name: buttonGroup
		}).component();

		manualButton.onDidClick((e) => this.migrationStateModel.databaseBackup.migrationCutover = MigrationCutover.MANUAL);

		const flexContainer = view.modelBuilder.flexContainer().withItems(
			[
				description,
				automaticButton,
				manualButton
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		return {
			title: constants.DATABASE_BACKUP_MIGRATION_CUTOVER_LABEL,
			component: flexContainer
		};
	}

	public async onPageEnter(): Promise<void> {
		await this.getSubscriptionValues();
		this.wizard.registerNavigationValidator((pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			return true;
		});
		return Promise.resolve();
	}

	public onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			return true;
		});

		return Promise.resolve();
	}

	protected handleStateChange(e: StateChangeEvent): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private toggleNetworkContainerFields(containerType: NetworkContainerType, networkContainer: NetworkShare | BlobContainer | FileShare) {
		this.migrationStateModel.databaseBackup.networkContainer = networkContainer;
		this.migrationStateModel.databaseBackup.networkContainerType = containerType;
		this._fileShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.FILE_SHARE) ? 'inline' : 'none' });
		this._blobContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.BLOB_CONTAINER) ? 'inline' : 'none' });
		this._networkShareContainer.updateCssStyles({ 'display': (containerType === NetworkContainerType.NETWORK_SHARE) ? 'inline' : 'none' });
		this._networkShareLocationText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._windowsUserAccountText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
		this._passwordText.updateProperties({
			required: containerType === NetworkContainerType.NETWORK_SHARE
		});
	}

	private async getSubscriptionValues() {
		this._networkShareContainerSubscriptionDropdown.loading = true;
		this._fileShareSubscriptionDropdown.loading = true;
		this._blobContainerSubscriptionDropdown.loading = true;

		let subscriptions: azureResource.AzureResourceSubscription[] = [];

		try {
			subscriptions = await getSubscriptions(this.migrationStateModel.azureAccount);
		} catch (error) {
			console.log(error);
		}

		subscriptions.forEach((subscription) => {
			this._subscriptionMap.set(subscription.id, subscription);
			this._subscriptionDropdownValues.push({
				name: subscription.id,
				displayName: subscription.name + ' - ' + subscription.id,
			});
		});

		if (!this._subscriptionDropdownValues) {
			this._subscriptionDropdownValues = [
				{
					displayName: constants.NO_SUBSCRIPTIONS_FOUND,
					name: ''
				}
			];
		}

		this._fileShareSubscriptionDropdown.values = this._subscriptionDropdownValues;
		this._networkShareContainerSubscriptionDropdown.values = this._subscriptionDropdownValues;
		this._blobContainerSubscriptionDropdown.values = this._subscriptionDropdownValues;

		this._networkShareContainerSubscriptionDropdown.loading = false;
		this._fileShareSubscriptionDropdown.loading = false;
		this._blobContainerSubscriptionDropdown.loading = false;

		this._networkShare.storageSubscriptionId = this._subscriptionDropdownValues[0].name;
		this._fileShare.subscriptionId = this._subscriptionDropdownValues[0].name;
		this._blob.subscriptionId = this._subscriptionDropdownValues[0].name;

		await this.loadNetworkShareStorageDropdown();
		await this.loadFileShareStorageDropdown();
		await this.loadblobStorageDropdown();
	}

	private async loadNetworkShareStorageDropdown() {
		this._networkShareContainerStorageAccountDropdown.loading = true;

		const subscriptionId = (<azdata.CategoryValue>this._networkShareContainerSubscriptionDropdown.value).name;
		if (!subscriptionId.length) {
			this.setEmptyDropdownPlaceHolder(this._networkShareContainerStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
		} else {
			const storageAccounts = await this.loadStorageAccounts(this._networkShare.storageSubscriptionId);

			if (storageAccounts && storageAccounts.length) {
				this._networkShareContainerStorageAccountDropdown.values = storageAccounts.map(s => <azdata.CategoryValue>{ name: s.id, displayName: s.name });
				this._networkShare.storageAccountId = storageAccounts[0].id;
			}
			else {
				this.setEmptyDropdownPlaceHolder(this._networkShareContainerStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
			}
		}
		this._networkShareContainerStorageAccountDropdown.loading = false;
	}

	private async loadFileShareStorageDropdown() {
		this._fileShareStorageAccountDropdown.loading = true;
		this._fileShareFileShareDropdown.loading = true;

		const subscriptionId = (<azdata.CategoryValue>this._fileShareSubscriptionDropdown.value).name;
		if (!subscriptionId.length) {
			this.setEmptyDropdownPlaceHolder(this._fileShareStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
		} else {
			const storageAccounts = await this.loadStorageAccounts(this._fileShare.subscriptionId);
			if (storageAccounts && storageAccounts.length) {
				this._fileShareStorageAccountDropdown.values = storageAccounts.map(s => <azdata.CategoryValue>{ name: s.id, displayName: s.name });
				this._fileShare.storageAccountId = storageAccounts[0].id;
			}
			else {
				this.setEmptyDropdownPlaceHolder(this._fileShareStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
				this._fileShareStorageAccountDropdown.loading = false;
			}
		}
		this._fileShareStorageAccountDropdown.loading = false;
		await this.loadFileShareDropdown();
	}

	private async loadblobStorageDropdown() {
		this._blobContainerStorageAccountDropdown.loading = true;
		this._blobContainerBlobDropdown.loading = true;

		const subscriptionId = (<azdata.CategoryValue>this._blobContainerSubscriptionDropdown.value).name;
		if (!subscriptionId.length) {
			this.setEmptyDropdownPlaceHolder(this._blobContainerStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
		} else {
			const storageAccounts = await this.loadStorageAccounts(this._blob.subscriptionId);
			if (storageAccounts.length) {
				this._blobContainerStorageAccountDropdown.values = storageAccounts.map(s => <azdata.CategoryValue>{ name: s.id, displayName: s.name });
				this._blob.storageAccountId = storageAccounts[0].id;
			} else {
				this.setEmptyDropdownPlaceHolder(this._blobContainerStorageAccountDropdown, constants.NO_STORAGE_ACCOUNT_FOUND);
			}
		}
		this._blobContainerStorageAccountDropdown.loading = false;
		await this.loadBlobContainerDropdown();
	}

	private async loadStorageAccounts(subscriptionId: string) {
		const storageAccounts = await getAvailableStorageAccounts(this.migrationStateModel.azureAccount, this._subscriptionMap.get(subscriptionId)!);
		storageAccounts.forEach(s => {
			this._storageAccountMap.set(s.id, s);
		});
		return storageAccounts;
	}

	private async loadFileShareDropdown() {
		this._fileShareFileShareDropdown.loading = true;
		const storageAccountId = (<azdata.CategoryValue>this._fileShareStorageAccountDropdown.value).name;
		if (!storageAccountId.length) {
			this.setEmptyDropdownPlaceHolder(this._fileShareFileShareDropdown, constants.NO_FILESHARES_FOUND);
		} else {
			const fileShares = await getFileShares(this.migrationStateModel.azureAccount, this._subscriptionMap.get(this._fileShare.subscriptionId)!, this._storageAccountMap.get(storageAccountId)!);
			if (fileShares && fileShares.length) {
				this._fileShareFileShareDropdown.values = fileShares.map(f => <azdata.CategoryValue>{ name: f.id, displayName: f.name });
				this._fileShare.fileShareId = fileShares[0].id;
			} else {
				this.setEmptyDropdownPlaceHolder(this._fileShareFileShareDropdown, constants.NO_FILESHARES_FOUND);
			}
		}
		this._fileShareFileShareDropdown.loading = false;
	}

	private async loadBlobContainerDropdown() {
		this._blobContainerBlobDropdown.loading = true;
		const storageAccountId = (<azdata.CategoryValue>this._blobContainerStorageAccountDropdown.value).name;
		if (!storageAccountId.length) {
			this.setEmptyDropdownPlaceHolder(this._blobContainerBlobDropdown, constants.NO_BLOBCONTAINERS_FOUND);
		} else {
			const blobContainer = await getBlobContainers(this.migrationStateModel.azureAccount, this._subscriptionMap.get(this._blob.subscriptionId)!, this._storageAccountMap.get(storageAccountId)!);
			if (blobContainer && blobContainer.length) {
				this._blobContainerBlobDropdown.values = blobContainer.map(f => <azdata.CategoryValue>{ name: f.id, displayName: f.name });
				this._blob.containerId = blobContainer[0].id;
			} else {
				this.setEmptyDropdownPlaceHolder(this._blobContainerBlobDropdown, constants.NO_BLOBCONTAINERS_FOUND);
			}
		}
		this._blobContainerBlobDropdown.loading = false;
	}

	private setEmptyDropdownPlaceHolder(dropDown: azdata.DropDownComponent, placeholder: string) {
		dropDown.values = [{
			displayName: placeholder,
			name: ''
		}];
	}
}
