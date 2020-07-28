/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/accountPicker';
import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IDropdownOptions } from 'vs/base/browser/ui/dropdown/dropdown';
import { IListEvent } from 'vs/base/browser/ui/list/list';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { buttonBackground } from 'vs/platform/theme/common/colorRegistry';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';

import * as azdata from 'azdata';
import { DropdownList } from 'sql/base/browser/ui/dropdownList/dropdownList';
import { attachDropdownStyler } from 'sql/platform/theme/common/styler';
import { AddAccountAction, RefreshAccountAction } from 'sql/platform/accounts/common/accountActions';
import { AccountPickerListRenderer, AccountListDelegate } from 'sql/workbench/services/accountManagement/browser/accountListRenderer';
import { AccountPickerViewModel } from 'sql/platform/accounts/common/accountPickerViewModel';
import { firstIndex } from 'vs/base/common/arrays';
import { Tenant, TenantListDelegate, TenantPickerListRenderer } from 'sql/workbench/services/accountManagement/browser/tenantListRenderer';

export class AccountPicker extends Disposable {
	public static ACCOUNTPICKERLIST_HEIGHT = 47;
	public viewModel: AccountPickerViewModel;
	private _accountList: List<azdata.Account>;
	private _accountContainer: HTMLElement;
	private _refreshContainer: HTMLElement;
	private _listContainer: HTMLElement;
	private _dropdown: DropdownList;
	private _tenantContainer: HTMLElement;
	private _tenantListContainer: HTMLElement;
	private _tenantList: List<Tenant>;
	private _tenantDropdown: DropdownList;
	private _refreshAccountAction: RefreshAccountAction;

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	private _onAccountSelectionChangeEvent: Emitter<azdata.Account | undefined>;
	public get onAccountSelectionChangeEvent(): Event<azdata.Account | undefined> { return this._onAccountSelectionChangeEvent.event; }

	private _onTenantSelectionChangeEvent: Emitter<string | undefined>;
	public get onTenantSelectionChangeEvent(): Event<string | undefined> { return this._onTenantSelectionChangeEvent.event; }

	constructor(
		private _providerId: string,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super();

		// Create event emitters
		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
		this._onAccountSelectionChangeEvent = new Emitter<azdata.Account>();
		this._onTenantSelectionChangeEvent = new Emitter<string | undefined>();

		// Create the view model, wire up the events, and initialize with baseline data
		this.viewModel = this._instantiationService.createInstance(AccountPickerViewModel, this._providerId);
		this.viewModel.updateAccountListEvent(arg => {
			if (arg.providerId === this._providerId) {
				this.updateAccountList(arg.accountList);
			}
		});
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Render account picker
	 */
	public render(accountContainer: HTMLElement, tenantContainer: HTMLElement): void {
		DOM.append(accountContainer, this._accountContainer);
		DOM.append(tenantContainer, this._tenantContainer);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Create account picker component
	 */
	public createAccountPickerComponent() {
		// Create an account list
		const delegate = new AccountListDelegate(AccountPicker.ACCOUNTPICKERLIST_HEIGHT);
		const tenantDelegate = new TenantListDelegate(AccountPicker.ACCOUNTPICKERLIST_HEIGHT);

		const accountRenderer = new AccountPickerListRenderer();
		const tenantRenderer = new TenantPickerListRenderer();

		this._listContainer = DOM.$('div.account-list-container');
		this._tenantListContainer = DOM.$('div.tenant-list-container');

		this._accountList = new List<azdata.Account>('AccountPicker', this._listContainer, delegate, [accountRenderer]);
		this._tenantList = new List<Tenant>('TenantPicker', this._tenantListContainer, tenantDelegate, [tenantRenderer]);

		this._register(attachListStyler(this._accountList, this._themeService));
		this._register(attachListStyler(this._tenantList, this._themeService));

		// this._rootElement = DOM.$('div.account-picker-container');
		this._accountContainer = DOM.$('div.account-picker');
		this._tenantContainer = DOM.$('div.tenant-picker');


		// Create a dropdown for account picker
		const option: IDropdownOptions = {
			contextViewProvider: this._contextViewService,
			labelRenderer: (container) => this.renderLabel(container)
		};

		const tenantOption: IDropdownOptions = {
			contextViewProvider: this._contextViewService,
			labelRenderer: (container) => this.renderTenantLabel(container)
		};

		// Create the add account action
		const addAccountAction = this._instantiationService.createInstance(AddAccountAction, this._providerId);
		addAccountAction.addAccountCompleteEvent(() => this._addAccountCompleteEmitter.fire());
		addAccountAction.addAccountErrorEvent((msg) => this._addAccountErrorEmitter.fire(msg));
		addAccountAction.addAccountStartEvent(() => this._addAccountStartEmitter.fire());

		this._dropdown = this._register(new DropdownList(this._accountContainer, option, this._listContainer, this._accountList, addAccountAction));
		this._tenantDropdown = this._register(new DropdownList(this._tenantContainer, tenantOption, this._tenantListContainer, this._tenantList));

		this._register(attachDropdownStyler(this._dropdown, this._themeService));
		this._register(attachDropdownStyler(this._tenantDropdown, this._themeService));

		this._register(this._accountList.onDidChangeSelection((e: IListEvent<azdata.Account>) => {
			if (e.elements.length === 1) {
				this._dropdown.renderLabel();
				this.onAccountSelectionChange(e.elements[0]);
			}
		}));

		this._register(this._tenantList.onDidChangeSelection((e: IListEvent<Tenant>) => {
			if (e.elements.length === 1) {
				this._tenantDropdown.renderLabel();
				this.onTenantSelectionChange(e.elements[0].id);
			}
		}));

		// Create refresh account action
		this._refreshContainer = DOM.append(this._accountContainer, DOM.$('div.refresh-container'));
		DOM.append(this._refreshContainer, DOM.$('div.sql codicon warning'));
		const actionBar = new ActionBar(this._refreshContainer, { animated: false });
		this._refreshAccountAction = this._instantiationService.createInstance(RefreshAccountAction);
		actionBar.push(this._refreshAccountAction, { icon: false, label: true });

		if (this._accountList.length > 0) {
			this._accountList.setSelection([0]);
			this.onAccountSelectionChange(this._accountList.getSelectedElements()[0]);
		} else {
			DOM.hide(this._refreshContainer);
		}

		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getColorTheme());

		// Load the initial contents of the view model
		this.viewModel.initialize()
			.then((accounts: azdata.Account[]) => {
				this.updateAccountList(accounts);
			});
	}

	public dispose() {
		super.dispose();
		if (this._accountList) {
			this._accountList.dispose();
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private onAccountSelectionChange(account: azdata.Account | undefined) {
		this.viewModel.selectedAccount = account;
		if (account && account.isStale) {
			this._refreshAccountAction.account = account;
			DOM.show(this._refreshContainer);
		} else {
			DOM.hide(this._refreshContainer);

			if (account.properties.tenants?.length > 1) {
				if (this._tenantContainer?.parentElement?.parentElement) {
					DOM.show(this._tenantContainer.parentElement.parentElement);
				}
				DOM.show(this._tenantContainer);
				this.updateTenantList(account);
				this.onTenantSelectionChange(account?.properties?.tenants[0]);
			} else {
				if (this._tenantContainer?.parentElement?.parentElement) {
					DOM.hide(this._tenantContainer.parentElement.parentElement);
				}
				DOM.hide(this._tenantContainer);

			}
		}

		this._onAccountSelectionChangeEvent.fire(account);
	}

	private onTenantSelectionChange(tenantId: string | undefined) {
		this.viewModel.selectedTenantId = tenantId;
		this._onTenantSelectionChangeEvent.fire(tenantId);
	}

	private renderLabel(container: HTMLElement): IDisposable | null {
		if (container.hasChildNodes()) {
			for (let i = 0; i < container.childNodes.length; i++) {
				container.removeChild(container.childNodes.item(i));
			}
		}

		const selectedAccounts = this._accountList.getSelectedElements();
		const account = selectedAccounts ? selectedAccounts[0] : undefined;
		if (account) {
			const badge = DOM.$('div.badge');
			const row = DOM.append(container, DOM.$('div.selected-account-container'));
			const icon = DOM.append(row, DOM.$('div.codicon'));
			DOM.append(icon, badge);
			const badgeContent = DOM.append(badge, DOM.$('div.badge-content'));
			const label = DOM.append(row, DOM.$('div.label'));

			// Set the account icon
			icon.classList.add('icon', account.displayInfo.accountType);

			// TODO: Pick between the light and dark logo
			label.innerText = account.displayInfo.displayName + ' (' + account.displayInfo.contextualDisplayName + ')';

			if (account.isStale) {
				badgeContent.className = 'badge-content codicon warning-badge';
			} else {
				badgeContent.className = 'badge-content';
			}
		} else {
			const row = DOM.append(container, DOM.$('div.no-account-container'));
			row.innerText = AddAccountAction.LABEL + '...';
		}
		return null;
	}

	private renderTenantLabel(container: HTMLElement): IDisposable | null {
		if (container.hasChildNodes()) {
			for (let i = 0; i < container.childNodes.length; i++) {
				container.removeChild(container.childNodes.item(i));
			}
		}

		const selectedTenants = this._tenantList.getSelectedElements();
		const tenant = selectedTenants ? selectedTenants[0] : undefined;
		if (tenant) {
			const row = DOM.append(container, DOM.$('div.selected-tenant-container'));
			const label = DOM.append(row, DOM.$('div.label'));

			// TODO: Pick between the light and dark logo
			label.innerText = tenant.displayName;
		}
		return null;
	}

	private updateTenantList(account: azdata.Account): void {
		this._tenantList.splice(0, this._tenantList.length, account?.properties?.tenants ?? []);
		this._tenantList.setSelection([0]);
		this._tenantDropdown.renderLabel();
		this._tenantList.layout(this._tenantList.contentHeight);
	}

	private updateAccountList(accounts: azdata.Account[]): void {
		// keep the selection to the current one
		const selectedElements = this._accountList.getSelectedElements();

		// find selected index
		let selectedIndex: number | undefined;
		if (selectedElements.length > 0 && accounts.length > 0) {
			selectedIndex = firstIndex(accounts, (account) => {
				return (account.key.accountId === selectedElements[0].key.accountId);
			});
		}

		// Replace the existing list with the new one
		this._accountList.splice(0, this._accountList.length, accounts);

		if (this._accountList.length > 0) {
			if (selectedIndex && selectedIndex !== -1) {
				this._accountList.setSelection([selectedIndex]);
			} else {
				this._accountList.setSelection([0]);
			}
		} else {
			// if the account is empty, re-render dropdown label
			this.onAccountSelectionChange(undefined);
			this._dropdown.renderLabel();
		}

		this._accountList.layout(this._accountList.contentHeight);
	}

	/**
	 * Update theming that is specific to account picker
	 */
	private updateTheme(theme: IColorTheme): void {
		const linkColor = theme.getColor(buttonBackground);
		const link = linkColor ? linkColor.toString() : null;
		this._refreshContainer.style.color = link;
		if (this._refreshContainer) {
			this._refreshContainer.style.color = link;
		}
	}
}
