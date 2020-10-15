/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { IPathService, AbstractPathService } from 'vs/workbench/services/path/common/pathService';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';

export class BrowserPathService extends AbstractPathService {

	readonly defaultUriScheme = defaultUriScheme(this.environmentService, this.contextService);

	constructor(
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService
	) {
		super(URI.from({ scheme: defaultUriScheme(environmentService, contextService), authority: environmentService.configuration.remoteAuthority, path: '/' }), remoteAgentService);
	}
}

function defaultUriScheme(environmentService: IWorkbenchEnvironmentService, contextService: IWorkspaceContextService): string {
	if (environmentService.configuration.remoteAuthority) {
		return Schemas.vscodeRemote;
	}

	const firstFolder = contextService.getWorkspace().folders[0];
	if (!firstFolder) {
		throw new Error('Empty workspace is not supported in browser when there is no remote connection.');
	}

	return firstFolder.uri.scheme;
}

registerSingleton(IPathService, BrowserPathService, true);
