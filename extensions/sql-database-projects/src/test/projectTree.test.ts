/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';

import { Project, EntryType } from '../models/project';
import { FolderNode, FileNode, sortFileFolderNodes } from '../models/tree/fileFolderTreeItem';
import { ProjectRootTreeItem } from '../models/tree/projectTreeItem';

describe('Project Tree tests', function (): void {
	it('Should correctly order tree nodes by type, then by name', async function (): Promise<void> {
		const parent = new ProjectRootTreeItem(new Project(vscode.Uri.file('Z:\\Fake.sqlproj').fsPath));

		let inputNodes: (FileNode | FolderNode)[] = [
			new FileNode(vscode.Uri.file('Z:\\C'), parent),
			new FileNode(vscode.Uri.file('Z:\\D'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Z'), parent),
			new FolderNode(vscode.Uri.file('Z:\\X'), parent),
			new FileNode(vscode.Uri.file('Z:\\B'), parent),
			new FileNode(vscode.Uri.file('Z:\\A'), parent),
			new FolderNode(vscode.Uri.file('Z:\\W'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Y'), parent)
		];

		inputNodes = inputNodes.sort(sortFileFolderNodes);

		const expectedNodes: (FileNode | FolderNode)[] = [
			new FolderNode(vscode.Uri.file('Z:\\W'), parent),
			new FolderNode(vscode.Uri.file('Z:\\X'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Y'), parent),
			new FolderNode(vscode.Uri.file('Z:\\Z'), parent),
			new FileNode(vscode.Uri.file('Z:\\A'), parent),
			new FileNode(vscode.Uri.file('Z:\\B'), parent),
			new FileNode(vscode.Uri.file('Z:\\C'), parent),
			new FileNode(vscode.Uri.file('Z:\\D'), parent)
		];

		should(inputNodes.map(n => n.uri.path)).deepEqual(expectedNodes.map(n => n.uri.path));
	});

	it('Should ignore duplicate entries in Project file when building tree', async function (): Promise<void> {
		const proj = new Project(vscode.Uri.file('Z:\\TestProj.sqlproj').fsPath);
		proj.files.push(proj.createProjectEntry('someFolder\\nestedTest.sql', EntryType.File)); // nested file before explicit folder entry
		proj.files.push(proj.createProjectEntry('someFolder', EntryType.Folder));

		proj.files.push(proj.createProjectEntry('duplicate.sql', EntryType.File));
		proj.files.push(proj.createProjectEntry('duplicate.sql', EntryType.File));

		proj.files.push(proj.createProjectEntry('duplicateFolder', EntryType.Folder));
		proj.files.push(proj.createProjectEntry('duplicateFolder', EntryType.Folder));

		const tree = new ProjectRootTreeItem(proj);
		should(tree.children.map(x => x.uri.path)).deepEqual([
			'/TestProj.sqlproj/Data Sources',
			'/TestProj.sqlproj/duplicateFolder',
			'/TestProj.sqlproj/someFolder',
			'/TestProj.sqlproj/duplicate.sql']);

		should(tree.children.find(x => x.uri.path === '/TestProj.sqlproj/someFolder')?.children.map(y => y.uri.path)).deepEqual(['/TestProj.sqlproj/someFolder/nestedTest.sql']);
	});
});
