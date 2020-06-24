/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ResourceType } from '../../../constants';
import { DuskyObjectModelsDatabase, V1Pod, DuskyObjectModelsDatabaseServiceArcPayload } from '../../../controller/generated/dusky/api';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel, PodRole } from '../../../models/postgresModel';
import { promptForResourceDeletion, promptAndConfirmPassword } from '../../../common/utils';

export class PostgresOverviewPage extends DashboardPage {

	private propertiesLoading?: azdata.LoadingComponent;
	private kibanaLoading?: azdata.LoadingComponent;
	private grafanaLoading?: azdata.LoadingComponent;
	private nodesTableLoading?: azdata.LoadingComponent;

	private properties?: azdata.PropertiesContainerComponent;
	private kibanaLink?: azdata.HyperlinkComponent;
	private grafanaLink?: azdata.HyperlinkComponent;
	private nodesTable?: azdata.DeclarativeTableComponent;

	constructor(protected modelView: azdata.ModelView, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(modelView);

		this.disposables.push(
			this._controllerModel.onEndpointsUpdated(
				() => this.eventuallyRunOnInitialized(() => this.refreshEndpoints())));

		this.disposables.push(
			this._controllerModel.onRegistrationsUpdated(
				() => this.eventuallyRunOnInitialized(() => this.refreshProperties())));

		this.disposables.push(
			this._postgresModel.onServiceUpdated(
				() => this.eventuallyRunOnInitialized(() => {
					this.refreshProperties();
					this.refreshNodes();
				})));

		this.disposables.push(
			this._postgresModel.onPodsUpdated(
				() => this.eventuallyRunOnInitialized(() => {
					this.refreshProperties();
					this.refreshNodes();
				})));
	}

	protected get title(): string {
		return loc.overview;
	}

	protected get id(): string {
		return 'postgres-overview';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.postgres;
	}

	protected get container(): azdata.Component {
		const root = this.modelView.modelBuilder.divContainer().component();
		const content = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '10px 20px 0px 20px' } });

		// Properties
		this.properties = this.modelView.modelBuilder.propertiesContainer().component();
		this.propertiesLoading = this.modelView.modelBuilder.loadingComponent().component();

		// Refresh in case the models already have data. Do this before
		// configuring the loading component so the UI loads correctly initially.
		this.refreshProperties();
		this.propertiesLoading.component = this.properties;
		content.addItem(this.propertiesLoading, { CSSStyles: cssStyles.text });

		// Service endpoints
		const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.serviceEndpoints,
			CSSStyles: titleCSS
		}).component());

		this.kibanaLink = this.modelView.modelBuilder.hyperlink().component();
		this.grafanaLink = this.modelView.modelBuilder.hyperlink().component();
		this.kibanaLoading = this.modelView.modelBuilder.loadingComponent().component();
		this.grafanaLoading = this.modelView.modelBuilder.loadingComponent().component();

		// Refresh before configuring the loading components
		this.refreshEndpoints();
		this.kibanaLoading.component = this.kibanaLink;
		this.grafanaLoading.component = this.grafanaLink;

		const endpointsTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.endpoint,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: {
						...cssStyles.tableRow,
						'overflow': 'hidden',
						'text-overflow': 'ellipsis',
						'white-space': 'nowrap',
						'max-width': '0'
					}
				},
				{
					displayName: loc.description,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: [
				[loc.kibanaDashboard, this.kibanaLoading, loc.kibanaDashboardDescription],
				[loc.grafanaDashboard, this.grafanaLoading, loc.grafanaDashboardDescription]]
		}).component();
		content.addItem(endpointsTable);

		// Server group nodes
		content.addItem(this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: loc.serverGroupNodes,
			CSSStyles: titleCSS
		}).component());

		this.nodesTableLoading = this.modelView.modelBuilder.loadingComponent().component();
		this.nodesTable = this.modelView.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			width: '100%',
			columns: [
				{
					displayName: loc.name,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.type,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '15%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.status,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.fullyQualifiedDomain,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '35%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			data: []
		}).component();

		// Refresh before configuring the loading component
		this.refreshNodes();
		this.nodesTableLoading.component = this.nodesTable;
		content.addItem(this.nodesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });

		this.initialized = true;
		return root;
	}

	protected get toolbarContainer(): azdata.ToolbarContainer {
		// New database
		const newDatabaseButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.newDatabase,
			iconPath: IconPathHelper.add
		}).component();

		this.disposables.push(
			newDatabaseButton.onDidClick(async () => {
				newDatabaseButton.enabled = false;
				let name;
				try {
					name = await vscode.window.showInputBox({ prompt: loc.databaseName });
					if (name) {
						const db: DuskyObjectModelsDatabase = { name: name }; // TODO support other options (sharded, owner)
						await this._postgresModel.createDatabase(db);
						vscode.window.showInformationMessage(loc.databaseCreated(db.name ?? ''));
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.databaseCreationFailed(name ?? '', error));
				} finally {
					newDatabaseButton.enabled = true;
				}
			}));

		// Reset password
		const resetPasswordButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.resetPassword,
			iconPath: IconPathHelper.edit
		}).component();

		this.disposables.push(
			resetPasswordButton.onDidClick(async () => {
				resetPasswordButton.enabled = false;
				try {
					const password = await promptAndConfirmPassword(input => !input ? loc.enterANonEmptyPassword : '');
					if (password) {
						await this._postgresModel.update(s => {
							s.arc = s.arc ?? new DuskyObjectModelsDatabaseServiceArcPayload();
							s.arc.servicePassword = password;
						});
						vscode.window.showInformationMessage(loc.passwordReset);
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.passwordResetFailed(error));
				} finally {
					resetPasswordButton.enabled = true;
				}
			}));

		// Delete service
		const deleteButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.deleteText,
			iconPath: IconPathHelper.delete
		}).component();

		this.disposables.push(
			deleteButton.onDidClick(async () => {
				deleteButton.enabled = false;
				try {
					if (await promptForResourceDeletion(this._postgresModel.namespace, this._postgresModel.name)) {
						await this._postgresModel.delete();
						vscode.window.showInformationMessage(loc.resourceDeleted(this._postgresModel.fullName));
					}
				} catch (error) {
					vscode.window.showErrorMessage(loc.resourceDeletionFailed(this._postgresModel.fullName, error));
				} finally {
					deleteButton.enabled = true;
				}
			}));

		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();

		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					this.propertiesLoading!.loading = true;
					this.kibanaLoading!.loading = true;
					this.grafanaLoading!.loading = true;
					this.nodesTableLoading!.loading = true;

					await Promise.all([
						this._postgresModel.refresh(),
						this._controllerModel.refresh()
					]);
				} catch (error) {
					vscode.window.showErrorMessage(loc.refreshFailed(error));
				}
				finally {
					refreshButton.enabled = true;
				}
			}));

		// Open in Azure portal
		const openInAzurePortalButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.openInAzurePortal,
			iconPath: IconPathHelper.openInTab
		}).component();

		this.disposables.push(
			openInAzurePortalButton.onDidClick(async () => {
				const r = this._controllerModel.getRegistration(ResourceType.postgresInstances, this._postgresModel.namespace, this._postgresModel.name);
				if (!r) {
					vscode.window.showErrorMessage(loc.couldNotFindAzureResource(this._postgresModel.fullName));
				} else {
					vscode.env.openExternal(vscode.Uri.parse(
						`https://portal.azure.com/#resource/subscriptions/${r.subscriptionId}/resourceGroups/${r.resourceGroupName}/providers/Microsoft.AzureData/${ResourceType.postgresInstances}/${r.instanceName}`));
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems([
			{ component: newDatabaseButton },
			{ component: resetPasswordButton },
			{ component: deleteButton },
			{ component: refreshButton, toolbarSeparatorAfter: true },
			{ component: openInAzurePortalButton }
		]).component();
	}

	private refreshProperties() {
		const registration = this._controllerModel.getRegistration(ResourceType.postgresInstances, this._postgresModel.namespace, this._postgresModel.name);
		const endpoint: { ip?: string, port?: number } = this._postgresModel.endpoint;

		this.properties!.propertyItems = [
			{ displayName: loc.name, value: this._postgresModel.name },
			{ displayName: loc.coordinatorEndpoint, value: `postgresql://postgres@${endpoint.ip}:${endpoint.port}` },
			{ displayName: loc.status, value: this._postgresModel.service?.status?.state ?? '' },
			{ displayName: loc.postgresAdminUsername, value: 'postgres' },
			{ displayName: loc.dataController, value: this._controllerModel?.namespace ?? '' },
			{ displayName: loc.nodeConfiguration, value: this._postgresModel.configuration },
			{ displayName: loc.subscriptionId, value: registration?.subscriptionId ?? '' },
			{ displayName: loc.postgresVersion, value: this._postgresModel.service?.spec?.engine?.version?.toString() ?? '' }
		];

		if (this._controllerModel.registrationsLastUpdated ||
			this._postgresModel.serviceLastUpdated ||
			this._postgresModel.podsLastUpdated) {

			this.propertiesLoading!.loading = false;
		}
	}

	private refreshEndpoints() {
		const kibanaQuery = `kubernetes_namespace:"${this._postgresModel.namespace}" and cluster_name:"${this._postgresModel.name}"`;
		const kibanaUrl = `${this._controllerModel.getEndpoint('logsui')?.endpoint}/app/kibana#/discover?_a=(query:(language:kuery,query:'${kibanaQuery}'))`;
		this.kibanaLink!.label = kibanaUrl;
		this.kibanaLink!.url = kibanaUrl;

		const grafanaUrl = `${this._controllerModel.getEndpoint('metricsui')?.endpoint}/d/postgres-metrics?var-Namespace=${this._postgresModel.namespace}&var-Name=${this._postgresModel.name}`;
		this.grafanaLink!.label = grafanaUrl;
		this.grafanaLink!.url = grafanaUrl;

		if (this._controllerModel.endpointsLastUpdated) {
			this.kibanaLoading!.loading = false;
			this.grafanaLoading!.loading = false;
		}
	}

	private refreshNodes() {
		const endpoint: { ip?: string, port?: number } = this._postgresModel.endpoint;

		this.nodesTable!.data = this._postgresModel.pods?.map((pod: V1Pod) => {
			const name = pod.metadata?.name;
			const role: PodRole | undefined = PostgresModel.getPodRole(pod);
			const service = pod.metadata?.annotations?.['arcdata.microsoft.com/serviceHost'];
			const internalDns = service ? `${name}.${service}` : '';

			return [
				name,
				PostgresModel.getPodRoleName(role),
				PostgresModel.getPodStatus(pod),
				role === PodRole.Router ? `${endpoint.ip}:${endpoint.port}` : internalDns
			];
		}) ?? [];

		if (this._postgresModel.serviceLastUpdated || this._postgresModel.podsLastUpdated) {
			this.nodesTableLoading!.loading = false;
		}
	}
}
