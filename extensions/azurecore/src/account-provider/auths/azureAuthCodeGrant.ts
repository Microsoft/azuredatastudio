/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as nls from 'vscode-nls';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as http from 'http';

import {
	AzureAuth,
	AccessToken,
	RefreshToken,
	TokenClaims,
	TokenRefreshResponse,
} from './azureAuth';

import {
	AzureAccountProviderMetadata,
	Tenant,
	Resource,
	AzureAuthType,
	Subscription
} from '../interfaces';

import { SimpleWebServer } from './simpleWebServer';
import { SimpleTokenCache } from '../simpleTokenCache';
const localize = nls.loadMessageBundle();

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}
export class AzureAuthCodeGrant extends AzureAuth {
	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureAuthCodeGrantName', 'Azure Auth Code Grant');
	private server: SimpleWebServer;

	constructor(metadata: AzureAccountProviderMetadata,
		_tokenCache: SimpleTokenCache,
		_context: vscode.ExtensionContext) {
		super(metadata, _tokenCache, _context, AzureAuthType.AuthCodeGrant, AzureAuthCodeGrant.USER_FRIENDLY_NAME);
	}

	public async autoOAuthCancelled(): Promise<void> {
		return this.server.shutdown();
	}

	public async login(): Promise<azdata.Account | azdata.PromptFailedResult> {
		let authCompleteDeferred: Deferred<void>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });

		this.server = new SimpleWebServer();
		const nonce = crypto.randomBytes(16).toString('base64');
		let serverPort: string;

		try {
			serverPort = await this.server.startup();
		} catch (err) {
			const msg = localize('azure.serverCouldNotStart', 'Server could not start. This could be a permissions error or an incompatibility on your system.');
			vscode.window.showErrorMessage(msg);
			console.dir(err);
			return { canceled: false } as azdata.PromptFailedResult;
		}

		vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${serverPort}/signin?nonce=${encodeURIComponent(nonce)}`));

		// The login code to use
		let loginUrl: string;
		let codeVerifier: string;
		let scopes: string;
		{
			scopes = this.scopes.join(' ');
			codeVerifier = this.toBase64UrlEncoding(crypto.randomBytes(32).toString('base64'));
			const state = `${serverPort},${encodeURIComponent(nonce)}`;
			const codeChallenge = this.toBase64UrlEncoding(crypto.createHash('sha256').update(codeVerifier).digest('base64'));
			loginUrl = `${this.loginEndpointUrl}${this.commonTenant}/oauth2/v2.0/authorize?response_type=code&response_mode=query&client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes)}&prompt=select_account&code_challenge_method=S256&code_challenge=${codeChallenge}`;
		}

		const authenticatedCode = await this.addServerListeners(this.server, nonce, loginUrl, authCompletePromise);

		let tenants: Tenant[];
		let subscriptions: Subscription[];

		let tokenClaims: TokenClaims;
		let accessToken: AccessToken;
		let refreshToken: RefreshToken;

		for (let resource of this.resources) {
			try {
				const { accessToken: at, refreshToken: rt, tokenClaims: tc } = await this.getTokenWithAuthCode(authenticatedCode, codeVerifier, this.redirectUri, resource);
				tokenClaims = tc;
				accessToken = at;
				refreshToken = rt;
			} catch (ex) {
				if (ex.msg) {
					vscode.window.showErrorMessage(ex.msg);
				}
				console.log(ex);
			}

			if (!accessToken) {
				const msg = localize('azure.tokenFail', "Failure when retreiving tokens.");
				authCompleteDeferred.reject(msg);
				throw Error('Failure when retreiving tokens');
			}

			switch (resource.id) {
				case this.metadata.settings.armResource.id: {
					tenants = await this.getTenants(accessToken);
					subscriptions = await this.getSubscriptions(accessToken);
					break;
				}
			}

			try {
				this.setCachedToken({ accountId: accessToken.key, providerId: this.metadata.id }, resource, accessToken, refreshToken);
			} catch (ex) {
				console.log(ex);
				if (ex.msg) {
					vscode.window.showErrorMessage(ex.msg);
					authCompleteDeferred.reject(ex.msg);
				} else {
					authCompleteDeferred.reject('There was an issue when storing the cache.');
				}

				return { canceled: false } as azdata.PromptFailedResult;
			}
		}
		const account = this.createAccount(tokenClaims, accessToken.key, tenants, subscriptions);
		authCompleteDeferred.resolve();
		return account;
	}

	private async addServerListeners(server: SimpleWebServer, nonce: string, loginUrl: string, authComplete: Promise<void>): Promise<string> {
		const mediaPath = path.join(this._context.extensionPath, 'media');

		// Utility function
		const sendFile = async (res: http.ServerResponse, filePath: string, contentType: string): Promise<void> => {
			let fileContents;
			try {
				fileContents = await fs.readFile(filePath);
			} catch (ex) {
				console.error(ex);
				res.writeHead(200);
				res.end();
				return;
			}

			res.writeHead(200, {
				'Content-Length': fileContents.length,
				'Content-Type': contentType
			});

			res.end(fileContents);
		};

		server.on('/landing.css', (req, reqUrl, res) => {
			sendFile(res, path.join(mediaPath, 'landing.css'), 'text/css; charset=utf-8').catch(console.error);
		});

		server.on('/signin', (req, reqUrl, res) => {
			let receivedNonce: string = reqUrl.query.nonce as string;
			receivedNonce = receivedNonce.replace(/ /g, '+');

			if (receivedNonce !== nonce) {
				res.writeHead(400, { 'content-type': 'text/html' });
				res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
				res.end();
				console.error('nonce no match');
				return;
			}
			res.writeHead(302, { Location: loginUrl });
			res.end();
		});

		return new Promise<string>((resolve, reject) => {
			server.on('/callback', (req, reqUrl, res) => {
				const state = reqUrl.query.state as string ?? '';
				const code = reqUrl.query.code as string ?? '';

				const stateSplit = state.split(',');
				if (stateSplit.length !== 2) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.stateError', "Authentication failed due to a state mismatch, please close ADS and try again."));
					res.end();
					reject(new Error('State mismatch'));
					return;
				}

				if (stateSplit[1] !== nonce) {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(localize('azureAuth.nonceError', "Authentication failed due to a nonce mismatch, please close ADS and try again."));
					res.end();
					reject(new Error('Nonce mismatch'));
					return;
				}

				resolve(code);

				authComplete.then(() => {
					sendFile(res, path.join(mediaPath, 'landing.html'), 'text/html; charset=utf-8').catch(console.error);
				}, (msg) => {
					res.writeHead(400, { 'content-type': 'text/html' });
					res.write(msg);
					res.end();
				});
			});
		});
	}

	private async getTokenWithAuthCode(authCode: string, codeVerifier: string, redirectUri: string, resource: Resource): Promise<TokenRefreshResponse | undefined> {
		const scopes = [...this.metadata.settings.scopes, resource.scopes];
		const postData = {
			grant_type: 'authorization_code',
			code: authCode,
			client_id: this.clientId,
			scope: scopes.join(' '),
			code_verifier: codeVerifier,
			redirect_uri: redirectUri
		};

		return this.getToken(postData, postData.scope, resource);
	}
}
