/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sqlops from 'sqlops';
import 'mocha';

import { AzureResourceServicePool } from '../../../azureResource/servicePool';
import { IAzureResourceAccountService } from '../../../azureResource/interfaces';
import { AzureResourceTreeProvider } from '../../../azureResource/tree/treeProvider';
import { AzureResourceAccountTreeNode } from '../../../azureResource/tree/accountTreeNode';
import { AzureResourceAccountNotSignedInTreeNode } from '../../../azureResource/tree/accountNotSignedInTreeNode';
import { AzureResourceMessageTreeNode } from '../../../azureResource/messageTreeNode';

// Mock services
const mockServicePool = AzureResourceServicePool.getInstance();

let mockAccountService: TypeMoq.IMock<IAzureResourceAccountService>;

// Mock test data
const mockAccount1: sqlops.Account = {
	key: {
		accountId: 'mock_account_1',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account_1@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test'
	},
	properties: undefined,
	isStale: false
};
const mockAccount2: sqlops.Account = {
	key: {
		accountId: 'mock_account_2',
		providerId: 'mock_provider'
	},
	displayInfo: {
		displayName: 'mock_account_2@test.com',
		accountType: 'Microsoft',
		contextualDisplayName: 'test'
	},
	properties: undefined,
	isStale: false
};
const mockAccounts = [mockAccount1, mockAccount2];

describe('AzureResourceTreeProvider.getChildren', function(): void {
	beforeEach(() => {
		mockAccountService = TypeMoq.Mock.ofType<IAzureResourceAccountService>();

		mockServicePool.accountService = mockAccountService.object;
	});

	it('Should load accounts.', async function(): Promise<void> {
		mockAccountService.setup((o) => o.getAccounts()).returns(() => Promise.resolve(mockAccounts));

		const treeProvider = new AzureResourceTreeProvider();
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);

		mockAccountService.verify((o) => o.getAccounts(), TypeMoq.Times.once());

		should(children).Array();
		should(children.length).equal(mockAccounts.length);

		for (let ix = 0; ix < mockAccounts.length; ix++) {
			const child = children[ix];
			const account = mockAccounts[ix];

			should(child).instanceof(AzureResourceAccountTreeNode);
			should(child.nodePathValue).equal(`account_${account.key.accountId}`);
		}
	});

	it('Should handle when there is no accounts.', async function(): Promise<void> {
		mockAccountService.setup((o) => o.getAccounts()).returns(() => Promise.resolve(undefined));

		const treeProvider = new AzureResourceTreeProvider();
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceAccountNotSignedInTreeNode);
	});

	it('Should handle errors.', async function(): Promise<void> {
		const mockAccountError = 'Test account error';
		mockAccountService.setup((o) => o.getAccounts()).returns(() => { throw new Error(mockAccountError); });

		const treeProvider = new AzureResourceTreeProvider();
		treeProvider.isSystemInitialized = true;

		const children = await treeProvider.getChildren(undefined);

		mockAccountService.verify((o) => o.getAccounts(), TypeMoq.Times.once());

		should(children).Array();
		should(children.length).equal(1);
		should(children[0]).instanceof(AzureResourceMessageTreeNode);
		should(children[0].nodePathValue).startWith('message_');
		should(children[0].getNodeInfo().label).equal(`Error: ${mockAccountError}`);
	});
});
