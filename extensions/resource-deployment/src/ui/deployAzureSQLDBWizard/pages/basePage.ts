/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';

export abstract class BasePage extends WizardPageBase<DeployAzureSQLDBWizard> {

	protected liveValidation!: boolean;

	public abstract initialize(): void;

	protected async validatePage(): Promise<string> {
		return '';
	}

	protected activateRealTimeFormValidation(): void {
		if (this.liveValidation) {
			this.validatePage();
		}
	}
}
