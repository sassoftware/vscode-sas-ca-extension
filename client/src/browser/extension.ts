// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  ExtensionContext,
  StatusBarAlignment,
  StatusBarItem,
  authentication,
  commands,
  l10n,
  window,
  workspace,
} from "vscode";

import { checkProfileAndAuthorize } from "../commands/authorize";
import {
  addProfile,
  deleteProfile,
  profileConfig,
  switchProfile,
  updateProfile,
} from "../commands/profile";
import { SASAuthProvider } from "../components/AuthProvider";
import { installCAs } from "../components/CAHelper";
import RepositoryNavigator from "../components/RepositoryNavigator";
import { setContext } from "../components/ExtensionContext";
import { ConnectionType } from "../components/profile";

// Create Profile status bar item
const activeProfileStatusBarIcon = window.createStatusBarItem(
  StatusBarAlignment.Left,
  0,
);

export function activate(context: ExtensionContext): void {

  activeProfileStatusBarIcon.command = "SAS.ClinicalAcceleration.switchProfile";

  installCAs();

  setContext(context);

  const repositoryNavigator = new RepositoryNavigator(context);

  context.subscriptions.push(
    commands.registerCommand("SAS.ClinicalAcceleration.switchProfile", switchProfile),
    commands.registerCommand("SAS.ClinicalAcceleration.addProfile", addProfile),
    commands.registerCommand("SAS.ClinicalAcceleration.deleteProfile", deleteProfile),
    commands.registerCommand("SAS.ClinicalAcceleration.updateProfile", updateProfile),
    commands.registerCommand("SAS.ClinicalAcceleration.authorize", checkProfileAndAuthorize),
    authentication.registerAuthenticationProvider(
      SASAuthProvider.id,
      "SAS.ClinicalAcceleration",
      new SASAuthProvider(context.secrets),
    ),
    activeProfileStatusBarIcon,
    ...repositoryNavigator.getSubscriptions(),
    // If configFile setting is changed, update watcher to watch new configuration file
    workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("SAS.ClinicalAcceleration.connectionProfiles")) {
        triggerProfileUpdate();
      }
    }),
  );

  // Reset first to set "No Active Profiles"
  resetStatusBarItem(activeProfileStatusBarIcon);

  // Update status bar if profile is found
  updateStatusBarProfile(activeProfileStatusBarIcon);

  profileConfig.migrateLegacyProfiles();
  triggerProfileUpdate();
}

function triggerProfileUpdate(): void {
  const profileList = profileConfig.getAllProfiles();
  const activeProfileName = profileConfig.getActiveProfile();
  if (profileList[activeProfileName]) {
    updateStatusBarProfile(activeProfileStatusBarIcon);

    const connectionType =
      profileList[activeProfileName].connectionType || ConnectionType.Rest;

    //Set the connection type
    commands.executeCommand("setContext", "SAS.ClinicalAcceleration.connectionType", connectionType);

    //See if the connection is direct (ie. serverId)
    commands.executeCommand(
      "setContext",
      "SAS.ClinicalAcceleration.connection.direct",
      connectionType === ConnectionType.Rest &&
      "serverId" in profileList[activeProfileName],
    );
  } else {
    profileConfig.updateActiveProfileSetting("");
    commands.executeCommand(
      "setContext",
      "SAS.ClinicalAcceleration.connectionType",
      ConnectionType.Rest,
    );
  }
}

async function updateStatusBarProfile(profileStatusBarIcon: StatusBarItem) {
  const activeProfileName = profileConfig.getActiveProfile();
  const activeProfile = profileConfig.getProfileByName(activeProfileName);
  if (!activeProfile) {
    resetStatusBarItem(profileStatusBarIcon);
  } else {
    const statusBarTooltip = profileConfig.remoteTarget(activeProfileName);

    updateStatusBarItem(
      profileStatusBarIcon,
      `${activeProfileName}`,
      `${activeProfileName}\n${statusBarTooltip}`,
    );
  }
}

function updateStatusBarItem(
  statusBarItem: StatusBarItem,
  text: string,
  tooltip: string,
): void {
  statusBarItem.text = `$(cloud) ${text}`;
  statusBarItem.tooltip = tooltip;
  statusBarItem.show();
}

function resetStatusBarItem(statusBarItem: StatusBarItem): void {
  statusBarItem.text = `$(debug-disconnect) ${l10n.t("No Profile")}`;
  statusBarItem.tooltip = l10n.t("No SAS Clinical Acceleration Connection Profile");
  statusBarItem.show();
}
