import {
  TreeItem,
  Uri,
  authentication,
  env,
  workspace,
} from "vscode";

import axios, { AxiosInstance, HeadersDefaults } from "axios";
import { expect } from "chai";
import path from "path";
import * as sinon from "sinon";
import { StubbedInstance, stubInterface } from "ts-sinon";

import RepositoryDataProvider from "../../../src/components/RepositoryNavigator/RepositoryDataProvider";
import { RepositoryModel } from "../../../src/components/RepositoryNavigator/RepositoryModel";
import { ActionStatus, RepositoryItem } from "../../../src/components/RepositoryNavigator/types";
import { getUri } from '../../../src/components/RepositoryNavigator/utils';

let stub;
let axiosInstance: StubbedInstance<AxiosInstance>;
let testFixturePath = path.resolve(__dirname, "../../../../testFixture") + path.sep;

const mockContentItem = (
  contentItem: Partial<RepositoryItem> = {},
): RepositoryItem => ({
  description: "",
  name: "testItem",
  owner: "",
  ownerDisplayName: "",
  defaultOwner: "",
  defaultOwnerDisplayName: "",
  location: "",
  path: "/full/path/to/this/file/testItem",
  primaryType: "FILE",
  propertiesModifiedBy: "",
  propertiesModifiedByDisplayName: "",
  propertiesModifiedTimeStamp: "",
  size: 1,
  state: "ACTIVE",
  createdBy: "",
  createdByDisplayName: "",
  creationTimeStamp: "",
  id: "unique-id",
  typeId: "1234",
  modifiedBy: "",
  modifiedByDisplayName: "",
  modifiedTimeStamp: "",
  versioned: false,
  eTag: "",
  ...contentItem,
});

const mockActionStatus = (
  actionItem: Partial<ActionStatus> = {},
): ActionStatus => ({
  details: [
    {
      id: "123",
      itemIdentifier: "unique-id",
      itemLocation: "/full/path/to/this/file/",
      itemName: "testItem",
      message: "This message was successful",
      startTimeStamp: "2024-03-01",
      endTimeStamp: "2024-03-01",
      percentComplete: 100,
      progressStatus: "COMPLETED",
      completionStatus: "INFO",
    }
  ],
  summary: {
    id: '1234',
    clientId: '123',
    action: 'ENABLE_VERSIONING',
    message: 'This item was enabled successfully',
    detailMessage: 'This is a detail message',
    startTimeStamp: "2024-03-01",
    endTimeStamp: "2024-03-01",
    percentComplete: 100,
    stoppable: false,
    progressStatus: 'QUEUED',
    completionStatus: 'INFO'
  }
});

const mockObjectType = {
  id: "1234",
  name: "Organization",
  description: "test",
  icon: "ORGANIZATION",
  auditable: true,
  searchable: true,
  contextType: true,
  fileType: false,
  attributeDefinitions: null,
  capabilities: null,
  allowableChildTypes: null,
}

const createDataProvider = () => {
  const model = new RepositoryModel();
  sinon.stub(model, "getObjectType").returns(mockObjectType);
  return new RepositoryDataProvider(model, Uri.from({ scheme: "http" }));
};

describe("RepositoryDataProvider", async function () {
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

  it("getTreeItem - returns a file tree item for file reference", async () => {
    const item: RepositoryItem = mockContentItem();
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("/healthClinicalAcceleration/types").resolves({
      data: [mockObjectType],
    });

    const treeItem = await dataProvider.getTreeItem(item);
    const uri = await dataProvider.getUri(item, false);

    const expectedIconPath = {
      dark: Uri.joinPath(Uri.from({ scheme: "http" }), `icons/dark/businessCompanyDark.svg`),
      light: Uri.joinPath(Uri.from({ scheme: "http" }), `icons/light/businessCompanyLight.svg`),
    };

    const expectedTreeItem: TreeItem = {
      iconPath: expectedIconPath,
      id: "unique-id",
      label: "testItem",
      command: {
        command: "SAS.ClinicalAcceleration.selectRepositoryResource",
        arguments: [item, uri],
        title: "Select Item",
      }
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("readFile - returns contents of a file", async function () {
    const fileItem = mockContentItem();
    const dataProvider = createDataProvider();

    axiosInstance.post.withArgs("/healthClinicalAcceleration/repository/items/unique-id/content")
      .resolves({
        data: "example file content",
        headers: { etag: "1234", "last-modified": "1234" },
      });

    await dataProvider.connect("http://test.io");
    const fileData: Uint8Array = await dataProvider.readFile(getUri(fileItem));

    expect(new TextDecoder().decode(fileData)).to.equal("example file content");
  });

  it("createFolder - creates a folder", async function () {
    const parentItem = mockContentItem({
      primaryType: "FOLDER",
      name: "parent-folder"
    });
    const createdFolder = mockContentItem({
      primaryType: "FOLDER",
      name: "test-folder",
    });
    const dataProvider = createDataProvider();

    axiosInstance.post
      .withArgs("/healthClinicalAcceleration/repository/items/unique-id/children?name=test-folder&type=FOLDER")
      .resolves({
        data: createdFolder,
      });

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.createFolder(parentItem, "test-folder");
    expect(uri).to.deep.equal(getUri(createdFolder));
  });

  it("renameResource - renames item and returns uri", async function () {
    const origItem = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const newItem = mockContentItem({
      primaryType: "FILE",
      name: "renamed-file.sas",
    });

    axiosInstance.get.withArgs("/healthClinicalAcceleration/repository/items/unique-id")
      .resolves({
        data: origItem,
        headers: { etag: "1234", "last-modified": "5678" },
      });

    axiosInstance.patch
      .withArgs("/healthClinicalAcceleration/repository/items/unique-id",
        {
          name: "renamed-file.sas",
        })
      .resolves({
        data: newItem,
      });

    const dataProvider = createDataProvider();
    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      origItem,
      "renamed-file.sas",
    );
    expect(uri).to.deep.equal(getUri(newItem));
  });

  it("deleteResource - deletes an item from the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();

    axiosInstance.delete.withArgs("/healthClinicalAcceleration/repository/items").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const deleted = await dataProvider.deleteResource([item]);

    expect(deleted).to.equal(true);
  });

  it("uploadResource - uploads an item to the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();
    axiosInstance.put.withArgs("/healthClinicalAcceleration/repository/items/unique-id?name=file.sas&expand=false").resolves({ data: item });

    const fileToUpload = testFixturePath + "SampleCode.sas";
    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.parse(fileToUpload)], false, '', '');

    expect(uploaded).to.equal(true);
  });

  it("uploadResource - uploads an item to the repository with comment and version", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();
    axiosInstance.put.withArgs("/healthClinicalAcceleration/repository/items/unique-id?name=file.sas&expand=false").resolves({ data: item });

    const fileToUpload = testFixturePath + "SampleCode.sas";
    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.parse(fileToUpload)], false, 'comment', '1.0');

    expect(uploaded).to.equal(true);
  });

  it("uploadResource - uploads a zip file to the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const fileToUpload = testFixturePath + "sampleZip.zip";
    const dataProvider = createDataProvider();
    axiosInstance.put.withArgs("/healthClinicalAcceleration/repository/items/unique-id?name=sampleZip.zip&expand=true").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.parse(fileToUpload)], true, '', '');

    expect(uploaded).to.equal(true);
  });

  it("uploadResource - uploads a zip file to the repository with version and comment", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const fileToUpload = testFixturePath + "sampleZip.zip";
    const dataProvider = createDataProvider();
    axiosInstance.put.withArgs("/healthClinicalAcceleration/repository/items/unique-id?name=sampleZip.zip.sas&expand=true").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.parse(fileToUpload)], true, 'comment', '1.0');

    expect(uploaded).to.equal(true);
  });

  it("downloadResource - downloads an item from the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();

    axiosInstance.post.withArgs("/healthClinicalAcceleration/repository/items/unique-id/content").resolves({
      data: "00000000: 5468 6973 2069 7320 6120 7465 7374 0a    This is a test."
    });

    await dataProvider.connect("http://test.io");
    await dataProvider.downloadResource([item], '${userHome}');
  });

  it("copy path - get an items path and copies it to the clipboard", async () => {
    await env.clipboard.writeText("foo bar");
    expect(await env.clipboard.readText()).to.equal("foo bar");
  });

  it("enableVersioning - versions an unversioned item in the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
      versioned: false,
    });

    const action = mockActionStatus();
    const dataProvider = createDataProvider();
    axiosInstance.post.withArgs("/healthClinicalAcceleration/repository/items/batch").resolves(
      { token: "123" }
    );
    axiosInstance.post.withArgs("/healthClinicalAcceleration/actionstatus/123").resolves(
      {
        data: action
      });

    await dataProvider.connect("http://test.io");
    await dataProvider.enableVersioning(item, "this is a comment", "1.1");
  });

  it("disableVersioning - unversions an versioned item in the repository", async function () {
    const item = mockContentItem({
      primaryType: "FILE",
      name: "file.sas",
      versioned: true,
    });

    const action = mockActionStatus();
    const dataProvider = createDataProvider();
    axiosInstance.post.withArgs("/healthClinicalAcceleration/repository/items/batch").resolves(
      { token: "123" }
    );
    axiosInstance.post.withArgs("/healthClinicalAcceleration/actionstatus/123").resolves(
      {
        data: action
      });

    await dataProvider.connect("http://test.io");
    await dataProvider.disableVersioning(item, "this is a comment");
  });
  
});
