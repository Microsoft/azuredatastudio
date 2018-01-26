/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { always } from 'vs/base/common/async';
import { getDomNodePagePosition } from 'vs/base/browser/dom';
import { Position } from 'vs/editor/common/core/position';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { CodeAction } from 'vs/editor/common/modes';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { Action } from 'vs/base/common/actions';
import Event, { Emitter } from 'vs/base/common/event';
import { ScrollType } from 'vs/editor/common/editorCommon';

export class QuickFixContextMenu {

	private _visible: boolean;
	private _onDidExecuteCodeAction = new Emitter<void>();

	readonly onDidExecuteCodeAction: Event<void> = this._onDidExecuteCodeAction.event;

	constructor(
		private readonly _editor: ICodeEditor,
		private readonly _contextMenuService: IContextMenuService,
		private readonly _onApplyCodeAction: (action: CodeAction) => TPromise<any>
	) { }

	show(fixes: TPromise<CodeAction[]>, at: { x: number; y: number } | Position) {

		const actions = fixes.then(value => {
			return value.map(action => {
				return new Action(action.command ? action.command.id : action.title, action.title, undefined, true, () => {
					return always(
						this._onApplyCodeAction(action),
						() => this._onDidExecuteCodeAction.fire(undefined));
				});
			});
		});

		this._contextMenuService.showContextMenu({
			getAnchor: () => {
				if (Position.isIPosition(at)) {
					at = this._toCoords(at);
				}
				return at;
			},
			getActions: () => actions,
			onHide: () => { this._visible = false; },
			autoSelectFirstItem: true
		});
	}

	get isVisible(): boolean {
		return this._visible;
	}

	private _toCoords(position: Position): { x: number, y: number } {

		this._editor.revealPosition(position, ScrollType.Immediate);
		this._editor.render();

		// Translate to absolute editor position
		const cursorCoords = this._editor.getScrolledVisiblePosition(this._editor.getPosition());
		const editorCoords = getDomNodePagePosition(this._editor.getDomNode());
		const x = editorCoords.left + cursorCoords.left;
		const y = editorCoords.top + cursorCoords.top + cursorCoords.height;

		return { x, y };
	}
}
