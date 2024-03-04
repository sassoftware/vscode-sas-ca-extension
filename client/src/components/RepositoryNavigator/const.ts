// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

export const REPOSITORY_ITEMS = "/healthClinicalAcceleration/repository/items";
export const TYPES = "/healthClinicalAcceleration/types";
export const AUTHORIZATIONS = "/healthClinicalAcceleration/authorizations";
export const REPOSITORY_FILES_CONTENT = "/healthClinicalAcceleration/repository/files/content";
export const REPOSITORY_ITEMS_BATCH = "/healthClinicalAcceleration/repository/items/batch";
export const ACTION_STATUS = "/healthClinicalAcceleration/actionstatus";

const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
export const ROOT_FOLDER_TYPE = "RootFolder";

export const ROOT_FOLDER = {
  id: 1,
  name: "Repository",
  type: ROOT_FOLDER_TYPE,
  uri: CONTENT_FOLDER_ID,
};

export const FILE_TYPE = "file";
export const FILE_TYPES = [FILE_TYPE];
export const FOLDER_TYPE = "folder";
export const MYFOLDER_TYPE = "myFolder";
export const TRASH_FOLDER_TYPE = "trashFolder";
export const FAVORITES_FOLDER_TYPE = "favoritesFolder";
export const FOLDER_TYPES = [
  ROOT_FOLDER_TYPE,
  FOLDER_TYPE,
  MYFOLDER_TYPE,
  FAVORITES_FOLDER_TYPE,
  "userFolder",
  "userRoot",
  TRASH_FOLDER_TYPE,
];

export const Messages = {
  AccessError: l10n.t('The item cannot be accessed.'),
  AccessPermissionsError: l10n.t('The item permissions cannot be accessed.'),
  AccessPrivilegesError: l10n.t('The item privileges cannot be accessed.'),
  CommentLengthValidationError: l10n.t("The comment cannot contain more than 1024 characters."),
  CommentPrompt: l10n.t("Enter an optional comment for this upload."),
  CommentTitle: l10n.t("Comment"),
  DeleteButtonLabel: l10n.t("Delete"),
  DeleteError: l10n.t("There was an error in deleting the selected item(s)."),
  DeleteWarningMessage: l10n.t(
    'Are you sure you want to delete the selected item(s)?',
  ),
  DisableVersioningError: l10n.t('There was an error disabling versioning for file "{name}". {message}'),
  DisableVersioningMessage: l10n.t('Disabling versioning for file "{name}".'),
  DisabledVersioningSuccess: l10n.t('Successfully disabled versioning for file "{name}".'),
  DownloadedMessage: l10n.t('Downloaded "{name}" to "{location}"'),
  DownloadTitle: l10n.t("Download"),
  DownloadError: l10n.t("There was an error downloading the selected version"),
  DownloadingMessage: l10n.t("Downloading content..."),
  EmptyRecycleBinError: l10n.t("Unable to empty the recycle bin."),
  EmptyRecycleBinWarningMessage: l10n.t(
    "Are you sure you want to permanently delete all the items? You cannot undo this action.",
  ),
  EnableVersioningError: l10n.t('There was an error enabling versioning for file "{name}". {message}'),
  EnableVersioningMessage: l10n.t('Enabling versioning for file "{name}".'),
  EnabledVersioningSuccess: l10n.t('Successfully enabled versioning for file "{name}".'),
  FileDeletionError: l10n.t("Unable to delete file."),
  FileOpenError: l10n.t("The file type is unsupported."),
  FileNotVersioned: l10n.t("The selected file is not versioned."),
  FileRestoreError: l10n.t("Unable to restore file."),
  FileValidationError: l10n.t("Invalid file name."),
  FolderCreationSuccess: l10n.t('Created new folder "{name}" at "{location}".'),
  FolderCreationError: l10n.t('Unable to create new folder "{name}" at "{location}". {message}'),
  FolderDeletionError: l10n.t("Unable to delete folder."),
  FolderNameLengthValidationError: l10n.t(
    "The folder name cannot contain more than 255 characters.",
  ),
  FolderNameCharacterValidationError: l10n.t(
    "The folder name provided has invalid characters.",
  ),
  FolderNameDotValidationError: l10n.t(
    "Leading dot character is not allowed.",
  ),
  FolderNameLeadingSpaceValidationError: l10n.t(
    "Leading whitespace characters are not allowed.",
  ),
  FolderNameTrailingSpaceValidationError: l10n.t(
    "Trailing whitespace characters are not allowed.",
  ),
  FolderRestoreError: l10n.t("Unable to restore folder."),
  ItemLocation: l10n.t('Location: {location}'),
  MovedToRecyleBinError: l10n.t('Unable to move "{name}" to the Recycle Bin. {message}'),
  MovedToRecyleBinSuccess: l10n.t('Moved "{name}" to the Recycle Bin. You can restore it using the SAS Health Manage Data Repository application.'),
  NewFolderCreationError: l10n.t('Unable to create folder "{name}".'),
  NewFolderPrompt: l10n.t("Enter a folder name."),
  NewFolderTitle: l10n.t("New Folder"),
  PropertiesError: l10n.t("Unable to display properties for the selected item."),
  RenameError: l10n.t('Unable to rename "{oldName}" to "{newName}". {message}'),
  RenameErrorMessage: l10n.t('Unable to rename "{oldName}" to "{newName}"'),
  RenameFileTitle: l10n.t("Rename File"),
  RenameFolderTitle: l10n.t("Rename Folder"),
  RenamePrompt: l10n.t("Enter a new name."),
  RenameSuccess: l10n.t('Successfully renamed "{oldName}" to "{newName}".'),
  UploadedAndExpandedMessage: l10n.t('Uploaded and expanded "{name}" to "{location}".'),
  UploadAndExpandTitle: l10n.t("Upload and Expand"),
  UploadedMessage: l10n.t('Uploaded "{name}" to "{location}".'),
  UploadingMessage: l10n.t("Uploading content..."),
  UploadTitle: l10n.t("Upload"),
  UploadError: l10n.t("There was an error in uploading the selected item(s)."),
  UploadErrorMessage: l10n.t('Unable to upload "{name}" to "{location}". {message}'),
  VersionHistoryItemError: l10n.t("Unable to display version history for the selected item."),
  VersioningUnsupported: l10n.t("The item selected does not support versioning."),
  NameLabel: l10n.t("Name:"),
  DescriptionLabel: l10n.t("Description:"),
  LocationLabel: l10n.t("Location:"),
  TypeLabel: l10n.t("Type:"),
  OwnerLabel: l10n.t("Owner:"),
  CreatedByLabel: l10n.t("Created by:"),
  DateCreatedLabel: l10n.t("Date created:"),
  ModifiedByLabel: l10n.t("Modified by:"),
  DateModifiedLabel: l10n.t("Date modified:"),
  StateLabel: l10n.t("State:"),
  SizeLabel: l10n.t("Size:"),
  LockStatusLabel: l10n.t("Lock status:"),
  VersionFormatValidationError: l10n.t("Please enter a valid version (ex: 1.0, etc.)"),
  VersionPrompt: l10n.t("Enter an optional version for this upload."),
  VersionTitle: l10n.t("Version"),
  VersionStatusLabel: l10n.t("Version status:"),
  VersionLabel: l10n.t("Version:"),
  Locked: l10n.t("Locked"),
  Unlocked: l10n.t("Unlocked"),
  Versioned: l10n.t("Versioned"),
  Unversioned: l10n.t("Unversioned"),
};
