// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  Event,
  EventEmitter,
  MarkdownString,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeView,
  Uri,
  window,
  l10n,
  FileSystemProvider,
  FileChangeEvent,
  FileStat,
  FileType,
  FilePermission,
  commands
} from "vscode";

import { SubscriptionProvider } from "../SubscriptionProvider";
import { RepositoryItem, VersionHistoryItem } from "./types";
import { RepositoryModel } from './RepositoryModel';
import { profileConfig } from '../../commands/profile';
import { ViyaProfile } from '../profile';
import { formatBytes, formatDate, getCreationDate, getModifyDate, isContainer } from './utils';
import { writeFileSync } from 'fs';
import { EventFn } from '../ActionChannel';
import { Messages } from "./const";

class VersionHistoryProvider
  implements
  TreeDataProvider<VersionHistoryItem>,
  FileSystemProvider,
  SubscriptionProvider {
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<VersionHistoryItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private _treeView: TreeView<VersionHistoryItem>;
  private data: VersionHistoryItem[];
  private readonly model: RepositoryModel;
  private extensionUri: Uri;

  get treeView(): TreeView<VersionHistoryItem> {
    return this._treeView;
  }

  constructor(model: RepositoryModel, extensionUri: Uri) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<VersionHistoryItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;

    this._treeView = window.createTreeView("versionhistoryprovider", {
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
        "SAS.ClinicalAcceleration.twoVersionItemsSelected",
        event.selection.length === 2
      );
    });
  }

  public async connect(baseUrl: string): Promise<void> {
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView];
  }

  get onDidChangeTreeData(): Event<VersionHistoryItem> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }
  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public async clearData(item?: RepositoryItem) {
    this.data = [];
    this._onDidChangeTreeData.fire(undefined);
    this._treeView.description = item?.name;
    this._treeView.message = Messages.VersioningUnsupported;
  }

  public async setData(item?: RepositoryItem) {
    if (item && !isContainer(item)) {
      this._treeView.description = item.name;

      if (item?.versioned) {
        this._treeView.message = l10n.t(Messages.ItemLocation, { location: item.location });
        const versionHistory = await this.model.getVersionHistory(item);
        if (versionHistory) {
          this.data = versionHistory.items.map((version) => {
            version.name = item.name;
            return version;
          });
          this._onDidChangeTreeData.fire(undefined);
        } else {
          this.data = [];
          this._treeView.message = Messages.VersionHistoryItemError;
        }
      } else {
        this.data = [];
        this._treeView.message = Messages.FileNotVersioned;
      }
      this._onDidChangeTreeData.fire(undefined);
    } else {
      this.clearData();
    }
  }

  public async getMarkdownText(id?: string, version?: string, comment?: string) {
    const versionDetails = await this.model.getVersionHistoryItem(id, version);
    const markdown = new MarkdownString();

    const formattedDate = formatDate(Date.parse(versionDetails.modifiedTimeStamp), "en-US");
    const formattedComment = comment || '';
    const formattedSize = formatBytes(versionDetails.fileSize, 0);

    markdown.appendMarkdown('<div>');
    markdown.appendMarkdown('<div>Version created by:</div><p/>');
    markdown.appendMarkdown('<div>&nbsp;&nbsp;&nbsp;' + `${versionDetails.modifiedByDisplayName}` + '</div><p/>');
    markdown.appendMarkdown('<div>Date version created:</div><p/>');
    markdown.appendMarkdown('<div>&nbsp;&nbsp;&nbsp;' + `${formattedDate}` + '</div><p/>');
    markdown.appendMarkdown('<div>Size:</div><p/>');
    markdown.appendMarkdown('<div>&nbsp;&nbsp;&nbsp;' + `${formattedSize}` + '</div><p/>');
    markdown.appendMarkdown('<div>Comment:</div><p/>');
    markdown.appendMarkdown('<div>&nbsp;&nbsp;&nbsp;' + `${formattedComment}` + '</div>');
    markdown.appendMarkdown('</div>');

    markdown.supportHtml = true;
    markdown.supportThemeIcons = true;
    markdown.isTrusted = true;
    return markdown;
  }

  public getChildren(): ProviderResult<VersionHistoryItem[]> {
    return this.data;
  }

  public async getTreeItem(item: VersionHistoryItem): Promise<TreeItem> {
    const markdownText = await this.getMarkdownText(item.fileId, item.fileVersion, item.comment);
    const uri = await this.getUri(item);

    return {
      iconPath: new ThemeIcon('git-commit'),
      contextValue: "version",
      id: item.fileId + "--" + item.fileVersion,
      label: "v" + item.fileVersion,
      description: item.comment,
      collapsibleState: undefined,
      tooltip: markdownText,
      command: {
        command: "vscode.open",
        arguments: [uri],
        title: "Open Version",
      }
    };
  }

  public watch(): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => { });
  }

  public async refresh(item?: RepositoryItem, refetch?: boolean) {
    if (item) {
      if (refetch) {
        item = await this.model.getResourceById(item.id);
      }
      this.setData(item);
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  public getUri(item: VersionHistoryItem): Promise<Uri> {
    return this.model.getVersionUri(item);
  }

  public reveal(item: VersionHistoryItem): void {
    this._treeView.reveal(item, {
      expand: true,
      select: false,
      focus: false,
    });
  }

  public async downloadResource(
    item: VersionHistoryItem,
    path: string,
  ): Promise<void> {
    if (!item) {
      return;
    }
    return await this.model.downloadResourceVersion(item)
      .then((response) => {
        writeFileSync(path, new Uint8Array(Buffer.from(response.data, 'binary')));
        EventFn(l10n.t(Messages.DownloadedMessage, { name: item.name, location: path }));
      })
      .catch(() => {
        EventFn(l10n.t(Messages.DownloadError));
      })
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.model
      .getContentVersionByUri(uri)
      .then((content) => new TextEncoder().encode(content));
  }

  public async stat(uri: Uri): Promise<FileStat> {
    return await this.model.getResourceByUri(uri).then(
      (resource): FileStat => ({
        type: FileType.File,
        ctime: new Date(getCreationDate(resource)).getTime(),
        mtime: new Date(getModifyDate(resource)).getTime(),
        size: resource.size,
        permissions: FilePermission.Readonly,
      }),
    );
  }
  readDirectory(): [string, FileType][] | Thenable<[string, FileType][]> {
    throw new Error('Method not implemented.');
  }
  createDirectory(): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }
  writeFile(): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }
  delete(): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }
  rename(): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }
}

export default VersionHistoryProvider;
