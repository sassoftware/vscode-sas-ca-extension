// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";
import path from "path";

import { RepositoryItem, Link, VersionHistoryItem } from "./types";

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string,
): Link | null =>
  !links || links.length === 0
    ? null
    : links.find((link) => link.method === method && link.rel === relationship);

export const getResourceId = (uri: Uri): string => uri.query.substring(3);
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

export const isContext = (item: RepositoryItem): boolean => {
  return "CONTEXT" === item.primaryType
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

export const resourceType = (item: RepositoryItem): string | undefined => {
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
    del && !isContext(item) && "delete",
    write && "update",
    !isContainer(item) ? (isVersioned(item) ? "versioned" : "unversioned") : ''
  ].filter((action) => !!action);

  if (actions.length === 0) {
    return;
  }
  console.log(actions.sort().join("-"));
  return actions.sort().join("-");
}

export const getUri = (item: RepositoryItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? "sasHcaReadOnly" : "sasHca"}:/${getName(
      item,
    )}?id=${getResourceIdFromItem(item)}`,
  );

export const getVersionUri = (item: VersionHistoryItem): Uri => {
  const fileNameVersioned = path.parse(item.name).name + "-v" + item.fileVersion + path.parse(item.name).ext;
  return Uri.parse(
    `${"sasHcaVersion"}:/${fileNameVersioned}?id=${item.fileId}#version=${item.fileVersion}`
  );
}

export const getModifyDate = (item: RepositoryItem): string =>
  item.modifiedTimeStamp;

export const getCreationDate = (item: RepositoryItem): string =>
  item.creationTimeStamp;

export const isReference = (item: RepositoryItem): boolean =>
  !!item && item?.typeId === "reference";

export const isValidItem = (item: RepositoryItem): boolean =>
  !!item && !!item.id && !!item.name;

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
  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  const day = parts.find((part) => part.type === 'day').value;
  const hour = parts.find((part) => part.type === 'hour').value;
  const minute = parts.find((part) => part.type === 'minute').value;
  const second = parts.find((part) => part.type === 'second').value;

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