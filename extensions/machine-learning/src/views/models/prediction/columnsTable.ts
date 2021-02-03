/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../../../common/constants';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { IDataComponent } from '../../interfaces';
import { PredictColumn, DatabaseTable, TableColumn } from '../../../prediction/interfaces';
import { ModelParameter, ModelParameters } from '../../../modelManagement/interfaces';

export const _warningButtonDimensions = {
	height: 16,
	width: 16
};

/**
 * View to render azure models in a table
 */
export class ColumnsTable extends ModelViewBase implements IDataComponent<PredictColumn[]> {
	private _table: azdata.DeclarativeTableComponent | undefined;
	private _parameters: PredictColumn[] = [];
	private _loader: azdata.LoadingComponent;

	/**
	 * Creates a view to render azure models in a table
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase, private _forInput: boolean = true) {
		super(apiWrapper, parent.root, parent);
		this._loader = this.registerComponent(this._modelBuilder);
	}

	/**
	 * Register components
	 * @param modelBuilder model builder
	 */
	public registerComponent(modelBuilder: azdata.ModelBuilder): azdata.LoadingComponent {
		let columnHeader: azdata.DeclarativeTableColumn[];
		if (this._forInput) {
			columnHeader = [
				{ // Action
					displayName: constants.columnName,
					ariaLabel: constants.columnName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Name
					displayName: '',
					ariaLabel: '',
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Name
					displayName: constants.inputName,
					ariaLabel: constants.inputName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 120,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				}
			];
		} else {
			columnHeader = [
				{ // Name
					displayName: constants.outputName,
					ariaLabel: constants.outputName,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: 200,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Action
					displayName: constants.displayName,
					ariaLabel: constants.displayName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				},
				{ // Action
					displayName: constants.dataTypeName,
					ariaLabel: constants.dataTypeName,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: 50,
					headerCssStyles: {
						...constants.cssStyles.tableHeader
					},
					rowCssStyles: {
						...constants.cssStyles.tableRow
					},
				}
			];
		}
		this._table = modelBuilder.declarativeTable()

			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: columnHeader,
					data: [],
					ariaLabel: constants.mlsConfigTitle
				})
			.component();
		this._loader = modelBuilder.loadingComponent()
			.withItem(this._table)
			.withProperties({
				loading: true
			}).component();
		return this._loader;
	}

	public async onLoading(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: true });
		}
	}

	public async onLoaded(): Promise<void> {
		if (this._loader) {
			await this._loader.updateProperties({ loading: false });
		}
	}

	public get component(): azdata.Component {
		return this._loader;
	}

	/**
	 * Load data in the component
	 * @param workspaceResource Azure workspace
	 */
	public async loadInputs(modelParameters: ModelParameters | undefined, table: DatabaseTable): Promise<void> {
		await this.onLoading();
		this._parameters = [];
		let tableData: any[][] = [];

		if (this._table && table) {
			if (this._forInput) {
				let columns: TableColumn[];
				try {
					columns = await this.listColumnNames(table);
				} catch {
					columns = [];
				}
				if (modelParameters?.inputs && columns) {
					tableData = tableData.concat(modelParameters.inputs.map(input => this.createInputTableRow(input, columns)));
				}
			}

			this._table.data = tableData;
		}
		await this.onLoaded();
	}

	public async loadOutputs(modelParameters: ModelParameters | undefined): Promise<void> {
		this.onLoading();
		this._parameters = [];
		let tableData: any[][] = [];

		if (this._table) {
			if (!this._forInput) {
				if (modelParameters?.outputs && constants.supportedDataTypes) {
					tableData = tableData.concat(modelParameters.outputs.map(output => this.createOutputTableRow(output, constants.supportedDataTypes)));
				}
			}

			this._table.data = tableData;
		}
		this.onLoaded();
	}

	private createOutputTableRow(modelParameter: ModelParameter, dataTypes: string[]): any[] {
		if (this._modelBuilder) {

			const outputContainer = this._modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				width: this.componentMaxLength + 20,
				justifyContent: 'flex-start'
			}).component();
			const warningButton = this.createWarningButton();
			warningButton.onDidClick(() => {
				let warningButtonProperties = {
					xPos: 0,
					yPos: 0,
					width: _warningButtonDimensions.width,
					height: _warningButtonDimensions.height
				};
				this.openWarningCalloutDialog(constants.columnDataTypeMismatchWarningHeading, 'output-table-row-dialog', constants.outputColumnDataTypeNotSupportedWarning, constants.learnMoreLink, constants.mlExtDocLink, warningButtonProperties);
			});
			const css = {
				'padding-top': '5px',
				'padding-right': '5px',
				'margin': '0px'
			};
			const name = modelParameter.name;
			let dataType = dataTypes.find(x => x === modelParameter.type);
			if (!dataType) {
				// Output type not supported
				//
				dataType = dataTypes[0];
				outputContainer.addItem(warningButton, {
					CSSStyles: css
				});
			}
			let nameInput = this._modelBuilder.dropDown().withProperties({
				values: dataTypes,
				width: this.componentMaxLength,
				value: dataType
			}).component();
			outputContainer.addItem(nameInput, {
				CSSStyles: {
					'padding': '0px',
					'padding-right': '10px',
					'margin': '0px'
				}
			});


			this._parameters.push({ columnName: name, paramName: name, dataType: dataType });

			nameInput.onValueChanged(() => {
				const value = <string>nameInput.value;
				if (value !== modelParameter.type) {
					let selectedRow = this._parameters.find(x => x.paramName === name);
					if (selectedRow) {
						selectedRow.dataType = value;
					}
					outputContainer.addItem(warningButton, {
						CSSStyles: css
					});
				} else {
					outputContainer.removeItem(warningButton);
				}
			});

			let displayNameInput = this._modelBuilder.inputBox().withProperties({
				value: name,
				width: 200
			}).component();
			displayNameInput.onTextChanged(() => {
				let selectedRow = this._parameters.find(x => x.paramName === name);
				if (selectedRow) {
					selectedRow.columnName = displayNameInput.value || name;
				}
			});
			return [`${name}(${modelParameter.originalType ? modelParameter.originalType : constants.unsupportedModelParameterType})`, displayNameInput, outputContainer];
		}

		return [];
	}

	private createInputTableRow(modelParameter: ModelParameter, columns: TableColumn[] | undefined): any[] {
		if (this._modelBuilder && columns) {

			let values = columns.map(c => { return { name: c.columnName, displayName: `${c.columnName}(${c.dataType})` }; });
			if (columns.length > 0 && columns[0].columnName !== constants.selectColumnTitle) {
				values = [{ displayName: constants.selectColumnTitle, name: '' }].concat(values);
			}
			let nameInput = this._modelBuilder.dropDown().withProperties({
				values: values,
				width: this.componentMaxLength
			}).component();
			const name = modelParameter.name;
			let column = values.find(x => x.name.toLocaleUpperCase() === modelParameter.name.toLocaleUpperCase());
			if (!column) {
				column = values.length > 0 ? values[0] : undefined;
			}
			const currentColumn = columns.find(x => x.columnName === column?.name);
			nameInput.value = column;

			if (column) {
				this._parameters.push({ columnName: column.name, paramName: name, paramType: modelParameter.type, maxLength: currentColumn?.maxLength });
			}
			const inputContainer = this._modelBuilder.flexContainer().withLayout({
				flexFlow: 'row',
				width: this.componentMaxLength + 20,
				justifyContent: 'flex-start'
			}).component();
			const warningButton = this.createWarningButton();
			warningButton.onDidClick(() => {
				let warningButtonProperties = {
					xPos: 0,
					yPos: 0,
					width: _warningButtonDimensions.width,
					height: _warningButtonDimensions.height
				};
				this.openWarningCalloutDialog(constants.columnDataTypeMismatchWarningHeading, 'input-table-row-dialog', constants.columnDataTypeMismatchWarning, constants.learnMoreLink, constants.mlExtDocLink, warningButtonProperties);
			});

			const css = {
				'padding-top': '5px',
				'padding-right': '5px',
				'margin': '0px'
			};

			nameInput.onValueChanged(() => {
				const selectedColumn = nameInput.value;
				const value = selectedColumn ? (<azdata.CategoryValue>selectedColumn).name : undefined;

				let selectedRow = this._parameters.find(x => x.paramName === name);
				if (selectedRow) {
					selectedRow.columnName = value || '';
					let tableColumn = columns.find(x => x.columnName === value);
					if (tableColumn) {
						selectedRow.maxLength = tableColumn.maxLength;
					}
				}

				const currentColumn = columns.find(x => x.columnName === value);
				if (currentColumn && modelParameter.type === currentColumn?.dataType) {
					inputContainer.removeItem(warningButton);
				} else {
					inputContainer.addItem(warningButton, {
						CSSStyles: css
					});
				}
			});

			const label = this._modelBuilder.inputBox().withProperties({
				value: `${name}(${modelParameter.originalType ? modelParameter.originalType : constants.unsupportedModelParameterType})`,
				enabled: false,
				width: this.componentMaxLength
			}).component();


			inputContainer.addItem(label, {
				CSSStyles: {
					'padding': '0px',
					'padding-right': '10px',
					'margin': '0px'
				}
			});
			if (currentColumn && modelParameter.type !== currentColumn?.dataType) {
				inputContainer.addItem(warningButton, {
					CSSStyles: css
				});
			}
			const image = this._modelBuilder.image().withProperties({
				width: 50,
				height: 50,
				iconPath: {
					dark: this.asAbsolutePath('images/dark/arrow.svg'),
					light: this.asAbsolutePath('images/light/arrow.svg')
				},
				iconWidth: 20,
				iconHeight: 20,
				title: 'maps'
			}).component();
			return [nameInput, image, inputContainer];
		}

		return [];
	}

	private createWarningButton(): azdata.ButtonComponent {
		const warningButton = this._modelBuilder.button().withProperties({
			width: `${_warningButtonDimensions.width}px`,
			height: `${_warningButtonDimensions.height}px`,
			title: constants.columnDataTypeMismatchWarningHelper,
			iconPath: {
				dark: this.asAbsolutePath('images/warning.svg'),
				light: this.asAbsolutePath('images/warning.svg'),
			},
			iconHeight: `${_warningButtonDimensions.height}px`,
			iconWidth: `${_warningButtonDimensions.width}px`
		}).component();

		return warningButton;
	}

	public openWarningCalloutDialog(dialogHeading: string, dialogName?: string, calloutMessageText?: string, calloutMessageLinkText?: string, calloutMessageLinkUrl?: string, triggerProperties?: azdata.window.ITriggerProperties): void {
		let dialog = azdata.window.createModelViewDialog(dialogHeading, dialogName, 'narrow', 'calloutCompact', 'left', true, false, triggerProperties);
		let warningTab: azdata.window.DialogTab = azdata.window.createTab('warning');
		warningTab.registerContent(async view => {
			let warningContentContainer = view.modelBuilder.divContainer().withProperties({
				CSSStyles: {}
			}).component();
			let messageTextComponent = view.modelBuilder.text().withProperties({
				value: calloutMessageText,
				CSSStyles: {
					'font-size': '12px',
					'line-height': '16px',
					'margin': '0 0 12px 0'
				}
			}).component();
			warningContentContainer.addItem(messageTextComponent);

			if (calloutMessageLinkText && calloutMessageLinkUrl) {
				const messageLinkComponent = view.modelBuilder.hyperlink().withProperties({
					label: calloutMessageLinkText,
					url: calloutMessageLinkUrl,
					CSSStyles: {
						'font-size': '13px',
						'margin': '0px'
					}
				}).component();
				warningContentContainer.addItem(messageLinkComponent);
			}
			view.initializeModel(warningContentContainer);
		});
		// set tab as content
		dialog.content = [warningTab];

		azdata.window.openDialog(dialog);
	}

	/**
	 * Returns selected data
	 */
	public get data(): PredictColumn[] | undefined {
		return this._parameters;
	}

	/**
	 * Refreshes the view
	 */
	public async refresh(): Promise<void> {
	}
}
