/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, ElementRef, ViewChild } from '@angular/core';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { IDashboardRegistry, Extensions as DashboardExtensions } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';

import { DatabaseInfo, ServerInfo } from 'azdata';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILogService } from 'vs/platform/log/common/log';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { PropertiesContainer, PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';

export interface PropertiesConfig {
	properties: Array<Property>;
}

export interface FlavorProperties {
	flavor: string;
	condition?: ConditionProperties;
	conditions?: Array<ConditionProperties>;
	databaseProperties: Array<Property>;
	serverProperties: Array<Property>;
}

export interface ConditionProperties {
	field: string;
	operator: '==' | '<=' | '>=' | '!=';
	value: string | boolean;
}

export interface ProviderProperties {
	provider: string;
	flavors: Array<FlavorProperties>;
}

export interface Property {
	displayName: string;
	value: string;
	ignore?: Array<string>;
	default?: string;
}

const dashboardRegistry = Registry.as<IDashboardRegistry>(DashboardExtensions.DashboardContributions);

@Component({
	selector: 'properties-widget',
	template: `
	<loading-spinner *ngIf="_loading" [loading]="_loading" [loadingMessage]="loadingMessage" [loadingCompletedMessage]="loadingCompletedMessage"></loading-spinner>
	<properties-container [style.display]="_loading ? 'none' : ''"></properties-container>`
})
export class PropertiesWidgetComponent extends DashboardWidget implements IDashboardWidget, OnInit {
	@ViewChild(PropertiesContainer) private _propertiesContainer: PropertiesContainer;
	public loadingMessage: string = nls.localize('loadingProperties', "Loading properties");
	public loadingCompletedMessage: string = nls.localize('loadingPropertiesCompleted', "Loading properties completed");
	private _connection: ConnectionManagementInfo;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(ILogService) private logService: ILogService
	) {
		super(changeRef);
		this.init();
	}

	ngOnInit() {
		this._inited = true;
		this._changeRef.detectChanges();
	}

	public refresh(): void {
		this.init();
	}

	private init(): void {
		this._connection = this._bootstrap.connectionManagementService.connectionInfo;
		this.setLoadingStatus(true);
		this._register(subscriptionToDisposable(this._bootstrap.adminService.databaseInfo.subscribe(databaseInfo => {
			const propertyItems = this.parseProperties(databaseInfo);
			if (this._inited) {
				this._propertiesContainer.propertyItems = propertyItems;
				this._changeRef.detectChanges();
			} else {
				this.logService.info('Database properties successfully retrieved but component not initialized yet');
			}
			this.setLoadingStatus(false);
		}, error => {
			this.setLoadingStatus(false);
			(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.properties.error', "Unable to load dashboard properties");
		})));
	}

	private parseProperties(databaseInfo?: DatabaseInfo): PropertyItem[] {
		const provider = this._config.provider;

		let propertyArray: Array<Property>;

		// if config exists use that, otherwise use default
		if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].properties) {
			const config = <PropertiesConfig>this._config.widget['properties-widget'];
			propertyArray = config.properties;
		} else {
			const providerProperties = dashboardRegistry.getProperties(provider as string);

			if (!providerProperties) {
				this.logService.error('No property definitions found for provider', provider);
				return [];
			}

			let flavor: FlavorProperties;

			// find correct flavor
			if (providerProperties.flavors.length === 1) {
				flavor = providerProperties.flavors[0];
			} else if (providerProperties.flavors.length === 0) {
				this.logService.error('No flavor definitions found for "', provider,
					'. If there are not multiple flavors of this provider, add one flavor without a condition');
				return [];
			} else {
				const flavorArray = providerProperties.flavors.filter((item) => {

					// For backward compatibility we are supporting array of conditions and single condition.
					// If nothing is specified, we return false.
					if (item.conditions) {
						let conditionResult = true;
						for (let i = 0; i < item.conditions.length; i++) {
							conditionResult = conditionResult && this.getConditionResult(item, item.conditions[i]);
						}

						return conditionResult;
					}
					else if (item.condition) {
						return this.getConditionResult(item, item.condition);
					}
					else {
						this.logService.error('No condition was specified.');
						return false;
					}
				});

				if (flavorArray.length === 0) {
					this.logService.error('Could not determine flavor');
					return [];
				} else if (flavorArray.length > 1) {
					this.logService.error('Multiple flavors matched correctly for this provider', provider);
					return [];
				}

				flavor = flavorArray[0];
			}

			// determine what context we should be pulling from
			if (this._config.context === 'database') {
				if (!Array.isArray(flavor.databaseProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for database properties');
				}

				if (!Array.isArray(flavor.serverProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for server properties');
				}

				propertyArray = flavor.databaseProperties;
			} else {
				if (!Array.isArray(flavor.serverProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for server properties');
				}

				propertyArray = flavor.serverProperties;
			}
		}


		let infoObject: ServerInfo | {};
		if (this._config.context === 'database') {
			if (databaseInfo?.options) {
				infoObject = databaseInfo.options;
			}
		} else {
			infoObject = this._connection.serverInfo;
		}

		return propertyArray.map(property => {
			let propertyObject = this.getValueOrDefault<string>(infoObject, property.value, property.default || '--');

			// make sure the value we got shouldn't be ignored
			if (property.ignore !== undefined && propertyObject !== '--') {
				for (let j = 0; j < property.ignore.length; j++) {
					// set to default value if we should be ignoring it's value
					if (propertyObject === property.ignore[0]) {
						propertyObject = property.default || '--';
						break;
					}
				}
			}
			return {
				displayName: property.displayName,
				value: propertyObject
			};
		});
	}

	private getConditionResult(item: FlavorProperties, conditionItem: ConditionProperties): boolean {
		let condition = this._connection.serverInfo[conditionItem.field];

		// If we need to compare strings, then we should ensure that condition is string
		// Otherwise tripple equals/unequals would return false values
		if (typeof conditionItem.value === 'string') {
			condition = condition.toString();
		}

		switch (conditionItem.operator) {
			case '==':
				return condition === conditionItem.value;
			case '!=':
				return condition !== conditionItem.value;
			case '>=':
				return condition >= conditionItem.value;
			case '<=':
				return condition <= conditionItem.value;
			default:
				this.logService.error('Could not parse operator: "', conditionItem.operator,
					'" on item "', item, '"');
				return false;
		}
	}

	private getValueOrDefault<T>(infoObject: ServerInfo | {}, propertyValue: string, defaultVal?: any): T {
		let val: T = undefined;
		if (infoObject) {
			val = infoObject[propertyValue];
		}
		if (types.isUndefinedOrNull(val)) {
			val = defaultVal;
		}
		return val;
	}
}
