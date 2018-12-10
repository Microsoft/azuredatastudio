/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import { nb } from 'sqlops';
import * as os from 'os';
import * as pfs from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { IOutputChannel } from 'vs/workbench/parts/output/common/output';
import { Registry } from 'vs/platform/registry/common/platform';
import { INotebookProviderRegistry, Extensions } from 'sql/services/notebook/notebookRegistry';
import { DEFAULT_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_FILETYPE } from 'sql/services/notebook/notebookService';


/**
 * Test whether an output is from a stream.
 */
export function isStream(output: nb.ICellOutput): output is nb.IStreamResult {
	return output.output_type === 'stream';
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function mkDir(dirPath: string, outputChannel?: IOutputChannel): Promise<void> {
	let exists = await pfs.dirExists(dirPath);
	if (!exists) {
		if (outputChannel) {
			outputChannel.append(localize('mkdirOutputMsg', '... Creating {0}', dirPath) + os.EOL);
		}
		await pfs.mkdirp(dirPath);
	}
}

export function getProviderForFileName(fileName: string): string {
	let fileExt = path.extname(fileName);
	let provider: string;
	let notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
	// First try to get provider for actual file type
	if (fileExt && fileExt.startsWith('.')) {
		fileExt = fileExt.slice(1,fileExt.length);
		provider = notebookRegistry.getProviderForFileType(fileExt);
	}
	// Fallback to provider for default file type (assume this is a global handler)
	if (!provider) {
		provider = notebookRegistry.getProviderForFileType(DEFAULT_NOTEBOOK_FILETYPE);
	}
	// Finally if all else fails, use the built-in handler
	if (!provider) {
		provider = DEFAULT_NOTEBOOK_PROVIDER;
	}
	return provider;
}
