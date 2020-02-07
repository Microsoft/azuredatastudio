/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { generateDashboardTabSchema, generateDashboardWidgetSchema, generateDashboardToolbarItemSchema } from 'sql/workbench/contrib/dashboard/browser/pages/dashboardPageContribution';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

export interface IPropertiesConfig {
	edition: number | Array<number>;
	provider: string | Array<string>;
	properties: {
		displayName: string;
		value: string
	}[];
}

export const serverDashboardPropertiesSchema: IJSONSchema = {
	description: nls.localize('dashboardServerProperties', "Enable or disable the properties widget"),
	default: true,
	oneOf: [
		{ type: 'boolean' },
		{
			type: 'string',
			enum: ['collapsed']
		},
		{
			type: 'object',
			properties: {
				provider: {
					type: 'string'
				},
				edition: {
					type: 'number'
				},
				properties: {
					description: nls.localize('dashboard.serverproperties', "Property values to show"),
					type: 'array',
					items: {
						type: 'object',
						properties: {
							displayName: {
								type: 'string',
								description: nls.localize('dashboard.serverproperties.displayName', "Display name of the property")
							},
							value: {
								type: 'string',
								description: nls.localize('dashboard.serverproperties.value', "Value in the Server Info Object")
							}
						}
					},
					default: [
						{
							displayName: nls.localize('version', "Version"),
							value: 'serverVersion'
						},
						{
							displayName: nls.localize('edition', "Edition"),
							value: 'serverEdition'
						},
						{
							displayName: nls.localize('computerName', "Computer Name"),
							value: 'machineName'
						},
						{
							displayName: nls.localize('osVersion', "OS Version"),
							value: 'osVersion'
						}
					]
				}
			}
		}
	]
};

const defaultVal = [
	{
		name: 'Tasks',
		widget: {
			'tasks-widget': ['newQuery', 'mssqlCluster.task.newNotebook']
		},
		gridItemConfig: {
			sizex: 1,
			sizey: 1
		}
	},
	{
		widget: {
			'backup-history-server-insight': null
		}
	},
	{
		widget: {
			'all-database-size-server-insight': null
		}
	}
];

export const serverDashboardSettingSchema: IJSONSchema = {
	type: ['array'],
	description: nls.localize('dashboardServer', "Customizes the server dashboard page"),
	items: generateDashboardWidgetSchema('server'),
	default: defaultVal
};

export const serverDashboardTabsSchema: IJSONSchema = {
	type: ['array'],
	description: nls.localize('dashboardServerTabs', "Customizes the Server dashboard tabs"),
	items: generateDashboardTabSchema('server'),
	default: []
};

export const serverDashboardToolbarSchema: IJSONSchema = {
	type: ['array'],
	description: nls.localize('dashboardServerToolbar', "Customizes the server dashboard toolbar"),
	items: generateDashboardToolbarItemSchema('server'),
	default: [
		{ name: 'restore', when: '!mssql:iscloud && mssql:engineedition != 11' }, 'newQuery', 'mssqlCluster.task.newNotebook'
	]
};

export const SERVER_DASHBOARD_SETTING = 'dashboard.server.widgets';
export const SERVER_DASHBOARD_PROPERTIES = 'dashboard.server.properties';
export const SERVER_DASHBOARD_TABS = 'dashboard.server.tabs';
export const SERVER_DASHBOARD_TOOLBAR = 'dashboard.server.toolbar';
