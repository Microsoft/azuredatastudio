/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/dashboard/contents/mvvm/interfaces';
import { FlexLayout, FlexItemLayout } from 'sqlops';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ContainerBase } from 'sql/parts/dashboard/contents/mvvm/componentBase';
import { ModelComponentWrapper } from 'sql/parts/dashboard/contents/mvvm/modelComponentWrapper.component';

class FlexItem {
	constructor(public descriptor: IComponentDescriptor, public config: FlexItemLayout) {}
}

@Component({
	template: `
		<div *ngIf="items" class="flexContainer" [style.flexFlow]="flexFlow" [style.justifyContent]="justifyContent">
			<div *ngFor="let item of items" [style.flex]="item.config.flex" [style.order]="item.config.order" >
				<model-component-wrapper [descriptor]="item.descriptor" [modelStore]="modelStore">
				</model-component-wrapper>
			</div>
		</div>
	`
})
export default class FlexContainer extends ContainerBase<FlexItemLayout> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _flexFlow: string;
	private _justifyContent: string;

	@ViewChildren(ModelComponentWrapper) private _componentWrappers: QueryList<ModelComponentWrapper>;

	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
		this._flexFlow = '';	// default
		this._justifyContent = '';	// default
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}


	/// IComponent implementation

	public layout(): void {
		if (this._componentWrappers) {
			this._componentWrappers.forEach(wrapper => {
				wrapper.layout();
			});
		}
	}

	public setLayout (layout: FlexLayout): void {
		this._flexFlow = layout.flexFlow ? layout.flexFlow : '';
		this._justifyContent= layout.justifyContent ? layout.justifyContent : '';
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		// Do nothing for now, no special properties supported
	}

	// CSS-bound properties
	public get flexFlow(): string {
		return this._flexFlow;
	}

	public get justifyContent(): string {
		return this._justifyContent;
	}
}
