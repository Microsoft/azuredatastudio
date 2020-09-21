/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';
import * as path from 'path';
import * as newProjectTool from '../tools/newProjectTool';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage, getSqlProjectFilesInFolder } from '../common/utils';
import { ProjectsController } from './projectController';
import { NetCoreTool } from '../tools/netcoreTool';
import { Project } from '../models/project';
import { IconPathHelper } from '../common/iconHelper';
import { IProjectProvider, WorkspaceTreeItem } from 'dataworkspace';
import { SqlDatabaseProjectProvider } from '../projectProvider/projectProvider';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;

	public constructor(private context: vscode.ExtensionContext) {
		this.projectsController = new ProjectsController(this.dbProjectTreeViewProvider);
		this.netcoreTool = new NetCoreTool();
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.context;
	}

	public get projController(): ProjectsController {
		return this.projectsController;
	}

	public deactivate(): void {
	}

	public async activate(): Promise<IProjectProvider> {
		await this.initializeDatabaseProjects();
		return new SqlDatabaseProjectProvider();
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		vscode.commands.registerCommand('sqlDatabaseProjects.new', async () => { await this.createNewProject(); });
		vscode.commands.registerCommand('sqlDatabaseProjects.open', async () => { await this.openProjectFromFile(); });
		vscode.commands.registerCommand('sqlDatabaseProjects.close', (node: WorkspaceTreeItem) => { this.projectsController.closeProject(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.properties', async (node: WorkspaceTreeItem) => { await vscode.window.showErrorMessage(`Properties not yet implemented: ${node.element.uri.path}`); }); // TODO

		vscode.commands.registerCommand('sqlDatabaseProjects.build', async (node: WorkspaceTreeItem) => { await this.projectsController.buildProject(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.publish', async (node: WorkspaceTreeItem) => { await this.projectsController.publishProject(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.schemaCompare', async (node: WorkspaceTreeItem) => { await this.projectsController.schemaCompare(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.importDatabase', async (profile: azdata.IConnectionProfile) => { await this.projectsController.importNewDatabaseProject(profile); });

		vscode.commands.registerCommand('sqlDatabaseProjects.newScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.script); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newPreDeploymentScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.preDeployScript); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newPostDeploymentScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.postDeployScript); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newTable', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.table); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newView', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.view); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element, templates.storedProcedure); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newItem', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newFolder', async (node: WorkspaceTreeItem) => { await this.projectsController.addFolderPrompt(node.element); });

		vscode.commands.registerCommand('sqlDatabaseProjects.addDatabaseReference', async (node: WorkspaceTreeItem) => { await this.projectsController.addDatabaseReference(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.openContainingFolder', async (node: WorkspaceTreeItem) => { await this.projectsController.openContainingFolder(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.editProjectFile', async (node: WorkspaceTreeItem) => { await this.projectsController.editProjectFile(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.delete', async (node: WorkspaceTreeItem) => { await this.projectsController.delete(node.element); });
		vscode.commands.registerCommand('sqlDatabaseProjects.exclude', async (node: WorkspaceTreeItem) => { await this.projectsController.exclude(node.element); });

		IconPathHelper.setExtensionContext(this.extensionContext);

		// init view
		const treeView = vscode.window.createTreeView(SQL_DATABASE_PROJECTS_VIEW_ID, {
			treeDataProvider: this.dbProjectTreeViewProvider,
			showCollapseAll: true
		});
		this.dbProjectTreeViewProvider.setTreeView(treeView);

		this.extensionContext.subscriptions.push(treeView);

		await templates.loadTemplates(path.join(this.context.extensionPath, 'resources', 'templates'));

		// ensure .net core is installed
		await this.netcoreTool.findOrInstallNetCore();

		// set the user settings around saving new projects to default value
		await newProjectTool.initializeSaveLocationSetting();

		// load any sql projects that are open in workspace folder
		await this.loadProjectsInWorkspace();
	}

	public async loadProjectsInWorkspace(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders?.length) {
			await Promise.all(workspaceFolders.map(async (workspaceFolder) => {
				await this.loadProjectsInFolder(workspaceFolder.uri.fsPath);
			}));
		}
	}

	public async loadProjectsInFolder(folderPath: string): Promise<void> {
		const results = await getSqlProjectFilesInFolder(folderPath);

		for (let f in results) {
			// open the project, but don't switch focus to the file explorer viewlet
			await this.projectsController.openProject(vscode.Uri.file(results[f]), false);
		}
	}

	/**
	 * Prompts the user to select a .sqlproj file to open
	 * TODO: define behavior once projects are automatically opened from workspace
	 */
	public async openProjectFromFile(): Promise<void> {
		try {
			let filter: { [key: string]: string[] } = {};

			filter[constants.sqlDatabaseProject] = ['sqlproj'];

			let files: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({ filters: filter });

			if (files) {
				for (const file of files) {
					await this.projectsController.openProject(file);
				}
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	/**
	 * Creates a new SQL database project from a template, prompting the user for a name and location
	 */
	public async createNewProject(): Promise<Project | undefined> {
		try {
			let newProjName = await vscode.window.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: newProjectTool.defaultProjectNameNewProj()
			});

			newProjName = newProjName?.trim();

			if (!newProjName) {
				// TODO: is this case considered an intentional cancellation (shouldn't warn) or an error case (should warn)?
				vscode.window.showErrorMessage(constants.projectNameRequired);
				return undefined;
			}

			let selectionResult = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: newProjectTool.defaultProjectSaveLocation()
			});

			if (!selectionResult) {
				vscode.window.showErrorMessage(constants.projectLocationRequired);
				return undefined;
			}

			// TODO: what if the selected folder is outside the workspace?

			const newProjFolderUri = (selectionResult as vscode.Uri[])[0];
			const newProjFilePath = await this.projectsController.createNewProject(<string>newProjName, newProjFolderUri, true);
			const proj = await this.projectsController.openProject(vscode.Uri.file(newProjFilePath));

			newProjectTool.updateSaveLocationSetting();

			return proj;
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
			return undefined;
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
