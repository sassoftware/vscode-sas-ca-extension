// Copyright ©2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { authentication, Uri } from "vscode";
import path from "path";
import { RepositoryItem, WorkspaceItem, Link, VersionHistoryItem, RepositoryFile, ObjectType, WorkspaceFile } from "./types";
import { SASAuthProvider } from '../AuthProvider';

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string,
): Link | null =>
  !links || links.length === 0
    ? null
    : links.find((link) => link.method === method && link.rel === relationship) || null;

export const getResourceId = (uri: Uri): string => {
  const params = new URLSearchParams(uri.query);
  return params.get('id') ?? '';
};
export const getFragmentId = (uri: Uri): string => uri.fragment.substring(8);

export const getId = (item: RepositoryItem): string | null =>
  item.id || null;

export const getResourceIdFromItem = (item: RepositoryItem): string | null => {
  return item.id;
}

export const getName = (item: RepositoryItem): string => item.name;
export const getTypeName = (item: RepositoryItem): string => item.typeId;
export const getPrimaryType = (item: RepositoryItem): string => item.primaryType;
export const isVersioned = (item: RepositoryItem): boolean => item.versioned;

export const getWorkspaceType = (item: WorkspaceItem): string => item.type;


export const isContext = (item: RepositoryItem): boolean => {
  return "CONTEXT" === item.primaryType
}

export const isTopLevelContext = (item: RepositoryItem, type?: ObjectType): boolean => {
  return "CONTEXT" === item.primaryType && !!type && type.capabilities.includes("TOP");
}

export const isContainer = (item: RepositoryItem, bStrict?: boolean): boolean => {
  const primaryType = getPrimaryType(item);
  if ("CONTEXT" === primaryType || "FOLDER" === primaryType) {
    return true;
  }
  if (bStrict) {
    return false;
  }
  return false;
}

export const isWorkspaceContainer = (item: WorkspaceItem): boolean => {
  return ("FOLDER" === getWorkspaceType(item));
}

export const isWorkspaceFileCheckedOut = (item: WorkspaceItem): boolean => {
  return Boolean((item as unknown as WorkspaceFile).synchronizationInfo?.checkedOut);
}

export const isRepositoryFileCheckedOut = (item: RepositoryItem): boolean => {
  return Boolean((item as unknown as RepositoryFile).checkedOut);
}

export const isWorkspaceFileCheckedOutBySelf = async (item: WorkspaceItem): Promise<boolean> => {
  return Boolean((item as unknown as WorkspaceFile).synchronizationInfo?.checkedOutBy === await getCurrentUser());
}

export const isRepositoryFileCheckedOutBySelf = async (item: RepositoryItem): Promise<boolean> => {
  return Boolean((item as unknown as RepositoryFile).checkedOutBy === await getCurrentUser());
}
export const resourceType = async (item: RepositoryItem, type?: ObjectType): Promise<string | undefined> => {
  if (!isValidItem(item)) {
    return;
  }
  const { read, write, delete: del, create } = {
    read: true,
    write: true,
    delete: true,
    create: true,
  };

  const actions = [
    read && "open",
    create && isContainer(item) && "create",
    !isContainer(item) && "compare",
    del && !isTopLevelContext(item, type) && "delete",
    write && "update",
    !isContainer(item) ? (isVersioned(item) ? "versioned" : "unversioned") : "",
    !isContainer(item) ? (isRepositoryFileCheckedOut(item) ? "checkedOut" : "notCheckedOut") : "",
    !isContainer(item) ? (await isRepositoryFileCheckedOutBySelf(item) ? "coBySelf" : "notCoBySelf") : ""
  ].filter((action) => !!action);

  if (actions.length === 0) {
    return;
  }
  return actions.sort().join("-");
}

export const workspaceResourceType = async (item: WorkspaceItem): Promise<string | undefined> => {
  if (!isValidWorkspaceItem(item)) {
    return;
  }
  const { read, write, delete: del, create } = {
    read: true,
    write: true,
    delete: true,
    create: true,
  };

  const actions = [
    read && "open",
    create && isWorkspaceContainer(item) && "create",
    !isWorkspaceContainer(item) && "compare",
    del && "delete",
    write && "update",
    !isWorkspaceContainer(item) ? (isWorkspaceFileCheckedOut(item) ? "checkedOut" : "notCheckedOut") : "",
    !isWorkspaceContainer(item) ? (await isWorkspaceFileCheckedOutBySelf(item) ? "coBySelf" : "notCoBySelf") : ""
  ].filter((action) => !!action);

  if (actions.length === 0) {
    return;
  }
  return actions.sort().join("-");
}

export const getNextVersion = (type: 'major' | 'minor', version?: string) => {
  const cleanVersion = version !== null && version !== undefined && version !== '' && version !== '-' ? version : '0.0';
  if (!cleanVersion.includes('.')) {
    throw new Error(`${version} is not a valid version.`);
  }

  const [majorString, minorString] = cleanVersion.split('.');
  const nextVersion = Number(type === 'major' ? majorString : minorString) + 1;
  if (type === 'minor') {
    return `${majorString}.${nextVersion}`;
  }
  return `${nextVersion}.0`;
};

export const getCurrentUser = async (): Promise<string> => {
  const session = await authentication.getSession(SASAuthProvider.id, [], {
    createIfNone: true,
  });
  return session.account.id;
}
export const getUri = async (item: RepositoryItem, readOnly?: boolean): Promise<Uri> => {
  let checkedOut = false;
  let checkedOutBy = '';
  let checkedOutBySelf = false;
  let workspaceStatus: string | undefined = '';
  if (!isContainer(item)) {
    checkedOut = (item as unknown as RepositoryFile).checkedOut;
    checkedOutBy = (item as unknown as RepositoryFile).checkedOutByDisplayName;
    checkedOutBySelf = (item as unknown as RepositoryFile).checkedOutBy === await getCurrentUser();
    workspaceStatus = (item as unknown as RepositoryFile).synchronizationInfo?.workspaceStatus;
  }
  return Uri.parse(
    `${readOnly ? "sasHcaReadOnly" : "sasHca"}:/${getName(
      item,
    )}?id=${getResourceIdFromItem(item)}&isContainer=${isContainer(item)}&checkedOut=${checkedOut}&checkedOutBy=${checkedOutBy}&checkedOutBySelf=${checkedOutBySelf}&workspaceStatus=${workspaceStatus}`,
  );
}

export const getWorkspaceUri = (item: WorkspaceItem): Uri =>
  Uri.parse(
    `${"sasCaWorkspace"}:/${item.name}?path=${encodePath(item.path)}`,
  );

export const getVersionUri = (item: VersionHistoryItem): Uri => {
  const fileNameVersioned = path.parse(item.name).name + "-v" + item.fileVersion + path.parse(item.name).ext;
  return Uri.parse(
    `${"sasHcaVersion"}:/${fileNameVersioned}?id=${item.fileId}#version=${item.fileVersion}`
  );
}

export const encodePath = (path: string): string =>
  encodeURIComponent(path ?? '').replace(/%2F/g, '/');

export const buildQueryParam = (
  uri: string,
  key: string,
  value: string | number | boolean | undefined | null
): string => {
  if (value === null) {
    return '';
  }
  const delimiter = uri.includes('?') ? '&' : '?';
  return `${delimiter}${key}=${value}`;
};

export const getModifyDate = (item: RepositoryItem): string =>
  item.modifiedTimeStamp;

export const getWorkspaceModifyDate = (item: WorkspaceItem): string =>
  item.modifiedTimeStamp;

export const getCreationDate = (item: RepositoryItem): string =>
  item.creationTimeStamp;

export const isReference = (item: RepositoryItem): boolean =>
  !!item && item?.typeId === "reference";

export const isValidItem = (item: RepositoryItem): boolean =>
  !!item && !!item.id && !!item.name;

export const isValidWorkspaceItem = (item: WorkspaceItem): boolean =>
  !!item && !!item.path && !!item.name;

export const isRepositoryItem = (item: RepositoryItem): item is RepositoryItem => isValidItem(item);

export const formatBytes = (bytes: number, decimals: number) => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024,
    dm = decimals || 2,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const defaultComparator = (a: any, b: any) => {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return -1;
  }
  if (b === null) {
    return 1;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

export const defaultDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

export const logDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}

export const formatDate = (
  date: number | Date,
  language: string,
  formatOptions: Intl.DateTimeFormatOptions = defaultDateTimeFormatOptions
) => {
  const formatter = new Intl.DateTimeFormat(language, formatOptions);
  const formatted = formatter.format(date);
  return formatted.replace(/\u202f/g, ' ');
}

export const formatLogDate = (
  date: Date,
  language: string,
) => {
  const formatter = new Intl.DateTimeFormat(language, logDateTimeFormatOptions);
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || "";
  const month = parts.find((part) => part.type === 'month')?.value || "";
  const day = parts.find((part) => part.type === 'day')?.value || "";
  const hour = parts.find((part) => part.type === 'hour')?.value || "";
  const minute = parts.find((part) => part.type === 'minute')?.value || "";
  const second = parts.find((part) => part.type === 'second')?.value || "";

  return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + '.' + date.getMilliseconds();
}

export const buildQueryPhrase = (
  operation: 'startsWith' | 'like' | 'in' | 'eq' | 'contains' | 'ne',
  key: string,
  values?: string | number | boolean | (string | number | boolean)[]
): string | null => {
  if (values === undefined || values === '' || (Array.isArray(values) && values.length === 0)) {
    return null;
  }

  let flatValues: string | number | boolean;
  if (Array.isArray(values)) {
    if (typeof values[0] === 'string') {
      flatValues = `'${values.join("','")}'`;
    } else {
      flatValues = `'${values.join(',')}'`;
    }
  } else if (typeof values === 'string') {
    flatValues = `'${values}'`;
  } else {
    flatValues = values;
  }

  return `${operation}(${key},${flatValues})`;
}

export const getDefaultWorkspaceRoot = () =>
({
  workspaceId: '',
  modifiedTimeStamp: '',
  path: '/',
  type: 'FOLDER',
  name: 'Workspace'
} as WorkspaceItem);