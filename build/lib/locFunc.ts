/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as path from 'path';
import * as fs from 'fs';

import { through, ThroughStream } from 'event-stream';
import { createStatsStream } from './stats';
import * as File from 'vinyl';
import i18n = require('./i18n');
import { Stream } from 'stream';
import * as glob from 'glob';
import rename = require('gulp-rename');
const root = path.dirname(path.dirname(__dirname));

interface Map<V> {
	[key: string]: V;
}

interface ParsedXLF {
	messages: Map<string>;
	originalFilePath: string;
	language: string;
}

interface I18nPack {
	version: string;
	contents: {
		[path: string]: Map<string>;
	};
}

const extensionsProject: string = 'extensions';
const i18nPackVersion = '1.0.0';

function createI18nFile(originalFilePath: string, messages: any): File {
	let result = Object.create(null);
	result[''] = [
		'--------------------------------------------------------------------------------------------',
		'Copyright (c) Microsoft Corporation. All rights reserved.',
		'Licensed under the Source EULA. See License.txt in the project root for license information.',
		'--------------------------------------------------------------------------------------------',
		'Do not edit this file. It is machine generated.'
	];
	for (let key of Object.keys(messages)) {
		result[key] = messages[key];
	}

	let content = JSON.stringify(result, null, '\t');
	if (process.platform === 'win32') {
		content = content.replace(/\n/g, '\r\n');
	}
	return new File({
		path: path.join(originalFilePath + '.i18n.json'),
		contents: Buffer.from(content, 'utf8')
	});
}

function updateMainI18nFile(existingTranslationFilePath: string, originalFilePath: string, messages: any): File {
	let currFilePath = path.join(existingTranslationFilePath + '.i18n.json');
	let currentContent = fs.readFileSync(currFilePath);
	let currentContentObject = JSON.parse(currentContent.toString());
	let result = Object.create(null);
	messages.contents = { ...currentContentObject.contents, ...messages.contents };
	result[''] = [
		'--------------------------------------------------------------------------------------------',
		'Copyright (c) Microsoft Corporation. All rights reserved.',
		'Licensed under the Source EULA. See License.txt in the project root for license information.',
		'--------------------------------------------------------------------------------------------',
		'Do not edit this file. It is machine generated.'
	];
	for (let key of Object.keys(messages)) {
		result[key] = messages[key];
	}
	let content = JSON.stringify(result, null, '\t');

	if (process.platform === 'win32') {
		content = content.replace(/\n/g, '\r\n');
	}
	return new File({
		path: path.join(originalFilePath + '.i18n.json'),

		contents: Buffer.from(content, 'utf8'),
	})
}

export function packageLangpacksStream(): NodeJS.ReadWriteStream {
	const extenalExtensionDescriptions = (<string[]>glob.sync('extensions/*/package.json'))
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})

	const builtExtensions = extenalExtensionDescriptions.map(extension => {
		return fromLocalNormal(extension.path)
			.pipe(rename(p => p.dirname = `langpacks/${extension.name}/${p.dirname}`));
	});

	return es.merge(builtExtensions);
}

function fromLocalNormal(extensionPath: string): Stream {
	const result = es.through();

	const vsce = require('vsce') as typeof import('vsce');

	vsce.listFiles({ cwd: extensionPath, packageManager: vsce.PackageManager.Yarn })
		.then(fileNames => {
			const files = fileNames
				.map(fileName => path.join(extensionPath, fileName))
				.map(filePath => new File({
					path: filePath,
					stat: fs.statSync(filePath),
					base: extensionPath,
					contents: fs.createReadStream(filePath) as any
				}));

			es.readArray(files).pipe(result);
		})
		.catch(err => result.emit('error', err));

	return result.pipe(createStatsStream(path.basename(extensionPath)));
}

export function modifyI18nPackFiles(existingTranslationFolder: string, adsExtensions: Map<string>, resultingTranslationPaths: i18n.TranslationPath[], pseudo = false): NodeJS.ReadWriteStream {
	let parsePromises: Promise<ParsedXLF[]>[] = [];
	let mainPack: I18nPack = { version: i18nPackVersion, contents: {} };
	let extensionsPacks: Map<I18nPack> = {};
	let errors: any[] = [];
	return through(function (this: ThroughStream, xlf: File) {
		let project = path.basename(path.dirname(xlf.relative));
		let resource = path.basename(xlf.relative, '.xlf').replace(/\.[a-zA-Z-]*\./, '.');
		let contents = xlf.contents.toString();
		let parsePromise = pseudo ? i18n.XLF.parsePseudo(contents) : i18n.XLF.parse(contents);
		parsePromises.push(parsePromise);
		parsePromise.then(
			resolvedFiles => {
				resolvedFiles.forEach(file => {
					const path = file.originalFilePath;
					const firstSlash = path.indexOf('/');

					if (project === extensionsProject) {
						let extPack = extensionsPacks[resource];
						if (!extPack) {
							extPack = extensionsPacks[resource] = { version: i18nPackVersion, contents: {} };
						}
						const adsId = adsExtensions[resource];
						if (adsId) { // internal ADS extension: remove 'extensions/extensionId/' segnent
							const secondSlash = path.indexOf('/', firstSlash + 1);
							extPack.contents[path.substr(secondSlash + 1)] = file.messages;
						} else {
							extPack.contents[path] = file.messages;
						}
					} else {
						mainPack.contents[path.substr(firstSlash + 1)] = file.messages;
					}
				});
			}
		).catch(reason => {
			errors.push(reason);
		});
	}, function () {
		Promise.all(parsePromises)
			.then(() => {
				if (errors.length > 0) {
					throw errors;
				}
				const translatedMainFile = updateMainI18nFile(existingTranslationFolder + '\\main', './main', mainPack);

				this.queue(translatedMainFile);
				for (let extension in extensionsPacks) {
					const translatedExtFile = createI18nFile(`extensions/${extension}`, extensionsPacks[extension]);
					this.queue(translatedExtFile);

					const adsExtensionId = adsExtensions[extension];
					if (adsExtensionId) {
						resultingTranslationPaths.push({ id: adsExtensionId, resourceName: `extensions/${extension}.i18n.json` });
					} else {
						resultingTranslationPaths.push({ id: `vscode.${extension}`, resourceName: `extensions/${extension}.i18n.json` });
					}

				}
				this.queue(null);
			})
			.catch((reason) => {
				this.emit('error', reason);
			});
	});
}









