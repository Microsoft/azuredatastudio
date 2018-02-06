/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Extensions, IDashboardWidgetRegistry } from 'sql/platform/dashboard/common/widgetRegistry';
import { mixin } from 'vs/base/common/objects';

let widgetRegistry = <IDashboardWidgetRegistry>Registry.as(Extensions.DashboardWidgetContribution);

export function GenerateDashboardWidgetSchema(type?: 'database' | 'server', extension?: boolean): IJSONSchema {
	let schemas;
	if (extension) {
		let extensionSchemas = type === 'server' ? widgetRegistry.serverWidgetSchema.extensionProperties : type === 'database' ? widgetRegistry.databaseWidgetSchema.extensionProperties : widgetRegistry.allSchema.extensionProperties;
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
		schemas = mixin(schemas, extensionSchemas, true);
	} else {
		schemas = type === 'server' ? widgetRegistry.serverWidgetSchema.properties : type === 'database' ? widgetRegistry.databaseWidgetSchema.properties : widgetRegistry.allSchema.properties;
	}

	return {
		type: 'object',
		properties: {
			name: {
				type: 'string'
			},
			icon: {
				type: 'string'
			},
			provider: {
				anyOf: [
					{
						type: 'string'
					},
					{
						type: 'array',
						items: {
							type: 'string'
						}
					}
				]
			},
			edition: {
				anyOf: [
					{
						type: 'number'
					},
					{
						type: 'array',
						items: {
							type: 'number'
						}
					}
				]
			},
			gridItemConfig: {
				type: 'object',
				properties: {
					sizex: {
						type: 'number'
					},
					sizey: {
						type: 'number'
					},
					col: {
						type: 'number'
					},
					row: {
						type: 'number'
					}
				}
			},
			widget: {
				type: 'object',
				properties: schemas,
				minItems: 1,
				maxItems: 1
			}
		}
	};
};
