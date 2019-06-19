/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as mssql from '../../mssql/src/api/mssqlapis';
import * as Utils from './cmsResource/utils';
import { ICmsResourceNodeInfo } from './cmsResource/tree/baseTreeNodes';

const localize = nls.loadMessageBundle();
const cmsProvider: string = 'MSSQL-CMS';
const mssqlProvider: string = 'MSSQL';
const CredentialNamespace = 'cmsCredentials';
const sqlLoginAuthType: string = 'SqlLogin';

export interface CreateCmsResult {
	listRegisteredServersResult: mssql.ListRegisteredServersResult;
	connection: azdata.connection.Connection;
	ownerUri: string;
}

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 *
 * @export
 * ApiWrapper
 */
export class CmsUtils {

	private _credentialProvider: azdata.CredentialProvider;
	private _cmsService: mssql.CmsService;
	private _registeredCmsServers: ICmsResourceNodeInfo[] = [];

	public async savePassword(username: string, password: string): Promise<boolean> {
		let provider = await this.credentialProvider();
		let result = await provider.saveCredential(username, password);
		return result;
	}

	public async getPassword(username: string): Promise<string> {
		let provider = await this.credentialProvider();
		let credential = await provider.readCredential(username);
		return credential ? credential.password : undefined;
	}

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	/**
	 * Get the configuration for a extensionName
	 * @param extensionName The string name of the extension to get the configuration for
	 * @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
	 */
	public getConfiguration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('centralManagementServers');
	}

	public async setConfiguration(value: any): Promise<void> {
		await vscode.workspace.getConfiguration('centralManagementServers').update('servers', value, true);
	}

	// Connection APIs
	public openConnectionDialog(providers: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public async getUriForConnection(connection: azdata.connection.Connection): Promise<string> {
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			let result = await azdata.connection.connect(Utils.toConnectionProfile(connection), false, false);
			if (result) {
				ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			}
		}
		return ownerUri;
	}

	// CMS APIs
	public async getCmsService(): Promise<mssql.CmsService> {
		if (!this._cmsService) {
			let extensionApi: mssql.MssqlExtensionApi = vscode.extensions.getExtension('Microsoft.mssql').exports;
			this._cmsService = await extensionApi.getCmsServiceProvider();
		}
		return this._cmsService;
	}

	public async getRegisteredServers(ownerUri: string, relativePath: string): Promise<mssql.ListRegisteredServersResult> {
		const cmsService = await this.getCmsService();
		const result = await cmsService.getRegisteredServers(ownerUri, relativePath);
		if (result && result.registeredServersList && result.registeredServersList) {
			return result;
		}
	}

	public async createCmsServer(connection: azdata.connection.Connection,
		name: string, description: string): Promise<CreateCmsResult> {
		let provider = await this.getCmsService();
		connection.providerName = connection.providerName === cmsProvider ? mssqlProvider : connection.providerName;
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			let initialConnectionProfile = this.getConnectionProfile(connection);
			let result = await azdata.connection.connect(initialConnectionProfile, false, false);
			ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			// If the ownerUri is still undefined, then open a connection dialog with the connection
			if (!ownerUri) {
				try {
					let result = await this.connection(initialConnectionProfile);
					if (result) {
						ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
						connection = result;
					}
				} catch (error) {
					throw error;
				}
			}
		}
		try {
			let result = await provider.createCmsServer(name, description, connection, ownerUri);
			const createCmsResult: CreateCmsResult = {
				listRegisteredServersResult: result,
				connection: connection,
				ownerUri: ownerUri
			};
			return createCmsResult;
		} catch (error) {
			throw error;
		}
	}

	public async deleteCmsServer(cmsServerName: string, connection: azdata.connection.Connection): Promise<void> {
		let config = this.getConfiguration();
		if (config && config.servers) {
			let newServers = config.servers.filter((cachedServer) => {
				return cachedServer.name !== cmsServerName;
			});
			await this.setConfiguration(newServers);
			this._registeredCmsServers = this._registeredCmsServers.filter((cachedServer) => {
				return cachedServer.name !== cmsServerName;
			});
		}
		if (connection.options.authenticationType === sqlLoginAuthType && connection.options.savePassword) {
			this._credentialProvider.deleteCredential(connection.options.user);
		}
	}

	public async cacheRegisteredCmsServer(name: string, description: string, ownerUri: string, connection: azdata.connection.Connection): Promise<void> {
		let cmsServerNode: ICmsResourceNodeInfo = {
			name: name,
			description: description,
			connection: connection,
			ownerUri: ownerUri
		};

		// update a server if a server with same name exists
		this._registeredCmsServers = this._registeredCmsServers.filter((server) => {
			return server.name !== name;
		});
		this._registeredCmsServers.push(cmsServerNode);

		// save the CMS Servers for future use
		let toSaveCmsServers: ICmsResourceNodeInfo[] = JSON.parse(JSON.stringify(this._registeredCmsServers));
		toSaveCmsServers.forEach(server => {
			server.ownerUri = undefined;
			// don't save password in config
			server.connection.options.password = '';
		});
		await this.setConfiguration(toSaveCmsServers);
	}

	public async addRegisteredServer(relativePath: string, ownerUri: string,
		parentServerName?: string): Promise<boolean> {
		let provider = await this.getCmsService();
		// Initial profile to disallow SQL Login without
		// changing provider.
		let initialProfile: azdata.IConnectionProfile = {
			connectionName: undefined,
			serverName: undefined,
			databaseName: undefined,
			userName: undefined,
			password: undefined,
			authenticationType: undefined,
			savePassword: undefined,
			groupFullName: undefined,
			groupId: undefined,
			providerName: undefined,
			saveProfile: undefined,
			id: undefined,
			options: {
				authTypeChanged: true
			}
		};
		try {
			let connection = await this.openConnectionDialog([cmsProvider], initialProfile, { saveConnection: false });
			if (connection && connection.options) {
				if (connection.options.server === parentServerName) {
					// error out for same server registration
					let errorText = localize('cms.errors.sameServerUnderCms', 'You cannot add a shared registered server with the same name as the Configuration Server');
					this.showErrorMessage(errorText);
					return false;
				} else {
					let registeredServerName = connection.options.registeredServerName === '' ? connection.options.server : connection.options.registeredServerName;
					let result = await provider.addRegisteredServer(ownerUri, relativePath, registeredServerName, connection.options.registeredServerDescription, connection);
					if (result) {
						return Promise.resolve(result);
					}
				}
			}
		} catch (error) {
			throw error;
		}
	}

	public async removeRegisteredServer(registeredServerName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		let result = await provider.removeRegisteredServer(ownerUri, relativePath, registeredServerName);
		return result;
	}

	public async addServerGroup(groupName: string, groupDescription: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		let result = await provider.addServerGroup(ownerUri, relativePath, groupName, groupDescription);
		return result;
	}

	public async removeServerGroup(groupName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		let result = await provider.removeServerGroup(ownerUri, relativePath, groupName);
		return result;
	}

	// Getters
	public get registeredCmsServers(): ICmsResourceNodeInfo[] {
		return this._registeredCmsServers;
	}

	public async credentialProvider(): Promise<azdata.CredentialProvider> {
		if (!this._credentialProvider) {
			this._credentialProvider = await azdata.credentials.getProvider(CredentialNamespace);
		}
		return this._credentialProvider;
	}

	public async connection(initialConnectionProfile?: azdata.IConnectionProfile): Promise<azdata.connection.Connection> {
		if (!initialConnectionProfile) {
			initialConnectionProfile = {
				connectionName: undefined,
				serverName: undefined,
				databaseName: undefined,
				userName: undefined,
				password: undefined,
				authenticationType: undefined,
				savePassword: undefined,
				groupFullName: undefined,
				groupId: undefined,
				providerName: undefined,
				saveProfile: undefined,
				id: undefined,
				options: {}
			};
		}
		try {
			let connection = await this.openConnectionDialog([cmsProvider], initialConnectionProfile, { saveConnection: false });
			if (connection) {
				// remove group ID from connection if a user chose connection
				// from the recent connections list
				connection.options['groupId'] = null;
				connection.providerName = mssqlProvider;
				if (connection.options.savePassword) {
					await this.savePassword(connection.options.user, connection.options.password);
				}
				return connection;
			} else {
				return Promise.reject();
			}
		} catch (error) {
			throw error;
		}
	}

	// Static Functions

	public getConnectionProfile(connection: azdata.connection.Connection): azdata.IConnectionProfile {
		let connectionProfile: azdata.IConnectionProfile = {
			connectionName: connection.options.connectionName,
			serverName: connection.options.server,
			databaseName: undefined,
			userName: connection.options.user,
			password: connection.options.password,
			authenticationType: connection.options.authenticationType,
			savePassword: connection.options.savePassword,
			groupFullName: undefined,
			groupId: undefined,
			providerName: connection.providerName,
			saveProfile: false,
			id: connection.connectionId,
			options: connection.options
		};
		return connectionProfile;
	}

	public didConnectionChange(connectionA: azdata.connection.Connection, connectionB: azdata.connection.Connection): boolean {
		return (connectionA !== connectionB) || ((connectionA.connectionId === connectionB.connectionId) &&
			(connectionA.options.savePassword !== connectionA.options.savePassword));
	}

}