/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { WorkspaceTreeDataProvider } from './common/workspaceTreeDataProvider';
import { WorkspaceService } from './services/workspaceService';
import { WorkspaceTreeItem, IExtension } from 'dataworkspace';
import { DataWorkspaceExtension } from './common/dataWorkspaceExtension';
import { NewProjectDialog } from './dialogs/newProjectDialog';
import { OpenExistingDialog } from './dialogs/openExistingDialog';
import { IWorkspaceService } from './common/interfaces';
import { IconPathHelper } from './common/iconHelper';
import { ProjectDashboard } from './dialogs/projectDashboard';

export async function activate(context: vscode.ExtensionContext): Promise<IExtension> {
	const workspaceService = new WorkspaceService(context);
	await workspaceService.loadTempProjects();

	// this isn't awaited because if the notification shows, the rest of this activate function will be blocked from running and
	// the contributed commands won't be registered until the notifation gets dismissed
	workspaceService.checkForProjectsNotAddedToWorkspace();
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
		workspaceService.checkForProjectsNotAddedToWorkspace();
	}));

	const workspaceTreeDataProvider = new WorkspaceTreeDataProvider(workspaceService);
	const dataWorkspaceExtension = new DataWorkspaceExtension(workspaceService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('dataworkspace.views.main', workspaceTreeDataProvider));
	context.subscriptions.push(vscode.extensions.onDidChange(() => {
		setProjectProviderContextValue(workspaceService);
	}));
	setProjectProviderContextValue(workspaceService);

	context.subscriptions.push(vscode.commands.registerCommand('projects.new', async () => {
		const dialog = new NewProjectDialog(workspaceService);
		await dialog.open();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('projects.openExisting', async () => {
		const dialog = new OpenExistingDialog(workspaceService, context);
		await dialog.open();

	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.refresh', () => {
		workspaceTreeDataProvider.refresh();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dataworkspace.close', () => {
		vscode.commands.executeCommand('workbench.action.closeFolder');
	}));

	context.subscriptions.push(vscode.commands.registerCommand('projects.removeProject', async (treeItem: WorkspaceTreeItem) => {
		await workspaceService.removeProject(vscode.Uri.file(treeItem.element.project.projectFilePath));
	}));
	context.subscriptions.push(vscode.commands.registerCommand('projects.manageProject', async (treeItem: WorkspaceTreeItem) => {
		const dashboard = new ProjectDashboard(workspaceService, treeItem);
		await dashboard.showDashboard();
	}));

	IconPathHelper.setExtensionContext(context);

	return Promise.resolve(dataWorkspaceExtension);
}

function setProjectProviderContextValue(workspaceService: IWorkspaceService): void {
	vscode.commands.executeCommand('setContext', 'isProjectProviderAvailable', workspaceService.isProjectProviderAvailable);
}

export function deactivate(): void {
}
