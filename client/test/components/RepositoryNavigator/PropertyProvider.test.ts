import {
  ThemeIcon,
  TreeItem,
  Uri,
  authentication,
} from "vscode";

import axios, { AxiosInstance, HeadersDefaults } from "axios";
import { expect } from "chai";
import * as sinon from "sinon";
import { StubbedInstance, stubInterface } from "ts-sinon";

import PropertyProvider from "../../../src/components/RepositoryNavigator/PropertyProvider";
import { RepositoryModel } from "../../../src/components/RepositoryNavigator/RepositoryModel";
import { PropertyItem, RepositoryFile, RepositoryItem, RepositoryContainer } from "../../../src/components/RepositoryNavigator/types";

let stub;
let axiosInstance: StubbedInstance<AxiosInstance>;

const mockRepositoryItem = (): RepositoryItem => ({
  description: "",
  name: "testItem",
  owner: "",
  ownerDisplayName: "",
  defaultOwner: "",
  defaultOwnerDisplayName: "",
  location: "",
  path: "",
  primaryType: "FILE",
  propertiesModifiedBy: "",
  propertiesModifiedByDisplayName: "",
  propertiesModifiedTimeStamp: "2024-05-04T17:22:59.000Z",
  size: 1,
  state: "ACTIVE",
  createdBy: "",
  createdByDisplayName: "",
  creationTimeStamp: "2024-05-04T17:22:59.000Z",
  id: "unique-id",
  typeId: "1234",
  modifiedBy: "",
  modifiedByDisplayName: "",
  modifiedTimeStamp: "2024-05-04T17:22:59.000Z",
  eTag: "",
  versioned: false,
});

const mockContentFile = (
  repositoryItem: RepositoryItem,
  contentItem: Partial<RepositoryFile> = {},
): RepositoryFile => ({
  digest: "",
  locked: false,
  signingStatus: "NONE",
  fileVersion: null,
  majorVersionLimit: null,
  minorVersionLimit: null,
  contentType: "application/octet-stream",
  fileSize: 123,
  ...repositoryItem,
  ...contentItem,
});

const mockContentContainer = (
  repositoryItem: RepositoryItem,
  contentItem: Partial<RepositoryContainer> = {},
): RepositoryContainer => ({
  defaultMajorVersionLimit: 0,
  defaultMinorVersionLimit: 0,
  defaultOwner: "owner",
  defaultOwnerDisplayName: "Owner (owner)",
  children: null,
  ...repositoryItem,
  ...contentItem,
});

const mockPropertyItem = (
  contentItem: Partial<PropertyItem> = {},
): PropertyItem => ({
  key: "123",
  type: "STRING",
  label: "label",
  value: "value",
  ...contentItem,
});

const createDataProvider = () => {
  const model = new RepositoryModel();
  return new PropertyProvider(model);
};

describe("PropertyProvider", async function () {
  let authStub;
  beforeEach(() => {
    authStub = sinon.stub(authentication, "getSession").resolves({
      accessToken: "12345",
      account: { id: "id", label: "label" },
      id: "id",
      scopes: [],
    });

    axiosInstance = stubInterface<AxiosInstance>();
    axiosInstance.interceptors.response = {
      use: () => null,
      eject: () => null,
      clear: () => null,
    };
    const headerDefaults: HeadersDefaults = {
      common: {
        Authorization: "",
      },
      put: {},
      post: {},
      patch: {},
      delete: {},
      head: {},
      get: {},
    };
    axiosInstance.defaults = {
      headers: headerDefaults as AxiosInstance["defaults"]["headers"],
    };
    stub = sinon.stub(axios, "create").returns(axiosInstance);
  });

  afterEach(() => {
    if (stub) {
      stub.restore();
    }
    authStub.restore();
    axiosInstance = undefined;
  });

  it("getFileProperties - returns the properties for a file", async () => {
    const item: RepositoryFile = mockContentFile(
      mockRepositoryItem(),
      {
        primaryType: "FILE",
        name: "Test-File",
        size: 456,
        locked: true,
        fileVersion: "1.1",
      });

    const dataProvider = createDataProvider();
    dataProvider.setData(item);

    const nameProperty: PropertyItem = mockPropertyItem({
      key: "123",
      label: "Name:",
      value: "Test-File"
    });

    const name = await dataProvider.getTreeItem(nameProperty);
    const expectedName: TreeItem = {
      id: "123",
      label: "Name:",
      description: "Test-File",
    };

    expect(name).to.deep.include(expectedName);

    // A file should have additional properties (size, lock status, version)
    const lockedProperty: PropertyItem = mockPropertyItem({
      key: "123",
      label: "Locked status:",
      value: "Locked"
    });

    const locked = await dataProvider.getTreeItem(lockedProperty);
    const expectdLocked: TreeItem = {
      id: "123",
      label: "Locked status:",
      description: "Locked",
    };

    expect(locked).to.deep.include(expectdLocked);
  });

  it("getContainerProperties - returns the properties for a context", async () => {
    const item: RepositoryContainer = mockContentContainer(
      mockRepositoryItem(),
      {
        primaryType: "CONTEXT",
        name: "Test-Context"
      });
    const dataProvider = createDataProvider();
    dataProvider.setData(item);

    const nameProperty: PropertyItem = mockPropertyItem({
      key: "123",
      value: "Test-Context",
      label: "Name:"
    });
    const name = await dataProvider.getTreeItem(nameProperty);
    const expectedName: TreeItem = {
      id: "123",
      label: "Name:",
      description: "Test-Context",
    };
    expect(name).to.deep.include(expectedName);

    // A context will have state property,
    const stateProperty: PropertyItem = mockPropertyItem({
      key: "123",
      value: "Active",
      label: "State:"
    });
    const state = await dataProvider.getTreeItem(stateProperty);
    const expectedState: TreeItem = {
      id: "123",
      label: "State:",
      description: "Active",
    };
    expect(state).to.deep.include(expectedState);
  });

  it("getFolderProperties - returns the properties for a folder", async () => {
    const item: RepositoryContainer = mockContentContainer(
      mockRepositoryItem(),
      {
        primaryType: "FOLDER",
        name: "Test-Folder"
      });
    const dataProvider = createDataProvider();
    dataProvider.setData(item);

    const data = dataProvider.getChildren();

    const nameProperty: PropertyItem = mockPropertyItem({
      key: "123",
      label: "Name:",
      value: "Test-Folder",
    });
    const name = await dataProvider.getTreeItem(nameProperty);
    const expectedName: TreeItem = {
      id: "123",
      label: "Name:",
      description: "Test-Folder",
    };
    expect(name).to.deep.include(expectedName);

    const stateProperty: PropertyItem = mockPropertyItem({
      key: "456",
      value: "Active",
      label: "State:"
    });

    expect(dataProvider.getChildren()).to.not.include(stateProperty);
  });
});
