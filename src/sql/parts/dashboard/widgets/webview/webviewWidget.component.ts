/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, ViewChild, ElementRef } from '@angular/core';

import Webview from 'vs/workbench/parts/html/browser/webview';
import { Parts } from 'vs/workbench/services/part/common/partService';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { IWebviewWidget } from 'sql/services/dashboardWebview/common/dashboardWebviewService';

interface IWebviewWidgetConfig {
	id: string;
}

const selector = 'webview-widget';

@Component({
	selector: selector,
	template: '<div></div>'
})
export class WebviewWidget extends DashboardWidget implements IDashboardWidget, OnInit, IWebviewWidget {

	private _id: string;
	private _webview: Webview;

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
		this._id = (_config.widget[selector] as IWebviewWidgetConfig).id;
	}

	ngOnInit() {
		this._dashboardService.dashboardWebviewService.registerWebviewWidget(this);
		this._webview = new Webview(this._el.nativeElement,
			this._dashboardService.partService.getContainer(Parts.EDITOR_PART),
			this._dashboardService.contextViewService,
			undefined,
			undefined,
			{
				allowScripts: true,
				enableWrappedPostMessage: true,
				hideFind: true
			}
		);
		this._webview.style(this._dashboardService.themeService.getTheme());
	}

	public get id(): string {
		return this._id;
	}

	public setHtml(html: string): void {
		this._webview.contents = [html];
	}
}
