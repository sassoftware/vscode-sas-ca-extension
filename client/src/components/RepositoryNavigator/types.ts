// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const RESOURCE_COLLECTION_MEDIA_TYPE = 'application/vnd.sas.collection+json';
export const REPOSITORY_ITEM_MEDIA_TYPE = 'application/vnd.sas.clinical.repository.item+json';
export const REPOSITORY_FILE_MEDIA_TYPE = 'application/vnd.sas.clinical.repository.file+json';
export const REPOSITORY_CONTAINER_MEDIA_TYPE =
  'application/vnd.sas.clinical.repository.container+json';

export type ItemType = 'CONTEXT' | 'FOLDER' | 'FILE';
export type Capability = 'TOP' | 'MEMBERSHIP' | 'STATE' | 'FILES';
export type AttributeType = 'LONG' | 'STRING' | 'DATE' | 'BOOLEAN';
export type State = 'ACTIVE' | 'CLOSED';
export type SigningStatus = 'NONE' | 'PREVIOUS' | 'CURRENT' | 'BOTH';
export type PropertyType = 'DATE' | 'USER' | 'NUMBER' | 'STRING' | 'BOOLEAN';

export enum PropertyTypes {
  Date = "DATE",
  User = "USER",
  Number = "NUMBER",
  String = "STRING",
  Boolean = "BOOLEAN",
}

export const PERMISSION_TYPES = [
  'READ',
  'WRITE'
];

export const PRIVILEGE_TYPES =
  [
    'PRIVILEGE_ENABLE_VERSIONING',
    'PRIVILEGE_MANAGE_VERSIONING'
  ];

export type Action =
  | 'ENABLE_VERSIONING'
  | 'DISABLE_VERSIONING';

export type EnableVersioning = {
  comment: string;
  fileSpecifications: { path: string; fileVersion: string }[];
};

export type DisableVersioning = {
  comment: string;
  paths: string[];
};

export type ActionBody =
  | EnableVersioning
  | DisableVersioning
  | undefined;

export interface Link {
  method: string;
  rel: string;
  href: string;
  type: string;
  uri: string;
}

export interface Permission {
  read: boolean;
  write: boolean;
  delete: boolean;
  create: boolean;
}

export interface Privilege {
  enableVersioning: boolean;
  manageVersioning: boolean;
}

export interface PropertyItem {
  key: string,
  type: PropertyType,
  label: string,
  value: string,
}

export interface AbstractModifiableResource {
  createdBy: string;
  createdByDisplayName: string;
  creationTimeStamp: string;
  id: string;
  typeId: string;
  modifiedBy: string;
  modifiedByDisplayName: string;
  modifiedTimeStamp: string;
  versioned: boolean;
  eTag: string;
}

export interface RepositoryItem extends AbstractModifiableResource {
  description: string;
  name: string;
  owner: string;
  ownerDisplayName: string;
  defaultOwner: string;
  defaultOwnerDisplayName: string;
  location: string;
  path: string;
  primaryType: ItemType;
  propertiesModifiedBy: string;
  propertiesModifiedByDisplayName: string;
  propertiesModifiedTimeStamp: string;
  size: number;
  state: State;
  permisison?: Permission;
  privilege?: Privilege;
}

export interface RepositoryFile extends RepositoryItem {
  digest: string;
  locked: boolean;
  signingStatus: SigningStatus;
  versioned: boolean;
  fileVersion: string;
  majorVersionLimit: number | null;
  minorVersionLimit: number | null;
  contentType?: string;
  fileSize: number;
}

export interface RepositoryContainer extends RepositoryItem {
  defaultMajorVersionLimit: number;
  defaultMinorVersionLimit: number;
  defaultOwner: string;
  defaultOwnerDisplayName: string;
  children?: RepositoryItem[];
}

export interface AttributeDefinition {
  declaringTypeId: string;
  id: string;
  name: string;
  attributeType: AttributeType;
  logicalType: string;
  order: number;
  auditable: boolean;
  confidential: boolean;
  editable: boolean;
  multiple: boolean;
  required: boolean;
  searchable: boolean;
  versioned: boolean;
}

export interface ObjectType {
  id: string;
  name: string;
  description: string;
  icon: string;
  auditable: boolean;
  searchable: boolean;
  contextType: boolean;
  fileType: boolean;
  attributeDefinitions: AttributeDefinition[];
  capabilities: Capability[];
  allowableChildTypes: string[];
}

export interface ResourceCollection<T> {
  count: number;
  start: number;
  items: T[];
  limit: number;
}

export interface VersionHistoryItem {
  name: string;
  fileId: string;
  versionId: string;
  path: string;
  fileVersion: string;
  comment: string;
  createdBy: string;
  createdByDisplayName: string;
  creationTimeStamp: number;
  size: number;
  latest: boolean;
  signed: boolean;
}

export interface VersionHistoryResponse extends ResourceCollection<VersionHistoryItem> {
  name: string;
}

export const ACTION_STATUS_MEDIA_TYPE = 'application/vnd.sas.clinical.action.status+json';

export interface ActionStatusDetails {
  id: string;
  itemIdentifier: string;
  itemLocation: string;
  itemName: string;
  message: string;
  startTimeStamp: string;
  endTimeStamp: string;
  percentComplete: number;
  progressStatus: ProgressStatus;
  completionStatus: CompletionStatus;
}

export interface ActionStatus {
  details: ActionStatusDetails[];
  summary: ActionStatusSummary;
}

export const ACTION_SUMMARY_MEDIA_TYPE = 'application/vnd.sas.clinical.action.status.summary+json';
export type ProgressStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'STOPPED'
  | 'STOPPING'
  | 'COMPLETED'
  | 'TERMINATED';
export type CompletionStatus = 'INFO' | 'WARN' | 'ERROR';

export interface ActionStatusSummary {
  id: string;
  clientId: string;
  action: string;
  message: string;
  detailMessage: string;
  startTimeStamp: string;
  endTimeStamp: string;
  percentComplete: number;
  stoppable: boolean;
  progressStatus: ProgressStatus;
  completionStatus: CompletionStatus;
}