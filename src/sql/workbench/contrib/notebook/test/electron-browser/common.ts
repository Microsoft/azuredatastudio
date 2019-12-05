/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IConnectionProfile } from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { INotebookModel, ICellModel, IClientSession, NotebookContentChange } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';
import { INotebookManager, INotebookService, INotebookEditor, ILanguageMagic, INotebookProvider, INavigationProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IStandardKernelWithProvider } from 'sql/workbench/contrib/notebook/browser/models/notebookUtils';
import { URI } from 'vs/workbench/workbench.web.api';
import { RenderMimeRegistry } from 'sql/workbench/contrib/notebook/browser/outputs/registry';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export class NotebookModelStub implements INotebookModel {
	constructor(private _languageInfo?: nb.ILanguageInfo) {
	}
	public trustedMode: boolean;
	language: string;
	standardKernels: IStandardKernelWithProvider[];

	public get languageInfo(): nb.ILanguageInfo {
		return this._languageInfo;
	}
	onCellChange(cell: ICellModel, change: NotebookChangeType): void {
		// Default: do nothing
	}
	get cells(): ReadonlyArray<ICellModel> {
		throw new Error('method not implemented.');
	}
	get activeCell(): ICellModel {
		throw new Error('method not implemented.');
	}
	get clientSession(): IClientSession {
		throw new Error('method not implemented.');
	}
	get notebookManagers(): INotebookManager[] {
		throw new Error('method not implemented.');
	}
	get kernelChanged(): Event<nb.IKernelChangedArgs> {
		throw new Error('method not implemented.');
	}
	get kernelsChanged(): Event<nb.IKernelSpec> {
		throw new Error('method not implemented.');
	}
	get layoutChanged(): Event<void> {
		throw new Error('method not implemented.');
	}
	get defaultKernel(): nb.IKernelSpec {
		throw new Error('method not implemented.');
	}
	get contextsChanged(): Event<void> {
		throw new Error('method not implemented.');
	}
	get contextsLoading(): Event<void> {
		throw new Error('method not implemented.');
	}
	get contentChanged(): Event<NotebookContentChange> {
		throw new Error('method not implemented.');
	}
	get specs(): nb.IAllKernels {
		throw new Error('method not implemented.');
	}
	get context(): ConnectionProfile {
		throw new Error('method not implemented.');
	}
	get providerId(): string {
		throw new Error('method not implemented.');
	}
	get applicableConnectionProviderIds(): string[] {
		throw new Error('method not implemented.');
	}
	getStandardKernelFromName(name: string): IStandardKernelWithProvider {
		throw new Error('Method not implemented.');
	}
	changeKernel(displayName: string): void {
		throw new Error('Method not implemented.');
	}
	changeContext(host: string, connection?: IConnectionProfile, hideErrorMessage?: boolean): Promise<void> {
		throw new Error('Method not implemented.');
	}
	findCellIndex(cellModel: ICellModel): number {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number): void {
		throw new Error('Method not implemented.');
	}
	deleteCell(cellModel: ICellModel): void {
		throw new Error('Method not implemented.');
	}
	pushEditOperations(edits: ISingleNotebookEditOperation[]): void {
		throw new Error('Method not implemented.');
	}
	getApplicableConnectionProviderIds(kernelName: string): string[] {
		throw new Error('Method not implemented.');
	}
	get onValidConnectionSelected(): Event<boolean> {
		throw new Error('method not implemented.');
	}
	get onProviderIdChange(): Event<string> {
		throw new Error('method not impelemented.');
	}
	toJSON(): nb.INotebookContents {
		throw new Error('Method not implemented.');
	}
	serializationStateChanged(changeType: NotebookChangeType): void {
		throw new Error('Method not implemented.');
	}
	get onActiveCellChanged(): Event<ICellModel> {
		throw new Error('Method not implemented.');
	}
	updateActiveCell(cell: ICellModel) {
		throw new Error('Method not implemented.');
	}

}

export class NotebookManagerStub implements INotebookManager {
	providerId: string;
	contentManager: nb.ContentManager;
	sessionManager: nb.SessionManager;
	serverManager: nb.ServerManager;
}

export class ServerManagerStub implements nb.ServerManager {
	public onServerStartedEmitter = new Emitter<void>();
	onServerStarted: Event<void> = this.onServerStartedEmitter.event;
	isStarted: boolean = false;
	calledStart: boolean = false;
	calledEnd: boolean = false;
	public result: Promise<void> = undefined;

	startServer(): Promise<void> {
		this.calledStart = true;
		return this.result;
	}
	stopServer(): Promise<void> {
		this.calledEnd = true;
		return this.result;
	}
}

export class NotebookServiceStub implements INotebookService {
	_serviceBrand: undefined;
	onNotebookEditorAdd: Event<INotebookEditor>;
	onNotebookEditorRemove: Event<INotebookEditor>;
	onNotebookEditorRename: Event<INotebookEditor>;
	isRegistrationComplete: boolean;
	registrationComplete: Promise<void>;
	languageMagics: ILanguageMagic[];
	registerProvider(providerId: string, provider: INotebookProvider): void {
		throw new Error('Method not implemented.');
	}
	unregisterProvider(providerId: string): void {
		throw new Error('Method not implemented.');
	}
	registerNavigationProvider(provider: INavigationProvider): void {
		throw new Error('Method not implemented.');
	}
	getNavigationProvider(notebookUri: URI): INavigationProvider {
		throw new Error('Method not implemented.');
	}
	getSupportedFileExtensions(): string[] {
		throw new Error('Method not implemented.');
	}
	getProvidersForFileType(fileType: string): string[] {
		throw new Error('Method not implemented.');
	}
	getStandardKernelsForProvider(provider: string): nb.IStandardKernel[] {
		throw new Error('Method not implemented.');
	}
	getOrCreateNotebookManager(providerId: string, uri: URI): Thenable<INotebookManager> {
		throw new Error('Method not implemented.');
	}
	addNotebookEditor(editor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	removeNotebookEditor(editor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	listNotebookEditors(): INotebookEditor[] {
		throw new Error('Method not implemented.');
	}
	findNotebookEditor(notebookUri: URI): INotebookEditor {
		throw new Error('Method not implemented.');
	}
	getMimeRegistry(): RenderMimeRegistry {
		throw new Error('Method not implemented.');
	}
	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void {
		throw new Error('Method not implemented.');
	}
	isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel): void {
		throw new Error('Method not implemented.');
	}
	navigateTo(notebookUri: URI, sectionId: string): void {
		throw new Error('Method not implemented.');
	}
}
