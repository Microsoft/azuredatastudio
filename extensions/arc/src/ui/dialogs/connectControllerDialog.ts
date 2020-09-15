/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo } from 'arc';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import { v4 as uuid } from 'uuid';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { ControllerModel } from '../../models/controllerModel';
import { InitializingComponent } from '../components/initializingComponent';
import { AzureArcTreeDataProvider } from '../tree/azureArcTreeDataProvider';
import { getErrorMessage } from '../../common/utils';

export type ConnectToControllerDialogModel = { controllerModel: ControllerModel, password: string };
abstract class ControllerDialogBase extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;
	protected dialog: azdata.window.Dialog;

	protected urlInputBox!: azdata.InputBoxComponent;
	protected nameInputBox!: azdata.InputBoxComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;

	protected getComponents(): (azdata.FormComponent<azdata.Component> & { layout?: azdata.FormItemLayout | undefined; })[] {
		return [
			{
				component: this.urlInputBox,
				title: loc.controllerUrl,
				required: true
			}, {
				component: this.nameInputBox,
				title: loc.controllerName,
				required: false
			}, {
				component: this.usernameInputBox,
				title: loc.username,
				required: true
			}, {
				component: this.passwordInputBox,
				title: loc.password,
				required: true
			}
		];
	}

	protected abstract fieldToFocusOn(): azdata.Component;
	protected readonlyFields(): azdata.InputBoxComponent[] { return []; }

	protected initializeFields(controllerInfo: ControllerInfo | undefined, password: string | undefined) {
		this.urlInputBox = this.modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: controllerInfo?.url,
				// If we have a model then we're editing an existing connection so don't let them modify the URL
				readOnly: !!controllerInfo
			}).component();
		this.nameInputBox = this.modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: controllerInfo?.name
			}).component();
		this.usernameInputBox = this.modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				value: controllerInfo?.username
			}).component();
		this.passwordInputBox = this.modelBuilder.inputBox()
			.withProperties<azdata.InputBoxProperties>({
				inputType: 'password',
				value: password
			}).component();
	}

	protected _completionPromise = new Deferred<ConnectToControllerDialogModel | undefined>();
	protected _id!: string;

	constructor(protected _treeDataProvider: AzureArcTreeDataProvider, title: string) {
		super();
		this.dialog = azdata.window.createModelViewDialog(title);
	}

	public showDialog(controllerInfo?: ControllerInfo, password?: string): azdata.window.Dialog {
		this._id = controllerInfo?.id ?? uuid();
		this.dialog.cancelButton.onClick(() => this.handleCancel());
		this.dialog.registerContent(async (view) => {
			this.modelBuilder = view.modelBuilder;
			this.initializeFields(controllerInfo, password);

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: this.getComponents(),
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			await this.fieldToFocusOn().focus();
			this.readonlyFields().forEach(f => f.readOnly = true);
			this.initialized = true;
		});

		this.dialog.registerCloseValidator(async () => await this.validate());
		this.dialog.okButton.label = loc.connect;
		this.dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(this.dialog);
		return this.dialog;
	}

	public abstract async validate(): Promise<boolean>;

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<ConnectToControllerDialogModel | undefined> {
		return this._completionPromise.promise;
	}
}

export class ConnectToControllerDialog extends ControllerDialogBase {
	protected rememberPwCheckBox!: azdata.CheckBoxComponent;

	protected fieldToFocusOn = () => this.urlInputBox;

	protected getComponents() {
		return [
			...super.getComponents(),
			{
				component: this.rememberPwCheckBox,
				title: ''
			}];
	}

	protected initializeFields(controllerInfo: ControllerInfo | undefined, password: string | undefined) {
		super.initializeFields(controllerInfo, password);
		this.rememberPwCheckBox = this.modelBuilder.checkBox()
			.withProperties<azdata.CheckBoxProperties>({
				label: loc.rememberPassword,
				checked: controllerInfo?.rememberPassword
			}).component();
	}

	constructor(protected _treeDataProvider: AzureArcTreeDataProvider) {
		super(_treeDataProvider, loc.connectToController);
	}

	public async validate(): Promise<boolean> {
		if (!this.urlInputBox.value || !this.usernameInputBox.value || !this.passwordInputBox.value) {
			return false;
		}
		let url = this.urlInputBox.value;
		// Only support https connections
		if (url.toLowerCase().startsWith('http://')) {
			url = url.replace('http', 'https');
		}
		// Append https if they didn't type it in
		if (!url.toLowerCase().startsWith('https://')) {
			url = `https://${url}`;
		}
		// Append default port if one wasn't specified
		if (!/.*:\d*$/.test(url)) {
			url = `${url}:30080`;
		}
		const controllerInfo: ControllerInfo = {
			id: this._id,
			url: url,
			name: this.nameInputBox.value ?? '',
			username: this.usernameInputBox.value,
			rememberPassword: this.rememberPwCheckBox.checked ?? false,
			resources: []
		};
		const controllerModel = new ControllerModel(this._treeDataProvider, controllerInfo, this.passwordInputBox.value);
		try {
			// Validate that we can connect to the controller, this also populates the controllerRegistration from the connection response.
			await controllerModel.refresh(false);
			// default info.name to the name of the controller instance if the user did not specify their own and to a pre-canned default if for some weird reason controller endpoint returned instanceName is also not a valid value
			controllerModel.info.name = controllerModel.info.name || controllerModel.controllerConfig?.metadata.name || loc.defaultControllerName;
		} catch (err) {
			this.dialog.message = {
				text: loc.connectToControllerFailed(this.urlInputBox.value, err),
				level: azdata.window.MessageLevel.Error
			};
			return false;
		}
		this._completionPromise.resolve({ controllerModel: controllerModel, password: this.passwordInputBox.value });
		return true;
	}
}
export class PasswordToControllerDialog extends ControllerDialogBase {

	constructor(protected _treeDataProvider: AzureArcTreeDataProvider) {
		super(_treeDataProvider, loc.passwordToController);
	}

	protected fieldToFocusOn = () => this.passwordInputBox;
	protected readonlyFields = () => [
		this.urlInputBox,
		this.nameInputBox,
		this.usernameInputBox
	];

	public async validate(): Promise<boolean> {
		if (!this.passwordInputBox.value) {
			return false;
		}
		const azdataApi = <azdataExt.IExtension>vscode.extensions.getExtension(azdataExt.extension.name)?.exports;
		try {
			await azdataApi.azdata.login(this.urlInputBox.value!, this.usernameInputBox.value!, this.passwordInputBox.value);
		} catch (e) {
			if (getErrorMessage(e).match(/Wrong username or password/i)) {
				this.dialog.message = {
					text: loc.invalidPassword,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			} else {
				this.dialog.message = {
					text: loc.errorVerifyingPassword(e),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
		}
		const controllerInfo: ControllerInfo = {
			id: this._id,
			url: this.urlInputBox.value!,
			name: this.nameInputBox.value!,
			username: this.usernameInputBox.value!,
			rememberPassword: false,
			resources: []
		};
		const controllerModel = new ControllerModel(this._treeDataProvider, controllerInfo, this.passwordInputBox.value);
		this._completionPromise.resolve({ controllerModel: controllerModel, password: this.passwordInputBox.value });
		return true;
	}

	public showDialog(controllerInfo?: ControllerInfo, password?: string): azdata.window.Dialog {
		const dialog = super.showDialog(controllerInfo, password);
		dialog.okButton.label = loc.ok;
		return dialog;
	}
}
