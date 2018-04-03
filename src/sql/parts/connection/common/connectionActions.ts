/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import Event, { Emitter } from 'vs/base/common/event';
import { IMessageService, Severity, IConfirmation } from 'vs/platform/message/common/message';
import { IQuickOpenService } from 'vs/platform/quickOpen/common/quickOpen';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';

/**
 * Workbench action to clear the recent connnections list
 */
export class ClearRecentConnectionsAction extends Action {

		public static ID = 'clearRecentConnectionsAction';
		public static LABEL = nls.localize('ClearRecentlyUsedLabel', 'Clear Recent Connections List');
		public static ICON = 'search-action clear-search-results';

		private _onRecentConnectionsRemoved = new Emitter<void>();
		public onRecentConnectionsRemoved: Event<void> = this._onRecentConnectionsRemoved.event;

		private _useConfirmationMessage = false;

		constructor(
			id: string,
			label: string,
			@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
			@IMessageService private _messageService: IMessageService,
			@IQuickOpenService private _quickOpenService: IQuickOpenService
		) {
			super(id, label, ClearRecentConnectionsAction.ICON);
			this.enabled = true;
		}

		public set useConfirmationMessage(value: boolean) {
			this._useConfirmationMessage = value;
		}

		public run(): TPromise<void> {
			if (this._useConfirmationMessage) {
				return this.promptConfirmationMessage().then(result => {
					if (result) {
						this._connectionManagementService.clearRecentConnectionsList();
						this._onRecentConnectionsRemoved.fire();
					}
				});
			} else {
				return this.promptQuickOpenService().then(result => {
					if (result) {
						this._connectionManagementService.clearRecentConnectionsList();
						this._messageService.show(Severity.Info, nls.localize('ClearedRecentConnections', 'Recent connections list cleared'));
						this._onRecentConnectionsRemoved.fire();
					}
				});
			}
		}

		private promptQuickOpenService(): TPromise<boolean> {
			const self = this;
			return new TPromise<boolean>((resolve, reject) => {
				let choices: { key, value }[] = [
					{ key: nls.localize('connectionAction.yes', 'Yes'), value: true },
					{ key: nls.localize('connectionAction.no', 'No'), value: false }
				];

				self._quickOpenService.pick(choices.map(x => x.key), { placeHolder: nls.localize('ClearRecentlyUsedLabel', 'Clear Recent Connections List'), ignoreFocusLost: true }).then((choice) => {
					let confirm = choices.find(x => x.key === choice);
					resolve(confirm && confirm.value);
				});
			});
		}

		private promptConfirmationMessage(): TPromise<boolean> {
			let confirm: IConfirmation = {
				message: nls.localize('clearRecentConnectionMessage', 'Are you sure you want to delete all the connections from the list?'),
				primaryButton: nls.localize('connectionDialog.yes', 'Yes'),
				secondaryButton: nls.localize('connectionDialog.no', 'No'),
				type: 'question'
			};

			// @SQLTODO
			return new TPromise<boolean>((resolve, reject) => {
				let confirmed: boolean = this._messageService.confirm(confirm);
				resolve(confirmed);
			});

			//this._messageService.confirm(confirm).then(confirmation => {
			// 	if (!confirmation.confirmed) {
			// 		return TPromise.as(false);
			// 	} else {
			// 		this._connectionManagementService.clearRecentConnectionsList();
			// 		this.open(false);
			// 		return TPromise.as(true);
			// 	}
			// });

			// return this._messageService.confirm(confirm).then(confirmation => {
			// 	if (!confirmation.confirmed) {
			// 		return TPromise.as(false);
			// 	} else {
			// 		this._connectionManagementService.clearRecentConnectionsList();
			// 		this.open(false);
			// 		return TPromise.as(true);
			// 	}
			// });
		}
	}

/**
 * Action to delete one recently used connection from the MRU
 */
export class ClearSingleRecentConnectionAction extends Action {

	public static ID = 'clearSingleRecentConnectionAction';
	public static LABEL = nls.localize('delete', 'Delete');
	private _onRecentConnectionRemoved = new Emitter<void>();
	public onRecentConnectionRemoved: Event<void> = this._onRecentConnectionRemoved.event;

	constructor(
		id: string,
		label: string,
		private _connectionProfile: IConnectionProfile,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): TPromise<void> {
		return new TPromise<void>((resolve, reject) => {
			resolve(this._connectionManagementService.clearRecentConnection(this._connectionProfile));
			this._onRecentConnectionRemoved.fire();
		});
	}
}