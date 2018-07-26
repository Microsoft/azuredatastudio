/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ImportDataModel } from './dataModel';
import { DeferredPromise } from './flatFileWizard';
import { PROSEDiscoveryResponse } from '../services/contracts';
const localize = nls.loadMessageBundle();

export async function prosePreview(view: sqlops.ModelView, model: ImportDataModel, previewReadyPromise: DeferredPromise<PROSEDiscoveryResponse>) : Promise<void> {
	let formWrapper = view.modelBuilder.loadingComponent().component();

	previewReadyPromise.promise.then(async () => {
		if(!model.proseDataPreview || model.proseDataPreview.length === 0){
			let errorMsg = view.modelBuilder.text()
				.withProperties({
					value: localize('flatFileImport.dataModelError',"No data available for preview")
				}).component();
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([
					{
					component: errorMsg,
					title: 'Error'
				}], {
					horizontal: false,
					componentWidth: '100%'
				}).component();

			formWrapper.component = formModel;
			formWrapper.loading = false;
			return await view.initializeModel(formWrapper);
		}

		let table = await createTable(view, model.proseDataPreview, model.proseColumns.map(c => c.columnName));
		let formModel = view.modelBuilder.formContainer()
			.withFormItems(
				[
				{
					component : table,
					title : 'This operation analyzed the input file structure to generate the preview below for up to the first 50 rows'
				}
			]
		).component();
		formWrapper.component = formModel;
		formWrapper.loading = false;
	});
	await view.initializeModel(formWrapper);
}

async function createTable(view: sqlops.ModelView, tableData: string[][], columnHeaders: string[]) : Promise<sqlops.TableComponent> {
	let rows;
	let rowsLength = tableData.length;

	if(rowsLength > 50){
		rows = tableData;
	}
	else{
		rows = tableData.slice(0, rowsLength);
	}

	let table = view.modelBuilder.table().withProperties({
			data: rows,
			columns: columnHeaders,
			height: 400,
			width: '700',
        }).component();

	return Promise.resolve(table);
}



var data =
	[
		['created_utc','score','domain','id'],
		['1370264768.0','674','twitter.com','1fktz4'],
		['1370264798.0','675','twitter.com','2gatz4'],
		['1370264768.0','676','twitter.com','1fkrzf']
	];

