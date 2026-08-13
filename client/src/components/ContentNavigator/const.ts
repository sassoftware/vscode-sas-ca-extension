// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

export const REPOSITORY_ITEMS = "/clinicalRepository/repository/items";
export const TYPES = "/clinicalRepository/types";
export const AUTHORIZATIONS = "/clinicalRepository/authorizations";
export const REPOSITORY_FILES_CONTENT = "/clinicalRepository/repository/files/content";
export const REPOSITORY_ITEMS_BATCH = "/clinicalRepository/repository/items/batch";
export const ACTION_STATUS = "/clinicalActionStatus/actionstatus";
export const WORKSPACE = "/clinicalRepository/workspaces/@currentUser";
export const WORKSPACE_ITEMS_CONTENT = "/clinicalRepository/workspaces/@currentUser/items/content";
export const WORKSPACE_ITEMS_BATCH = "/clinicalRepository/workspaces/@currentUser/items/batch";
export const WORKSPACE_SYNCHRONIZATION_ITEMS = "/clinicalRepository/synchronization/items";

const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
export const ROOT_FOLDER_TYPE = "RootFolder";

export const ROOT_FOLDER = {
  id: 1,
  name: "Repository",
  type: ROOT_FOLDER_TYPE,
  uri: CONTENT_FOLDER_ID,
};

export const WORKSPACE_ROOT_FOLDER = {
  id: 1,
  name: "Workspace",
  type: ROOT_FOLDER_TYPE,
  uri: CONTENT_FOLDER_ID,
};

export const FILE_TYPE = "file";
export const FILE_TYPES = [FILE_TYPE];
export const FOLDER_TYPE = "folder";
export const MYFOLDER_TYPE = "myFolder";
export const TRASH_FOLDER_TYPE = "trashFolder";
export const FAVORITES_FOLDER_TYPE = "favoritesFolder";
export const USER_FOLDER_TYPE = "userFolder";
export const USER_ROOT_TYPE = "userRoot";
export const FOLDER_TYPES = [
  ROOT_FOLDER_TYPE,
  FOLDER_TYPE,
  MYFOLDER_TYPE,
  FAVORITES_FOLDER_TYPE,
  USER_FOLDER_TYPE,
  USER_ROOT_TYPE,
  TRASH_FOLDER_TYPE,
];

export const Messages = {
  AccessError: l10n.t('The item cannot be accessed.'),
  AccessPermissionsError: l10n.t('The item permissions cannot be accessed.'),
  AccessPrivilegesError: l10n.t('The item privileges cannot be accessed.'),
  CheckInError: l10n.t('There was an error checking in the selected item(s). {message}'),
  CheckInSuccess: l10n.t('Successfully checked in selected item(s).'),
  CheckInWarning: l10n.t('There was a warning checking in the selected items(s). { message }'),
  CheckOutError: l10n.t('There was an error checking out the selected items(s). {message}'),
  CheckOutSuccess: l10n.t('Successfully checked out selected item(s).'),
  CheckOutWarning: l10n.t('There was a warning checking out the selected items(s). {message}'),
  CheckedOut: l10n.t("Checked out"),
  CheckedOutByLabel: l10n.t("Checked out by:"),
  CheckedOutLabel: l10n.t("Checked out status:"),
  CheckedOutTimestampLabel: l10n.t("Date checked out:"),
  CheckinVersionPrompt: l10n.t("Enter a version for this check-in."),
  CheckingInMessage: l10n.t("Checking in content..."),
  CheckingOutContentMessage: l10n.t("Checking out content..."),
  CheckingOutMessage: l10n.t("Checking out ..."),
  CommentLengthValidationError: l10n.t("The comment cannot contain more than 1024 characters."),
  CommentPrompt: l10n.t("Enter an optional comment for this action."),
  CommentTitle: l10n.t("Comment"),
  CopyFolderError: l10n.t('There was an error copying the folder for the selected items(s). {message}'),
  CopyFolderMessage: l10n.t('Copying folder selections to the workspace...'),
  CopyFolderStructureError: l10n.t('There was an error copying the folder structure for selected folder(s). {message}'),
  CopyFolderStructureMessage: l10n.t('Copying folder structure of selections to the workspace...'),
  CopyFolderStructureSuccess: l10n.t('Successfully copied the folder structure for selected folder(s).'),
  CopyFolderStructureWarning: l10n.t('There was a warning copying the folder structure for the selected items(s). {message}'),
  CopyFolderSuccess: l10n.t('Successfully copied the selected folder(s).'),
  CopyFolderWarning: l10n.t('There was a warning copying the folder for the selected items(s). {message}'),
  CopyLatestVersionError: l10n.t('There was an error copying the latest version for file "{name}". {message}'),
  CopyLatestVersionMessage: l10n.t('Copying latest version of selections to the workspace...'),
  CopyLatestVersionSuccess: l10n.t('Successfully copied the latest version for the selected item(s).'),
  CopyLatestVersionWarning: l10n.t('There was a warning copying the latest version of the selected items(s). {message}'),
  CopySpecificVersionError: l10n.t('There was an error copying the specific version of the file "{name}". {message}'),
  CopySpecificVersionMessage: l10n.t('Copying specific version of file to the workspace...'),
  CopySpecificVersionSuccess: l10n.t('Successfully copied specific version for file "{name}".'),
  CopySpecificVersionWarning: l10n.t('There was a warning copying the specific version of the selected item. {message}'),
  CreatedByLabel: l10n.t("Created by:"),
  DateCreatedLabel: l10n.t("Date created:"),
  DateModifiedLabel: l10n.t("Date modified:"),
  DeleteButtonLabel: l10n.t("Delete"),
  DeleteError: l10n.t("There was an error in deleting the selected item(s)."),
  DeleteSuccess: l10n.t('Successfully deleted the selected item(s).'),
  DeleteWarning: l10n.t('There was a warning deleting the selected items(s). {message}'),
  DeleteWarningMessage: l10n.t('Are you sure you want to delete the selected item(s)?'),
  DescriptionLabel: l10n.t("Description:"),
  DisableVersioningError: l10n.t('There was an error disabling versioning for file "{name}". {message}'),
  DisableVersioningMessage: l10n.t('Disabling versioning for file "{name}"...'),
  DisabledVersioningSuccess: l10n.t('Successfully disabled versioning for file "{name}".'),
  DownloadError: l10n.t("There was an error downloading the selected version."),
  DownloadTitle: l10n.t("Download"),
  DownloadedMessage: l10n.t('Downloaded "{name}" to "{location}"'),
  DownloadingMessage: l10n.t("Downloading content..."),
  DownloadedError: l10n.t("There was an error downloading the selected item(s). One or more of the selections could not be accessed."),
  EmptyRecycleBinError: l10n.t("Unable to empty the recycle bin."),
  EmptyRecycleBinWarningMessage: l10n.t("Are you sure you want to permanently delete all the items? You cannot undo this action."),
  EnableVersioningError: l10n.t('There was an error enabling versioning for file "{name}". {message}'),
  EnableVersioningForExistingFilesMessage: l10n.t('There are files checked out available to check in that have not been versioned. Do you want to set a version for them? (yes/no)?'),
  EnableVersioningForFilesTitle: l10n.t("Versioning"),
  EnableVersioningForNewFilesMessage: l10n.t('There are new files available to check in. Do you want to set a version for them? (yes/no)?'),
  EnableVersioningMessage: l10n.t('Enabling versioning for file "{name}".'),
  EnabledVersioningSuccess: l10n.t('Successfully enabled versioning for file "{name}".'),
  FileCreationError: l10n.t('Unable to create new file "{name}" at "{location}". {message}'),
  FileCreationMessage: l10n.t('Creating new file...'),
  FileCreationSuccess: l10n.t('Created new file "{name}" at "{location}".'),
  FileDeletionError: l10n.t("Unable to delete file."),
  FileNotVersioned: l10n.t("The selected file is not versioned."),
  FileOpenError: l10n.t("The file type is unsupported."),
  FileRestoreError: l10n.t("Unable to restore file."),
  FileValidationError: l10n.t("Invalid file name."),
  FolderCreationError: l10n.t('Unable to create new folder "{name}" at "{location}". {message}'),
  FolderCreationSuccess: l10n.t('Created new folder "{name}" at "{location}".'),
  FolderDeletionError: l10n.t("Unable to delete folder."),
  FolderNameCharacterValidationError: l10n.t("The folder name provided has invalid characters."),
  FolderNameDotValidationError: l10n.t("Leading dot character is not allowed."),
  FolderNameLeadingSpaceValidationError: l10n.t("Leading whitespace characters are not allowed."),
  FolderNameLengthValidationError: l10n.t("The folder name cannot contain more than 255 characters."),
  FolderNameTrailingSpaceValidationError: l10n.t("Trailing whitespace characters are not allowed."),
  FolderRestoreError: l10n.t("Unable to restore folder."),
  ItemLocation: l10n.t('Location: {location}'),
  LocationLabel: l10n.t("Location:"),
  LockStatusLabel: l10n.t("Lock status:"),
  Locked: l10n.t("Locked"),
  Missing: l10n.t("Missing"),
  ModifiedByLabel: l10n.t("Modified by:"),
  MovedToRecyleBinError: l10n.t('Unable to move "{name}" to the Recycle Bin. {message}'),
  MovedToRecyleBinSuccess: l10n.t('Moved "{name}" to the Recycle Bin. You can restore it using the SAS Clinical Acceleration Manage Data Repository application.'),
  NameLabel: l10n.t("Name:"),
  NewFileCreationError: l10n.t('Unable to create file "{name}".'),
  NewFilePrompt: l10n.t("Enter a file name."),
  NewFileTitle: l10n.t("New File"),
  NewFolderCreationError: l10n.t('Unable to create folder "{name}".'),
  NewFolderPrompt: l10n.t("Enter a folder name."),
  NewFolderTitle: l10n.t("New Folder"),
  NoEligibleItemsFound: l10n.t("There were no eligible items found to check in. Please verify your selections."),
  NotCheckedOut: l10n.t("Not Checked out"),
  NotSynced: l10n.t("Not Synced"),
  OutOfSync: l10n.t("Out of Sync"),
  OwnerLabel: l10n.t("Owner:"),
  PropertiesError: l10n.t("Unable to display properties for the selected item."),
  RenameError: l10n.t('Unable to rename "{oldName}" to "{newName}". {message}.'),
  RenameErrorMessage: l10n.t('Unable to rename "{oldName}" to "{newName}".'),
  RenameFileTitle: l10n.t("Rename File"),
  RenameFolderTitle: l10n.t("Rename Folder"),
  RenamePrompt: l10n.t("Enter a new name."),
  RenameSuccess: l10n.t('Successfully renamed "{oldName}" to "{newName}".'),
  SizeLabel: l10n.t("Size:"),
  StateLabel: l10n.t("State:"),
  Synced: l10n.t("Synced"),
  TypeLabel: l10n.t("Type:"),
  UndoCheckOutError: l10n.t("There was an error in reverting the check-out the selected item(s). {message}"),
  UndoCheckOutWarning: l10n.t("There was a warning in reverting the check-out the selected item(s). {message}"),
  UndoCheckOutMessage: l10n.t("Undo check out..."),
  UndoCheckOutSuccess: l10n.t("Successfully reverted checkout of selected item(s)."),
  Unlocked: l10n.t("Unlocked"),
  Unversioned: l10n.t("Unversioned"),
  UploadAndExpandTitle: l10n.t("Upload and Expand"),
  UploadError: l10n.t("There was an error in uploading the selected item(s)."),
  UploadErrorMessage: l10n.t('Unable to upload "{name}" to "{location}". {message}.'),
  UploadTitle: l10n.t("Upload"),
  UploadedAndExpandedMessage: l10n.t('Uploaded and expanded "{name}" to "{location}".'),
  UploadedMessage: l10n.t('Uploaded "{name}" to "{location}".'),
  UploadingMessage: l10n.t("Uploading content..."),
  VersionFormatValidationError: l10n.t("Please enter a valid version (ex: 1.0, etc.)."),
  VersionHistoryItemError: l10n.t("Unable to display version history for the selected item."),
  VersionLabel: l10n.t("Version:"),
  VersionPrompt: l10n.t("Enter an optional version for this upload."),
  VersionStatusLabel: l10n.t("Version status:"),
  VersionTitle: l10n.t("Version"),
  Versioned: l10n.t("Versioned"),
  VersioningUnsupported: l10n.t("The item selected does not support versioning."),
  WorkspaceFileStatus: l10n.t("Workspace Status"),
  YesNoFormatValidationError: l10n.t('Please enter "yes" or "no".'),
};


