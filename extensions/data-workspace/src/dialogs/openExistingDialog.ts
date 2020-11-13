/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DialogBase } from './dialogBase';
import * as constants from '../common/constants';
import { IWorkspaceService } from '../common/interfaces';
import { fileExist } from '../common/utils';
import { IconPathHelper } from '../common/iconHelper';

export class OpenExistingDialog extends DialogBase {
	public _projectFile: string = '';
	public _workspaceFile: string = '';
	public _targetTypeRadioCardGroup: azdata.RadioCardGroupComponent | undefined;
	public _filePathTextBox: azdata.InputBoxComponent | undefined;

	private _targetTypes = [
		{
			name: constants.Project,
			icon: {
				dark: this.extensionContext.asAbsolutePath('images/file_inverse.svg'),
				light: this.extensionContext.asAbsolutePath('images/file.svg')
			}
		}, {
			name: constants.Workspace,
			icon: {
				dark: this.extensionContext.asAbsolutePath('images/file_inverse.svg'), // temporary - still waiting for real icon from UX
				light: this.extensionContext.asAbsolutePath('images/file.svg')
			}
		}
	];

	constructor(private workspaceService: IWorkspaceService, private extensionContext: vscode.ExtensionContext) {
		super(constants.OpenExistingDialogTitle, 'OpenProject');
	}

	async validate(): Promise<boolean> {
		try {
			// the selected location should be an existing directory
			if (this._targetTypeRadioCardGroup?.selectedCardId === constants.Project) {
				const fileExists = await fileExist(this._projectFile);
				if (!fileExists) {
					this.showErrorMessage(constants.ProjectFileNotExistError(this._projectFile));
					return false;
				}
			} else if (this._targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				const fileExists = await fileExist(this._workspaceFile);
				if (!fileExists) {
					this.showErrorMessage(constants.WorkspaceFileNotExistError(this._workspaceFile));
					return false;
				}
			}

			return true;
		}
		catch (err) {
			this.showErrorMessage(err?.message ? err.message : err);
			return false;
		}
	}

	async onComplete(): Promise<void> {
		try {
			if (this._targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				await this.workspaceService.enterWorkspace(vscode.Uri.file(this._workspaceFile));
			} else {
				const validateWorkspace = await this.workspaceService.validateWorkspace();
				if (validateWorkspace) {
					await this.workspaceService.addProjectsToWorkspace([vscode.Uri.file(this._projectFile)]);
				}
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(err?.message ? err.message : err);
		}
	}

	protected async initialize(view: azdata.ModelView): Promise<void> {
		this._targetTypeRadioCardGroup = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
			cards: this._targetTypes.map((targetType) => {
				return <azdata.RadioCard>{
					id: targetType.name,
					label: targetType.name,
					icon: targetType.icon,
					descriptions: [
						{
							textValue: targetType.name,
							textStyles: {
								'font-size': '13px'
							}
						}
					]
				};
			}),
			iconHeight: '50px',
			iconWidth: '50px',
			cardWidth: '170px',
			cardHeight: '170px',
			ariaLabel: constants.TypeTitle,
			width: '500px',
			iconPosition: 'top',
			selectedCardId: constants.Project
		}).component();

		this._filePathTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.LocationSelectorTitle,
			placeHolder: constants.ProjectFilePlaceholder,
			required: true,
			width: constants.DefaultInputWidth
		}).component();
		this.register(this._filePathTextBox.onTextChanged(() => {
			this._projectFile = this._filePathTextBox!.value!;
			this._filePathTextBox!.updateProperty('title', this._projectFile);
		}));

		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.BrowseButtonText,
			iconPath: IconPathHelper.folder,
			width: '18px',
			height: '16px',
		}).component();
		this.register(browseFolderButton.onDidClick(async () => {
			if (this._targetTypeRadioCardGroup?.selectedCardId === constants.Project) {
				await this.projectBrowse();
			} else if (this._targetTypeRadioCardGroup?.selectedCardId === constants.Workspace) {
				await this.workspaceBrowse();
			}
		}));

		this.register(this._targetTypeRadioCardGroup.onSelectionChanged(({ cardId }) => {
			if (cardId === constants.Project) {
				this._filePathTextBox!.placeHolder = constants.ProjectFilePlaceholder;
			} else if (cardId === constants.Workspace) {
				this._filePathTextBox!.placeHolder = constants.WorkspacePlaceholder;
			}

			// clear selected file textbox
			this._filePathTextBox!.value = '';
		}));

		const form = view.modelBuilder.formContainer().withFormItems([
			{
				title: constants.TypeTitle,
				required: true,
				component: this._targetTypeRadioCardGroup,
			}, {
				title: constants.LocationSelectorTitle,
				required: true,
				component: this.createHorizontalContainer(view, [this._filePathTextBox, browseFolderButton])
			}
		]).component();
		await view.initializeModel(form);
		this.initDialogComplete?.resolve();
	}

	public async workspaceBrowse(): Promise<void> {
		const filters: { [name: string]: string[] } = { [constants.Workspace]: [constants.WorkspaceFileExtension] };
		const fileUris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: constants.SelectProjectFileActionName,
			filters: filters
		});

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		const workspaceFilePath = fileUris[0].fsPath;
		this._filePathTextBox!.value = workspaceFilePath;
		this._workspaceFile = workspaceFilePath;
	}

	public async projectBrowse(): Promise<void> {
		const filters: { [name: string]: string[] } = {};
		const projectTypes = await this.workspaceService.getAllProjectTypes();
		filters[constants.AllProjectTypes] = projectTypes.map(type => type.projectFileExtension);
		projectTypes.forEach(type => {
			filters[type.displayName] = [type.projectFileExtension];
		});

		const fileUris = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			openLabel: constants.SelectProjectFileActionName,
			filters: filters
		});

		if (!fileUris || fileUris.length === 0) {
			return;
		}

		const projectFilePath = fileUris[0].fsPath;
		this._filePathTextBox!.value = projectFilePath;
		this._projectFile = projectFilePath;
	}
}
