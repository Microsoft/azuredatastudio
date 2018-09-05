/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from '../execution/queryModel';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { MessagePanel } from './messagePanel';
import { GridPanel } from './gridPanel';

import * as nls from 'vs/nls';
import * as UUID from 'vs/base/common/uuid';
import { PanelViewlet } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { ChartTab } from './charting/chartTab';

class ResultsView implements IPanelView {
	private panelViewlet: PanelViewlet;
	private gridPanel: GridPanel;
	private messagePanel: MessagePanel;
	private container = document.createElement('div');

	constructor(instantiationService: IInstantiationService) {
		this.panelViewlet = instantiationService.createInstance(PanelViewlet, 'resultsView', { showHeaderInTitleWhenSingleView: false });
		this.gridPanel = instantiationService.createInstance(GridPanel, { title: nls.localize('gridPanel', 'Results') });
		this.messagePanel = instantiationService.createInstance(MessagePanel, { title: nls.localize('messagePanel', 'Messages') });
		this.gridPanel.render();
		this.messagePanel.render();
		this.panelViewlet.create(this.container).then(() => {
			this.panelViewlet.addPanels([
				{ panel: this.gridPanel, size: 1000, index: 0 },
				{ panel: this.messagePanel, size: this.messagePanel.minimumSize, index: 1 }
			]);
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.panelViewlet.layout(dimension);
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		this.gridPanel.queryRunner = runner;
		this.messagePanel.queryRunner = runner;
	}

	public hideResultHeader() {
		this.gridPanel.headerVisible = false;
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = UUID.generateUuid();
	public readonly view: ResultsView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new ResultsView(instantiationService);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}
}

export class QueryResultsView {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;
	private chartTab: ChartTab;

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		this.resultsTab = new ResultsTab(instantiationService);
		this.chartTab = new ChartTab(instantiationService);
		this._panelView = new TabbedPanel(container, { showHeaderWhenSingleView: false });
	}

	public style() {
	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		let queryRunner = this.queryModelService._getQueryInfo(input.uri).queryRunner;
		this.resultsTab.queryRunner = queryRunner;
		this.chartTab.queryRunner = queryRunner;

		this._panelView.pushTab(this.resultsTab);
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	public layout(dimension: DOM.Dimension) {
		this._panelView.layout(dimension);
	}

	public chartData(dataId: { resultId: number, batchId: number }): void {
		if (!this._panelView.contains(this.chartTab)) {
			this._panelView.pushTab(this.chartTab);
			this.resultsTab.view.hideResultHeader();
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}
}
