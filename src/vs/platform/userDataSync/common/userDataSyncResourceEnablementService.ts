/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IUserDataSyncResourceEnablementService, ALL_SYNC_RESOURCES, SyncResource, getEnablementKey } from 'vs/platform/userDataSync/common/userDataSync';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { IStorageService, IStorageValueChangeEvent, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { isWeb } from 'vs/base/common/platform';

type SyncEnablementClassification = {
	enabled?: { classification: 'SystemMetaData', purpose: 'FeatureInsight', isMeasurement: true };
};

export class UserDataSyncResourceEnablementService extends Disposable implements IUserDataSyncResourceEnablementService {

	_serviceBrand: any;

	private _onDidChangeResourceEnablement = new Emitter<[SyncResource, boolean]>();
	readonly onDidChangeResourceEnablement: Event<[SyncResource, boolean]> = this._onDidChangeResourceEnablement.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
	) {
		super();
		this._register(storageService.onDidChangeValue(e => this.onDidStorageChange(e)));
	}

	isResourceEnabled(resource: SyncResource): boolean {
		return this.storageService.getBoolean(getEnablementKey(resource), StorageScope.GLOBAL, true);
	}

	setResourceEnablement(resource: SyncResource, enabled: boolean): void {
		if (this.isResourceEnabled(resource) !== enabled) {
			const resourceEnablementKey = getEnablementKey(resource);
			this.telemetryService.publicLog2<{ enabled: boolean }, SyncEnablementClassification>(resourceEnablementKey, { enabled });
			this.storeResourceEnablement(resourceEnablementKey, enabled);
		}
	}

	getResourceSyncStateVersion(resource: SyncResource): string | undefined {
		return undefined;
	}

	private storeResourceEnablement(resourceEnablementKey: string, enabled: boolean): void {
		this.storageService.store(resourceEnablementKey, enabled, StorageScope.GLOBAL, isWeb ? StorageTarget.USER /* sync in web */ : StorageTarget.MACHINE);
	}

	private onDidStorageChange(storageChangeEvent: IStorageValueChangeEvent): void {
		if (storageChangeEvent.scope === StorageScope.GLOBAL) {
			const resourceKey = ALL_SYNC_RESOURCES.filter(resourceKey => getEnablementKey(resourceKey) === storageChangeEvent.key)[0];
			if (resourceKey) {
				this._onDidChangeResourceEnablement.fire([resourceKey, this.isResourceEnabled(resourceKey)]);
				return;
			}
		}
	}
}
