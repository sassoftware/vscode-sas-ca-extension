// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, authentication, window } from "vscode";

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import {
  SASAuthProvider
} from "../AuthProvider";
import {
  WORKSPACE,
  WORKSPACE_ITEMS_BATCH,
  Messages,
  WORKSPACE_SYNCHRONIZATION_ITEMS,
} from "./const";
import {
  WorkspaceItem,
  Action,
  WORKSPACE_ITEM_CONTENT_TYPE,
  WorkspaceActionBody,
  RESOURCE_COLLECTION_MEDIA_TYPE,
  ResourceCollection,
  SynchronizationItem,
} from "./types";
import {
  buildQueryParam,
  defaultComparator,
  encodePath,
  getFragmentId,
  getResourceId,
  getWorkspaceUri,
} from "./utils";
import { getContextValue } from '../ExtensionContext';
import { startPolling } from '../ActionStatus';
import path from "path";
import { writeFileSync } from 'fs';

export class WorkspaceModel {
  private connection!: AxiosInstance;
  private fileTokenMaps: {
    [path: string]: { etag: string; lastModified: string };
  };
  private authorized: boolean;
  private delegateFolders: { [name: string]: WorkspaceItem };

  constructor() {
    this.fileTokenMaps = {};
    this.authorized = false;
    this.delegateFolders = {};
  }

  public async connect(baseURL: string): Promise<void> {
    this.connection = axios.create({ baseURL });
    this.connection.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
          error.config as AxiosRequestConfig;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.updateAccessToken();
          return this.connection(originalRequest);
        }

        return Promise.reject(error);
      },
    );
    await this.updateAccessToken();
    this.authorized = true;
  }

  public getConnection(): AxiosInstance {
    return this.connection;
  }

  public async getChildren(item?: WorkspaceItem): Promise<WorkspaceItem[]> {
    if (!this.authorized) {
      return [];
    }

    const itemPath = !item ? "" : "/" + encodePath(
      item.path.substring(1));
    let start = 0;
    const url = `${WORKSPACE}/items${itemPath}?&includeSynchronizationInfo=true`;
    const response = await this.connection.get(url,
      {
        headers: {
          Accept: RESOURCE_COLLECTION_MEDIA_TYPE
        }
      }
    );
    let items = response.data.items;
    if (!items) {
      return Promise.reject();
    }

    const itemsPerPage = items.length;
    const totalItems = items.count ?? 0;
    start = itemsPerPage;
    while (start < totalItems) {
      const response = await this.connection.get(url);
      if (!response.data.items) {
        return Promise.reject();
      }
      items = items.concat(response.data.items);
      start += itemsPerPage;
    }

    return items.map((childItem: WorkspaceItem) => ({
      ...childItem,
      uid: !item ? '/' : `${item.path}`,
    })).sort((a: { name: any; }, b: { name: any; }) => defaultComparator(a.name, b.name));
  }

  public async getParent(item: WorkspaceItem): Promise<WorkspaceItem | undefined> {
    if (item) {
      const ancestorsLink: any = null;
      if (!ancestorsLink) {
        return undefined;
      }
      const response = await this.connection.get(ancestorsLink.uri);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
    }
  }

  public async getResourceByUri(uri: Uri): Promise<WorkspaceItem> {
    const filePath = uri.query.startsWith('path=') ? uri.query.substring(5) : uri.query;
    const response = await this.connection.get(
      `${WORKSPACE}/items/${filePath}`
    );
    this.fileTokenMaps[filePath] = {
      etag: response.headers.etag,
      lastModified: response.headers["last-modified"],
    };

    return response.data;
  }

  public async getResourceByPath(path: string): Promise<WorkspaceItem | undefined> {
    try {
      let url = `${WORKSPACE}/items${encodePath(path)}`;
      url += buildQueryParam(url, 'type', 'FILE');
      url += buildQueryParam(url, 'includeSynchronizationInfo', true);
      const response = await this.connection.get(
        url,
      );
      this.fileTokenMaps[path] = {
        etag: response.headers.etag,
        lastModified: response.headers["last-modified"],
      };

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        window.showErrorMessage(Messages.AccessError);
      }
      return undefined;
    }
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    const filePath = uri.query.startsWith('path=') ? uri.query.substring(5) : uri.query;
    const response = await this.connection.post(
      `${WORKSPACE}/items/content`,
      {
        paths: [filePath],
        actionStatusId: undefined,
      },
      {
        responseType: 'blob',
        transformResponse: (response) => response,
      }
    );
    this.fileTokenMaps[filePath] = {
      etag: response.headers.etag,
      lastModified: response.headers["last-modified"],
    };

    if (typeof response.data === "object") {
      throw new TypeError(Messages.FileOpenError);
    }

    return response.data;
  }

  public async getContentVersionByUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    const version = getFragmentId(uri);

    try {
      const response = await this.connection.get(
        `${WORKSPACE}/${resourceId}/versions/${version}/content`,
        {
          responseType: 'blob',
          transformResponse: (response) => response,
        }
      );
      this.fileTokenMaps[resourceId] = {
        etag: response.headers.etag,
        lastModified: response.headers["last-modified"],
      };

      if (typeof response.data === "object") {
        throw new TypeError(Messages.FileOpenError);
      }

      return response.data;
    } catch (error: any) {
      return error.response?.data?.message;
    }
  }

  public async createFile(
    fileName: string,
    item: WorkspaceItem
  ): Promise<WorkspaceItem | undefined> {
    if (!fileName) {
      return undefined;
    }

    const uriPath = `${item.path}/${fileName}`;
    const encodedPath = encodePath(uriPath);
    const url = `${WORKSPACE}/items${encodedPath}?expand=false`;

    const formData = new FormData();
    const uint8Array = new Uint8Array(Buffer.from("", "binary"));
    formData.append('file', new Blob([uint8Array]), fileName);
    const response = await this.connection.put(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      }
    });
    return response.data;
  }

  public async saveContent(
    uri: Uri,
    content: Uint8Array
  ): Promise<WorkspaceItem | undefined> {

    const name = uri.path.replace(/^\/+/g, '');
    const params = new URLSearchParams(uri.query);
    const path = params.get('path');
    const encodedPath = encodePath(path ?? '/');
    const url = `${WORKSPACE}/items${encodedPath}?expand=false`;

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(content)]), name);
    const response = await this.connection.put(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      }
    });
    return response.data;
  }

  public async createFolder(
    name: string,
    item?: WorkspaceItem
  ): Promise<WorkspaceItem | undefined> {
    if (!name) {
      return undefined;
    }
    const path = item ? item.path : "/";
    const response = await this.connection.post(
      `${WORKSPACE}/folders/${encodePath(path)}?name=${encodeURIComponent(name)}`,
    );

    return response.data;
  }

  public async renameResource(
    item: WorkspaceItem,
    name: string,
  ): Promise<WorkspaceItem | undefined> {
    if (!item && !name) {
      return undefined;
    }
    const response = await this.connection.post(
      `${WORKSPACE}/items/${encodePath(item.path)}?action=RENAME`,
      name,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": WORKSPACE_ITEM_CONTENT_TYPE,
        }
      });
    return response.data;
  }

  public async downloadResource(path: string, items: WorkspaceItem[]): Promise<WorkspaceItem | undefined> {
    let files = [''];
    if (items.length > 1) {
      const sortedItems = items.sort((a, b) => defaultComparator(a.name, b.name));
      files = sortedItems.map((item) => item.path);
    } else {
      const firstItem = items[0] as WorkspaceItem;
      files = [firstItem.path];
    }

    const token = await this.performBatchAction("DOWNLOAD", files);

    if (!token) {
      return undefined;
    }

    const requestBody: WorkspaceActionBody = {
      paths: files,
      actionStatusId: token,
    };

    const url = `${WORKSPACE}/items/content`;
    const response = await this.connection.post(url, requestBody,
      {
        responseType: 'arraybuffer',
      }
    );
    const buffer = typeof response.data === 'string'
      ? Buffer.from(response.data, 'binary')
      : Buffer.from(response.data);
    writeFileSync(path, new Uint8Array(buffer));

    try {
      await startPolling(this.connection, { token });
      return response.data;
    } catch (error) {
      return undefined;
    }
  }


  public async uploadResource(
    item: WorkspaceItem,
    location: string,
    content: Buffer,
    expand: boolean,
  ): Promise<WorkspaceItem | undefined> {
    if (!item || !location) {
      return undefined;
    }
    const fileName = path.basename(location);
    const action = expand ? "UPLOAD_EXPAND" : "UPLOAD";
    const token = await this.performBatchAction(action, [`${item.path}/${fileName}`], {
      headers: {
        "Content-Type": "application/json",
      }
    });

    if (!token) {
      return undefined;
    }

    const uriPath = action === 'UPLOAD_EXPAND' ? item.path : `${item.path}/${fileName}`;
    let url: string;
    if (uriPath === '/') {
      url = `${WORKSPACE}/items?path=/&expand=${expand}`;
    } else {
      const encodedPath = encodePath(uriPath);
      url = `${WORKSPACE}/items${encodedPath}?expand=${expand}`;
    }
    url += "&actionStatusId=" + token;

    const formData = new FormData();
    const uint8Array = new Uint8Array(content);
    formData.append('file', new Blob([uint8Array]), fileName);
    const response = await this.connection.put(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      }
    });

    try {
      await startPolling(this.connection, { token });
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  public async getUri(item: WorkspaceItem, _readOnly: boolean): Promise<Uri> {
    return getWorkspaceUri(item);
  }

  public getDelegateFolder(name: string): WorkspaceItem | undefined {
    return this.delegateFolders[name];
  }

  private async updateAccessToken(): Promise<void> {
    const session = await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
    this.connection.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
  }

  public async performBatchAction(action: Action, body: WorkspaceActionBody, config?: any): Promise<string | undefined> {
    const clientId: string = await getContextValue("clientId") || "";

    try {
      const response = await this.connection.post(
        `${WORKSPACE_ITEMS_BATCH}?action=${action}&clientId=${clientId}`,
        body ?? {},
        config
      );
      return this.getActionToken(response.headers);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        window.showErrorMessage(Messages.AccessError);
      }
      return undefined;
    }
  }

  public async getSynchronizationItems(type: string, body: string[]): Promise<ResourceCollection<SynchronizationItem>> {
    let url = WORKSPACE_SYNCHRONIZATION_ITEMS;
    url += buildQueryParam(url, 'type', type);

    return this.connection.post(url, body ?? {}, {
      headers: {
        "Accept": RESOURCE_COLLECTION_MEDIA_TYPE
      }
    }).then((response) => response.data);
  }

  private readonly getActionToken = (headers: any): string | undefined => {
    if (headers.location) {
      const parts = headers.location.split('/');
      return parts[parts.length - 1];
    }
    return undefined;
  }
}





