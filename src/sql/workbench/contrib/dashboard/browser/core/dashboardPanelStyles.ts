/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPanel';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import {
	TAB_ACTIVE_BACKGROUND, TAB_ACTIVE_FOREGROUND, TAB_INACTIVE_BACKGROUND,
	TAB_INACTIVE_FOREGROUND, EDITOR_GROUP_HEADER_TABS_BACKGROUND, TAB_BORDER, EDITOR_GROUP_BORDER, DASHBOARD_TAB_ACTIVE_BACKGROUND, DASHBOARD_BORDER
} from 'vs/workbench/common/theme';
import { activeContrastBorder } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	// Title Active
	const tabActiveBackground = theme.getColor(TAB_ACTIVE_BACKGROUND);
	const tabActiveForeground = theme.getColor(TAB_ACTIVE_FOREGROUND);
	let tabActiveBackgroundVertical = theme.getColor(DASHBOARD_TAB_ACTIVE_BACKGROUND);

	if (tabActiveBackground || tabActiveForeground) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel > .title .tabList .tab:hover .tabLabel,
			panel.dashboard-panel > .tabbedPanel > .title .tabList .tab .tabLabel.active {
				color: ${tabActiveForeground};
				border-bottom: 0px solid;
			}

			panel.dashboard-panel > .tabbedPanel.vertical > .title .tabList .tab-header.active {
				background-color: ${tabActiveBackgroundVertical};
			}

			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab-header.active {
				background-color: ${tabActiveBackground};
			}

			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab-header.active {
				border-bottom-color: transparent;
			}

			panel.dashboard-panel > .tabbedPanel.vertical > .title .tabList .tab-header.active {
				border-right-color: transparent;
			}
		`);
	}

	const highContrastActiveTabBorderColor = theme.getColor(activeContrastBorder);
	if (highContrastActiveTabBorderColor) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel > .title .tabList .tab-header.active {
				outline: 1px solid;
				outline-offset: -3px;
				outline-color: ${highContrastActiveTabBorderColor};
			}
		`);
	}

	// Title Inactive
	const tabInactiveBackground = theme.getColor(TAB_INACTIVE_BACKGROUND);
	const tabInactiveForeground = theme.getColor(TAB_INACTIVE_FOREGROUND);
	if (tabInactiveBackground || tabInactiveForeground) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab .tabLabel {
				color: ${tabInactiveForeground};
			}
			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab-header {
				background-color: ${tabInactiveBackground};
			}
		`);
	}

	// Panel title background
	const panelTitleBackground = theme.getColor(EDITOR_GROUP_HEADER_TABS_BACKGROUND);
	if (panelTitleBackground) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel.horizontal > .title {
				background-color: ${panelTitleBackground};
			}
		`);
	}

	// Panel title background
	const tabBorder = theme.getColor(TAB_BORDER);
	if (tabBorder) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab-header {
				border-right-color: ${tabBorder};
				border-bottom-color: ${tabBorder};
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel.horizontal > .title {
				border-bottom-color: ${tabBorder};
				border-bottom-width: 1px;
				border-bottom-style: solid;
			}

			panel.dashboard-panel > .tabbedPanel.vertical > .title {
				border-right-color: ${tabBorder};
				border-right-width: 1px;
				border-right-style: solid;
			}
		`);
	}

	const divider = theme.getColor(EDITOR_GROUP_BORDER);
	if (divider) {
		collector.addRule(`
			panel.dashboard-panel > .tabbedPanel.horizontal > .title .tabList .tab-header {
				border-right-width: 1px;
				border-right-style: solid;
			}
		`);
	}

	const sideBorder = theme.getColor(DASHBOARD_BORDER);
	if (divider) {
		collector.addRule(`panel.dashboard-panel > .tabbedPanel.vertical > .title > .tabContainer {
			border-right-width: 1px;
			border-right-style: solid;
			border-right-color: ${sideBorder};
		}`);
	}
});
