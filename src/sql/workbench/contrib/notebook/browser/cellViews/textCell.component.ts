/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';
import 'vs/css!./media/markdown';
import 'vs/css!./media/highlight';
import * as DOM from 'vs/base/browser/dom';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnChanges, SimpleChange, HostListener, ViewChildren, QueryList } from '@angular/core';
import * as Mark from 'mark.js';

import { localize } from 'vs/nls';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IColorTheme } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { toDisposable } from 'vs/base/common/lifecycle';
import { IMarkdownRenderResult } from 'vs/editor/browser/core/markdownRenderer';

import { NotebookMarkdownRenderer } from 'sql/workbench/contrib/notebook/browser/outputs/notebookMarkdown';
import { CellView } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { CellEditModes, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ISanitizer, defaultSanitizer } from 'sql/workbench/services/notebook/browser/outputs/sanitizer';
import { CodeComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/code.component';
import { NotebookRange, ICellEditorProvider, INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { HTMLMarkdownConverter } from 'sql/workbench/contrib/notebook/browser/htmlMarkdownConverter';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { IResourceUndoRedoElement, IUndoRedoService, UndoRedoElementType } from 'vs/platform/undoRedo/common/undoRedo';

export const TEXT_SELECTOR: string = 'text-cell-component';
const USER_SELECT_CLASS = 'actionselect';
const findHighlightClass = 'rangeHighlight';
const findRangeSpecificClass = 'rangeSpecificHighlight';
@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@ViewChildren(CodeComponent) private markdowncodeCell: QueryList<CodeComponent>;

	@Input() cellModel: ICellModel;

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	@HostListener('document:keydown.escape', ['$event'])
	handleKeyboardEvent() {
		if (this.isEditMode) {
			this.toggleEditMode(false);
		}
		this.cellModel.active = false;
		this._model.updateActiveCell(undefined);
	}

	// Double click to edit text cell in notebook
	@HostListener('dblclick', ['$event']) onDblClick() {
		this.enableActiveCellEditOnDoubleClick();
	}

	@HostListener('document:keydown', ['$event'])
	onkeydown(e: KeyboardEvent) {
		if (DOM.getActiveElement() === this.output?.nativeElement && this.isActive() && this.cellModel?.currentMode === CellEditModes.WYSIWYG) {
			// select the active .
			if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
				preventDefaultAndExecCommand(e, 'selectAll');
			} else if ((e.metaKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y') && !this.markdownMode) {
				this._undoRedoService.redo(this.cellModel.cellRichTextUri);
			} else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
				this._undoRedoService.undo(this.cellModel.cellRichTextUri);
			} else if (e.shiftKey && e.key === 'Tab') {
				preventDefaultAndExecCommand(e, 'outdent');
			} else if (e.key === 'Tab') {
				preventDefaultAndExecCommand(e, 'indent');
			}
		}
	}

	private _content: string | string[];
	private _lastTrustedMode: boolean;
	private isEditMode: boolean;
	private _previewMode: boolean = true;
	private _markdownMode: boolean;
	private _sanitizer: ISanitizer;
	private _model: NotebookModel;
	private _activeCellId: string;
	private readonly _onDidClickLink = this._register(new Emitter<URI>());
	private markdownRenderer: NotebookMarkdownRenderer;
	private markdownResult: IMarkdownRenderResult;
	private _htmlMarkdownConverter: HTMLMarkdownConverter;
	private markdownPreviewLineHeight: number;
	public readonly onDidClickLink = this._onDidClickLink.event;
	public previewFeaturesEnabled: boolean = false;
	public doubleClickEditEnabled: boolean;
	private _highlightRange: NotebookRange;

	private readonly _undoStack = new RichTextEditStack();
	private readonly _redoStack = new RichTextEditStack();

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IConfigurationService) private _configurationService: IConfigurationService,
		@Inject(INotebookService) private _notebookService: INotebookService,
		@Inject(IUndoRedoService) private _undoRedoService: IUndoRedoService
	) {
		super();
		this.markdownRenderer = this._instantiationService.createInstance(NotebookMarkdownRenderer);
		this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
		this.markdownPreviewLineHeight = this._configurationService.getValue('notebook.markdownPreviewLineHeight');
		this._register(toDisposable(() => {
			if (this.markdownResult) {
				this.markdownResult.dispose();
			}
		}));
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
			this.doubleClickEditEnabled = this._configurationService.getValue('notebook.enableDoubleClickEdit');
			if (e.affectsConfiguration('notebook.markdownPreviewLineHeight')) {
				this.markdownPreviewLineHeight = this._configurationService.getValue('notebook.markdownPreviewLineHeight');
				this.updatePreview();
			}
		}));
	}

	public get cellEditors(): ICellEditorProvider[] {
		let editors: ICellEditorProvider[] = [];
		if (this.markdowncodeCell) {
			editors.push(...this.markdowncodeCell.toArray());
		}
		return editors;
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private setLoading(isLoading: boolean): void {
		this.cellModel.loaded = !isLoading;
		this._changeRef.detectChanges();
	}

	ngOnInit() {
		this.previewFeaturesEnabled = this._configurationService.getValue('workbench.enablePreviewFeatures');
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.setFocusAndScroll();
		this.cellModel.isEditMode = false;
		this._htmlMarkdownConverter = new HTMLMarkdownConverter(this.notebookUri);
		this._register(this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		}));
		this._register(this.cellModel.onCellModeChanged(mode => {
			if (mode !== this.isEditMode) {
				this.toggleEditMode(mode);
			}
			this._changeRef.detectChanges();
		}));
		this._register(this.cellModel.onCellPreviewModeChanged(preview => {
			this.previewMode = preview;
			this.focusIfPreviewMode();
		}));
		this._register(this.cellModel.onCellMarkdownModeChanged(markdown => {
			this.markdownMode = markdown;
			this.focusIfPreviewMode();
		}));
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				this.toggleUserSelect(this.isActive());
				// If the activeCellId is undefined (i.e. in an active cell update), don't unnecessarily set editMode to false;
				// it will be set to true in a subsequent call to toggleEditMode()
				if (changedProp.previousValue !== undefined) {
					this.toggleEditMode(false);
				}
				break;
			}
		}
	}

	public cellGuid(): string {
		return this.cellModel.cellGuid;
	}

	public get isTrusted(): boolean {
		return this.model.trustedMode;
	}

	public get notebookUri(): URI {
		return this.model.notebookUri;
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Add content here...' or 'Double-click to edit' depending on setting
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview(): void {
		let trustedChanged = this.cellModel && this._lastTrustedMode !== this.cellModel.trustedMode;
		let cellModelSourceJoined = Array.isArray(this.cellModel.source) ? this.cellModel.source.join('') : this.cellModel.source;
		let contentJoined = Array.isArray(this._content) ? this._content.join('') : this._content;
		let contentChanged = contentJoined !== cellModelSourceJoined || cellModelSourceJoined.length === 0 || this._previewMode === true;
		if (trustedChanged || contentChanged) {
			this._lastTrustedMode = this.cellModel.trustedMode;
			if ((!cellModelSourceJoined) && !this.isEditMode) {
				if (this.doubleClickEditEnabled) {
					this._content = localize('doubleClickEdit', "<i>Double-click to edit</i>");
				} else {
					this._content = localize('addContent', "<i>Add content here...</i>");
				}
			} else {
				this._content = this.cellModel.source;
			}
			this.markdownRenderer.setNotebookURI(this.cellModel.notebookModel.notebookUri);
			this.markdownResult = this.markdownRenderer.render({
				isTrusted: true,
				value: Array.isArray(this._content) ? this._content.join('') : this._content,
				cellAttachments: this.cellModel.attachments
			});
			this.markdownResult.element.innerHTML = this.sanitizeContent(this.markdownResult.element.innerHTML);
			this.setLoading(false);
			if (this._previewMode) {
				let outputElement = <HTMLElement>this.output.nativeElement;
				outputElement.innerHTML = this.markdownResult.element.innerHTML;

				this.addUndoElement(outputElement.innerHTML);

				outputElement.style.lineHeight = this.markdownPreviewLineHeight.toString();
				this.cellModel.renderedOutputTextContent = this.getRenderedTextOutput();
				outputElement.focus();
				this.addDecoration();
			}
		}
	}

	private updateCellSource(addChangeToUndo: boolean): void {
		let textOutputElement = <HTMLElement>this.output.nativeElement;
		if (addChangeToUndo) {
			this.addUndoElement(textOutputElement.innerHTML);
		}
		let newCellSource: string = this._htmlMarkdownConverter.convert(textOutputElement.innerHTML);
		this.cellModel.source = newCellSource;
		this._changeRef.detectChanges();
	}

	private addUndoElement(newText: string) {
		if (newText !== this._undoStack.peek()) {
			this._undoStack.push(newText);
			this._redoStack.clear();
			this._undoRedoService.pushElement(new RichTextCellEdit(this._undoStack, this._redoStack, this.cellModel.cellRichTextUri, this.output.nativeElement, () => this.updateCellSource(false)));
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}

	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output?.nativeElement;
		if (outputElement) {
			outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
		}
	}

	public handleContentChanged(): void {
		this.updatePreview();
	}

	public handleHtmlChanged(): void {
		this.updateCellSource(true);
	}

	public toggleEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined ? editMode : !this.isEditMode;
		this.cellModel.isEditMode = this.isEditMode;
		if (!this.isEditMode) {
			this.cellModel.showPreview = true;
			this.cellModel.showMarkdown = false;
		} else {
			this.markdownMode = this.cellModel.showMarkdown;
		}
		this.updatePreview();
		this._changeRef.detectChanges();
	}

	public get previewMode(): boolean {
		return this._previewMode;
	}
	public set previewMode(value: boolean) {
		if (this._previewMode !== value) {
			this._previewMode = value;
			this.updatePreview();
			this._changeRef.detectChanges();
		}
	}

	public get markdownMode(): boolean {
		return this._markdownMode;
	}
	public set markdownMode(value: boolean) {
		if (this._markdownMode !== value) {
			this._markdownMode = value;
			this._changeRef.detectChanges();
		}
	}

	private toggleUserSelect(userSelect: boolean): void {
		if (!this.output) {
			return;
		}
		if (userSelect) {
			this.output.nativeElement.classList.add(USER_SELECT_CLASS);
		} else {
			this.output.nativeElement.classList.remove(USER_SELECT_CLASS);
		}
	}

	private setFocusAndScroll(): void {
		this.toggleEditMode(this.isActive());

		if (this.output && this.output.nativeElement) {
			let outputElement = this.output.nativeElement as HTMLElement;
			outputElement.scrollTo({ behavior: 'smooth' });
		}
	}

	private focusIfPreviewMode(): void {
		if (this.previewMode && !this.markdownMode) {
			let outputElement = this.output?.nativeElement as HTMLElement;
			if (outputElement) {
				outputElement.focus();
			}
		}
	}

	protected isActive(): boolean {
		return this.cellModel && this.cellModel.id === this.activeCellId;
	}

	public deltaDecorations(newDecorationRange: NotebookRange, oldDecorationRange: NotebookRange): void {
		if (oldDecorationRange) {
			this._highlightRange = oldDecorationRange === this._highlightRange ? undefined : this._highlightRange;
			this.removeDecoration(oldDecorationRange);
		}

		if (newDecorationRange) {
			this._highlightRange = newDecorationRange;
			this.addDecoration(newDecorationRange);
		}
	}

	private addDecoration(range?: NotebookRange): void {
		range = range ?? this._highlightRange;
		if (range && this.output && this.output.nativeElement) {
			let markAllOccurances = new Mark(this.output.nativeElement); // to highlight all occurances in the element.
			let elements = this.getHtmlElements();
			if (elements?.length >= range.startLineNumber) {
				let elementContainingText = elements[range.startLineNumber - 1];
				let markCurrent = new Mark(elementContainingText); // to highlight the current item of them all.
				let editor = this._notebookService.findNotebookEditor(this.model.notebookUri);
				if (editor) {
					let findModel = (editor.notebookParams.input as NotebookInput).notebookFindModel;
					if (findModel?.findMatches?.length > 0) {
						let searchString = findModel.findExpression;
						markAllOccurances.mark(searchString, {
							className: findHighlightClass
						});
					}
				}
				markCurrent.markRanges([{
					start: range.startColumn - 1, //subtracting 1 since markdown html is 0 indexed.
					length: range.endColumn - range.startColumn
				}], {
					className: findRangeSpecificClass,
					each: function (node, range) {
						// node is the marked DOM element
						node.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				});
			}
		}
	}

	private removeDecoration(range: NotebookRange): void {
		if (range && this.output && this.output.nativeElement) {
			let markAllOccurances = new Mark(this.output.nativeElement);
			let elements = this.getHtmlElements();
			let elementContainingText = elements[range.startLineNumber - 1];
			let markCurrent = new Mark(elementContainingText);
			markAllOccurances.unmark({ acrossElements: true, className: findHighlightClass });
			markCurrent.unmark({ acrossElements: true, className: findRangeSpecificClass });
		}
	}

	private getHtmlElements(): any[] {
		let hostElem = this.output?.nativeElement;
		let children = [];
		if (hostElem) {
			for (let element of hostElem.children) {
				if (element.nodeName.toLowerCase() === 'table') {
					// add table header and table rows.
					if (element.children.length > 0) {
						children.push(element.children[0]);
						if (element.children.length > 1) {
							for (let trow of element.children[1].children) {
								children.push(trow);
							}
						}
					}
				} else if (element.children.length > 1) {
					children = children.concat(this.getChildren(element));
				} else {
					children.push(element);
				}
			}
		}
		return children;
	}

	private getChildren(parent: any): any[] {
		let children: any = [];
		if (parent.children.length > 1 && parent.nodeName.toLowerCase() !== 'li' && parent.nodeName.toLowerCase() !== 'p') {
			for (let child of parent.children) {
				children = children.concat(this.getChildren(child));
			}
		} else {
			return parent;
		}
		return children;
	}

	private getRenderedTextOutput(): string[] {
		let textOutput: string[] = [];
		let elements = this.getHtmlElements();
		elements.forEach(element => {
			if (element && element.textContent) {
				textOutput.push(element.textContent);
			} else {
				textOutput.push('');
			}
		});
		return textOutput;
	}

	// Enables edit mode on double clicking active cell
	private enableActiveCellEditOnDoubleClick() {
		if (!this.isEditMode && this.doubleClickEditEnabled) {
			this.toggleEditMode(true);
		}
		this.cellModel.active = true;
		this._model.updateActiveCell(this.cellModel);
	}
}

function preventDefaultAndExecCommand(e: KeyboardEvent, commandId: string) {
	// use preventDefault() to avoid invoking the editor's select all
	e.preventDefault();
	document.execCommand(commandId);
}

class RichTextCellEdit implements IResourceUndoRedoElement {
	private readonly _label: string = 'RichText Cell Edit';

	constructor(
		private readonly _undoStack: RichTextEditStack,
		private readonly _redoStack: RichTextEditStack,
		private readonly _cellUri: URI,
		private readonly _textCellOutputElement: HTMLElement,
		private readonly _handleHtmlUpdated: () => void) {
	}

	public get type(): UndoRedoElementType.Resource {
		return UndoRedoElementType.Resource;
	}

	public get resource(): URI {
		return this._cellUri;
	}

	public get label(): string {
		return this._label;
	}

	public get confirmBeforeUndo(): boolean | undefined {
		return false;
	}

	public async undo(): Promise<void> {
		if (this._undoStack.length > 1) {
			// The most recent change is at the top of the undo stack, so we want to
			// update the text so that it's the change just before that.
			let redoText = this._undoStack.pop();
			this._redoStack.push(redoText);
			let undoText = this._undoStack.peek();

			this._textCellOutputElement.innerHTML = undoText;
			this._handleHtmlUpdated();
		}
	}

	public async redo(): Promise<void> {
		if (this._redoStack.length > 0) {
			let text = this._redoStack.pop();
			this._undoStack.push(text);

			this._textCellOutputElement.innerHTML = text;
			this._handleHtmlUpdated();
		}
	}
}

export class RichTextEditStack {
	private _list: string[] = [];

	constructor() {
	}

	public push(element: string): void {
		this._list.push(element);
	}

	public pop(): string {
		return this._list.pop();
	}

	public peek(): string {
		if (this._list.length > 0) {
			return this._list[this._list.length - 1];
		} else {
			return undefined;
		}
	}

	public clear(): void {
		this._list = [];
	}

	public get length(): number {
		return this._list.length;
	}
}


