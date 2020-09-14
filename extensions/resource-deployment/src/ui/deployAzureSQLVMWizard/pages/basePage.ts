/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export abstract class BasePage extends WizardPageBase<DeployAzureSQLVMWizard> {

	protected liveValidation!: boolean;

	public initialize(): void {
		throw new Error('Method not implemented.');
	}

	protected async formValidation(): Promise<string> {
		return '';
	}

	protected liveFormValidation() {
		if (this.liveValidation) {
			this.formValidation();
		}
	}
}
