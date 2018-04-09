/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ElementRef, Injector, OnDestroy, OnInit
} from '@angular/core';

import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/dashboard/contents/mvvm/interfaces';
import { FlexLayout, FlexItemLayout } from 'sqlops';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) {}
}

export abstract class ComponentBase implements IComponent, OnDestroy, OnInit {

	constructor(
		protected _changeRef: ChangeDetectorRef) {
	}

	/// IComponent implementation

	abstract descriptor: IComponentDescriptor;
	abstract modelStore: IModelStore;

	public layout(): void {
		this._changeRef.detectChanges();
	}

	protected baseInit(): void {
		if (this.modelStore) {
			this.modelStore.registerComponent(this);
		}
	}

	abstract ngOnInit(): void;

	protected baseDestroy(): void {
		if (this.modelStore) {
			this.modelStore.unregisterComponent(this);
		}
	}

	abstract ngOnDestroy(): void;

	abstract setLayout (layout: any): void;

	public setProperties(properties: { [key: string]: any; }): void {
		for (let propName in properties) {
			if (this.hasOwnProperty(propName)) {
				this[propName] = properties[propName];
			}
		}
		this.layout();
	}
}

export abstract class ContainerBase<T> extends ComponentBase {
	protected items: ItemDescriptor<T>[];

	constructor(
		_changeRef: ChangeDetectorRef
	) {
		super(_changeRef);
		this.items = [];
	}

	/// IComponent container-related implementation
	public addToContainer(componentDescriptor: IComponentDescriptor, config: any): void {
		this.items.push(new ItemDescriptor(componentDescriptor, config));
		this._changeRef.detectChanges();
	}

	public clearContainer(): void {
		this.items = [];
		this._changeRef.detectChanges();
	}

	abstract setLayout (layout: any): void;
}
