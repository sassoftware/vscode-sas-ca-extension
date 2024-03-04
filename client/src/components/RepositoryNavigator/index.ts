// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  ProgressLocation,
  Uri,
  commands,
  l10n,
  window,
  workspace,
  env,
} from "vscode";

import { join, parse } from "path";
import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ConnectionType } from "../profile";
import RepositoryDataProvider from "./RepositoryDataProvider";
import { RepositoryModel } from "./RepositoryModel";
import { Messages } from "./const";
import { RepositoryItem, VersionHistoryItem } from "./types";
import { isContainer as getIsContainer } from "./utils";
import PropertyProvider from './PropertyProvider';
import VersionHistoryProvider from './VersionHistoryProvider';

export const FILE_REGEX = /^([^/<>;\\{}?#]+)\.\w+$/;
export const NAME_REGEX =
  /[^\u0022\u0024\u002A\u002F\u003A\u003C\u003E\u003F\u005C\u007C\u007F-\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u200B\u2028\u2029\u205F\u3000]/g;
export const LIMIT_VERSION_REGEX = /^([0-9]|10)\.([1-9]|10)$/g;
export const VERSION_REGEX = /^(\d+)\.(\d+)$/g;

const fileValidator = (value: string): string | null =>
  FILE_REGEX.test(value)
    ? null
    : Messages.FileValidationError;

const folderValidator = (value: string) => {
  if (value.length > 255) {
    return Messages.FolderNameLengthValidationError;
  }
  if (value.startsWith('.')) {
    return Messages.FolderNameDotValidationError;
  }
  if (value.startsWith(' ')) {
    return Messages.FolderNameLeadingSpaceValidationError;
  }
  if (value.endsWith(' ')) {
    return Messages.FolderNameTrailingSpaceValidationError;
  }
  const trimmed = value.trim();
  const matches = trimmed === '' ? value.match(NAME_REGEX) : trimmed.match(NAME_REGEX);
  if (matches === null || (matches.length < trimmed.length)) {
    return Messages.FolderNameCharacterValidationError;
  }
  return null;
};

const commentValidator = (value: string) => {
  if (value.length > 1024) {
    return Messages.CommentLengthValidationError;
  }
  return null;
};

const versionValidator = (value: string): string | null => {
  if (value !== '' && value.match(VERSION_REGEX) === null) {
    return Messages.VersionFormatValidationError;
  }
  return null;
};

class RepositoryNavigator implements SubscriptionProvider {
  private repositoryDataProvider: RepositoryDataProvider;
  private propertyProvider: PropertyProvider;
  private versionHistoryProvider: VersionHistoryProvider;
  private selectedItem: Uri;
  private selectedVersion: Uri;

  private repositoryModel = new RepositoryModel();

  constructor(context: ExtensionContext) {
    this.repositoryDataProvider = new RepositoryDataProvider(
      this.repositoryModel,
      context.extensionUri,
    );

    this.propertyProvider = new PropertyProvider(this.repositoryModel);
    this.versionHistoryProvider = new VersionHistoryProvider(
      this.repositoryModel,
      context.extensionUri
    );

    workspace.registerFileSystemProvider("sasHca", this.repositoryDataProvider);
    workspace.registerFileSystemProvider("sasHcaVersion", this.versionHistoryProvider);
    workspace.registerTextDocumentContentProvider(
      "sasHcaReadOnly",
      this.repositoryDataProvider,
    );
  }

  public getSubscriptions(): Disposable[] {
    return [
      ...this.repositoryDataProvider.getSubscriptions(),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.deleteRepositoryResource",
        async (item: RepositoryItem) => {
          window.showWarningMessage(
            Messages.DeleteWarningMessage,
            { modal: true },
            Messages.DeleteButtonLabel
          )
            .then(async answer => {
              if (answer === "Delete") {
                const success = await this.repositoryDataProvider.deleteResource(this.treeViewSelections(item));
                if (!success) {
                  window.showErrorMessage(
                    l10n.t(Messages.DeleteError)
                  );
                  return;
                }

                this.repositoryDataProvider.refresh();
              }
            });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.selectRepositoryResource",
        async (item: RepositoryItem, uri: Uri) => {
          const isContainer = getIsContainer(item);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.containerSelected",
            isContainer
          );
          this.propertyProvider.refresh(item);
          if (!isContainer) {
            this.versionHistoryProvider.refresh(item, true);
            commands.executeCommand("vscode.open", uri);
          } else {
            this.versionHistoryProvider.clearData(item);
          }
        }
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.refreshRepositoryContent", () =>
        this.repositoryDataProvider.refresh(),
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.copyRepositoryResourcePath", (item: RepositoryItem) => {
        env.clipboard.writeText(item.path);
      }),
      commands.registerCommand("SAS.ClinicalAcceleration.refreshRepositoryProperties", () => {
        this.propertyProvider.refresh(this.repositoryDataProvider.treeView.selection[0]);
      }),
      commands.registerCommand("SAS.ClinicalAcceleration.refreshRepositoryVersionHistory", () => {
        this.versionHistoryProvider.refresh(this.repositoryDataProvider.treeView.selection[0], true);
      }),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.addRepositoryFolderResource",
        async (item: RepositoryItem) => {
          const folderName = await window.showInputBox({
            prompt: Messages.NewFolderPrompt,
            title: Messages.NewFolderTitle,
            ignoreFocusOut: true,
            validateInput: folderValidator,
          });
          if (!folderName || folderName === undefined) {
            return;
          }

          const newUri = await this.repositoryDataProvider.createFolder(
            item,
            folderName,
          );

          this.repositoryDataProvider.handleCreationResponse(
            item,
            newUri,
            l10n.t(Messages.NewFolderCreationError, { name: folderName }),
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.renameRepositoryResource",
        async (item: RepositoryItem) => {
          const isContainer = getIsContainer(item);
          const name = await window.showInputBox({
            prompt: Messages.RenamePrompt,
            title: isContainer
              ? Messages.RenameFolderTitle
              : Messages.RenameFileTitle,
            value: item.name,
            ignoreFocusOut: true,
            validateInput: isContainer ? folderValidator : fileValidator,
          });
          if (!name || name === undefined || name === item.name) {
            return;
          }

          const newUri = await this.repositoryDataProvider.renameResource(
            item,
            name,
          );

          if (!newUri) {
            window.showErrorMessage(
              l10n.t(Messages.RenameErrorMessage, {
                oldName: item.name,
                newName: name,
              }),
            );
            return;
          }

          this.repositoryDataProvider.refresh();
          this.propertyProvider.refresh(item);
          this.versionHistoryProvider.refresh(item, true);
        },
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.collapseAllRepositoryContent", () => {
        commands.executeCommand(
          "workbench.actions.treeView.repositorydataprovider.collapseAll",
        );
      }),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.downloadRepositoryResource",
        async (item: RepositoryItem) => {
          let saveAsPath = process.env.HOME ? join(process.env.HOME, item.name) : item.name;
          if (item.primaryType !== "FILE") {
            saveAsPath += ".zip";
          }

          const items = this.treeViewSelections(item);
          if (items.length > 1) {
            saveAsPath = process.env.HOME ? join(process.env.HOME, items[0].name + ".zip") : items[0].name + ".zip";
          }

          window.showSaveDialog({
            title: Messages.DownloadTitle,
            saveLabel: Messages.DownloadTitle,
            defaultUri: Uri.parse(saveAsPath),
          }).then(async fileInfos => {
            if (fileInfos) {
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.DownloadingMessage),
              },
                async () => {
                  await this.repositoryDataProvider.downloadResource(
                    items,
                    fileInfos.fsPath
                  );
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.uploadRepositoryResource",
        async (item: RepositoryItem) => {
          const openPath = process.env.HOME ? join(process.env.HOME) : '';

          window.showOpenDialog({
            title: Messages.UploadTitle,
            openLabel: Messages.UploadTitle,
            defaultUri: Uri.parse(openPath),
            canSelectMany: true,
          }).then(async fileInfos => {
            if (fileInfos) {
              const comment = await window.showInputBox({
                prompt: Messages.CommentPrompt,
                title: Messages.CommentTitle,
                ignoreFocusOut: true,
                validateInput: commentValidator,
              });
              if (comment === undefined) {
                return;
              }
              const version = await window.showInputBox({
                prompt: Messages.VersionPrompt,
                title: Messages.VersionTitle,
                value: "1.0",
                ignoreFocusOut: true,
                validateInput: versionValidator,
              });
              if (version === undefined) {
                return;
              }
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.UploadingMessage),
              },
                async () => {
                  const results = await this.repositoryDataProvider.uploadResource(item, fileInfos, false, comment, version);
                  if (results.includes(false)) {
                    window.showErrorMessage(
                      l10n.t(Messages.UploadError)
                    );
                  }
                  if (results.includes(true)) {
                    this.repositoryDataProvider.refresh();
                  }
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.uploadAndExpandRepositoryResource",
        async (item: RepositoryItem) => {
          const openPath = process.env.HOME ? join(process.env.HOME) : '';

          window.showOpenDialog({
            filters: {
              'Zip File': ['zip'],
            },
            canSelectMany: false,
            title: Messages.UploadAndExpandTitle,
            openLabel: Messages.UploadTitle,
            defaultUri: Uri.parse(openPath),
          }).then(async fileInfos => {
            if (fileInfos) {
              const comment = await window.showInputBox({
                prompt: Messages.CommentPrompt,
                title: Messages.CommentTitle,
                ignoreFocusOut: true,
                validateInput: commentValidator,
              });
              if (comment === undefined) {
                return;
              }
              const version = await window.showInputBox({
                prompt: Messages.VersionPrompt,
                title: Messages.VersionTitle,
                ignoreFocusOut: true,
                value: "1.0",
                validateInput: versionValidator,
              });
              if (version === undefined) {
                return;
              }
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.UploadingMessage),
              },
                async () => {
                  const success = await this.repositoryDataProvider.uploadResource(item, fileInfos, true, comment, version);
                  if (!success) {
                    window.showErrorMessage(
                      l10n.t(Messages.UploadError)
                    );
                    return;
                  }

                  this.repositoryDataProvider.refresh();
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.downloadRepositoryResourceVersion",
        async (item: VersionHistoryItem) => {
          const saveFileName = parse(item.path).name + "-v" + item.fileVersion + parse(item.path).ext;
          const saveAsPath = process.env.HOME ? join(process.env.HOME, saveFileName) : saveFileName;
          window.showSaveDialog({
            title: Messages.DownloadTitle,
            saveLabel: Messages.DownloadTitle,
            defaultUri: Uri.parse(saveAsPath),
          }).then(async fileInfo => {
            if (fileInfo) {
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.DownloadingMessage),
              },
                async () => {
                  this.versionHistoryProvider.downloadResource(
                    item,
                    fileInfo.fsPath,
                  );
                },
              );
            }
          });
        },
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.enableRepositoryResourceVersioning",
        async (item: RepositoryItem) => {
          const comment = await window.showInputBox({
            prompt: Messages.CommentPrompt,
            title: Messages.CommentTitle,
            ignoreFocusOut: true,
            validateInput: commentValidator,
          });
          if (comment === undefined) {
            return;
          }
          const version = await window.showInputBox({
            prompt: Messages.VersionPrompt,
            title: Messages.VersionTitle,
            ignoreFocusOut: true,
            value: "1.0",
            validateInput: versionValidator,
          });
          if (version === undefined) {
            return;
          }
          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.EnableVersioningMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.repositoryDataProvider.enableVersioning(item, comment, version);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.propertyProvider.refresh(item);
                this.versionHistoryProvider.refresh(item, true);
              }
            },
          );
        }),
      commands.registerCommand("SAS.ClinicalAcceleration.disableRepositoryResourceVersioning",
        async (item: RepositoryItem) => {
          const comment = await window.showInputBox({
            prompt: Messages.CommentPrompt,
            title: Messages.CommentTitle,
            ignoreFocusOut: true,
            validateInput: commentValidator,
          });
          if (comment === undefined) {
            return;
          }
          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.DisableVersioningMessage, {
              name: item.name,
            }),
          },
            async () => {
              const success = await this.repositoryDataProvider.disableVersioning(item, comment);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.propertyProvider.refresh(item);
                this.versionHistoryProvider.refresh(item, true);
              }
            },
          );
        }),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.selectRepositoryResourceForComparison",
        async (item: RepositoryItem) => {
          this.selectedItem = await this.repositoryDataProvider.getUri(item, false);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.itemSelected",
            this.selectedItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareRepositoryResourceWithSelected",
        async (item: RepositoryItem) => {
          const uri1 = await this.repositoryDataProvider.getUri(item, false);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            this.selectedItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareSelectedRepositoryResources",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);
          const uri1 = await this.repositoryDataProvider.getUri(selections[0], false);
          const uri2 = await this.repositoryDataProvider.getUri(selections[1], false);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            uri2
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.selectRepositoryVersionForComparison",
        async (item: VersionHistoryItem) => {
          this.selectedItem = await this.versionHistoryProvider.getUri(item);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.versionSelected",
            this.selectedItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareRepositoryVersionWithSelected",
        async (item: VersionHistoryItem) => {
          const uri1 = await this.versionHistoryProvider.getUri(item);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            this.selectedItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareSelectedRepositoryVersionResources",
        async (item: VersionHistoryItem) => {
          const selections = this.versionHistoryTreeViewSelections(item);
          const uri1 = await this.versionHistoryProvider.getUri(selections[0]);
          const uri2 = await this.versionHistoryProvider.getUri(selections[1]);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            uri2
          );
        },
      ),
      workspace.onDidChangeConfiguration(
        async (event: ConfigurationChangeEvent) => {
          if (event.affectsConfiguration("SAS.ClinicalAcceleration.connectionProfiles")) {
            const activeProfile = profileConfig.getProfileByName(
              profileConfig.getActiveProfile(),
            );
            if (activeProfile) {
              if (
                activeProfile.connectionType === ConnectionType.Rest &&
                !activeProfile.serverId
              ) {
                await this.repositoryDataProvider.connect(activeProfile.endpoint);
              }
            }
          }
        },
      ),
    ];
  }

  private treeViewSelections(item: RepositoryItem): RepositoryItem[] {
    const selections = this.repositoryDataProvider.treeView.selection;
    if (selections) {
      const ids: string[] = selections.map(({ id }: RepositoryItem) => id);
      if (ids.includes(item.id)) {
        return [...selections];
      }
    }
    return [item];
  }

  private versionHistoryTreeViewSelections(item: VersionHistoryItem): VersionHistoryItem[] {
    const selections = this.versionHistoryProvider.treeView.selection;
    if (selections) {
      const ids: string[] = selections.map(({ fileId }: VersionHistoryItem) => fileId);
      if (ids.includes(item.fileId)) {
        return [...selections];
      }
    }
    return [item];
  }
}

export default RepositoryNavigator;
