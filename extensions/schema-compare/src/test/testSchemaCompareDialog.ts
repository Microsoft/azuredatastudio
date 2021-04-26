/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SchemaCompareDialog } from '../dialogs/schemaCompareDialog';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';

export class SchemaCompareDialogTest extends SchemaCompareDialog {

	constructor(
		schemaCompareMainWindow: SchemaCompareMainWindow,
		view: azdata.ModelView,
		extensionContext: vscode.ExtensionContext) {
		super(schemaCompareMainWindow, view, extensionContext);
	}

	// only for test
	public getSourceDropdownValue(): string | azdata.CategoryValue {
		if (this.sourceServerDropdown) {
			return this.sourceServerDropdown.value;
		}
		return undefined;
	}

	public getTargetDropdownValue(): string | azdata.CategoryValue {
		if (this.targetServerDropdown) {
			return this.targetServerDropdown.value;
		}
		return undefined;
	}
}
