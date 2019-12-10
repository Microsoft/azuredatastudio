/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { EditorOptions } from 'vs/workbench/common/editor';
import * as DOM from 'vs/base/browser/dom';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

import { CancellationToken } from 'vs/base/common/cancellation';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { NotebookModule } from 'sql/workbench/contrib/notebook/browser/notebook.module';
import { NOTEBOOK_SELECTOR } from 'sql/workbench/contrib/notebook/browser/notebook.component';
import { INotebookParams, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ACTION_IDS, NOTEBOOK_MAX_MATCHES, IFindNotebookController, FindWidget, IConfigurationChangedEvent } from 'sql/workbench/contrib/notebook/find/notebookFindWidget';
import { IOverlayWidget } from 'vs/editor/browser/editorBrowser';
import { FindReplaceState, FindReplaceStateChangedEvent } from 'vs/editor/contrib/find/findState';
import { IEditorAction, ScrollType } from 'vs/editor/common/editorCommon';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { NotebookFindNextAction, NotebookFindPreviousAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService, ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { INotebookModel, INotebookFindModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { Command } from 'vs/editor/browser/editorExtensions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { NOTEBOOK_COMMAND_SEARCH, NOTEBOOK_COMMAND_CLOSE_SEARCH, NotebookEditorVisibleContext } from 'sql/workbench/services/notebook/common/notebookContext';
import { IDisposable, DisposableStore, dispose } from 'vs/base/common/lifecycle';
import { IModelDecorationsChangeAccessor, IModelDeltaDecoration } from 'vs/editor/common/model';
import { NotebookFindDecorations, NotebookRange } from 'sql/workbench/contrib/notebook/find/notebookFindDecorations';
import { TimeoutTimer } from 'vs/base/common/async';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { onUnexpectedError } from 'vs/base/common/errors';
import { NotebookFindModel } from 'sql/workbench/contrib/notebook/find/notebookFindModel';

export class NotebookEditor extends BaseEditor implements IFindNotebookController {

	public static ID: string = 'workbench.editor.notebookEditor';
	private _notebookContainer: HTMLElement;
	private _currentDimensions: DOM.Dimension;
	private _overlay: HTMLElement;
	private _findState: FindReplaceState;
	private _finder: FindWidget;
	private _actionMap: { [x: string]: IEditorAction } = {};
	private _onDidChangeConfiguration = new Emitter<IConfigurationChangedEvent>();
	public onDidChangeConfiguration: Event<IConfigurationChangedEvent> = this._onDidChangeConfiguration.event;
	private _notebookModel: INotebookModel;
	private _notebookFindModel: INotebookFindModel;
	private _findCountChangeListener: IDisposable;
	private _currentMatch: NotebookRange;
	private _previousMatch: NotebookRange;
	private readonly _decorations: NotebookFindDecorations;
	private readonly _toDispose = new DisposableStore();
	private readonly _startSearchingTimer: TimeoutTimer;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@INotebookService private _notebookService?: INotebookService
	) {
		super(NotebookEditor.ID, telemetryService, themeService, storageService);
		this._startSearchingTimer = new TimeoutTimer();
		this._decorations = new NotebookFindDecorations(this);
		this._toDispose.add(this._decorations);
		this._decorations.setStartPosition(this.getPosition());
		this._actionMap[ACTION_IDS.FIND_NEXT] = this._instantiationService.createInstance(NotebookFindNextAction, this);
		this._actionMap[ACTION_IDS.FIND_PREVIOUS] = this._instantiationService.createInstance(NotebookFindPreviousAction, this);
	}

	public dispose(): void {
		dispose(this._startSearchingTimer);
		this._toDispose.dispose();
	}

	public get notebookInput(): NotebookInput {
		return this.input as NotebookInput;
	}

	public getPosition(): NotebookRange {
		return this._currentMatch;
	}

	public getLastPosition(): NotebookRange {
		return this._previousMatch;
	}

	public getCellEditor(cellGuid: string): BaseTextEditor | undefined {
		let editorImpl = this._notebookService.findNotebookEditor(this.notebookInput.notebookUri);
		if (editorImpl) {
			let cellEditorProvider = editorImpl.cellEditors.filter(c => c.cellGuid() === cellGuid)[0];
			return cellEditorProvider ? cellEditorProvider.getEditor() : undefined;
		}
		return undefined;
	}

	// updateDecorations is only used for modifying decorations on markdown cells
	// changeDecorations is the function that handles the decorations w.r.t codeEditor cells.
	public updateDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		let editorImpl = this._notebookService.findNotebookEditor(this.notebookInput.notebookUri);
		if (editorImpl) {
			editorImpl.deltaDecorations(newDecorationRange, oldDecorationRange);
		}
	}

	public changeDecorations(callback: (changeAccessor: IModelDecorationsChangeAccessor) => any): any {
		if (!this._notebookFindModel) {
			// callback will not be called
			return null;
		}
		return this._notebookFindModel.changeDecorations(callback, undefined);
	}

	public deltaDecorations(oldDecorations: string[], newDecorations: IModelDeltaDecoration[]): string[] {
		return undefined;
	}

	async setNotebookModel(): Promise<void> {
		let notebookEditorModel = await this.notebookInput.resolve();
		if (notebookEditorModel) {
			this._notebookModel = notebookEditorModel.getNotebookModel();
			this._notebookFindModel = new NotebookFindModel(this._notebookModel);
		}
	}

	public getNotebookModel(): INotebookModel {
		return this._notebookModel;
	}

	public getNotebookFindModel(): INotebookFindModel {
		return this._notebookFindModel;
	}

	/**
	 * @param parent Called to create the editor in the parent element.
	 */
	public createEditor(parent: HTMLElement): void {
		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets monaco-editor';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';

		this._findState = new FindReplaceState();
		this._findState.onFindReplaceStateChange(e => this._onFindStateChange(e));

		this._finder = new FindWidget(
			this,
			this._findState,
			this._contextViewService,
			this._keybindingService,
			this._contextKeyService,
			this._themeService
		);
		this._finder.getDomNode().style.visibility = 'hidden';
	}

	/**
	 * Sets focus on this editor. Specifically, it sets the focus on the hosted text editor.
	 */
	public focus(): void {
	}

	/**
	 * Updates the internal variable keeping track of the editor's size, and re-calculates the sash position.
	 * To be called when the container of this editor changes size.
	 */
	public layout(dimension: DOM.Dimension): void {
		this._currentDimensions = dimension;
		if (this.notebookInput) {
			this.notebookInput.doChangeLayout();
		}
	}

	public async setInput(input: NotebookInput, options: EditorOptions): Promise<void> {
		if (this.input && this.input.matches(input)) {
			return Promise.resolve(undefined);
		}

		const parentElement = this.getContainer();

		super.setInput(input, options, CancellationToken.None);
		DOM.clearNode(parentElement);
		parentElement.appendChild(this._overlay);

		if (!input.hasBootstrapped) {
			let container = DOM.$<HTMLElement>('.notebookEditor');
			container.style.height = '100%';
			this._notebookContainer = DOM.append(parentElement, container);
			input.container = this._notebookContainer;
			return Promise.resolve(this.bootstrapAngular(input));
		} else {
			this._notebookContainer = DOM.append(parentElement, input.container);
			input.doChangeLayout();
			return Promise.resolve(null);
		}
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(input: NotebookInput): void {
		// Get the bootstrap params and perform the bootstrap
		input.hasBootstrapped = true;
		let params: INotebookParams = {
			notebookUri: input.notebookUri,
			input: input,
			providerInfo: input.getProviderInfo(),
			profile: input.connectionProfile
		};
		bootstrapAngular(this._instantiationService,
			NotebookModule,
			this._notebookContainer,
			NOTEBOOK_SELECTOR,
			params,
			input
		);
	}

	public getConfiguration() {
		return {
			layoutInfo: {
				width: this._currentDimensions ? this._currentDimensions.width : 0,
				height: this._currentDimensions ? this._currentDimensions.height : 0
			}
		};
	}

	public layoutOverlayWidget(widget: IOverlayWidget): void {
		// no op
	}

	public addOverlayWidget(widget: IOverlayWidget): void {
		let domNode = widget.getDomNode();
		domNode.style.right = '28px';
		domNode.style.top = '34px';
		this._overlay.appendChild(domNode);
		this._findState.change({ isRevealed: false }, false);
	}

	public getAction(id: string): IEditorAction {
		return this._actionMap[id];
	}


	private async _onFindStateChange(e: FindReplaceStateChangedEvent): Promise<void> {
		if (!this._notebookModel) {
			await this.setNotebookModel();
		}
		if (this._findCountChangeListener === undefined && this._notebookModel) {
			this._findCountChangeListener = this._notebookFindModel.onFindCountChange(() => this._updateFinderMatchState());
		}
		if (e.isRevealed) {
			if (this._findState.isRevealed) {
				this._finder.getDomNode().style.visibility = 'visible';
				this._finder.focusFindInput();
				this._updateFinderMatchState();
				// if find is closed and opened again, highlight the last position.
				this._decorations.setStartPosition(this.getPosition());
			} else {
				this._finder.getDomNode().style.visibility = 'hidden';
				this._decorations.clearDecorations();
			}
		}

		if (e.searchString) {
			this._decorations.clearDecorations();
			if (this._notebookModel) {
				if (this._findState.searchString) {
					let findScope = this._decorations.getFindScope();
					if (findScope !== null) {
						if (findScope && findScope.startLineNumber !== findScope.endLineNumber) {
							if (findScope.endColumn === 1) {
								findScope = new NotebookRange(findScope.cell, findScope.startLineNumber, 1, findScope.endLineNumber - 1, this._notebookFindModel.getLineMaxColumn(findScope.endLineNumber - 1));
							} else {
								// multiline find scope => expand to line starts / ends
								findScope = new NotebookRange(findScope.cell, findScope.startLineNumber, 1, findScope.endLineNumber, this._notebookFindModel.getLineMaxColumn(findScope.endLineNumber));
							}
							this._setCurrentFindMatch(findScope);
						}
					}
					this._notebookFindModel.find(this._findState.searchString, NOTEBOOK_MAX_MATCHES).then(findRange => {
						if (findRange) {
							this.updatePosition(findRange);
						} else if (this._notebookFindModel.findMatches.length > 0) {
							this.updatePosition(this._notebookFindModel.findMatches[0].range);
						} else {
							return;
						}
						this._updateFinderMatchState();
						this._finder.focusFindInput();
						this._decorations.set(this._notebookFindModel.findMatches, this._currentMatch);
						this._findState.changeMatchInfo(
							1,
							this._decorations.getCount(),
							this._currentMatch
						);
						this._setCurrentFindMatch(this._currentMatch);
					});
				} else {
					this._notebookFindModel.clearFind();
				}
			}
		}
	}

	public getSelection(): NotebookRange | null {
		if (!this._notebookModel) {
			return null;
		}
		return this._currentMatch;
	}

	public setSelection(range: NotebookRange): void {
		this._previousMatch = this._currentMatch;
		this._currentMatch = range;
	}

	public toggleSearch(reveal: boolean): void {
		if (reveal) {
			this._findState.change({
				isRevealed: true
			}, false);
			this._finder.focusFindInput();
		} else {
			this._findState.change({
				isRevealed: false
			}, false);
		}
	}

	public findNext(): void {
		this._notebookFindModel.findNext().then(p => {
			this.updatePosition(p);
			this._updateFinderMatchState();
			this._setCurrentFindMatch(p);
		}, er => { onUnexpectedError(er); });
	}

	private updatePosition(range: NotebookRange): void {
		this._previousMatch = this._currentMatch;
		this._currentMatch = range;
	}

	private _setCurrentFindMatch(match: NotebookRange): void {
		if (match) {
			this._notebookModel.updateActiveCell(match.cell);
			this._decorations.setCurrentFindMatch(match);
			this.setSelection(match);
			this._revealRangeInCenterIfOutsideViewport(match, ScrollType.Smooth);
		}
	}

	private _revealRangeInCenterIfOutsideViewport(match: NotebookRange, scrollType: ScrollType): void {
		let matchEditor = this.getCellEditor(match.cell.cellGuid);
		if (matchEditor && matchEditor instanceof BaseTextEditor) {
			matchEditor.getContainer().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			matchEditor.getControl().revealRangeInCenterIfOutsideViewport(match, ScrollType.Smooth);
		}
	}


	public findPrevious(): void {
		this._notebookFindModel.findPrevious().then(p => {
			this.updatePosition(p);
			this._updateFinderMatchState();
			this._setCurrentFindMatch(p);
		}, er => { onUnexpectedError(er); });
	}

	private _updateFinderMatchState(): void {
		if (this.notebookInput && this._notebookFindModel) {
			this._findState.changeMatchInfo(this._notebookFindModel.getFindIndex(), this._notebookFindModel.getFindCount(), this._currentMatch);
		} else {
			this._findState.changeMatchInfo(0, 0, undefined);
		}
	}
}

abstract class SettingsCommand extends Command {

	protected getNotebookEditor(accessor: ServicesAccessor): NotebookEditor {
		const activeEditor = accessor.get(IEditorService).activeControl;
		if (activeEditor instanceof NotebookEditor) {
			return activeEditor;
		}
		return null;
	}

}

class StartSearchNotebookCommand extends SettingsCommand {

	public runCommand(accessor: ServicesAccessor, args: any): void {
		const NotebookEditor = this.getNotebookEditor(accessor);
		if (NotebookEditor) {
			NotebookEditor.toggleSearch(true);
		}
	}

}

const command = new StartSearchNotebookCommand({
	id: NOTEBOOK_COMMAND_SEARCH,
	precondition: ContextKeyExpr.and(NotebookEditorVisibleContext),
	kbOpts: {
		primary: KeyMod.CtrlCmd | KeyCode.KEY_F,
		weight: KeybindingWeight.EditorContrib
	}
});
command.register();

class CloseSearchNotebookCommand extends SettingsCommand {

	public runCommand(accessor: ServicesAccessor, args: any): void {
		const NotebookEditor = this.getNotebookEditor(accessor);
		if (NotebookEditor) {
			NotebookEditor.toggleSearch(false);
		}
	}

}

const command2 = new CloseSearchNotebookCommand({
	id: NOTEBOOK_COMMAND_CLOSE_SEARCH,
	precondition: ContextKeyExpr.and(NotebookEditorVisibleContext),
	kbOpts: {
		primary: KeyCode.Escape,
		weight: KeybindingWeight.EditorContrib
	}
});
command2.register();
