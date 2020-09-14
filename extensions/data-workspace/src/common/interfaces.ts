/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProjectProvider, IProjectType } from 'dataworkspace';
import * as vscode from 'vscode';

/**
 * Defines the project provider registry
 */
export interface IProjectProviderRegistry {
	/**
	 * Registers a new project provider
	 * @param provider The project provider
	 */
	registerProvider(provider: IProjectProvider): vscode.Disposable;

	/**
	 * Clear the providers
	 */
	clear(): void;

	/**
	 * Gets all the registered providers
	 */
	readonly providers: IProjectProvider[];

	/**
	 * Gets the project provider for the specified project type
	 * @param projectType The project type, file extension of the project
	 */
	getProviderByProjectType(projectType: string): IProjectProvider | undefined;
}

/**
 * Defines the project service
 */
export interface IWorkspaceService {
	/**
	 * Gets all supported project types
	 */
	getAllProjectTypes(): Promise<IProjectType[]>;

	/**
	 * Gets the project files in current workspace
	 */
	getProjectsInWorkspace(): Promise<string[]>;

	/**
	 * Gets the project provider by project file
	 * @param projectFilePath The full path of the project file
	 */
	getProjectProvider(projectFilePath: string): Promise<IProjectProvider | undefined>;
}

/**
 * Represents the item for the workspace tree
 */
export interface WorkspaceTreeItem {
	/**
	 * Gets the tree data provider
	 */
	treeDataProvider: vscode.TreeDataProvider<any>;

	/**
	 * Gets the raw element returned by the tree data provider
	 */
	element: any;
}
