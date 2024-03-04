// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FilePermission,
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
import { readFileSync, writeFileSync } from "fs";
import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ViyaProfile } from "../profile";
import { RepositoryModel } from "./RepositoryModel";
import { EventFn } from "../ActionChannel";
import { Messages } from "./const";
import { Action, ActionBody, ActionStatus, RepositoryItem } from "./types";
import {
  getCreationDate,
  getId,
  isContainer as getIsContainer,
  getName,
  getModifyDate,
  getUri,
  resourceType,
} from "./utils";
import { startPolling } from '../ActionStatus';

class RepositoryDataProvider
  implements
  TreeDataProvider<RepositoryItem>,
  FileSystemProvider,
  TextDocumentContentProvider,
  SubscriptionProvider {
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<RepositoryItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private _treeView: TreeView<RepositoryItem>;
  private readonly model: RepositoryModel;
  private extensionUri: Uri;
  private baseUrl: string;

  get treeView(): TreeView<RepositoryItem> {
    return this._treeView;
  }

  constructor(model: RepositoryModel, extensionUri: Uri) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<RepositoryItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;

    this._treeView = window.createTreeView("repositorydataprovider", {
      treeDataProvider: this,
      canSelectMany: true,
    });

    this._treeView.onDidChangeVisibility(async () => {
      if (this._treeView.visible) {
        const activeProfile: ViyaProfile = profileConfig.getProfileByName(
          profileConfig.getActiveProfile(),
        );
        await this.connect(activeProfile.endpoint);
      }
    });

    this._treeView.onDidChangeSelection(async event => {
      commands.executeCommand(
        "setContext",
        "SAS.ClinicalAcceleration.twoItemsSelected",
        event.selection.length === 2
      );
      commands.executeCommand(
        "setContext",
        "SAS.ClinicalAcceleration.oneItemSelected",
        event.selection.length === 1
      );
    });
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView];
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<RepositoryItem> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public async connect(baseUrl: string): Promise<void> {
    this.baseUrl = baseUrl;
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public async getTreeItem(item: RepositoryItem): Promise<TreeItem> {
    const isContainer = getIsContainer(item);
    const uri = await this.getUri(item, false);

    return {
      iconPath: this.iconPathForItem(item),
      contextValue: resourceType(item),
      id: getId(item),
      label: getName(item),
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: {
        command: "SAS.ClinicalAcceleration.selectRepositoryResource",
        arguments: [item, uri],
        title: "Select Item",
      }
    }
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    return await this.model.getContentByUri(uri);
  }

  public getChildren(item?: RepositoryItem): ProviderResult<RepositoryItem[]> {
    return this.model.getChildren(item);
  }

  public watch(): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => { });
  }

  public async stat(uri: Uri): Promise<FileStat> {
    return await this.model.getResourceByUri(uri).then(
      (resource): FileStat => ({
        type: getIsContainer(resource) ? FileType.Directory : FileType.File,
        ctime: new Date(getCreationDate(resource)).getTime(),
        mtime: new Date(getModifyDate(resource)).getTime(),
        size: resource.size,
        permissions: FilePermission.Readonly,
      }),
    );
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.model
      .getContentByUri(uri)
      .then((content) => new TextEncoder().encode(content));
  }

  public getUri(item: RepositoryItem, readOnly: boolean): Promise<Uri> {
    return this.model.getUri(item, readOnly);
  }

  public async createFolder(
    item: RepositoryItem,
    folderName: string,
  ): Promise<Uri> {
    return await this.model.createFolder(item, folderName)
      .then((newFolder) => {
        this.refresh();
        EventFn(l10n.t(Messages.FolderCreationSuccess,
          {
            name: folderName,
            location: item.path
          }));
        return getUri(newFolder);
      })
      .catch((error) => {
        EventFn(l10n.t(Messages.FolderCreationError,
          {
            name: folderName,
            location: item.path,
            message: error.response.data.message
          }));
        return undefined;
      });
  }

  public async renameResource(
    item: RepositoryItem,
    name: string,
  ): Promise<Uri> {
    const existingItem = await this.model.getResourceById(item.id);
    return this.model.renameResource(existingItem, name)
      .then(async (newItem) => {
        const newUri = getUri(newItem);
        if (await (closeFileIfOpen(item))) {
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
    items: RepositoryItem[],
    path: string,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const response = await this.model.downloadResource(items);
    writeFileSync(path, new Uint8Array(Buffer.from(response.data, 'binary')));
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
  }

  public async uploadResource(
    item: RepositoryItem,
    fileInfos: Uri[],
    expand: boolean,
    comment?: string,
    version?: string,
  ): Promise<boolean[]> {
    if (!item) {
      return;
    }

    const uploadPromises = fileInfos.map(async file => {
      const filePath = file.fsPath;
      const buffer = readFileSync(filePath);
      return await this.model.uploadResource(item, filePath, buffer, expand, comment, version)
        .then(async (newItem) => {
          if (item?.primaryType === 'FILE' && await closeFileIfOpen(newItem)) {
            commands.executeCommand("vscode.open", getUri(newItem));
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

  public async enableVersioning(
    item: RepositoryItem,
    comment?: string,
    version?: string,
  ): Promise<boolean> {
    if (!item) {
      return;
    }

    const body = {
      comment: comment,
      fileSpecifications: [
        {
          path: item.path,
          fileVersion: version
        }
      ]
    }
    return this.performVersioningAction(item, "ENABLE_VERSIONING", body);
  }

  public async disableVersioning(
    item: RepositoryItem,
    comment?: string,
  ): Promise<boolean> {
    if (!item) {
      return;
    }
    const body = {
      comment: comment,
      paths: [item.path]
    }
    return this.performVersioningAction(item, "DISABLE_VERSIONING", body);
  }

  private async performVersioningAction(item: RepositoryItem, action: Action, body: ActionBody): Promise<boolean> {
    let success = Messages.EnabledVersioningSuccess;
    let error = Messages.EnableVersioningError;

    if (action === "DISABLE_VERSIONING") {
      success = Messages.DisabledVersioningSuccess;
      error = Messages.DisableVersioningError;
    }
    return await this.model.performBatchAction(action, body)
      .then(async (token) => {
        return startPolling(this.model.getConnection(),
          {
            token: token,
          }).then((data: ActionStatus) => {
            EventFn(l10n.t(success, {
              name: data.details[0].itemName
            }));
           return true;
          })
          .catch((data: ActionStatus) => {
            window.showWarningMessage(
              l10n.t(error, {
                name: data.details[0].itemName,
                message: data.details[0].message
              })
            );
            EventFn(l10n.t(error, {
              name: item.name,
              message: data.details[0].message
            }));
            return false;
          })
      })
      .catch((error) => {
        EventFn(l10n.t(error, {
          name: item.name,
          message: error.response.data.message
        }));
        return false;
      });
  }

  public async deleteResource(items: RepositoryItem[]): Promise<boolean> {
    items.forEach((item) => {
      if (!(closeFileIfOpen(item))) {
        return false;
      }
    });

    let success = true;
    const deletePromises = items.map(async item => {
      return await this.model.delete(item)
        .then(() => {
          EventFn(l10n.t(Messages.MovedToRecyleBinSuccess,
            {
              name: item.name
            }));
          return true;
        })
        .catch((error) => {
          EventFn(l10n.t(Messages.MovedToRecyleBinError, {
            name: item.name,
            message: error.response.data.message
          }));
          return false;
        })
    });
    const results = await Promise.all(deletePromises);
    if (results.includes(false)) {
      success = false;
    }
    return success;
  }

  public async handleCreationResponse(
    item: RepositoryItem,
    newUri: Uri | undefined,
    errorMessage: string,
  ): Promise<void> {
    if (!newUri) {
      window.showErrorMessage(errorMessage);
      return;
    }

    this.reveal(item);
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getParent(
    element: RepositoryItem,
  ): Promise<RepositoryItem | undefined> {
    return await this.model.getParent(element);
  }

  public async delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public rename(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }

  public readDirectory():
    | [string, FileType][]
    | Thenable<[string, FileType][]> {
    throw new Error("Method not implemented.");
  }

  public createDirectory(): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  public writeFile(): void | Promise<void> {
    throw new Error('Method not implemented.');
  }

  public reveal(item: RepositoryItem): void {
    this._treeView.reveal(item, {
      expand: true,
      select: false,
      focus: false,
    });
  }

  private iconPathForItem(
    item: RepositoryItem,
  ): ThemeIcon | { light: Uri; dark: Uri } {
    let icon = "";
    const type = this.model.getObjectType(item.typeId).icon;
    switch (type) {
      case 'ORGANIZATION':
        icon = "businessCompany";
        break;
      case 'PROJECT':
        icon = "project";
        break;
      case 'ANALYSIS':
        icon = "analyze";
        break;
      case 'ICON_1':
        icon = "application";
        break;
      case 'ICON_2':
        icon = "applicationServer";
        break;
      case 'ICON_3':
        icon = "biReportGallery";
        break;
      case 'ICON_4':
        icon = "allocationRule";
        break;
      case 'ICON_5':
        icon = "barChart";
        break;
      case 'ICON_6':
        icon = "gisMember";
        break;
      case 'ICON_7':
        icon = 'dashboard';
        break;
      case 'ICON_8':
        icon = "workflowItem";
        break;
      case 'ICON_9':
        icon = "collaboration";
        break;
      case 'ICON_10':
        icon = "indicator";
        break;
      case 'ICON_11':
        icon = "plan";
        break;
      case 'ICON_12':
        icon = "indicatorData";
        break;
      case 'ICON_13':
        icon = "sourceDatabase";
        break;
      case 'ICON_14':
        icon = "library";
        break;
      case 'ICON_15':
        icon = "lookup";
        break;
      case 'ICON_16':
        icon = "server";
        break;
      case 'ICON_17':
        icon = "stabilityMonitoringAnalysis";
        break;
      case 'ICON_18':
        icon = "visualStatistics";
        break;
      case 'ICON_19':
        icon = "webFunnel";
        break;
      case 'ICON_20':
        icon = "concatenate";
        break;
      case 'FOLDER':
        icon = "folder";
        break;
      case 'FILE':
        icon = "file";
        break;
      case 'FILE_SASCATALOG':
        icon = "sasCatalog";
        break;
      case 'FILE_JOB':
        icon = "jobTemplate";
        break;
      case 'FILE_PDF':
        icon = "pdfFile";
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
      case 'FILE_RPROGRAM':
        icon = "rCode";
        break;
      case 'FILE_RDATAFILE':
        icon = "rdataFile";
        break;
      case 'FILE_RDS':
        icon = "rdsFile";
        break;
      case 'FILE_AUDIO':
        icon = "audioFile";
        break;
      case 'FILE_CSV':
        icon = "csvFile";
        break;
      case 'FILE_EXCEL':
        icon = "excelFile";
        break;
      case 'FILE_HTML':
        icon = "htmlFile";
        break;
      case 'FILE_POWERPOINT':
        icon = "powerPointFile";
        break;
      case 'FILE_SASTRANSPORT':
        icon = "sasTransportFile";
        break;
      case 'FILE_VIDEO':
        icon = "videoFile";
        break;
      case 'FILE_WORD':
        icon = "wordFile";
        break;
      case 'FILE_XML':
        icon = "xmlFile";
        break;
      case 'FILE_ZIP':
        icon = "zipFile";
        break;
      case 'PROCESSFLOW':
        icon = "workflowItem";
        break;
      case 'TASK':
        icon = "task";
        break;
      case 'UNKNOWN':
        icon = "unknownNode";
        break;
      case 'SAS_LOG':
      case 'R_LOG':
        icon = "log";
        break;
      default:
        return undefined;
    }

    return icon !== ""
      ? {
        dark: Uri.joinPath(this.extensionUri, `icons/dark/${icon}Dark.svg`),
        light: Uri.joinPath(
          this.extensionUri,
          `icons/light/${icon}Light.svg`,
        ),
      }
      : ThemeIcon.File;
  }
}

export default RepositoryDataProvider;

const closeFileIfOpen = async (item: RepositoryItem) => {
  const fileUri = getUri(item, false);
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
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
