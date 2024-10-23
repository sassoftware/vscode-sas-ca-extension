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

import VersionHistoryProvider from "../../../src/components/RepositoryNavigator/VersionHistoryProvider";
import { RepositoryModel } from "../../../src/components/RepositoryNavigator/RepositoryModel";
import { RepositoryFile, RepositoryItem, VersionHistoryItem, VersionHistoryResponse, } from "../../../src/components/RepositoryNavigator/types";
import { getVersionUri } from '../../../src/components/RepositoryNavigator/utils';

let stub;
let axiosInstance: StubbedInstance<AxiosInstance>;

const mockVersionHistoryItem = (
  contentItem: Partial<VersionHistoryResponse> = {},
): VersionHistoryItem => ({
  path: "/path/to/file",
  fileId: "unique-id",
  versionId: "5",
  fileVersion: "1.1",
  comment: "comment",
  createdBy: "owner",
  createdByDisplayName: "Owner (owner)",
  creationTimeStamp: 123456,
  size: 123,
  latest: true,
  signed: false,
  name: "fileName",
  ...contentItem,
});

const mockRepositoryItem = (): RepositoryItem => ({
  id: "unique-id",
  name: "testItem",
  primaryType: "FILE",
  description: "",
  owner: "",
  ownerDisplayName: "",
  defaultOwner: "",
  defaultOwnerDisplayName: "",
  location: "",
  path: "",
  propertiesModifiedBy: "",
  propertiesModifiedByDisplayName: "",
  propertiesModifiedTimeStamp: "2024-05-04T17:22:59.000Z",
  size: 1,
  state: "ACTIVE",
  createdBy: "",
  createdByDisplayName: "",
  creationTimeStamp: "2024-05-04T17:22:59.000Z",
  typeId: "1234",
  modifiedBy: "",
  modifiedByDisplayName: "",
  modifiedTimeStamp: "2024-05-04T17:22:59.000Z",
  eTag: "",
  versioned: false,
});

const mockRepositoryFile = (
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

const createDataProvider = () => {
  const model = new RepositoryModel();
  return new VersionHistoryProvider(model, Uri.from({ scheme: "http" }));
};

describe("VersionHistoryProvider", async function () {
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

  it("getVersionHistory - show the version for a mocked item", async () => {
    const item: VersionHistoryItem = mockVersionHistoryItem();
    const file: RepositoryFile = mockRepositoryFile(
      mockRepositoryItem(),
      {
        name: "Test-File",
        size: 456,
        fileVersion: "1.1",
      });

    const dataProvider = createDataProvider();
    axiosInstance.get.withArgs("/clinicalRepository/repository/items/unique-id/versions/1.1").resolves({
      data: file,
    });

    await dataProvider.connect("http://test.io");
    const treeItem = await dataProvider.getTreeItem(item);
    const markdownText = await dataProvider.getMarkdownText(item.fileId, item.fileVersion, item.comment);

    const expectedTreeItem: TreeItem = {
      iconPath: new ThemeIcon('git-commit'),
      contextValue: "version",
      id: item.fileId + "--" + item.fileVersion,
      label: "v" + item.fileVersion,
      description: item.comment,
      collapsibleState: undefined,
      tooltip: markdownText,
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("readVersionFile - returns contents of a versioned file", async function () {
    const item = mockVersionHistoryItem();
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("/clinicalRepository/repository/items/unique-id/versions/1.1/content").resolves({
      data: "versioned file content",
      headers: { etag: "1234", "last-modified": "1234" },
    });

    await dataProvider.connect("http://test.io");
    const fileData: Uint8Array = await dataProvider.readFile(getVersionUri(item));

    expect(new TextDecoder().decode(fileData)).to.equal("versioned file content");
  });

  it("downloadResource - downloads an item from the repository", async function () {
    const item = mockVersionHistoryItem();

    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("/clinicalRepository/repository/items/versions/1.1/content").resolves({
      data: "00000000: 5468 6973 2069 7320 6120 7465 7374 0a    This is a test."
    });

    await dataProvider.connect("http://test.io");
    await dataProvider.downloadResource(item, '${userHome}');
  });
});
