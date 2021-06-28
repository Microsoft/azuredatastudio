/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as path from 'path';
import * as glob from 'glob';
import rename = require('gulp-rename');
import ext = require('./extensions');
//imports for langpack refresh.
import { through, ThroughStream } from 'event-stream';
import i18n = require('./i18n')
import * as fs from 'fs';
import * as File from 'vinyl';
import * as rimraf from 'rimraf';
import * as gulp from 'gulp';
import * as vfs from 'vinyl-fs';

const root = path.dirname(path.dirname(__dirname));

// Modified packageLocalExtensionsStream from extensions.ts, but for langpacks.
export function packageLangpacksStream(): NodeJS.ReadWriteStream {
	const langpackDescriptions = (<string[]>glob.sync('i18n/*/package.json'))
		.map(manifestPath => {
			const langpackPath = path.dirname(path.join(root, manifestPath));
			const langpackName = path.basename(langpackPath);
			return { name: langpackName, path: langpackPath };
		})

	const builtLangpacks = langpackDescriptions.map(langpack => {
		return ext.fromLocalNormal(langpack.path)
			.pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
	});

	return es.merge(builtLangpacks);
}

// Modified packageLocalExtensionsStream but for any ADS extensions including excluded/external ones.
export function packageSingleExtensionStream(name: string): NodeJS.ReadWriteStream {
	const extenalExtensionDescriptions = (<string[]>glob.sync(`extensions/${name}/package.json`))
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})

	const builtExtension = extenalExtensionDescriptions.map(extension => {
		return ext.fromLocal(extension.path, false)
			.pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
	});

	return es.merge(builtExtension);
}

// Langpack creation functions go here.

/**
 * Function combines the contents of the SQL core XLF file into the current main i18n file contianing the vs core strings.
 * Based on createI18nFile in i18n.ts
*/
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

/**
 * Function handles the processing of xlf resources and turning them into i18n.json files.
 * It adds the i18n files translation paths to be added back into package.main.
 * Based on prepareI18nPackFiles in i18n.ts
*/
export function modifyI18nPackFiles(existingTranslationFolder: string, resultingTranslationPaths: i18n.TranslationPath[], pseudo = false): NodeJS.ReadWriteStream {
	let parsePromises: Promise<i18n.ParsedXLF[]>[] = [];
	let mainPack: i18n.I18nPack = { version: i18n.i18nPackVersion, contents: {} };
	let extensionsPacks: i18n.Map<i18n.I18nPack> = {};
	let errors: any[] = [];
	return through(function (this: ThroughStream, xlf: File) {
		let rawResource = path.basename(xlf.relative, '.xlf');
		let resource = rawResource.substring(0, rawResource.lastIndexOf('.'));
		let contents = xlf.contents.toString();
		let parsePromise = pseudo ? i18n.XLF.parsePseudo(contents) : i18n.XLF.parse(contents);
		parsePromises.push(parsePromise);
		parsePromise.then(
			resolvedFiles => {
				resolvedFiles.forEach(file => {
					const path = file.originalFilePath;
					const firstSlash = path.indexOf('/');

					//exclude core sql file from extension processing.
					if (resource !== 'sql') {
						let extPack = extensionsPacks[resource];
						if (!extPack) {
							extPack = extensionsPacks[resource] = { version: i18n.i18nPackVersion, contents: {} };
						}
						//remove extensions/extensionId section as all extensions will be webpacked.
						const secondSlash = path.indexOf('/', firstSlash + 1);
						extPack.contents[path.substr(secondSlash + 1)] = file.messages;
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
					const translatedExtFile = i18n.createI18nFile(`extensions/${extension}`, extensionsPacks[extension]);
					this.queue(translatedExtFile);

					//handle edge case for 'Microsoft.sqlservernotebook'
					const adsExtensionId = (extension === 'Microsoft.sqlservernotebook') ? extension : 'Microsoft.' + extension;
					resultingTranslationPaths.push({ id: adsExtensionId, resourceName: `extensions/${extension}.i18n.json` });
				}
				this.queue(null);
			})
			.catch((reason) => {
				this.emit('error', reason);
			});
	});
}

const textFields = {
	"nameText": 'ads',
	"displayNameText": 'Azure Data Studio',
	"publisherText": 'Microsoft',
	"licenseText": 'SEE SOURCE EULA LICENSE IN LICENSE.txt',
	"updateText": 'cd ../vscode && npm run update-localization-extension '
}

//list of extensions from vscode that are to be included with ADS.
const VSCODEExtensions = [
	"bat",
	"configuration-editing",
	"docker",
	"extension-editing",
	"git-ui",
	"git",
	"github-authentication",
	"github",
	"image-preview",
	"json-language-features",
	"json",
	"markdown-basics",
	"markdown-language-features",
	"merge-conflict",
	"microsoft-authentication",
	"powershell",
	"python",
	"r",
	"search-result",
	"sql",
	"theme-abyss",
	"theme-defaults",
	"theme-kimbie-dark",
	"theme-monokai-dimmed",
	"theme-monokai",
	"theme-quietlight",
	"theme-red",
	"theme-seti",
	"theme-solarized-dark",
	"theme-solarized-light",
	"theme-tomorrow-night-blue",
	"typescript-basics",
	"xml",
	"yaml"
];

/**
 * A heavily modified version of update-localization-extension that runs using local xlf resources, no commands required to pass in.
 * It converts a renamed vscode langpack to an ADS one or updates the existing one to use XLF resources.
 *
 * It removes the resources of vscode that we do not support, and adds in new i18n json files created from the xlf files in the folder.
 * It also merges in the sql core strings with the vscode core strings into a combined main i18n json file.
 *
 * Note: Can be used on both the current langpack as well as renamed vscode langpacks (required to update vs core and vscode extensions).
 * Remember to change the version of the langpack and rename the folder to ads instead of vscode for the function to work.
*/
export function refreshLangpacks(): Promise<undefined> {
	let supportedLocations = [...i18n.defaultLanguages, ...i18n.extraLanguages];

	for (let i = 0; i < supportedLocations.length; i++) {
		let langId = supportedLocations[i].id;
		if (langId === "zh-cn") {
			langId = "zh-hans";
		}
		if (langId === "zh-tw") {
			langId = "zh-hant";
		}

		let location = path.join('.', 'resources', 'xlf');
		let locExtFolder = path.join('.', 'i18n', `ads-language-pack-${langId}`);
		try {
			fs.statSync(locExtFolder);
		}
		catch {
			console.log('Language is not included in ADS yet: ' + langId);
			continue;
		}
		let packageJSON = JSON.parse(fs.readFileSync(path.join(locExtFolder, 'package.json')).toString());
		//processing extension fields, version and folder name must be changed manually.
		packageJSON['name'] = packageJSON['name'].replace('vscode', textFields.nameText);
		packageJSON['displayName'] = packageJSON['displayName'].replace('Visual Studio Code', textFields.displayNameText);
		packageJSON['publisher'] = textFields.publisherText;
		packageJSON['license'] = textFields.licenseText;
		packageJSON['scripts']['update'] = textFields.updateText + langId;

		let contributes = packageJSON['contributes'];
		if (!contributes) {
			throw new Error('The extension must define a "localizations" contribution in the "package.json"');
		}
		let localizations = contributes['localizations'];
		if (!localizations) {
			throw new Error('The extension must define a "localizations" contribution of type array in the "package.json"');
		}

		localizations.forEach(function (localization: any) {
			if (!localization.languageId || !localization.languageName || !localization.localizedLanguageName) {
				throw new Error('Each localization contribution must define "languageId", "languageName" and "localizedLanguageName" properties.');
			}
			let languageId = localization.transifexId || localization.languageId;
			let translationDataFolder = path.join(locExtFolder, 'translations');
			if (languageId === "zh-cn") {
				languageId = "zh-hans";
			}
			if (languageId === "zh-tw") {
				languageId = "zh-hant";
			}

			//remove extensions not part of ADS.
			if (fs.existsSync(translationDataFolder)) {
				let totalExtensions = fs.readdirSync(path.join(translationDataFolder, 'extensions'));
				for (let extensionTag in totalExtensions) {
					let extensionFileName = totalExtensions[extensionTag];
					let xlfPath = path.join(location, `${languageId}`, extensionFileName.replace('.i18n.json', '.xlf'))
					if (!(fs.existsSync(xlfPath) || VSCODEExtensions.indexOf(extensionFileName.replace('.i18n.json', '')) !== -1)) {
						let filePath = path.join(translationDataFolder, 'extensions', extensionFileName);
						rimraf.sync(filePath);
					}
				}
			}


			console.log(`Importing translations for ${languageId} from '${location}' to '${translationDataFolder}' ...`);
			let translationPaths: any = [];
			gulp.src(path.join(location, languageId, '**', '*.xlf'))
				.pipe(modifyI18nPackFiles(translationDataFolder, translationPaths, languageId === 'ps'))
				.on('error', (error: any) => {
					console.log(`Error occurred while importing translations:`);
					translationPaths = undefined;
					if (Array.isArray(error)) {
						error.forEach(console.log);
					} else if (error) {
						console.log(error);
					} else {
						console.log('Unknown error');
					}
				})
				.pipe(vfs.dest(translationDataFolder))
				.on('end', function () {
					if (translationPaths !== undefined) {
						let nonExistantExtensions = [];
						for (let curr of localization.translations) {
							try {
								if (curr.id === 'vscode.theme-seti') {
									//handle edge case where 'theme-seti' has a different id.
									curr.id = 'vscode.vscode-theme-seti';
								}
								fs.statSync(path.join(translationDataFolder, curr.path.replace('./translations', '')));
							}
							catch {
								nonExistantExtensions.push(curr);
							}
						}
						for (let nonExt of nonExistantExtensions) {
							let index = localization.translations.indexOf(nonExt);
							if (index > -1) {
								localization.translations.splice(index, 1);
							}
						}
						for (let tp of translationPaths) {
							let finalPath = `./translations/${tp.resourceName}`;
							let isFound = false;
							for (let i = 0; i < localization.translations.length; i++) {
								if (localization.translations[i].path === finalPath) {
									localization.translations[i].id = tp.id;
									isFound = true;
									break;
								}
							}
							if (!isFound) {
								localization.translations.push({ id: tp.id, path: finalPath });
							}
						}
						fs.writeFileSync(path.join(locExtFolder, 'package.json'), JSON.stringify(packageJSON, null, '\t'));
					}
				});

		});
	}
	return new Promise(function (resolve) {
		console.log("Langpack Refresh Completed.");
		resolve(undefined);
	});
}

