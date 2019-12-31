/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Project } from '../models/project';
import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';

export class ProjectsController {
	private projectTreeViewProvider: SqlDatabaseProjectTreeViewProvider;

	projects: Project[] = [];

	constructor(projTreeViewProvider: SqlDatabaseProjectTreeViewProvider) {
		this.projectTreeViewProvider = projTreeViewProvider;
	}

	public async openProject(projectFile: vscode.Uri) {
		console.log('Loading project: ' + projectFile.fsPath);

		// Read project file
		const newProject = new Project(projectFile);
		await newProject.construct();
		this.projects.push(newProject);

		// Read datasources.json (if present)

		this.refreshProjectsTree();
	}

	public refreshProjectsTree() {
		this.projectTreeViewProvider.load(this.projects);
	}
}
