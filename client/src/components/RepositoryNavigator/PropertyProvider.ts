// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  Event,
  EventEmitter,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeView,
  Uri,
  window,
} from "vscode";

import { SubscriptionProvider } from "../SubscriptionProvider";
import { PropertyItem, PropertyType, PropertyTypes, RepositoryItem } from "./types";
import { formatBytes, formatDate } from './utils';
import { RepositoryModel } from './RepositoryModel';
import { Messages } from './const';

class PropertyProvider
  implements
  TreeDataProvider<PropertyItem>,
  SubscriptionProvider {
  private _onDidChangeTreeData: EventEmitter<PropertyItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private _treeView: TreeView<PropertyItem>;
  private _model: RepositoryModel;
  private data: PropertyItem[];

  get treeView(): TreeView<PropertyItem> {
    return this._treeView;
  }

  constructor(model: RepositoryModel) {
    this._onDidChangeTreeData = new EventEmitter<PropertyItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this._model = model;

    this._treeView = window.createTreeView("propertyprovider", {
      treeDataProvider: this
    });
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView];
  }

  get onDidChangeTreeData(): Event<PropertyItem> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public async setData(item?: RepositoryItem) {
    const currentProperties = [];

    if (item) {
      for (const propertyItem of this.getPropertyItems(item)) {
        const { key } = propertyItem;
        if (!key) {
          currentProperties.push(propertyItem);
        } else {
          currentProperties.push(this.getPropertyValue(propertyItem, item));
        }
      }
    }
    this.data = currentProperties;
    this._onDidChangeTreeData.fire(undefined);
  }

  public getChildren(): ProviderResult<PropertyItem[]> {
    return this.data;
  }

  public async getItem(item: RepositoryItem): Promise<RepositoryItem> {
    return await this._model.getResourceById(item.id);
  }

  public async getTreeItem(item: PropertyItem): Promise<TreeItem> {
    return {
      iconPath: this.getIconForType(item.type),
      contextValue: "a",
      id: item.key,
      label: item.label,
      description: item.value,
      collapsibleState: undefined,
      tooltip: item.value,
    };
  }

  public watch(): Disposable {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => { });
  }

  public async refresh(item?: RepositoryItem) {
    if (item) {
      const updatedItem = await this.getItem(item);
      if (updatedItem) {
        this.setData(updatedItem);
        this.treeView.message = null;
      } else {
        this.data = null;
        this.treeView.message = Messages.PropertiesError
      }
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  public reveal(item: PropertyItem): void {
    this._treeView.reveal(item, {
      expand: false,
      select: false,
      focus: false,
    });
  }

  private getIconForType(type: PropertyType): ThemeIcon {
    let icon = undefined;
    if (type === PropertyTypes.Boolean) {
      icon = 'symbol-boolean';
    } else if (type === PropertyTypes.Date) {
      icon = 'calendar';
    } else if (type === PropertyTypes.String) {
      icon = 'symbol-string';
    } else if (type === PropertyTypes.Number) {
      icon = 'symbol-number';
    } else if (type === PropertyTypes.User) {
      icon = 'person';
    }
    return icon ? new ThemeIcon(icon) : icon;
  }

  private getPropertyItems(item: RepositoryItem): PropertyItem[] {
    const primaryType = item.primaryType;
    const propertyItems: PropertyItem[] = [
      {
        type: PropertyTypes.String,
        key: 'name',
        label: Messages.NameLabel,
        value: '',
      },
      {
        type: PropertyTypes.String,
        key: 'description',
        label: Messages.DescriptionLabel,
        value: '',
      },
      {
        type: PropertyTypes.String,
        key: 'location',
        label: Messages.LocationLabel,
        value: '',
      },
      {
        type: PropertyTypes.String,
        key: 'typeId',
        label: Messages.TypeLabel,
        value: '',
      },
      {
        type: PropertyTypes.User,
        key: 'ownerDisplayName',
        label: Messages.OwnerLabel,
        value: '',
      },
      {
        type: PropertyTypes.User,
        key: 'createdByDisplayName',
        label: Messages.CreatedByLabel,
        value: '',
      },
      {
        type: PropertyTypes.Date,
        key: 'creationTimeStamp',
        label: Messages.DateCreatedLabel,
        value: '',
      },
      {
        type: PropertyTypes.User,
        key: 'modifiedByDisplayName',
        label: Messages.ModifiedByLabel,
        value: '',
      },
      {
        type: PropertyTypes.Date,
        key: 'modifiedTimeStamp',
        label: Messages.DateModifiedLabel,
        value: '',
      },
    ];

    if (primaryType === 'CONTEXT') {
      propertyItems.push(
        {
          type: PropertyTypes.Boolean,
          key: 'state',
          label: Messages.StateLabel,
          value: '',
        }
      );
    }

    if (primaryType === 'FILE') {
      propertyItems.push(
        {
          type: PropertyTypes.Number,
          key: 'size',
          label: Messages.SizeLabel,
          value: '',
        },
        {
          type: PropertyTypes.Boolean,
          key: 'locked',
          label: Messages.LockStatusLabel,
          value: '',
        },
      );

      propertyItems.push(
        {
          type: PropertyTypes.Boolean,
          key: 'versioned',
          label: Messages.VersionStatusLabel,
          value: '',
        }
      );

      if (item.versioned) {
        propertyItems.push(
          {
            type: PropertyTypes.Number,
            key: 'fileVersion',
            label: Messages.VersionLabel,
            value: '',
          }
        );
      }
    }

    return propertyItems;
  }

  private getPropertyValue(propertyItem: PropertyItem, item: { [key: string]: any; id: string }): PropertyItem {
    const { key, label } = propertyItem;
    const value = !item ? '' : item[key];
    let newValue = value;
    if (key === 'name' && item.id === '1') {
      newValue = 'Repository';
    } else if (key === 'locked') {
      newValue = value ? Messages.Locked : Messages.Unlocked;
    } else if (key === 'versioned') {
      newValue = value ? Messages.Versioned : Messages.Unversioned;
    } else if (key === 'size') {
      newValue = formatBytes(value, 0);
    } else if (key === 'primaryType' || key === 'state') {
      newValue = value.toLowerCase();
      newValue = newValue[0].toUpperCase() + newValue.slice(1);
    } else if (key === 'typeId') {
      newValue = this._model.getObjectTypeName(value);
    }

    if (propertyItem.type === PropertyTypes.Date) {
      newValue = formatDate(Date.parse(value), "en-US");
    }

    return {
      key: key,
      type: propertyItem.type,
      label: label ?? '',
      value: newValue ? String(newValue) : ''
    };
  }
}

export default PropertyProvider;
