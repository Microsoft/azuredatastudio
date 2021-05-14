/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

let locFunc = require("../lib/locFunc");
let fs = require("fs");
let path = require("path");

let gulp = require('gulp');
let vfs = require("vinyl-fs");
let rimraf = require('rimraf');
let minimist = require('minimist');
let nlsDev = require('vscode-nls-dev');


//Length of "ads-language-pack-", used to isolate ID.
const adsLangPackFolderLength = 17;

//Extensions for ADS
const currentADSJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../i18nExtensions/ADSExtensions.json'), 'utf8'));
const currentADSExtensions = currentADSJson.ADSExtensions;
const vscodeExtensions = currentADSJson.VSCODEExtensions;

function runUpdateOnLanguages() {
	let i18nPath = path.join('.', 'i18n');
	let i18nFolders = fs.readdirSync(i18nPath).filter(folderName => folderName.match(/ads-language-pack-[A-z]+/));
	let langIds = i18nFolders.map(folderName => { return folderName.substring(adsLangPackFolderLength + 1); });
	for (let langId in langIds) {
		update(langIds[langId]);
	}
}

//Function that updates the lang pack with strings from associated XLFs in the resources folder.
function update(langId) {
	let idOrPath = langId;
	if (!idOrPath) {
		throw new Error('Argument must be the location of the localization extension.');
	}
	let location = path.join('.', 'resources', 'xlf');
	if (location !== undefined && !fs.existsSync(location)) {
		throw new Error(`${location} doesn't exist.`);
	}

	let extensionsSourceFolder = path.join('.', 'extensions');
	if (extensionsSourceFolder !== undefined && !fs.existsSync(extensionsSourceFolder)) {
		throw new Error(`${extensionsSourceFolder} doesn't exist.`);
	}

	let locExtFolder = idOrPath;
	if (/^\w{2}(-\w+)?$/.test(idOrPath)) {
		locExtFolder = path.join('.', 'i18n', `ads-language-pack-${idOrPath}`);
	}
	let locExtStat = fs.statSync(locExtFolder);
	if (!locExtStat || !locExtStat.isDirectory) {
		throw new Error('No directory found at ' + idOrPath);
	}
	let packageJSON = JSON.parse(fs.readFileSync(path.join(locExtFolder, 'package.json')).toString());
	//Increment version automatically.
	packageJSON['version'] = incrementVersion(packageJSON['version']);

	let contributes = packageJSON['contributes'];
	if (!contributes) {
		throw new Error('The extension must define a "localizations" contribution in the "package.json"');
	}
	let localizations = contributes['localizations'];
	if (!localizations) {
		throw new Error('The extension must define a "localizations" contribution of type array in the "package.json"');
	}

	localizations.forEach(function (localization) {
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

		if (fs.existsSync(translationDataFolder)) {
			let totalExtensions = fs.readdirSync(path.join(translationDataFolder, 'extensions'));
			for (let extensionTag in totalExtensions) {
				let extensionName = totalExtensions[extensionTag].replace('i18n.json', '');
				if (!(currentADSExtensions[extensionName] !== undefined || vscodeExtensions.indexOf(extensionName) !== -1)) {
					// Extension is not recognized as a valid ADS extension, must be removed. (Used when converting vscode-langpacks).
					let filePath = path.join(translationDataFolder, 'extensions', extensionName + '.i18n.json')
					rimraf.sync(filePath);
				}
			}
		}


		console.log(`Importing translations for ${languageId} from '${location}' to '${translationDataFolder}' ...`);
		let translationPaths = [];
		gulp.src(path.join(location, languageId, '**', '*.xlf'))
			.pipe(locFunc.modifyI18nPackFiles(languageId, translationDataFolder, currentADSExtensions, translationPaths, languageId === 'ps'))
			.on('error', (error) => {
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
			.pipe(locFunc.determineLocation(languageId, translationDataFolder))
			.on('end', function () {
				if (translationPaths !== undefined) {
					let nonExistantExtensions = [];
					for (let curr of localization.translations) {
						try {
							if (curr.id === 'vscode.theme-seti') {
								//handle edge case where 'theme-seti' has a different id.
								curr.id = 'vscode.vscode-theme-seti';
							}
							else if (curr.id === 'vscode.markdown-basics') {
								//handle edge case where 'markdown-basics' has a different id.
								curr.id = 'vscode.markdown';
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

function incrementVersion(version) {
	let firstDot = version.indexOf('.');
	let secondDot = version.indexOf('.', firstDot + 1);
	let firstNumber = parseInt(version.substr(0, firstDot));
	let secondNumber = parseInt(version.substr(firstDot + 1, (secondDot - firstDot) - 1));
	let thirdNumber = parseInt(version.substr(secondDot + 1))
	if (thirdNumber === 9) {
		if (secondNumber === 99) {
			version = (firstNumber + 1) + ".0.0";
		}
		else {
			version = firstNumber + "." + (secondNumber + 1) + ".0";
		}
	}
	else {
		version = firstNumber + "." + secondNumber + "." + (thirdNumber + 1);
	}
	return version;
}

if (path.basename(process.argv[1]) === 'refresh-langpack-extension.js') {
	runUpdateOnLanguages();
}
