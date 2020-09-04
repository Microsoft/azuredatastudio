/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { ArcService } from '../services/arcService';

suite('arc service Tests', function (): void {
	const arcService = new ArcService();
	test('arc service fetches AzureArcTreeDataProvider properly', () => {
		should(arcService.getAzureArcTreeDataProvider()).not.be.undefined();
	});
});
