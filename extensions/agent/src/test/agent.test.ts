/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { CreateJobData } from '../data/createJobData';
import { TestAgentService } from './testAgentService';

const testOwnerUri = 'agent://testuri';

suite('Agent extension', () => {
	test('Create Job Data', async () => {
		let testAgentService = new TestAgentService();
		let data = new CreateJobData(testOwnerUri, testAgentService);
		data.save();
	});
});
