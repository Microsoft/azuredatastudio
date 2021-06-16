/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert } from 'console';
import { Application } from '../../../../../automation';

export function setup() {
	describe('NotebookView', () => {
		it('Pin a notebook', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focus();
			await app.workbench.sqlNotebook.view.pinNotebook();
			await app.workbench.sqlNotebook.view.waitForPinnedNotebookTreeView();
		});

		it('Unpin Notebook', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focus();
			await app.workbench.sqlNotebook.view.unpinNotebook();
		});

		it('No search results if search query is empty', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focus();
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('');
			assert(results.children !== undefined && results.children.length === 0);
		});

		it('Simple query search works correctly', async function () {
			const app = this.app as Application;
			await app.workbench.sqlNotebook.view.focus();
			// Adding a regex expression to not depend on specific results of files
			const regexExpr = /[0-9]+( results in )[0-9]+( files)/;
			const results = await app.workbench.sqlNotebook.view.searchInNotebook('hello');
			assert(results.textContent !== '' && results.textContent.match(regexExpr));
		});
	});
}
