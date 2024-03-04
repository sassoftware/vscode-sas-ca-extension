// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, authentication, window } from "vscode";
import path from "path";

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
  AUTHORIZATIONS,
  REPOSITORY_FILES_CONTENT,
  REPOSITORY_ITEMS,
  TYPES,
  Messages,
  REPOSITORY_ITEMS_BATCH,
} from "./const";

import {
  REPOSITORY_FILE_MEDIA_TYPE,
  REPOSITORY_ITEM_MEDIA_TYPE,

  ObjectType,
  Permission,
  Privilege,
  VersionHistoryResponse,
  RepositoryFile,
  RepositoryItem,
  VersionHistoryItem,
  Action,
  ActionBody,
} from "./types";

import {
  buildQueryPhrase,
  getFragmentId,
  getResourceId,
  getUri,
  getVersionUri,
} from "./utils";
import { getContextValue } from '../ExtensionContext';

export class RepositoryModel {
  private connection: AxiosInstance;
  private fileTokenMaps: {
    [id: string]: { etag: string; lastModified: string };
  };
  private authorized: boolean;
  private delegateFolders: { [name: string]: RepositoryItem };
  private objectTypes: ObjectType[];

  constructor() {
    this.fileTokenMaps = {};
    this.authorized = false;
    this.delegateFolders = {};
    this.objectTypes = [];
  }

  public async connect(baseURL: string): Promise<void> {
    this.connection = axios.create({ baseURL });
    this.connection.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
          error.config;

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

  public async getChildren(item?: RepositoryItem): Promise<RepositoryItem[]> {
    if (!this.authorized) {
      return [];
    }

    // Fetch the types the first time through.
    if (this.objectTypes.length <= 0) {
      const results = await this.connection.get(TYPES);
      const result = results.data;
      if (!result.items) {
        return Promise.reject();
      }

      this.objectTypes = result.items.map((objectType: ObjectType) => ({
        ...objectType
      }));
    }

    const itemId = !item ? "1" : item.id;
    let start = 0;
    const limit = 100;
    const url = `${REPOSITORY_ITEMS}/${itemId}/children?start=${start}&limit=${limit}`;

    const response = await this.connection.get(url);
    let items = response.data.items;
    if (!items) {
      return Promise.reject();
    }

    const itemsPerPage = response.data.length;
    const totalItems = response.data.count ?? 0;
    start = itemsPerPage;
    while (start < totalItems) {
      const response = await this.connection.get(url);
      if (!response.data.items) {
        return Promise.reject();
      }
      items = items.concat(response.data.items);
      start += itemsPerPage;
    }

    return items.map((childItem: RepositoryItem) => ({
      ...childItem,
      uid: !item ? '1' : `${item.id}`,
    }));
  }

  public async getParent(item: RepositoryItem): Promise<RepositoryItem | undefined> {
    if (item) {
      const ancestorsLink = null;
      if (!ancestorsLink) {
        return;
      }
      const response = await this.connection.get(ancestorsLink.uri);
      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
    }
  }

  public async getResourceByUri(uri: Uri): Promise<RepositoryItem> {
    const resourceId = getResourceId(uri);
    const response = await this.connection.get(
      `${REPOSITORY_ITEMS}/${resourceId}`
    );
    this.fileTokenMaps[resourceId] = {
      etag: response.headers.etag,
      lastModified: response.headers["last-modified"],
    };

    return response.data;
  }

  public async getResourceById(id: string): Promise<RepositoryItem> | undefined {
    try {
      const response = await this.connection.get(
        `${REPOSITORY_ITEMS}/${id}`
      );
      this.fileTokenMaps[id] = {
        etag: response.headers.etag,
        lastModified: response.headers["last-modified"],
      };

      return response.data;
    } catch (error) {
      if (error.response.status === 404 || error.response.status === 403) {
        window.showErrorMessage(Messages.AccessError);
      }
      return;
    }
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    const response = await this.connection.post(
      `${REPOSITORY_ITEMS}/${resourceId}/content`,
      [''],
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
      throw new Error(Messages.FileOpenError);
    }

    return response.data;
  }

  public async getContentVersionByUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    const version = getFragmentId(uri);

    try {
      const response = await this.connection.get(
        `${REPOSITORY_ITEMS}/${resourceId}/versions/${version}/content`,
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
        throw new Error(Messages.FileOpenError);
      }

      return response.data;
    } catch (error) {
      return error.response.data.message;
    }
  }

  public async createFolder(
    item: RepositoryItem,
    name: string,
  ): Promise<RepositoryItem | undefined> {
    if (!item && !name) {
      return undefined;
    }

    const response = await this.connection.post(
      `${REPOSITORY_ITEMS}/${item.id}/children?name=${encodeURIComponent(name)}&type=FOLDER`,
      {
        headers: {
          Accept: REPOSITORY_ITEM_MEDIA_TYPE
        }
      });

    return response.data;
  }

  public async renameResource(
    item: RepositoryItem,
    name: string,
  ): Promise<RepositoryItem | undefined> {
    if (!item && !name) {
      return undefined;
    }
    const { etag } = this.getFileInfo(item.id);
    const response = await this.connection.patch(
      `${REPOSITORY_ITEMS}/${item.id}`,
      { name: name },
      {
        headers: {
          Accept: REPOSITORY_ITEM_MEDIA_TYPE,
          "If-Match": etag
        }
      });
    return response.data;
  }

  public async downloadResource(items: RepositoryItem[]): Promise<AxiosResponse> {
    if (items.length > 1) {
      const ids = items.map((item) => item.id);
      const filter = buildQueryPhrase("in", 'id', ids);
      return await this.connection.post(
        REPOSITORY_FILES_CONTENT,
        {
          filter: filter
        },
        {
          responseType: 'arraybuffer'
        });
    } else {
      return await this.connection.post(
        `${REPOSITORY_ITEMS}/${items[0].id}/content`, [''],
        {
          responseType: 'arraybuffer',
        });
    }
  }

  public async downloadResourceVersion(item: VersionHistoryItem): Promise<AxiosResponse> {
    return await this.connection.get(
      `${REPOSITORY_ITEMS}/${item.fileId}/versions/${item.fileVersion}/content`);
  }

  public async uploadResource(
    item: RepositoryItem,
    location: string,
    content: Buffer,
    expand: boolean,
    comment?: string,
    version?: string,
  ): Promise<RepositoryItem> {
    if (!item && !location) {
      return undefined;
    }

    const name = path.parse(location).base;
    let uri = `${REPOSITORY_ITEMS}/${item.id}/content?name=${encodeURIComponent(name)}&expand=${expand}`
    if (comment && comment !== '') {
      uri += "&comment=" + encodeURIComponent(comment);
    }
    if (version && version !== '') {
      uri += "&fileVersion=" + version;
    }
    const response = await this.connection.put(
      uri,
      content,
      {
        headers: {
          "Content-Type": "application/octet-stream",
          Accept: REPOSITORY_ITEM_MEDIA_TYPE
        }
      });
    return response.data;
  }

  private getFileInfo(resourceId: string): {
    etag: string;
    lastModified: string;
  } {
    if (resourceId in this.fileTokenMaps) {
      return this.fileTokenMaps[resourceId];
    }
    const now = new Date();
    const timestamp = now.toUTCString();
    return { etag: "", lastModified: timestamp };
  }

  public async getUri(item: RepositoryItem, readOnly: boolean): Promise<Uri> {
    if (item.typeId !== "reference") {
      return getUri(item, readOnly);
    }

    try {
      const response = await this.connection.get(item.id);
      return getUri(response.data, readOnly);
    } catch (error) {
      return getUri(item, readOnly);
    }
  }

  public async getVersionUri(version: VersionHistoryItem): Promise<Uri> {
    return getVersionUri(version);
  }

  public async delete(item: RepositoryItem): Promise<void> {
    await this.connection.delete(`${REPOSITORY_ITEMS}/${item.id}?permanent=false`)
  }

  public getDelegateFolder(name: string): RepositoryItem | undefined {
    return this.delegateFolders[name];
  }

  private async updateAccessToken(): Promise<void> {
    const session = await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
    this.connection.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
  }

  public getObjectType = (typeId: string): ObjectType | undefined => {
    return this.objectTypes.find((type) => type.id === typeId);
  }

  public getObjectTypeName = (id: string): string | undefined => {
    return this.objectTypes.find((type) => type.id === id)?.name;
  }

  public async getPermission(item: RepositoryItem): Promise<Permission> {
    if (!item) {
      return undefined;
    }

    let canWrite = false;
    try {
      const response = await this.connection.get(`${AUTHORIZATIONS}/${item.id}/permissions`);
      canWrite = response.data.includes('WRITE');
    } catch (error) {
      window.showErrorMessage(Messages.AccessPermissionsError);
    }
    return {
      read: true,
      write: canWrite,
      delete: item.primaryType !== 'CONTEXT',
      create: item.primaryType !== 'FILE',
    }
  }

  public async getPrivilege(item: RepositoryItem): Promise<Privilege> | undefined {
    if (!item) {
      return undefined;
    }

    let canEnable = false;
    let canManage = false;
    try {
      const response = await this.connection.get(`${AUTHORIZATIONS}/${item.id}/privileges`);
      canEnable = response.data.includes('PRIVILEGE_ENABLE_VERSIONING');
      canManage = response.data.includes('PRIVILEGE_MANAGE_VERSIONING');
    } catch (error) {
      window.showErrorMessage(Messages.AccessPrivilegesError);
      return;
    }
    return {
      enableVersioning: canEnable,
      manageVersioning: canManage,
    }
  }

  public async getVersionHistory(item: RepositoryItem): Promise<VersionHistoryResponse> | undefined {
    if (!item) {
      return undefined;
    }
    try {
      const response = await this.connection.get(`${REPOSITORY_ITEMS}/${item.id}/versions`);
      const data = response.data;
      if (!data) {
        return Promise.reject();
      }
      return data;
    } catch (error) {
      if (error.response.status === 404 || error.response.status === 403) {
        window.showErrorMessage(Messages.AccessError);
      }
      return;
    }
  }

  public async getVersionHistoryItem(id: string, versionNumber: string): Promise<RepositoryFile> {
    if (!id) {
      return undefined;
    }
    const response = await this.connection.get(
      `${REPOSITORY_ITEMS}/${id}/versions/${versionNumber}`,
      {
        headers: { Accept: REPOSITORY_FILE_MEDIA_TYPE }
      });
    const data = response.data;
    if (!data) {
      return Promise.reject();
    }
    return data;
  }

  public async performBatchAction(action: Action, body: ActionBody): Promise<string> {
    const clientId: string = await getContextValue("clientId");

    try {
      const response = await this.connection.post(
        `${REPOSITORY_ITEMS_BATCH}?action=${action}&clientId=${clientId}`,
        body ?? {}
      );
      return this.getActionToken(response.headers);
    } catch (error) {
      if (error.response.status === 404 || error.response.status === 403) {
        window.showErrorMessage(Messages.AccessError);
      }
      return;
    }
  }

  private getActionToken = (headers): string => {
    if (headers.location) {
      const parts = headers.location.split('/');
      return parts[parts.length - 1];
    }
    return '';
  }
}





