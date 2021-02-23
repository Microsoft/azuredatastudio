/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#region --- workbench common & sandbox

import 'vs/workbench/workbench.sandbox.main';

//#endregion


//#region --- workbench actions

import 'vs/workbench/electron-browser/actions/developerActions';

//#endregion


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#region --- workbench (desktop main)

import 'vs/workbench/electron-browser/desktop.main';

//#endregion


//#region --- workbench services


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


import 'vs/workbench/services/integrity/node/integrityService';
import 'vs/workbench/services/search/electron-browser/searchService';
import 'vs/workbench/services/textfile/electron-browser/nativeTextFileService';
import 'vs/workbench/services/extensions/electron-browser/extensionService';
import 'vs/workbench/services/extensionManagement/electron-browser/extensionManagementServerService';
import 'vs/workbench/services/extensionManagement/electron-browser/extensionTipsService';
import 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import 'vs/workbench/services/telemetry/electron-browser/telemetryService';
import 'vs/workbench/services/backup/electron-browser/backupFileService';
import 'vs/workbench/services/userDataSync/electron-browser/userDataSyncMachinesService';
import 'vs/workbench/services/userDataSync/electron-browser/userDataSyncService';
import 'vs/workbench/services/userDataSync/electron-browser/userDataSyncAccountService';
import 'vs/workbench/services/userDataSync/electron-browser/userDataSyncStoreManagementService';
import 'vs/workbench/services/userDataSync/electron-browser/userDataAutoSyncService';
import 'vs/workbench/services/sharedProcess/electron-browser/sharedProcessService';
import 'vs/workbench/services/localizations/electron-browser/localizationsService';
import 'vs/workbench/services/diagnostics/electron-browser/diagnosticsService';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ITunnelService } from 'vs/platform/remote/common/tunnel';
import { TunnelService } from 'vs/platform/remote/node/tunnelService';

registerSingleton(ITunnelService, TunnelService);

//#endregion

// {{SQL CARBON EDIT}} - SQL-specific services
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-browser/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-browser/clipboardService';
import { IQueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryService';
import { QueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryServiceImpl';

registerSingleton(ISqlOAuthService, SqlOAuthService);
registerSingleton(sqlIClipboardService, sqlClipboardService);
registerSingleton(IQueryHistoryService, QueryHistoryService);
// {{SQL CARBON EDIT}} - End

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#region --- workbench contributions

// Output
import 'vs/workbench/contrib/output/electron-browser/outputChannelModelService';

// Tags
import 'vs/workbench/contrib/tags/electron-browser/workspaceTagsService';
import 'vs/workbench/contrib/tags/electron-browser/tags.contribution';

// Rapid Render Splash
import 'vs/workbench/contrib/splash/electron-browser/partsSplash.contribution';

// Debug
// import 'vs/workbench/contrib/debug/node/debugHelperService'; {{SQL CARBON EDIT}}

// Webview
import 'vs/workbench/contrib/webview/electron-browser/webview.contribution';


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


// Notebook
import 'vs/workbench/contrib/notebook/electron-browser/notebook.contribution';

// Extensions Management
import 'vs/workbench/contrib/extensions/electron-browser/extensions.contribution';

// Terminal
import 'vs/workbench/contrib/terminal/electron-browser/terminal.contribution';

// CodeEditor Contributions
import 'vs/workbench/contrib/codeEditor/electron-browser/codeEditor.contribution';

// External Terminal
import 'vs/workbench/contrib/externalTerminal/node/externalTerminal.contribution';


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


// Performance
import 'vs/workbench/contrib/performance/electron-browser/performance.contribution';

// CLI
import 'vs/workbench/contrib/cli/node/cli.contribution';

// Tasks
import 'vs/workbench/contrib/tasks/electron-browser/taskService';

// User Data Sync
import 'vs/workbench/contrib/userDataSync/electron-browser/userDataSync.contribution';


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#endregion

// {{SQL CARBON EDIT}}
// release notes
import 'sql/workbench/update/electron-browser/releaseNotes.contribution';

// query history
import 'sql/workbench/contrib/queryHistory/electron-browser/queryHistory.contribution';

// CLI
import 'sql/workbench/contrib/commandLine/electron-browser/commandLine.contribution';

//getting started
import 'sql/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
