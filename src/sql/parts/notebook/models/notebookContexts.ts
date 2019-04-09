/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'azdata';

import { localize } from 'vs/nls';
import { IDefaultConnection, notebookConstants } from 'sql/parts/notebook/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';

export class NotebookContexts {
	private static MSSQL_PROVIDER = 'MSSQL';

	private static get DefaultContext(): IDefaultConnection {
		let defaultConnection: ConnectionProfile = <any>{
			providerName: NotebookContexts.MSSQL_PROVIDER,
			id: '-1',
			serverName: localize('selectConnection', 'Select connection')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: defaultConnection,
			otherConnections: [defaultConnection]
		};
	}

	private static get LocalContext(): IDefaultConnection {
		let localConnection: ConnectionProfile = <any>{
			providerName: NotebookContexts.MSSQL_PROVIDER,
			id: '-1',
			serverName: localize('localhost', 'localhost')
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: localConnection,
			otherConnections: [localConnection]
		};
	}

	/**
	 * Get all of the applicable contexts for a given kernel
	 * @param connectionService connection management service
	 * @param connProviderIds array of connection provider ids applicable for a kernel
	 * @param kernelChangedArgs kernel changed args (both old and new kernel info)
	 * @param profile current connection profile
	 */
	public static async getContextsForKernel(model: NotebookModel, connectionService: IConnectionManagementService, connProviderIds: string[], kernelChangedArgs?: nb.IKernelChangedArgs, profile?: IConnectionProfile): Promise<IDefaultConnection> {
		let connections: IDefaultConnection = this.DefaultContext;
		if (!profile) {
			if (!kernelChangedArgs || !kernelChangedArgs.newValue ||
				(kernelChangedArgs.oldValue && kernelChangedArgs.newValue.id === kernelChangedArgs.oldValue.id)) {
				// nothing to do, kernels are the same or new kernel is undefined
				return connections;
			}
		}
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name && connProviderIds.length < 1) {
			return connections;
		} else {
			connections = await this.getActiveContexts(model, connectionService, connProviderIds, profile);
		}
		return connections;
	}

	/**
	 * Get all active contexts and sort them
	 * @param apiWrapper ApiWrapper
	 * @param profile current connection profile
	 */
	public static async getActiveContexts(model: NotebookModel, connectionService: IConnectionManagementService, connProviderIds: string[], profile: IConnectionProfile): Promise<IDefaultConnection> {
		// If no connection provider ids exist for a given kernel, the attach to should show localhost
		if (connProviderIds.length === 0) {
			return NotebookContexts.LocalContext;
		}

		let activeConnections: ConnectionProfile[] = Array.from(model.connectionsForAttachTo.values());
		// If no active connections exist, show "Select connection" as the default value
		if (activeConnections) {
			if (activeConnections.length === 0) {
				return NotebookContexts.DefaultContext;
			}
			// Filter active connections by their provider ids to match kernel's supported connection providers
			else if (activeConnections.length > 0) {
				let connections = activeConnections.filter(connection => {
					return connProviderIds.includes(connection.providerName);
				});
				if (connections && connections.length === 0) {
					return NotebookContexts.DefaultContext;
				}
				activeConnections = [];
				connections.forEach(connection => activeConnections.push(connection));
			}
		}
		let newConnection = <ConnectionProfile><any>{
			providerName: 'SQL',
			id: '-2',
			serverName: localize('addConnection', 'Add new connection')
		};
		activeConnections.push(newConnection);

		return {
			otherConnections: activeConnections,
			defaultConnection: NotebookContexts.DefaultContext.defaultConnection
		};
	}

	/**
	 *
	 * @param specs kernel specs (comes from session manager)
	 * @param displayName kernel info loaded from
	 */
	public static getDefaultKernel(specs: nb.IAllKernels, displayName: string): nb.IKernelSpec {
		let defaultKernel: nb.IKernelSpec;
		if (specs) {
			// find the saved kernel (if it exists)
			if (displayName) {
				defaultKernel = specs.kernels.find((kernel) => kernel.display_name === displayName);
			}
			// if no saved kernel exists, use the default KernelSpec
			if (!defaultKernel) {
				defaultKernel = specs.kernels.find((kernel) => kernel.name === specs.defaultKernel);
			}
			if (defaultKernel) {
				return defaultKernel;
			}
		}

		// If no default kernel specified (should never happen), default to SQL
		if (!defaultKernel) {
			defaultKernel = notebookConstants.sqlKernelSpec;
		}
		return defaultKernel;
	}
}
