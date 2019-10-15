/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as fs from 'fs';
import * as cp from 'promisify-child-process';
import * as sudo from 'sudo-prompt';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { OsType } from '../interfaces';


const localize = nls.loadMessageBundle();
const extensionOutputChannel = localize('resourceDeployment.outputChannel', 'Deployments');
const sudoPromptTitle = 'AzureDataStudio';

/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	osType(): OsType;
	platform(): string;
	storagePath(): string;
	copyFile(source: string, target: string): Promise<void>;
	fileExists(file: string): Promise<boolean>;
	openFile(filePath: string): void;
	getErrorMessage(error: any): string;
	showErrorMessage(error: Error | string): void;
	logToOutputChannel(data: string | Buffer, header?: string): void;
	outputChannelName(): string;
	showOutputChannel(preserveFocus?: boolean): void;
	isNotebookNameUsed(title: string): boolean;
	makeDirectory(path: string): Promise<void>;
	readTextFile(filePath: string): Promise<string>;
	runCommand(command: string, options?: CommandOptions, sudo?: boolean, commandTitle?: string, ignoreError?: boolean): Promise<string>;
}

interface CommandOutput {
	stdout: string;
	stderr: string;
}

export interface CommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
}

/**
 * A class that provides various services to interact with the platform on which the code runs
 */
export class PlatformService implements IPlatformService {

	private _outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(extensionOutputChannel);

	constructor(private _storagePath: string = '') {
	}

	storagePath(): string {
		return this._storagePath;
	}

	platform(): string {
		return process.platform;
	}

	outputChannelName(): string {
		return this._outputChannel.name;
	}

	showOutputChannel(preserveFocus?: boolean | undefined): void {
		this._outputChannel.show(preserveFocus);
	}

	osType(platform: string = this.platform()): OsType {
		if (Object.values(OsType).includes(<OsType>platform)) {
			return <OsType>platform;
		} else {
			return OsType.others;
		}
	}

	async copyFile(source: string, target: string): Promise<void> {
		return await fs.promises.copyFile(source, target);
	}

	async fileExists(file: string): Promise<boolean> {
		try {
			await fs.promises.access(file);
			return true;
		} catch (error) {
			if (error && error.code === 'ENOENT') {
				return false;
			}
			throw error;
		}
	}

	openFile(filePath: string): void {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	getErrorMessage(error: any): string {
		return (error instanceof Error)
			? (typeof error.message === 'string' ? error.message : '')
			: typeof error === 'string' ? error : `${JSON.stringify(error, undefined, '\t')}`;
	}

	showErrorMessage(error: Error | string): void {
		vscode.window.showErrorMessage(this.getErrorMessage(error));
	}

	isNotebookNameUsed(title: string): boolean {
		return (azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1);
	}

	async makeDirectory(path: string): Promise<void> {
		await fs.promises.mkdir(path);
	}

	async readTextFile(filePath: string): Promise<string> {
		return await fs.promises.readFile(filePath, 'utf8');
	}

	public logToOutputChannel(data: string | Buffer, header?: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				this._outputChannel.appendLine(header ? header + line : line);
			});
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}

	async runCommand(command: string, options?: CommandOptions, sudo?: boolean, commandTitle?: string, ignoreError?: boolean): Promise<string> {
		if (commandTitle !== undefined && commandTitle !== null) {
			this._outputChannel.appendLine(`\t[ ${commandTitle} ]`);
		}

		try {
			if (sudo) {
				return await this.runSudoCommand(command, this._outputChannel, options);
			} else {
				return await this.runStreamedCommand(command, this._outputChannel, options);
			}
		} catch (error) {
			this._outputChannel.append(`\t>>> ${command}   ... errored out: ${this.getErrorMessage(error)}`);
			if (!ignoreError) {
				throw error;
			} else {
				this._outputChannel.append(`\t>>> Ignoring error in execution and continuing tool deployment`);
				return '';
			}
		}
	}

	private sudoExec(command: string, options: sudo.SudoOptions): Promise<CommandOutput> {
		return new Promise<CommandOutput>((resolve, reject) => {
			sudo.exec(command, options, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					resolve({ stdout, stderr });
				}
			});
		});
	}

	private async runSudoCommand(command: string, outputChannel: vscode.OutputChannel, options?: CommandOptions): Promise<string> {
		outputChannel.appendLine(`    > ${command}`);

		if (options && options.workingDirectory) {
			process.chdir(options.workingDirectory);
		}

		// Workaround for https://github.com/jorangreef/sudo-prompt/issues/111
		// DevNote: The environment variable being excluded from getting passed to sudo will never exist on a 'unixy' box. So this affects windows only.
		// On my testing on windows machine for our usage the environment variables being excluded were not important for the process execution being used here.
		// If one is trying to use this code elsewhere, one should test on windows thoroughly unless the above issue is fixed.
		const origEnv: NodeJS.ProcessEnv = Object.assign({}, process.env, options && options.additionalEnvironmentVariables);
		const env: NodeJS.ProcessEnv = {};

		Object.keys(origEnv).filter(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)).forEach((key) => {
			env[key] = origEnv[key];
		});
		// Workaround for  https://github.com/jorangreef/sudo-prompt/issues/111 done

		const sudoOptions = {
			name: sudoPromptTitle,
			env: env
		};

		try {
			const { stdout, stderr } = await this.sudoExec(command, sudoOptions);
			this.outputDataChunk(stdout, outputChannel, '    stdout: ');
			this.outputDataChunk(stderr, outputChannel, '    stderr: ');
			return stdout;
		} catch (error) {
			this.outputDataChunk(error, outputChannel, '    stderr: ');
			throw error;
		}
	}

	private async runStreamedCommand(command: string, outputChannel: vscode.OutputChannel, options?: CommandOptions): Promise<string> {
		const stdoutData: string[] = [];
		outputChannel.appendLine(`    > ${command}`);

		const spawnOptions = {
			cwd: options && options.workingDirectory,
			env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024, // 10 Mb of output can be captured.
			shell: true,
			detached: false,
			windowsHide: true
		};
		const child = cp.spawn(command, [], spawnOptions);

		// Add listeners to print stdout and stderr and exit code
		child.on('exit', (code: number | null, signal: string | null) => {
			if (code !== null) {
				outputChannel.appendLine(`    >>> ${command}    ... exited with code: ${code}`);
			} else {
				outputChannel.appendLine(`    >>> ${command}   ... exited with signal: ${signal}`);
			}
		});
		child.stdout.on('data', data => {
			stdoutData.push(data);
			this.outputDataChunk(data, outputChannel, '    stdout: ');
		});
		child.stderr.on('data', data => { this.outputDataChunk(data, outputChannel, '    stderr: '); });

		await child;
		return stdoutData.join('');
	}
}
