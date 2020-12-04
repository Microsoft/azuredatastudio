/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as loc from '../localizedConstants';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import * as uuid from 'uuid';
import * as os from 'os';
import { promises as fs } from 'fs';
import { getEndpointName, verifyConnectionAndGetOwnerUri, exists } from '../utils';
import { mockDacpacEndpoint, mockDatabaseEndpoint, mockFilePath, mockConnectionInfo, shouldThrowSpecificError, mockConnectionResult, mockConnectionProfile } from './testUtils';
import { createContext, TestContext } from './testContext';
import * as sinon from 'sinon';

let testContext: TestContext;

describe('utils: Tests to verify getEndpointName', function (): void {
	afterEach(() => {
		sinon.restore();
	});

	it('Should generate correct endpoint information', () => {
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		should(getEndpointName(endpointInfo)).equal(' ');
		should(getEndpointName(mockDacpacEndpoint)).equal(mockFilePath);
		should(getEndpointName(mockDatabaseEndpoint)).equal(' ');
	});

	it('Should get endpoint information from ConnectionInfo', () => {
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});

	it('Should get correct endpoint information from SchemaCompareEndpointInfo', () => {
		let dbName = 'My Database';
		let serverName = 'My Server';
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.databaseName = dbName;
		testDatabaseEndpoint.serverName = serverName;

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});
});

describe('utils: Basic tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	it('Should return undefined for endpoint as dacpac', async function (): Promise<void> {
		let ownerUri = undefined;
		ownerUri = await verifyConnectionAndGetOwnerUri(mockDacpacEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});

	it('Should return undefined for endpoint as database and no ConnectionInfo', async function (): Promise<void> {
		let ownerUri = undefined;
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = undefined;

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});
});

describe('utils: In-depth tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	afterEach(() => {
		sinon.restore();
	});

	it('Should throw an error asking to make a connection', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };
		const getConnectionString = loc.getConnectionString('test');

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').callsFake(() => {
			throw new Error('');
		});

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), getConnectionString);
	});

	it('Should throw an error for login failure', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [{ ...mockConnectionProfile }];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').throwsArg(0);

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), connection.errorMessage);
	});

	it('Should throw an error for login failure with openConnectionDialog but no ownerUri', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'openConnectionDialog').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(loc.YesButtonText));

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), connection.errorMessage);
	});

	it('Should not throw an error and set ownerUri appropriately', async function (): Promise<void> {
		let ownerUri = undefined;
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		let expectedOwnerUri: string = 'providerName:MSSQL|authenticationType:SqlLogin|database:My Database|server:My Server|user:My User|databaseDisplayName:My Database';
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(expectedOwnerUri));

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test');

		should(ownerUri).equal(expectedOwnerUri);
	});
});

describe('utils: Test to verify exists method', () => {
	it('Should run as expected', async () => {
		const filename = path.join(os.tmpdir(), `SchemaCompareUtilsTest_${uuid.v4()}`);
		try {
			should(await exists(filename)).be.false();
			await fs.writeFile(filename, '');
			should(await exists(filename)).be.true();
		} finally {
			try {
				await fs.unlink(filename);
			} catch { /* no-op */ }
		}
	});
});
