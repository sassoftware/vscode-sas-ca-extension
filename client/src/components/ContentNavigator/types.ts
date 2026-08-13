// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const RESOURCE_COLLECTION_MEDIA_TYPE = 'application/vnd.sas.collection+json';
export const REPOSITORY_ITEM_MEDIA_TYPE = 'application/vnd.sas.clinical.repository.item+json';
export const REPOSITORY_FILE_MEDIA_TYPE = 'application/vnd.sas.clinical.repository.file+json';
export const REPOSITORY_CONTAINER_MEDIA_TYPE = 'application/vnd.sas.clinical.repository.container+json';
export const WORKSPACE_ITEM_MEDIA_TYPE = 'application/vnd.sas.clinical.workspace.item+json';
export const WORKSPACE_ITEM_CONTENT_TYPE = 'application/json';
export const SYNCHRONIZATION_ITEM_MEDIA_TYPE = 'application/vnd.sas.clinical.synchronization.item+json';
export const ACTION_STATUS_MEDIA_TYPE = 'application/vnd.sas.clinical.action.status+json';
export const ACTION_SUMMARY_MEDIA_TYPE = 'application/vnd.sas.clinical.action.status.summary+json';

export type ItemType =
  | 'CONTEXT'
  | 'FOLDER'
  | 'FILE'
  | 'JOB_FILE'
  | 'JOB';

export type Capability =
  | 'TOP'
  | 'MEMBERSHIP'
  | 'STATE'
  | 'FILES';

export type AttributeType =
  | 'LONG'
  | 'STRING'
  | 'DATE'
  | 'BOOLEAN';

export type State =
  | 'ACTIVE'
  | 'CLOSED';

export type SigningStatus =
  | 'NONE'
  | 'PREVIOUS'
  | 'CURRENT'
  | 'BOTH';

export type PropertyType =
  | 'DATE'
  | 'USER'
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'SYNC';

export enum PropertyTypes {
  Date = "DATE",
  User = "USER",
  Number = "NUMBER",
  String = "STRING",
  Boolean = "BOOLEAN",
  Sync = "SYNC",
}

export const PERMISSION_TYPES = [
  'READ',
  'WRITE'
];

export const PRIVILEGE_TYPES = [
  'PRIVILEGE_ENABLE_VERSIONING',
  'PRIVILEGE_MANAGE_VERSIONING'
];

export const ExtensionTypes: ExtensionType[] = [
  { extension: '.sas', objectType: 'FILE_SASPROGRAM' },
  { extension: '.sas7bdat', objectType: 'FILE_SASDATASET' },
  { extension: '.sas7bcat', objectType: 'FILE_SASCATALOG' },
  { extension: '.sas7bvew', objectType: 'FILE_SASVIEW' },
  { extension: '.xpt', objectType: 'FILE_SASTRANSPORT' },
  { extension: '.cjob', objectType: 'FILE_CJOB' },
  { extension: '.job', objectType: 'FILE_JOB' },
  { extension: '.cmnf', objectType: 'FILE_CMNF' },
  { extension: '.log', objectType: 'SAS_LOG' },
  { extension: '.lst', objectType: 'SAS_LOG' },
];

export type Action =
  'RENAME'
  | 'MOVE'
  | 'COPY'
  | 'DOWNLOAD'
  | 'DELETE'
  | 'COPY_LATEST_VERSION'
  | 'COPY_SPECIFIC_VERSION'
  | 'COPY_FOLDER'
  | 'COPY_FOLDER_STRUCTURE'
  | 'UPLOAD'
  | 'UPLOAD_EXPAND'
  | 'ENABLE_VERSIONING'
  | 'REPOSITORY_CHECK_OUT'
  | 'CHECK_IN'
  | 'UNDO_CHECKOUT'
  | 'DISABLE_VERSIONING';

export type WorkspaceAction =
  | 'MOVE'
  | 'COPY'
  | 'DOWNLOAD'
  | 'DELETE'
  | 'CHECK_OUT_WITHOUT_COPY'
  | 'UNDO_CHECKOUT'
  | 'CHECK_IN'
  | 'COPY_LATEST_VERSION'
  | 'COPY_SPECIFIC_VERSION'
  | 'COPY_FOLDER_STRUCTURE'
  | 'UPLOAD'
  | 'UPLOAD_EXPAND'
  | 'REPOSITORY_CHECK_OUT'
  | 'WORKSPACE_CHECK_OUT';

export type ProgressStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'STOPPED'
  | 'STOPPING'
  | 'COMPLETED'
  | 'TERMINATED';

export type CompletionStatus =
  | 'INFO'
  | 'WARN'
  | 'ERROR';

export type Syncable =
  | 'ALLOW'
  | 'WARN'
  | 'DENY'
  | 'DENY_ALL';

export type CheckoutType =
  | 'CHECKED_OUT_BY_SELF'
  | 'CHECKED_OUT_BY_OTHER';

export type WorkspaceStatus =
  | 'WORKSPACE_FILE_MISSING'
  | 'OUT_OF_SYNC'
  | 'IN_SYNC'
  | 'NOT_SYNCED';

export type ActionMessages = {
  success: string;
  warn: string;
  error: string;
};

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
  syncable: Syncable;
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
  checkedOut: boolean;
  checkedOutBy: string;
  checkedOutByDisplayName: string;
  checkedOutTimestamp: string;
  synchronizationInfo?: SynchronizationInfo;
  runAsOwner?: boolean;
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
export interface SynchronizationItem {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  location: string;
  path: string;
  repositoryFileSize: number;
  repositoryModifiedTimeStamp: string;
  synchronizationInfo: SynchronizationInfo;
}
export interface SynchronizationInfo {
  checkedOut?: boolean;
  checkedOutBy?: string;
  checkedOutByDisplayName?: string;
  checkedOutTimeStamp?: string;
  synchronizationFileVersion?: string;
  synchronizationTimeStamp?: string;
  workspaceStatus?: WorkspaceStatus;
  fileVersion?: string;
  syncable?: Syncable;
}
export interface WorkspaceItem {
  workspaceId: string;
  name: string;
  path: string;
  location: string;
  type: 'FILE' | 'FOLDER';
  modifiedTimeStamp: string;
  repositoryInfo?: RepositoryItem;
}
export interface WorkspaceFile extends WorkspaceItem {
  size: number;
  contentType: string;
  synchronizationInfo?: SynchronizationInfo;
}

export interface WorkspaceFolder extends WorkspaceItem { }

type DownloadWorkspaceItemAction = { paths: string[]; actionStatusId?: string };
type CopyFolderSpecification = {
  paths: string[];
  includeSubfolders: boolean;
};

export type FileSpecification = { path: string; fileVersion?: string };
type CheckInSpecification = {
  fileSpecifications: { path: string; fileVersion?: string; type: string }[];
  comment: string;
  includeNewFiles: boolean;
};

export type VersioningItem = {
  name?: string;
  path?: string;
  location?: string;
  file?: File;
  currentVersion?: string;
  fileVersion?: string;
  versionType?: number;
  enableVersioning?: boolean;
  disableAll?: boolean;
  updateValidation?: boolean;
};

export type WorkspaceActionBody =
  DownloadWorkspaceItemAction
  | CopyFolderSpecification
  | CheckInSpecification
  | FileSpecification[]
  | string[]
  | string
  | undefined;

export type ExtensionType = {
  extension: string;
  objectType: string;
};


