/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as azdata from 'azdata';
import { SemVer } from 'semver';

export const NoteBookEnvironmentVariablePrefix = 'AZDATA_NB_VAR_';

export interface ResourceType {
	name: string;
	displayName: string;
	description: string;
	platforms: string[];
	icon: { light: string; dark: string };
	options: ResourceTypeOption[];
	providers: DeploymentProvider[];
	getProvider(selectedOptions: { option: string, value: string }[]): DeploymentProvider | undefined;
}

export interface ResourceTypeOption {
	name: string;
	displayName: string;
	values: ResourceTypeOptionValue[];
}

export interface ResourceTypeOptionValue {
	name: string;
	displayName: string;
}

export interface DeploymentProvider {
	title: string;
	dialog: DialogInfo;
	notebook: string | NotebookInfo;
	downloadUrl: string;
	webPageUrl: string;
	wizard: WizardInfo;
	requiredTools: ToolRequirementInfo[];
	when: string;
}

export interface WizardInfo {
	notebook: string | NotebookInfo;
	type: BdcDeploymentType;
}

export interface DialogInfo {
	notebook: string | NotebookInfo;
	title: string;
	name: string;
	tabs: DialogTabInfo[];
}

export interface DialogTabInfo {
	title: string;
	sections: SectionInfo[];
	labelWidth?: string;
	inputWidth?: string;
}

export interface SectionInfo {
	title: string;
	fields?: FieldInfo[]; // Use this if the dialog is not wide. All fields will be displayed in one column, label will be placed on top of the input component.
	rows?: RowInfo[]; // Use this for wide dialog or wizard. label will be placed to the left of the input component.
	labelWidth?: string;
	inputWidth?: string;
	labelOnLeft?: boolean; // label position. true: label on the left side of field, false: label on top of field, default is false.
	collapsible?: boolean;
	collapsed?: boolean;
	spaceBetweenFields?: string;
}

export interface RowInfo {
	fields: FieldInfo[];
}

export interface FieldInfo {
	label: string;
	variableName?: string;
	type: FieldType;
	defaultValue?: string;
	confirmationRequired?: boolean;
	confirmationLabel?: string;
	min?: number;
	max?: number;
	required?: boolean;
	options?: string[] | azdata.CategoryValue[];
	placeHolder?: string;
	userName?: string; // needed for sql server's password complexity requirement check, password can not include the login name.
	labelWidth?: string;
	inputWidth?: string;
	description?: string;
	useCustomValidator?: boolean;
	labelOnLeft?: boolean; // overwrite the labelOnLeft of SectionInfo.
	fontStyle?: string;
}

export enum FieldType {
	Text = 'text',
	Number = 'number',
	DateTimeText = 'datetime_text',
	SQLPassword = 'sql_password',
	Password = 'password',
	Options = 'options',
	ReadonlyText = 'readonly_text',
	Checkbox = 'checkbox'
}

export interface NotebookInfo {
	win32: string;
	darwin: string;
	linux: string;
}

export interface ToolRequirementInfo {
	name: string;
	version: string;
}

export enum ToolType {
	AzCli,
	KubeCtl,
	Docker,
	Azdata
}

export interface ITool {
	readonly name: string;
	readonly displayName: string;
	readonly description: string;
	readonly type: ToolType;
	readonly version: SemVer | undefined;
	readonly homePage: string;
	readonly isInstalled: boolean;
	loadInformation(): Thenable<void>;
}

export enum BdcDeploymentType {
	NewAKS = 'new-aks',
	ExistingAKS = 'existing-aks',
	ExistingKubeAdm = 'existing-kubeadm'
}
