// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  ProviderResult,
  Tab,
  TabInputNotebook,
  TabInputText,
  TextDocumentContentProvider,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  commands,
  l10n,
  window,
} from "vscode";
import { readFileSync } from "fs";
import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ViyaProfile } from "../profile";
import { EventFn } from "../ActionChannel";
import { Messages } from "./const";
import {
  Action,
  ActionStatus,
  RepositoryItem,
  WorkspaceActionBody,
  WorkspaceFile,
  WorkspaceItem,
  ExtensionTypes,
  ActionMessages,
  VersionHistoryItem,
  ResourceCollection,
  SynchronizationItem,
  VersioningItem
} from "./types";
import {
  isWorkspaceContainer as getIsWorkspaceContainer,
  getWorkspaceUri,
  getWorkspaceModifyDate,
  workspaceResourceType,
  getNextVersion,
} from "./utils";
import { startPolling } from '../ActionStatus';
import { WorkspaceModel } from './WorkspaceModel';

class WorkspaceDataProvider
  implements
  TreeDataProvider<WorkspaceItem>,
  FileSystemProvider,
  TextDocumentContentProvider,
  SubscriptionProvider {

  private readonly _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private readonly _onDidChangeTreeData: EventEmitter<WorkspaceItem | undefined>;
  private readonly _onDidChange: EventEmitter<Uri>;
  private readonly _treeView: TreeView<WorkspaceItem>;
  private readonly model: WorkspaceModel;
  private readonly extensionUri: Uri;
  private saveDebounceTimers: Map<string, any> = new Map();

  get treeView(): TreeView<WorkspaceItem> {
    return this._treeView;
  }

  constructor(model: WorkspaceModel, extensionUri: Uri) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<WorkspaceItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;

    this._treeView = window.createTreeView("workspacedataprovider", {
      treeDataProvider: this,
      canSelectMany: true,
    });

    this._treeView.onDidChangeVisibility(async () => {
      if (this._treeView.visible) {
        const activeProfile: ViyaProfile = profileConfig.getProfileByName(
          profileConfig.getActiveProfile(),
        ) as ViyaProfile;
        await this.connect(activeProfile.endpoint);
      }
    });

    this._treeView.onDidChangeSelection(async event => {
      commands.executeCommand(
        "setContext",
        "SAS.ClinicalAcceleration.oneWorkspaceItemSelected",
        event.selection.length === 1
      );
      commands.executeCommand(
        "setContext",
        "SAS.ClinicalAcceleration.twoWorkspaceItemsSelected",
        event.selection.length === 2
      );
    });
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView];
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<WorkspaceItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public async connect(baseUrl: string): Promise<void> {
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public async getTreeItem(item: WorkspaceItem): Promise<TreeItem> {
    const isContainer = getIsWorkspaceContainer(item);
    const uri = await this.getUri(item, false);

    return {
      iconPath: this.iconPathForItem(item),
      resourceUri: this.getResourcePathByExtension(item),
      contextValue: await workspaceResourceType(item),
      id: item.path ?? undefined,
      label: item.name,
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: {
        command: "SAS.ClinicalAcceleration.selectWorkspaceResource",
        arguments: [item, uri],
        title: "Select Item",
      }
    }
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    return await this.model.getContentByUri(uri);
  }

  public getChildren(item?: WorkspaceItem): ProviderResult<WorkspaceItem[]> {
    return this.model.getChildren(item);
  }

  public watch(): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => { });
  }

  public async stat(uri: Uri): Promise<FileStat> {
    return await this.model.getResourceByUri(uri).then(
      (resource): FileStat => ({
        type: getIsWorkspaceContainer(resource) ? FileType.Directory : FileType.File,
        ctime: 0,
        mtime: new Date(getWorkspaceModifyDate(resource)).getTime(),
        size: (resource as unknown as WorkspaceFile).size,
        permissions: undefined,
      }),
    );
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.model
      .getContentByUri(uri)
      .then((content) => new TextEncoder().encode(content));
  }

  public getUri(item: WorkspaceItem, readOnly: boolean): Promise<Uri> {
    return this.model.getUri(item, readOnly);
  }

  public async createFile(
    fileName: string,
    item: WorkspaceItem,
  ): Promise<Uri | undefined> {

    return await this.model.createFile(fileName, item)
      .then((newFileName) => {
        this.refresh();
        EventFn(l10n.t(Messages.FileCreationSuccess,
          {
            name: fileName,
            location: item ? item.path : "/"
          }));
        const newUri = newFileName ? getWorkspaceUri(newFileName) : undefined;
        commands.executeCommand("vscode.open", newUri);
        return newUri;
      })
      .catch((error) => {
        EventFn(l10n.t(Messages.FileCreationError,
          {
            name: fileName,
            location: item ? item.path : "/",
            message: error.response.data.message
          }));
        return undefined;
      });
  }

  public async createFolder(
    folderName: string,
    item?: WorkspaceItem,
  ): Promise<Uri | undefined> {

    return await this.model.createFolder(folderName, item)
      .then((newFolder) => {
        this.refresh();
        EventFn(l10n.t(Messages.FolderCreationSuccess,
          {
            name: folderName,
            location: item ? item.path : "/"
          }));
        return newFolder ? getWorkspaceUri(newFolder) : undefined;
      })
      .catch((error) => {
        EventFn(l10n.t(Messages.FolderCreationError,
          {
            name: folderName,
            location: item ? item.path : "/",
            message: error.response.data.message
          }));
        return undefined;
      });
  }

  public async renameResource(
    item: WorkspaceItem,
    name: string,
  ): Promise<Uri | undefined> {
    const existingItem = await this.model.getResourceByPath(item.path);
    if (!existingItem) {
      return undefined;
    }
    return this.model.renameResource(existingItem, name)
      .then(async (newItem) => {
        const newUri = newItem ? getWorkspaceUri(newItem) : undefined;
        if (await (closeFileIfOpen(item)) && newUri) {
          commands.executeCommand("vscode.open", newUri);
        }
        EventFn(l10n.t(Messages.RenameSuccess,
          {
            oldName: item.name,
            newName: name
          }));
        return newUri;
      })
      .catch((error) => {
        EventFn(l10n.t(Messages.RenameError,
          {
            oldName: item.name,
            newName: name,
            message: error.response.data.message
          }));
        return undefined;
      });
  }

  public async downloadResource(
    items: WorkspaceItem[],
    path: string,
  ): Promise<boolean> {
    if (items.length === 0) {
      return false;
    }

    return await this.model.downloadResource(path, items)
      .then(async () => {
        items.length > 1 ?
          EventFn(l10n.t(Messages.DownloadedMessage,
            {
              name: "selected files",
              location: path
            }))
          :
          EventFn(l10n.t(Messages.DownloadedMessage,
            {
              name: items[0].name,
              location: path
            }));
        return true;
      }).catch((error) => {
        EventFn(l10n.t(Messages.DownloadedError,
          {
            name: "selected files",
            location: path,
            message: error.response.data.message
          }));
        return false;
      });
  }

  public async uploadResource(
    item: WorkspaceItem,
    fileInfos: Uri[],
    expand: boolean,
  ): Promise<boolean[]> {
    if (!item) {
      return [];
    }

    const uploadPromises = fileInfos.map(async file => {
      const filePath = file.fsPath;
      const buffer = readFileSync(filePath);
      return await this.model.uploadResource(item, filePath, buffer, expand)
        .then(async (newItem) => {
          if (newItem && item?.type === 'FILE' && await closeFileIfOpen(newItem)) {
            commands.executeCommand("vscode.open", getWorkspaceUri(newItem));
          }
          expand ?
            EventFn(l10n.t(Messages.UploadedAndExpandedMessage,
              {
                name: filePath,
                location: item.path
              }))
            :
            EventFn(l10n.t(Messages.UploadedMessage,
              {
                name: filePath,
                location: item.path
              }));
          return true;
        })
        .catch((error) => {
          EventFn(l10n.t(Messages.UploadErrorMessage,
            {
              name: filePath,
              location: item.path,
              message: error.response.data.message
            }));
          return false;
        });
    });
    return await Promise.all(uploadPromises);
  }

  public async deleteResource(items: WorkspaceItem[]): Promise<boolean> {
    items.forEach((item) => {
      if (!(closeFileIfOpen(item))) {
        return false;
      }
    });

    const paths = items.map((item) => item.path);
    return this.performWorkspaceAction("DELETE", paths);
  }

  public async handleCreationResponse(
    item: WorkspaceItem,
    newUri: Uri | undefined,
    errorMessage: string,
  ): Promise<void> {
    if (!newUri) {
      window.showErrorMessage(errorMessage);
      return;
    }

    this.reveal(item);
  }

  public copyLatestVersion(items: RepositoryItem[]): Promise<boolean> {
    const paths = items.map((item) => item.path);
    return this.performWorkspaceAction("COPY_LATEST_VERSION", paths);
  }

  public copySpecificVersion(item: VersionHistoryItem): Promise<boolean> {
    const fileSpecs: { path: string; fileVersion: string }[] = [];

    fileSpecs.push({
      path: item.path,
      fileVersion: item.fileVersion
    });

    return this.performWorkspaceAction("COPY_SPECIFIC_VERSION", fileSpecs);
  }

  public copyFolder(items: RepositoryItem[]): Promise<boolean> {
    const paths = items.map((item) => item.path);
    return this.performWorkspaceAction("COPY_FOLDER", paths);
  }

  public copyFolderStructure(items: RepositoryItem[]): Promise<boolean> {
    const paths = items.map((item) => item.path);
    return this.performWorkspaceAction("COPY_FOLDER_STRUCTURE", { paths: paths, includeSubfolders: true });
  }

  public checkoutWithContent(items: RepositoryItem[]): Promise<boolean> {
    const body = {
      paths: items.map((item) => item.path),
      copyContent: true,
    };
    return this.performWorkspaceAction("REPOSITORY_CHECK_OUT", body);
  }

  public checkoutWithoutContent(items: RepositoryItem[]): Promise<boolean> {
    const body = {
      paths: items.map((item) => item.path),
      copyContent: false,
    };
    return this.performWorkspaceAction("REPOSITORY_CHECK_OUT", body);
  }

  public undoCheckout(items: WorkspaceItem[] | RepositoryItem[]): Promise<boolean> {
    const paths = items.map((item) => item.path);
    return this.performWorkspaceAction("UNDO_CHECKOUT", paths);
  }


  public checkIn(
    items: VersioningItem[],
    versionForNewFiles?: string,
    versionForUnVersionedFiles?: string,
    nextVersionForVersionedFiles?: string,
    comment?: string): Promise<boolean> {
    const fileSpecs: { path: string; fileVersion?: string; type: string }[] = [];
    items.forEach((item) => {
      let fileVersion = item.fileVersion;
      if (item.versionType === 0) {
        if (versionForNewFiles) {
          fileVersion = versionForNewFiles;
        }
      }

      if (item.versionType === 1) {
        if (nextVersionForVersionedFiles) {
          fileVersion = getNextVersion(nextVersionForVersionedFiles as 'major' | 'minor', item.currentVersion);
        }
      }

      if (item.versionType === 2) {
        if (versionForUnVersionedFiles) {
          fileVersion = versionForUnVersionedFiles;
        }
      }

      fileSpecs.push({
        path: item.path ?? '',
        fileVersion: fileVersion,
        type: 'FILE',
      });
    });

    const customBody: WorkspaceActionBody = {
      fileSpecifications: fileSpecs,
      comment: comment ?? '',
      includeNewFiles: true,
    };

    return this.performWorkspaceAction("CHECK_IN", customBody);
  }

  public getEligibleSynchronizationItems(action: string, paths: string[]): Promise<ResourceCollection<SynchronizationItem>> {
    return this.model.getSynchronizationItems(action, paths);
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getParent(
    element: WorkspaceItem,
  ): Promise<WorkspaceItem | undefined> {
    return await this.model.getParent(element);
  }

  public async delete(): Promise<void> {
    throw new Error("delete() - Method not implemented.");
  }

  public rename(): void | Promise<void> {
    throw new Error("rename() - Method not implemented.");
  }

  public readDirectory():
    | [string, FileType][]
    | Thenable<[string, FileType][]> {
    throw new Error("readDirectory() - Method not implemented.");
  }

  public createDirectory(): void | Thenable<void> {
    throw new Error("createDirectory() - Method not implemented.");
  }

  public writeFile(uri: Uri, content: Uint8Array) {
    const key = uri.toString();

    // Clear any existing pending save for this resource
    if (this.saveDebounceTimers.has(key)) {
      clearTimeout(this.saveDebounceTimers.get(key));
    }

    this.saveDebounceTimers.set(
      key,
      setTimeout(async () => {
        try {
          await this.model.saveContent(uri, content);
          this._onDidChange.fire(uri);
        } catch (err) {
          console.error("WorkspaceDataProvider: saveContent error", err);
        }
        this.saveDebounceTimers.delete(key);
      },
        500),
    );
  }

  public reveal(item: WorkspaceItem): void {
    this._treeView.reveal(item, {
      expand: true,
      select: false,
      focus: false,
    });
  }

  private getActionMessages(action: Action): ActionMessages {
    switch (action) {
      case 'DELETE':
        return {
          success: Messages.DeleteSuccess,
          warn: Messages.DeleteWarning,
          error: Messages.DeleteError
        };
      case 'COPY_LATEST_VERSION':
        return {
          success: Messages.CopyLatestVersionSuccess,
          warn: Messages.CopyLatestVersionWarning,
          error: Messages.CopyLatestVersionError
        };
      case 'COPY_SPECIFIC_VERSION':
        return {
          success: Messages.CopySpecificVersionSuccess,
          warn: Messages.CopySpecificVersionWarning,
          error: Messages.CopySpecificVersionError
        };
      case 'COPY_FOLDER':
        return {
          success: Messages.CopyFolderSuccess,
          warn: Messages.CopyFolderWarning,
          error: Messages.CopyFolderError
        };
      case 'COPY_FOLDER_STRUCTURE':
        return {
          success: Messages.CopyFolderStructureSuccess,
          warn: Messages.CopyFolderStructureWarning,
          error: Messages.CopyFolderStructureError
        };
      case 'REPOSITORY_CHECK_OUT':
        return {
          success: Messages.CheckOutSuccess,
          warn: Messages.CheckOutWarning,
          error: Messages.CheckOutError
        };
      case 'CHECK_IN':
        return {
          success: Messages.CheckInSuccess,
          warn: Messages.CheckInWarning,
          error: Messages.CheckInError
        };
      case 'UNDO_CHECKOUT':
        return {
          success: Messages.UndoCheckOutSuccess,
          warn: Messages.UndoCheckOutWarning,
          error: Messages.UndoCheckOutError
        };
      default:
        return { success: '', warn: '', error: '' };
    }
  }

  private async performWorkspaceAction(action: Action, body: WorkspaceActionBody): Promise<boolean> {
    const messages = this.getActionMessages(action);
    const batchAction = action === 'COPY_FOLDER' ? 'COPY_LATEST_VERSION' : action;
    return await this.model.performBatchAction(batchAction, body)
      .then(async (token) => {
        if (!token) {
          window.showErrorMessage(
            l10n.t(messages.error, {
              name: batchAction,
              message: l10n.t('Unable to start the requested workspace action.')
            })
          );
          return false;
        }

        return startPolling(this.model.getConnection(),
          {
            token: token,
          }).then((data: ActionStatus) => {
            let message = "";
            let detailsMessage = "";

            const status = data.summary.completionStatus
            if (status === 'INFO') {
              message = messages.success;
            } else {
              message = status === 'WARN' ? messages.warn : messages.error

              if (data.details) {
                data.details.forEach(detail => {
                  detailsMessage += "\n\t" + detail.itemName;
                  detailsMessage += " - ";
                  detailsMessage += detail.message;
                });
              } else {
                detailsMessage = "\n\t" + data.summary.message;
              }
            }

            const itemName = data && data.details && data.details.length > 0 ? data.details[0]?.itemName : ''
            EventFn(l10n.t(message, {
              name: itemName,
              message: detailsMessage
            }));

            switch (status) {
              case 'INFO':
                window.showInformationMessage(
                  l10n.t(messages.success, {
                    name: '', message: ''
                  })
                );
                break;
              case 'WARN':
                window.showWarningMessage(
                  l10n.t(messages.warn, {
                    name: '', message: ''
                  })
                );
                break;
              case 'ERROR':
                window.showErrorMessage(
                  l10n.t(messages.error, {
                    name: '', message: ''
                  })
                );
                break;
            }

            return true;
          })
          .catch((error: ActionStatus) => {
            window.showErrorMessage(
              l10n.t(messages.error, {
                name: error.details[0].itemName,
                message: error.details[0].message
              })
            );
            EventFn(l10n.t(messages.error, {
              name: error.details[0].itemName,
              message: error.details[0].message
            }));
            return false;
          })
      })
      .catch((error) => {
        EventFn(l10n.t(error, {
          message: error.response.data.message
        }));
        return false;
      });
  }

  private getTypeByExtension(item: WorkspaceItem): string {
    const type = ExtensionTypes.find((type) => item.name.toLowerCase().endsWith(type.extension));
    return type === undefined ? "" : type.objectType;
  }

  private getResourcePathByExtension(item: WorkspaceItem): Uri | undefined {
    if (item.type === 'FOLDER') {
      return undefined;
    }
    const type = ExtensionTypes.find((type) => item.name.toLowerCase().endsWith(type.extension));
    const extension = item.name.split('.').pop();
    return type === undefined ? Uri.parse(`fake-scheme://path/to/file.${extension}`) : undefined;
  }

  private iconPathForItem(
    item: WorkspaceItem,
  ): ThemeIcon | { light: Uri; dark: Uri } | undefined {
    let icon = null;
    if (item.type === "FOLDER") {
      icon = "folder";
    } else {
      switch (this.getTypeByExtension(item)) {
        case 'FILE_SASCATALOG':
          icon = "sasCatalog";
          break;
        case 'FILE_JOB':
          icon = "jobTemplate";
          break;
        case 'FILE_SASDATASET':
          icon = "sasDataSet";
          break;
        case 'FILE_SASVIEW':
          icon = "dataSetView";
          break;
        case 'FILE_SASPROGRAM':
          icon = "sasProgramFile";
          break;
        case 'FILE_SASTRANSPORT':
          icon = "sasTransportFile";
          break;
        case 'FILE_CJOB':
          icon = "clinicalJobFile";
          break;
        case 'FILE_CMNF':
          icon = "clinicalJobManifest";
          break;
        case 'UNKNOWN':
          icon = "unknownNode";
          break;
        case 'SAS_LOG':
        case 'R_LOG':
          icon = "log";
          break;
        default:
          icon = "";
      }
    }

    return icon === null || icon === ""
      ? ThemeIcon.File
      : {
        dark: Uri.joinPath(this.extensionUri, `icons/dark/${icon}Dark.svg`),
        light: Uri.joinPath(
          this.extensionUri,
          `icons/light/${icon}Light.svg`,
        ),
      };
  }
}

export default WorkspaceDataProvider;

const closeFileIfOpen = async (item: WorkspaceItem) => {
  const fileUri = getWorkspaceUri(item);
  const tabs: Tab[] = window.tabGroups.all.flatMap((tg) => tg.tabs);
  const tab = tabs.find(
    (tab) =>
      (tab.input instanceof TabInputText ||
        tab.input instanceof TabInputNotebook) &&
      tab.input.uri.query === fileUri.query,
  );
  if (tab) {
    return await window.tabGroups.close(tab);
  }
  return false;
}
