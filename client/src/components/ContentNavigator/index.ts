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
import { RepositoryItem, SynchronizationItem, VersionHistoryItem, VersioningItem, WorkspaceItem } from "./types";
import { isContainer as getIsContainer, isWorkspaceContainer as getIsWorkspaceContainer } from "./utils";
import PropertyProvider from './PropertyProvider';
import VersionHistoryProvider from './VersionHistoryProvider';
import WorkspaceDataProvider from './WorkspaceDataProvider';
import { WorkspaceModel } from './WorkspaceModel';
import RepositoryDecorator from './RepositoryDecorator';

export const FILE_REGEX = /^([^/<>;\\{}?#]+)\.\w+$/;
export const NAME_REGEX =
  /[^\u0022\u0024\u002A\u002F\u003A\u003C\u003E\u003F\u005C\u007C\u007F-\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200A\u200B\u2028\u2029\u205F\u3000]/g;
export const LIMIT_VERSION_REGEX = /^(\d|10)\.([1-9]|10)$/g;
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

const yesNoValidator = (value: string): string | null => {
  const input = value.toLowerCase().trim();
  if (input !== 'yes' && input !== 'no' && input !== 'true' && input !== 'false') {
    return Messages.YesNoFormatValidationError;
  }
  return null;
}

class ContentNavigator implements SubscriptionProvider {
  private readonly repositoryDataProvider: RepositoryDataProvider;
  private readonly workspaceDataProvider: WorkspaceDataProvider;

  private readonly propertyProvider: PropertyProvider;
  private readonly versionHistoryProvider: VersionHistoryProvider;
  private selectedRepositoryItem: Uri | undefined;
  private selectedWorkspaceItem: Uri | undefined;
  private selectedVersionedItem: Uri | undefined;

  private readonly repositoryModel = new RepositoryModel();
  private readonly workspaceModel = new WorkspaceModel();
  private readonly repositoryDecorator: RepositoryDecorator;

  constructor(context: ExtensionContext) {
    this.repositoryDataProvider = new RepositoryDataProvider(
      this.repositoryModel,
      context.extensionUri,
    );

    this.workspaceDataProvider = new WorkspaceDataProvider(
      this.workspaceModel,
      context.extensionUri,
    );

    this.propertyProvider = new PropertyProvider(this.repositoryModel);
    this.versionHistoryProvider = new VersionHistoryProvider(
      this.repositoryModel,
      context.extensionUri
    );

    this.repositoryDecorator = new RepositoryDecorator();

    workspace.registerFileSystemProvider("sasHca", this.repositoryDataProvider);
    workspace.registerFileSystemProvider("sasHcaVersion", this.versionHistoryProvider);
    workspace.registerTextDocumentContentProvider(
      "sasHcaReadOnly",
      this.repositoryDataProvider,
    );

    workspace.registerFileSystemProvider("sasCaWorkspace", this.workspaceDataProvider);
    workspace.registerTextDocumentContentProvider("sasCaWorkspace", this.workspaceDataProvider);

    window.registerFileDecorationProvider(this.repositoryDecorator)
  }

  public getSubscriptions(): Disposable[] {
    return [
      ...this.repositoryDataProvider.getSubscriptions(),
      ...this.workspaceDataProvider.getSubscriptions(),
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
            "SAS.ClinicalAcceleration.repositoryContainerSelected",
            isContainer
          );
          this.propertyProvider.refresh(item);
          if (isContainer) {
            this.versionHistoryProvider.clearData(item);
          } else {
            this.versionHistoryProvider.refresh(item, true);
            commands.executeCommand("vscode.open", uri);
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
          this.selectedRepositoryItem = await this.repositoryDataProvider.getUri(item, false);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.repositoryItemSelected",
            this.selectedRepositoryItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareRepositoryResourceWithSelectedWorkspaceResource",
        async (item: RepositoryItem) => {
          const uri1 = await this.repositoryDataProvider.getUri(item, false);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            this.selectedWorkspaceItem
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
            this.selectedRepositoryItem
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
          this.selectedVersionedItem = await this.versionHistoryProvider.getUri(item);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.versionSelected",
            this.selectedVersionedItem
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
            this.selectedVersionedItem
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
      commands.registerCommand(
        "SAS.ClinicalAcceleration.copyLatestVersion",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CopyLatestVersionMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.copyLatestVersion(selections);
              if (success) {
                this.workspaceDataProvider.refresh();
              }
            },
          );
        }
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.copySpecificVersion",
        async (item: VersionHistoryItem) => {

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CopySpecificVersionMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.copySpecificVersion(item);
              if (success) {
                this.workspaceDataProvider.refresh();
              }
            }
          );
        }
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.copyFolder",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CopyFolderMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.copyFolder(selections);
              if (success) {
                this.workspaceDataProvider.refresh();
              }
            },
          );
        }
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.copyFolderStructure",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CopyFolderStructureMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.copyFolderStructure(selections);
              if (success) {
                this.workspaceDataProvider.refresh();
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.checkoutWithContent",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CheckingOutContentMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.checkoutWithContent(selections);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.workspaceDataProvider.refresh();
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.checkoutWithoutContent",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.CheckingOutMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.checkoutWithoutContent(selections);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.workspaceDataProvider.refresh();
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.undoCheckoutRepositoryResource",
        async (item: RepositoryItem) => {
          const selections = this.treeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.UndoCheckOutMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.undoCheckout(selections);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.workspaceDataProvider.refresh();
              }
            },
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

      //
      // Start of commands for workspace.
      //

      commands.registerCommand(
        "SAS.ClinicalAcceleration.deleteWorkspaceResource",
        async (item: WorkspaceItem) => {
          window.showWarningMessage(
            Messages.DeleteWarningMessage,
            { modal: true },
            Messages.DeleteButtonLabel
          )
            .then(async answer => {
              if (answer === "Delete") {
                const success = await this.workspaceDataProvider.deleteResource(this.workspaceTreeViewSelections(item));
                if (!success) {
                  window.showErrorMessage(
                    l10n.t(Messages.DeleteError)
                  );
                  return;
                }

                this.workspaceDataProvider.refresh();
              }
            });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.selectWorkspaceResource",
        async (item: WorkspaceItem, uri: Uri) => {
          const isContainer = getIsWorkspaceContainer(item);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.workspaceContainerSelected",
            isContainer
          );

          if (!isContainer) {
            commands.executeCommand("vscode.open", uri);
          }
        }
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.refreshWorkspaceContent", () =>
        this.workspaceDataProvider.refresh(),
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.copyWorkspaceResourcePath", (item: RepositoryItem) => {
        env.clipboard.writeText(item.path);
      }),

      commands.registerCommand(
        "SAS.ClinicalAcceleration.addWorkspaceFileResource",
        async (item: WorkspaceItem) => {
          const fileName = await window.showInputBox({
            prompt: Messages.NewFilePrompt,
            title: Messages.NewFileTitle,
            ignoreFocusOut: true,
            validateInput: fileValidator,
          });
          if (!fileName || fileName === undefined) {
            return;
          }

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.FileCreationMessage),
          },
            async () => {
              const newUri = await this.workspaceDataProvider.createFile(
                fileName,
                item,
              );

              this.workspaceDataProvider.handleCreationResponse(
                item,
                newUri,
                l10n.t(Messages.NewFileCreationError, { name: fileName }),
              );
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.addWorkspaceFolderResource",
        async (item: WorkspaceItem) => {
          const folderName = await window.showInputBox({
            prompt: Messages.NewFolderPrompt,
            title: Messages.NewFolderTitle,
            ignoreFocusOut: true,
            validateInput: folderValidator,
          });
          if (!folderName || folderName === undefined) {
            return;
          }

          const newUri = await this.workspaceDataProvider.createFolder(
            folderName,
            item,
          );

          this.workspaceDataProvider.handleCreationResponse(
            item,
            newUri,
            l10n.t(Messages.NewFolderCreationError, { name: folderName }),
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.renameWorkspaceResource",
        async (item: WorkspaceItem) => {
          const isContainer = getIsWorkspaceContainer(item);
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

          const newUri = await this.workspaceDataProvider.renameResource(
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

          this.workspaceDataProvider.refresh();
        },
      ),
      commands.registerCommand("SAS.ClinicalAcceleration.collapseAllWorkspaceContent", () => {
        commands.executeCommand(
          "workbench.actions.treeView.workspaceDataProvider.collapseAll",
        );
      }),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.downloadWorkspaceResource",
        async (item: WorkspaceItem) => {
          let saveAsPath = process.env.HOME ? join(process.env.HOME, item.name) : item.name;
          if (item.type !== "FILE") {
            saveAsPath += ".zip";
          }

          const items = this.workspaceTreeViewSelections(item);
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
                  const results = await this.workspaceDataProvider.downloadResource(
                    items,
                    fileInfos.fsPath
                  );
                  if (!results) {
                    window.showErrorMessage(
                      l10n.t(Messages.DownloadedError)
                    );
                  }
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.uploadWorkspaceResource",
        async (item: WorkspaceItem) => {
          const openPath = process.env.HOME ? join(process.env.HOME) : '';

          window.showOpenDialog({
            title: Messages.UploadTitle,
            openLabel: Messages.UploadTitle,
            defaultUri: Uri.parse(openPath),
            canSelectMany: true,
          }).then(async fileInfos => {
            if (fileInfos) {
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.UploadingMessage),
              },
                async () => {
                  const results = await this.workspaceDataProvider.uploadResource(item, fileInfos, false);
                  if (results.includes(false)) {
                    window.showErrorMessage(
                      l10n.t(Messages.UploadError)
                    );
                  }
                  if (results.includes(true)) {
                    this.workspaceDataProvider.refresh();
                  }
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.uploadAndExpandWorkspaceResource",
        async (item: WorkspaceItem) => {
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
              await window.withProgress({
                location: ProgressLocation.Notification,
                title: l10n.t(Messages.UploadingMessage),
              },
                async () => {
                  const success = await this.workspaceDataProvider.uploadResource(item, fileInfos, true);
                  if (!success) {
                    window.showErrorMessage(
                      l10n.t(Messages.UploadError)
                    );
                    return;
                  }

                  this.workspaceDataProvider.refresh();
                },
              );
            }
          });
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.checkInWorkspaceResource",
        async (item: WorkspaceItem) => {
          const selections = this.workspaceTreeViewSelections(item);

          const newFiles: VersioningItem[] = [];
          const existingVersionedFiles: VersioningItem[] = [];
          const existingUnVersionedFiles: VersioningItem[] = [];
          const collection = await this.workspaceDataProvider.getEligibleSynchronizationItems('CHECKIN',
            selections.map((item) => item.path));

          if (collection.items.length === 0) {
            window.showErrorMessage(
              l10n.t(Messages.NoEligibleItemsFound)
            );
            return;
          }

          collection.items.forEach((item: SynchronizationItem) => {
            const file = item as SynchronizationItem;
            const isVersioned =
              item.synchronizationInfo?.fileVersion !== null &&
              item.synchronizationInfo.fileVersion !== '-';
            if (!file.synchronizationInfo?.checkedOut) {
              // This is a new file
              newFiles.push({
                ...item,
                versionType: 0,
                fileVersion: file.synchronizationInfo.fileVersion ?? '-',
                currentVersion: file.synchronizationInfo.fileVersion ?? '-',
              });
            } else if (file.synchronizationInfo?.checkedOut) {
              // This is a file that is already checked out.
              if (isVersioned) {
                existingVersionedFiles.push({
                  ...item,
                  versionType: 1,
                  fileVersion: file.synchronizationInfo.fileVersion,
                  currentVersion: file.synchronizationInfo.fileVersion,
                });
              } else {
                existingUnVersionedFiles.push({
                  ...item,
                  versionType: 2,
                  fileVersion: file.synchronizationInfo.fileVersion ?? '-',
                  currentVersion: file.synchronizationInfo.fileVersion ?? '-',
                });
              }
            }
          });

          // Prompt if we have new files.
          let versionForNewFiles: string | undefined;

          if (newFiles.length !== 0) {
            const enableVersioningPrompt = await window.showInputBox({
              prompt: Messages.EnableVersioningForNewFilesMessage,
              title: Messages.EnableVersioningForFilesTitle,
              ignoreFocusOut: true,
              value: "yes",
              validateInput: yesNoValidator,
            });
            if (enableVersioningPrompt === undefined) {
              return;
            }

            const input = enableVersioningPrompt.toLowerCase().trim();
            const enableVersioning = input === 'yes' || input === 'true';

            if (enableVersioning) {
              versionForNewFiles = await window.showInputBox({
                prompt: Messages.CheckinVersionPrompt,
                title: Messages.VersionTitle,
                value: "1.0",
                ignoreFocusOut: true,
                validateInput: versionValidator,
              });

              if (versionForNewFiles === undefined) {
                return;
              }
            }
          }

          // Prompt if we have existing files
          let versionForUnVersionedFiles: string | undefined;

          if (existingUnVersionedFiles.length !== 0) {
            const enableVersioningPrompt = await window.showInputBox({
              prompt: Messages.EnableVersioningForExistingFilesMessage,
              title: Messages.EnableVersioningForFilesTitle,
              ignoreFocusOut: true,
              value: "yes",
              validateInput: yesNoValidator,
            });
            if (enableVersioningPrompt === undefined) {
              return;
            }

            const input = enableVersioningPrompt.toLowerCase().trim();
            const enableVersioning = input === 'yes' || input === 'true';

            if (enableVersioning) {
              versionForUnVersionedFiles = await window.showInputBox({
                prompt: Messages.VersionPrompt,
                title: Messages.VersionTitle,
                value: "1.0",
                ignoreFocusOut: true,
                validateInput: versionValidator,
              });

              if (versionForUnVersionedFiles === undefined) {
                return;
              }
            }
          }

          let nextVersionForVersionedFiles: string | undefined;
          if (existingVersionedFiles.length !== 0) {
            const versionChoices = [
              {
                label: l10n.t("Major"),
                description: l10n.t("Update version for all versioned files being checked in to the next Major version."),
                value: "major"
              },
              {
                label: l10n.t("Minor"),
                description: l10n.t("Update version for all versioned files being checked in to the next Minor version."),
                value: "minor"
              },
            ];

            nextVersionForVersionedFiles = (await window.showQuickPick(versionChoices, {
              placeHolder: l10n.t("Select version scheme to apply to checked-out versioned files."),
              ignoreFocusOut: true,
              canPickMany: false,
            }))?.value;

            if (!nextVersionForVersionedFiles) {
              return;
            }
          }

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
            title: l10n.t(Messages.CheckingInMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.checkIn(
                [...newFiles, ...existingUnVersionedFiles, ...existingVersionedFiles],
                versionForNewFiles,
                versionForUnVersionedFiles,
                nextVersionForVersionedFiles,
                comment);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.workspaceDataProvider.refresh();
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.undoCheckoutWorkspaceResource",
        async (item: WorkspaceItem) => {
          const selections = this.workspaceTreeViewSelections(item);

          await window.withProgress({
            location: ProgressLocation.Notification,
            title: l10n.t(Messages.UndoCheckOutMessage,
              { name: item.name }),
          },
            async () => {
              const success = await this.workspaceDataProvider.undoCheckout(selections);
              if (success) {
                this.repositoryDataProvider.refresh();
                this.workspaceDataProvider.refresh();
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.selectWorkspaceResourceForComparison",
        async (item: WorkspaceItem) => {
          this.selectedWorkspaceItem = await this.workspaceDataProvider.getUri(item, false);
          commands.executeCommand(
            "setContext",
            "SAS.ClinicalAcceleration.workspaceItemSelected",
            this.selectedWorkspaceItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareWorkspaceResourceWithSelected",
        async (item: WorkspaceItem) => {
          const uri1 = await this.workspaceDataProvider.getUri(item, false);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            this.selectedWorkspaceItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareWorkspaceResourceWithSelectedRepositoryResource",
        async (item: WorkspaceItem) => {
          const uri1 = await this.workspaceDataProvider.getUri(item, false);
          commands.executeCommand(
            "vscode.diff",
            uri1,
            this.selectedRepositoryItem
          );
        },
      ),
      commands.registerCommand(
        "SAS.ClinicalAcceleration.compareSelectedWorkspaceResources",
        async (item: WorkspaceItem) => {
          const selections = this.workspaceTreeViewSelections(item);
          const uri1 = await this.workspaceDataProvider.getUri(selections[0], false);
          const uri2 = await this.workspaceDataProvider.getUri(selections[1], false);
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
                await this.workspaceDataProvider.connect(activeProfile.endpoint);
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

  private workspaceTreeViewSelections(item: WorkspaceItem): WorkspaceItem[] {
    const selections = this.workspaceDataProvider.treeView.selection;
    if (selections) {
      const paths: string[] = selections.map(({ path }: WorkspaceItem) => path);
      if (paths.includes(item.path)) {
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

export default ContentNavigator;
