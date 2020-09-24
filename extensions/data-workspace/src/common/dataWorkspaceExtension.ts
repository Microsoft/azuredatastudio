/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as constants from './constants';
import { IExtension } from 'dataworkspace';
import { WorkspaceService } from '../services/workspaceService';

export class DataWorkspaceExtension implements IExtension {
	constructor(private workspaceService: WorkspaceService) {
	}

	getProjectsInWorkspace(): vscode.Uri[] {
		return this.workspaceService.getProjectsInWorkspace();
	}

	addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void> {
		return this.workspaceService.addProjectsToWorkspace(projectFiles);
	}

	showProjectsView(): void {
		vscode.commands.executeCommand(constants.projectsViewFocusCommand);
	}
}
