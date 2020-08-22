/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzdataOutput } from 'azdata-ext';
import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, executeSudoCommand, ExitCodeError } from './common/childProcess';
import { HttpClient } from './common/httpClient';
import { discoverLatestAvailableAzdataVersion, searchForCmd } from './common/utils';
import * as loc from './localizedConstants';



export const azdataHostname = 'https://aka.ms';
export const azdataUri = 'azdata-msi';
export const azdataReleaseJson = 'azdata/release.json';


/**
 * Information about an azdata installation
 */
export interface IAzdataTool {
	path: string,
	version: SemVer
	/**
	 * Executes azdata with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to azdata
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<AzdataOutput<R>>
}

export class AzdataTool implements IAzdataTool {
	constructor(public path: string, public version: SemVer, private _outputChannel: vscode.OutputChannel) { }

	public async executeCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<AzdataOutput<R>> {
		try {
			const output = JSON.parse((await executeCommand(`"${this.path}"`, args.concat(['--output', 'json']), this._outputChannel, additionalEnvVars)).stdout);
			return {
				logs: <string[]>output.log,
				stdout: <string[]>output.stdout,
				stderr: <string[]>output.stderr,
				result: <R>output.result
			};
		} catch (err) {
			// Since the output is JSON we need to do some extra parsing here to get the correct stderr out.
			// The actual value we get is something like ERROR: { stderr: '...' } so we also need to trim
			// off the start that isn't a valid JSON blob
			if (err instanceof ExitCodeError) {
				err.stderr = JSON.parse(err.stderr.substring(err.stderr.indexOf('{'))).stderr;
			}
			throw err;
		}
	}
}

export type AzdataLatestVersionInfo = {
	versions: {
		stable: string,
		devel: string,
		head: string,
		bottle: boolean
	}
};
/**
 * Finds the existing installation of azdata, or throws an error if it couldn't find it
 * or encountered an unexpected error.
 * @param outputChannel Channel used to display diagnostic information
 * The promise is rejected when Azdata is not found.
 */
export async function findAzdata(outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	outputChannel.appendLine(loc.searchingForAzdata);
	try {
		let azdata: IAzdataTool | undefined = undefined;
		switch (process.platform) {
			case 'win32':
				azdata = await findAzdataWin32(outputChannel);
				break;
			default:
				azdata = await findSpecificAzdata('azdata', outputChannel);
		}
		outputChannel.appendLine(loc.foundExistingAzdata(azdata.path, azdata.version.raw));
		return azdata;
	} catch (err) {
		outputChannel.appendLine(loc.couldNotFindAzdata(err));
		throw err;
	}
}

/**
 * Downloads the appropriate installer and/or runs the command to install azdata
 * @param outputChannel Channel used to display diagnostic information
 */
export async function installAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.upgradingAzdata);
	outputChannel.show();
	outputChannel.appendLine(loc.installingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32(outputChannel);
				break;
			case 'darwin':
				await installAzdataDarwin(outputChannel);
				break;
			case 'linux':
				await installAzdataLinux(outputChannel);
				break;
			default:
				throw new Error(loc.platformUnsupported(process.platform));
		}
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Upgrades the azdata using os appropriate method
 * @param outputChannel Channel used to display diagnostic information
 */
export async function upgradeAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.upgradingAzdata);
	outputChannel.show();
	outputChannel.appendLine(loc.upgradingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32(outputChannel);
				break;
			case 'darwin':
				await upgradeAzdataDarwin(outputChannel);
				break;
			case 'linux':
				await installAzdataLinux(outputChannel);
				break;
			default:
				throw new Error(loc.platformUnsupported(process.platform));
		}
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Checks whether a newer version of azdata is available - and if it is prompts the user to download and
 * install it.
 * @param currentAzdata The current version of azdata to check again
 * @param outputChannel Channel used to display diagnostic information
 */
export async function checkAndUpdateAzdata(currentAzdata: IAzdataTool, outputChannel: vscode.OutputChannel): Promise<void> {
	const newVersion = await discoverLatestAvailableAzdataVersion(outputChannel);
	if (newVersion.compare(currentAzdata.version) === 1) {
		const response = await vscode.window.showInformationMessage(loc.promptForAzdataUpgrade(newVersion.raw), loc.yes, loc.no);
		if (response === loc.yes) {
			await upgradeAzdata(outputChannel);
		}
	}
}


/**
 * Downloads the Windows installer and runs it
 * @param outputChannel Channel used to display diagnostic information
 */
async function downloadAndInstallAzdataWin32(outputChannel: vscode.OutputChannel): Promise<void> {
	const downloadFolder = os.tmpdir();
	const downloadedFile = await HttpClient.downloadFile(`${azdataHostname}/${azdataUri}`, outputChannel, downloadFolder);
	await executeCommand('msiexec', ['/qn', '/i', downloadedFile], outputChannel);
}

/**
 * Runs commands to install azdata on MacOS
 */
async function installAzdataDarwin(outputChannel: vscode.OutputChannel): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	await executeCommand('brew', ['update'], outputChannel);
	await executeCommand('brew', ['install', 'azdata-cli'], outputChannel);
}

/**
 * Runs commands to upgrade azdata on MacOS
 */
async function upgradeAzdataDarwin(outputChannel: vscode.OutputChannel): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	await executeCommand('brew', ['update'], outputChannel);
	await executeCommand('brew', ['upgrade', 'azdata-cli'], outputChannel);
}

/**
 * Runs commands to install azdata on Linux
 */
async function installAzdataLinux(outputChannel: vscode.OutputChannel): Promise<void> {
	// https://docs.microsoft.com/en-us/sql/big-data-cluster/deploy-install-azdata-linux-package
	// Get packages needed for install process
	await executeSudoCommand('apt-get update', outputChannel);
	await executeSudoCommand('apt-get install gnupg ca-certificates curl wget software-properties-common apt-transport-https lsb-release -y', outputChannel);
	// Download and install the signing key
	await executeSudoCommand('curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc.gpg > /dev/null', outputChannel);
	// Add the azdata repository information
	const release = (await executeCommand('lsb_release', ['-rs'], outputChannel)).stdout.trim();
	await executeSudoCommand(`add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/${release}/mssql-server-2019.list)"`, outputChannel);
	// Update repository information and install azdata
	await executeSudoCommand('apt-get update', outputChannel);
	await executeSudoCommand('apt-get install -y azdata-cli', outputChannel);
}

/**
 * Finds azdata specifically on Windows
 * @param outputChannel Channel used to display diagnostic information
 */
async function findAzdataWin32(outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	const promise = searchForCmd('azdata.cmd');
	return findSpecificAzdata(`"${await promise}"`, outputChannel);
}

/**
 * Gets the version using a known azdata path
 * @param path The path to the azdata executable
 * @param outputChannel Channel used to display diagnostic information
 */
async function findSpecificAzdata(path: string, outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	const versionOutput = await executeCommand(`"${path}"`, ['--version'], outputChannel);
	return new AzdataTool(path, getVersionFromAzdataOutput(versionOutput.stdout), outputChannel);
}

/**
 * Parses out the azdata version from the raw azdata version output
 * @param raw The raw version output from azdata --version
 */
function getVersionFromAzdataOutput(raw: string): SemVer {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line being the version of azdata itself.
	const lines = raw.split(os.EOL);
	return new SemVer(lines[0].trim());
}
