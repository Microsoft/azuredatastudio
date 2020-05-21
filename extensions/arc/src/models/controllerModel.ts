/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Authentication } from '../controller/auth';
import { EndpointsRouterApi, EndpointModel, RegistrationRouterApi, RegistrationResponse, TokenRouterApi } from '../controller/generated/v1/api';

export class ControllerModel {
	private _endpointsRouter: EndpointsRouterApi;
	private _tokenRouter: TokenRouterApi;
	private _registrationRouter: RegistrationRouterApi;
	private _endpoints!: EndpointModel[];
	private _namespace!: string;
	private _registrations!: RegistrationResponse[];

	constructor(controllerUrl: string, auth: Authentication) {
		this._endpointsRouter = new EndpointsRouterApi(controllerUrl);
		this._endpointsRouter.setDefaultAuthentication(auth);

		this._tokenRouter = new TokenRouterApi(controllerUrl);
		this._tokenRouter.setDefaultAuthentication(auth);

		this._registrationRouter = new RegistrationRouterApi(controllerUrl);
		this._registrationRouter.setDefaultAuthentication(auth);
	}

	public async refresh(): Promise<void> {
		await Promise.all([
			this._endpointsRouter.apiV1BdcEndpointsGet().then(response => {
				this._endpoints = response.body;
			}),
			this._tokenRouter.apiV1TokenPost().then(async response => {
				this._namespace = response.body.namespace!;
			})
		]).then(async _ => {
			this._registrations = (await this._registrationRouter.apiV1RegistrationListResourcesNsGet(this._namespace)).body;
		});
	}

	public endpoints(): EndpointModel[] {
		return this._endpoints;
	}

	public endpoint(name: string): EndpointModel | undefined {
		return this._endpoints.find(e => e.name === name);
	}

	public namespace(): string {
		return this._namespace;
	}

	public registrations(): RegistrationResponse[] {
		return this._registrations;
	}

	public registration(type: string, namespace: string, name: string): RegistrationResponse | undefined {
		return this._registrations.find(r => {
			// Resources deployed outside the controller's namespace are named in the format 'namespace_name'
			let instanceName = r.instanceName!;
			const parts: string[] = instanceName.split('_');
			if (parts.length === 2) {
				instanceName = parts[1];
			}
			else if (parts.length > 2) {
				throw new Error(`Cannot parse resource '${instanceName}'. Acceptable formats are 'namespace_name' or 'name'.`);
			}
			return r.instanceType === type && r.instanceNamespace === namespace && instanceName === name;
		});
	}
}
