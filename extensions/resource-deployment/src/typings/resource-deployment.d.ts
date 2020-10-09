/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
declare module 'resource-deployment' {
	import * as azdata from 'azdata';

	export const enum extension {
		name = 'Microsoft.resource-deployment'
	}
	export interface IOptionsSourceProvider {
		readonly optionsSourceId: string,
		getOptions(): Promise<string[] | azdata.CategoryValue[]> | string[] | azdata.CategoryValue[];
		getVariableValue?: (variableName: string, input: string) => Promise<string> | string;
		getIsPassword?: (variableName: string) => boolean | Promise<boolean>;
	}

	/**
	 * Covers defining what the resource-deployment extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */

	export interface IExtension {
		registerOptionsSourceProvider(provider: IOptionsSourceProvider): void
	}
}
