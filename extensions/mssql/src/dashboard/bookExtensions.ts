/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as arrays from '../util/arrays';
import { Disposable } from '../util/dispose';

const resolveExtensionResource = (extension: vscode.Extension<any>, resourcePath: string): vscode.Uri => {
	return vscode.Uri.file(path.join(extension.extensionPath, resourcePath));
};

const resolveBookResources = (extension: vscode.Extension<any>, books: BookContribution | BookContribution[]): BookContribution[] => {
	const result: BookContribution[] = [];
	if (!books) {
		return result;
	}
	if (!Array.isArray(books)) {
		books = [books];
	}
	for (const book of books) {
		try {
			book.path = resolveExtensionResource(extension, book.path).fsPath;
		} catch (e) {
			// noop
		}
		result.push(book);
	}
	return result;
};

export interface BookContribution {
	name: string;
	path: string;
	when?: string;
}

export namespace BookContributions {

	export function merge(a: BookContribution[], b: BookContribution[]): BookContribution[] {
		return a.concat(b);
	}

	export function equal(a: BookContribution, b: BookContribution): boolean {
		return (a.name === b.name)
			&& (a.path === b.path)
			&& (a.when === b.when);
	}

	export function fromExtension(
		extension: vscode.Extension<any>
	): BookContribution[] {
		const contributions = extension.packageJSON && extension.packageJSON.contributes;
		if (!contributions) {
			return [];
		}

		return getContributedBooks(contributions, extension);
	}


	function getContributedBooks(
		contributes: any,
		extension: vscode.Extension<any>
	): BookContribution[] {
		if (contributes['notebook.books']) {
			return resolveBookResources(extension, contributes['notebook.books']);
		}
		return [];
	}
}

export interface BookContributionProvider {
	readonly extensionPath: string;
	readonly contributions: BookContribution[];
	readonly onContributionsChanged: vscode.Event<this>;

	dispose(): void;
}

class AzdataExtensionBookContributionProvider extends Disposable implements BookContributionProvider {
	private _contributions?: BookContribution[];

	public constructor(
		public readonly extensionPath: string,
	) {
		super();

		vscode.extensions.onDidChange(() => {
			const currentContributions = this.getCurrentContributions();
			const existingContributions = this._contributions || undefined;
			if (!arrays.equals(existingContributions, currentContributions, BookContributions.equal)) {
				this._contributions = currentContributions;
				this._onContributionsChanged.fire(this);
			}
		}, undefined, this._disposables);
	}

	private readonly _onContributionsChanged = this._register(new vscode.EventEmitter<this>());
	public readonly onContributionsChanged = this._onContributionsChanged.event;

	public get contributions(): BookContribution[] {
		if (!this._contributions) {
			this._contributions = this.getCurrentContributions();
		}
		return this._contributions;
	}

	private getCurrentContributions(): BookContribution[] {
		return vscode.extensions.all
			.map(BookContributions.fromExtension)
			.reduce(BookContributions.merge, []);
	}
}

export function getBookExtensionContributions(context: vscode.ExtensionContext): BookContributionProvider {
	return new AzdataExtensionBookContributionProvider(context.extensionPath);
}