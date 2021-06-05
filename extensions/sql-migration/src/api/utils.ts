/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DAYS, HRS, MINUTE, SEC } from '../constants/strings';
import { AdsMigrationStatus } from '../dialog/migrationStatus/migrationStatusDialogModel';
import { MigrationContext } from '../models/migrationLocalStorage';

export function deepClone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result: any = Array.isArray(obj) ? [] : {};
	Object.keys(<any>obj).forEach((key: string) => {
		if ((<any>obj)[key] && typeof (<any>obj)[key] === 'object') {
			result[key] = deepClone((<any>obj)[key]);
		} else {
			result[key] = (<any>obj)[key];
		}
	});
	return result;
}

export function getSqlServerName(majorVersion: number): string | undefined {
	switch (majorVersion) {
		case 10:
			return 'SQL Server 2008';
		case 11:
			return 'SQL Server 2012';
		case 12:
			return 'SQL Server 2014';
		case 13:
			return 'SQL Server 2016';
		case 14:
			return 'SQL Server 2017';
		case 15:
			return 'SQL Server 2019';
		default:
			return undefined;
	}
}

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo | undefined {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
	return undefined;
}

/**
 * Generates a wordy time difference between start and end time.
 * @returns stringified duration like '10.0 days', '12.0 hrs', '1.0 min'
 */
export function convertTimeDifferenceToDuration(startTime: Date, endTime: Date): string {
	const time = endTime.getTime() - startTime.getTime();
	let seconds = (time / 1000).toFixed(1);
	let minutes = (time / (1000 * 60)).toFixed(1);
	let hours = (time / (1000 * 60 * 60)).toFixed(1);
	let days = (time / (1000 * 60 * 60 * 24)).toFixed(1);
	if (time / 1000 < 60) {
		return SEC(parseFloat(seconds));
	}
	else if (time / (1000 * 60) < 60) {
		return MINUTE(parseFloat(minutes));
	}
	else if (time / (1000 * 60 * 60) < 24) {
		return HRS(parseFloat(hours));
	}
	else {
		return DAYS(parseFloat(days));
	}
}

export function filterMigrations(databaseMigrations: MigrationContext[], statusFilter: string, databaseNameFilter?: string): MigrationContext[] {
	let filteredMigration: MigrationContext[] = [];
	if (statusFilter === AdsMigrationStatus.ALL) {
		filteredMigration = databaseMigrations;
	} else if (statusFilter === AdsMigrationStatus.ONGOING) {
		filteredMigration = databaseMigrations.filter((value) => {
			const status = value.migrationContext.properties.migrationStatus;
			const provisioning = value.migrationContext.properties.provisioningState;
			return status === 'InProgress' || status === 'Creating' || provisioning === 'Creating';
		});
	} else if (statusFilter === AdsMigrationStatus.SUCCEEDED) {
		filteredMigration = databaseMigrations.filter((value) => {
			const status = value.migrationContext.properties.migrationStatus;
			return status === 'Succeeded';
		});
	} else if (statusFilter === AdsMigrationStatus.FAILED) {
		filteredMigration = databaseMigrations.filter((value) => {
			const status = value.migrationContext.properties.migrationStatus;
			const provisioning = value.migrationContext.properties.provisioningState;
			return status === 'Failed' || provisioning === 'Failed';
		});
	} else if (statusFilter === AdsMigrationStatus.COMPLETING) {
		filteredMigration = databaseMigrations.filter((value) => {
			const status = value.migrationContext.properties.migrationStatus;
			return status === 'Completing';
		});
	}
	if (databaseNameFilter) {
		filteredMigration = filteredMigration.filter((value) => {
			return value.migrationContext.name.toLowerCase().includes(databaseNameFilter.toLowerCase());
		});
	}
	return filteredMigration;
}

export function convertByteSizeToReadableUnit(size: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	for (let i = 1; i < units.length; i++) {
		const higherUnit = size / 1024;
		if (higherUnit < 0.1) {
			return `${size.toFixed(2)} ${units[i - 1]}`;
		}
		size = higherUnit;
	}
	return '';
}
