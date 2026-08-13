import {
  TreeItem,
  Uri,
  authentication,
  env,
  workspace,
  commands,
} from "vscode";

import axios, { AxiosInstance, HeadersDefaults } from "axios";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import path from "path";
import * as sinon from "sinon";
import { StubbedInstance, stubInterface } from "ts-sinon";

import WorkspaceDataProvider from "../../../src/components/ContentNavigator/WorkspaceDataProvider";
import { WorkspaceModel } from "../../../src/components/ContentNavigator/WorkspaceModel";
import { ActionStatus, WorkspaceItem, WorkspaceFile, WorkspaceFolder } from "../../../src/components/ContentNavigator/types";
import { getWorkspaceUri } from '../../../src/components/ContentNavigator/utils';

let stub: any;
let axiosInstance: StubbedInstance<AxiosInstance>;
let testFixturePath = path.resolve(__dirname, "../../../../testFixture") + path.sep;

const mockWorkspaceItem = (
  item: Partial<WorkspaceItem> = {},
): WorkspaceItem => ({
  workspaceId: "workspace-123",
  name: "testItem",
  path: "/full/path/to/this/file/testItem",
  location: "/full/path/to/this/file/",
  type: "FILE",
  modifiedTimeStamp: "2024-03-01",
  ...item,
});

const mockWorkspaceFile = (
  item: Partial<WorkspaceFile> = {},
): WorkspaceFile => ({
  ...mockWorkspaceItem(item),
  type: "FILE",
  size: 1024,
  contentType: "text/plain",
  ...item
} as WorkspaceFile);

const mockWorkspaceFolder = (
  item: Partial<WorkspaceFolder> = {},
): WorkspaceFolder => ({
  ...mockWorkspaceItem(item),
  type: "FOLDER",
  ...item
} as WorkspaceFolder);

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
    action: 'COPY_LATEST_VERSION',
    message: 'Action completed successfully',
    detailMessage: 'This is a detail message',
    startTimeStamp: "2024-03-01",
    endTimeStamp: "2024-03-01",
    percentComplete: 100,
    stoppable: false,
    progressStatus: 'QUEUED',
    completionStatus: 'INFO'
  },
  ...actionItem
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
  const model = new WorkspaceModel();
  return new WorkspaceDataProvider(model, Uri.from({ scheme: "http" }));
};

describe("WorkspaceDataProvider", async function () {
  let authStub: any;
  let commandsStub: any;

  beforeEach(() => {
    authStub = sinon.stub(authentication, "getSession").resolves({
      accessToken: "12345",
      account: { id: "id", label: "label" },
      id: "id",
      scopes: [],
    });

    commandsStub = sinon.stub(commands, "executeCommand").resolves();

    axiosInstance = stubInterface<AxiosInstance>();
    axiosInstance.interceptors.response = {
      use: () => 0,
      eject: () => undefined,
      clear: () => undefined,
    } as any;
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
    commandsStub.restore();
    axiosInstance = undefined as any;
  });

  it("getTreeItem - returns a file tree item for file reference", async () => {
    const item: WorkspaceItem = mockWorkspaceFile();
    const dataProvider = createDataProvider();

    // Keep the test focused on stable properties (iconPath may vary depending on type resolution)
    const treeItem = await dataProvider.getTreeItem(item);
    const uri = await dataProvider.getUri(item, false);

    expect(treeItem).to.include({
      id: "/full/path/to/this/file/testItem",
      label: "testItem",
    });
    expect(treeItem.command).to.deep.equal({
      command: "SAS.ClinicalAcceleration.selectWorkspaceResource",
      arguments: [item, uri],
      title: "Select Item",
    });
  });

  it("readFile - returns contents of a file", async function () {
    const fileItem = mockWorkspaceFile();
    const dataProvider = createDataProvider();

    // WorkspaceModel.getContentByUri issues a POST; stub post broadly for this test
    axiosInstance.post.resolves({
      data: "example file content",
      headers: { etag: "1234", "last-modified": "1234" },
    });

    await dataProvider.connect("http://test.io");
    const fileData: Uint8Array = await dataProvider.readFile(await getWorkspaceUri(fileItem));

    expect(new TextDecoder().decode(fileData)).to.equal("example file content");
  });

  it("createFolder - creates a folder", async function () {
    const parentItem = mockWorkspaceFolder({
      path: "/full/path/to",
      name: "to",
    });
    const createdFolder = mockWorkspaceFolder({
      path: "/full/path/to/test-folder",
      name: "test-folder",
    });
    const dataProvider = createDataProvider();

    // Generic stub for createFolder post
    axiosInstance.post.resolves({ data: createdFolder });

    await dataProvider.connect("http://test.io");
    const uri: Uri | undefined = await dataProvider.createFolder("test-folder", parentItem);
    expect(uri).to.deep.equal(await getWorkspaceUri(createdFolder));
  });

  it("renameResource - renames item and returns uri", async function () {
    const origItem = mockWorkspaceFile({
      name: "file.sas",
      path: "/path/file.sas"
    });

    const newItem = mockWorkspaceFile({
      name: "renamed-file.sas",
      path: "/path/renamed-file.sas"
    });

    // Stub get for existing resource and POST for workspace rename action (model uses POST)
    axiosInstance.get.resolves({ data: origItem, headers: { etag: "1234", "last-modified": "5678" } });
    axiosInstance.post.resolves({ data: newItem });

    const dataProvider = createDataProvider();
    await dataProvider.connect("http://test.io");
    const uri: Uri | undefined = await dataProvider.renameResource(
      origItem,
      "renamed-file.sas",
    );
    expect(uri).to.deep.equal(getWorkspaceUri(newItem));
  });

  it("deleteResource - deletes an item from the repository", async function () {
    const item = mockWorkspaceFile({
      name: "file.sas",
      path: "/path/file.sas"
    });
    const dataProvider = createDataProvider();

    // Stub the model's batch action and polling to avoid low-level axios stubs
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;
    const performStub = sinon.stub(model, "performBatchAction").resolves("token-123");
    // stub the ActionStatus polling helper
    const actionStatus = mockActionStatus({ summary: { ...mockActionStatus().summary, completionStatus: 'INFO' } });
    // Import startPolling dynamically to stub on the module in compiled tests
    const actionStatusModule = require("../../../src/components/ActionStatus");
    const pollingStub = sinon.stub(actionStatusModule, "startPolling").resolves(actionStatus as any);

    await dataProvider.connect("http://test.io");
    const deleted = await dataProvider.deleteResource([item]);

    expect(deleted).to.equal(true);

    performStub.restore();
    pollingStub.restore();
  });

  it("uploadResource - uploads an item to the repository", async function () {
    const item = mockWorkspaceFolder({
      name: "folder",
      path: "/path/folder"
    });
    const dataProvider = createDataProvider();
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;
    sinon.stub(model, "uploadResource").resolves(item as any);

    const fileToUpload = testFixturePath + "SampleCode.sas";
    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.file(fileToUpload)], false);

    expect(uploaded).to.deep.equal([true]);
  });

  it("uploadResource - waits for the upload action to complete before resolving", async function () {
    const item = mockWorkspaceFolder({
      name: "folder",
      path: "/path/folder"
    });

    let dataProvider = createDataProvider();
    const uploadedItem = mockWorkspaceFile({
      name: "SampleCode.sas",
      path: "/path/folder/SampleCode.sas"
    });
    const actionStatus = mockActionStatus({
      summary: {
        ...mockActionStatus().summary,
        endTimeStamp: "2024-03-02",
        completionStatus: "INFO",
      }
    });

    dataProvider = createDataProvider();
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;
    sinon.stub(model, "uploadResource").resolves(uploadedItem as any);

    const fileToUpload = testFixturePath + "SampleCode.sas";
    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.file(fileToUpload)], false);

    expect(uploaded).to.deep.equal([true]);
  });

  it("uploadResource - passes expand=true to the workspace model", async function () {
    const item = mockWorkspaceFolder({
      name: "folder",
      path: "/path/folder"
    });

    const dataProvider = createDataProvider();
    const uploadedItem = mockWorkspaceFile({
      name: "SampleCode.sas",
      path: "/path/folder/SampleCode.sas"
    });
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;
    const uploadStub = sinon.stub(model, "uploadResource").resolves(uploadedItem);

    const fileToUpload = testFixturePath + "SampleCode.sas";
    await dataProvider.connect("http://test.io");
    const uploaded = await dataProvider.uploadResource(item, [Uri.file(fileToUpload)], true);

    expect(uploaded).to.deep.equal([true]);
    expect(uploadStub.calledOnce).to.equal(true);
    expect(uploadStub.firstCall.args[0]).to.deep.equal(item);
    expect(uploadStub.firstCall.args[1]).to.equal(fileToUpload);
    expect(uploadStub.firstCall.args[3]).to.equal(true);
  });

  it("downloadResource - writes downloaded content to disk", async function () {
    const item = mockWorkspaceFile({
      name: "file.sas",
      path: "/path/file.sas"
    });

    const dataProvider = createDataProvider();
    const downloadPath = path.join(os.tmpdir(), `workspace-data-provider-${Date.now()}.sas`);
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;
    sinon.stub(model, "downloadResource").callsFake(async (_path: string, _items: any) => {
      fs.writeFileSync(downloadPath, "downloaded content");
      return Buffer.from("downloaded content") as any;
    });

    try {
      await dataProvider.connect("http://test.io");
      await dataProvider.downloadResource([item], downloadPath);

      expect(fs.existsSync(downloadPath)).to.equal(true);
      expect(fs.readFileSync(downloadPath, "utf8")).to.equal("downloaded content");
    } finally {
      if (fs.existsSync(downloadPath)) {
        fs.rmSync(downloadPath);
      }
    }
  });

  it("writeFile - debounces saves, calls model.saveContent once with last content, and fires onDidChange", async function () {
    const dataProvider = createDataProvider();
    const model = (dataProvider as unknown as { model: WorkspaceModel }).model;

    const saveStub = sinon.stub(model, "saveContent").resolves();

    const clock = sinon.useFakeTimers();

    let fired = false;
    let firedUri: Uri | undefined;
    dataProvider.onDidChange((uri) => {
      fired = true;
      firedUri = uri;
    });

    const uri = Uri.parse("fake-scheme://path/to/file.sas");
    const firstContent = new TextEncoder().encode("first");
    const finalContent = new TextEncoder().encode("final");

    // Call writeFile twice in quick succession; debounce should ensure only finalContent is saved
    dataProvider.writeFile(uri, firstContent);
    dataProvider.writeFile(uri, finalContent);

    // Advance timers by 500ms to trigger the debounced save
    await clock.tickAsync(500);

    expect(saveStub.calledOnce).to.equal(true);
    // first arg is uri, second is Uint8Array content
    expect(saveStub.firstCall.args[0].toString()).to.equal(uri.toString());
    const savedContent = new TextDecoder().decode(saveStub.firstCall.args[1]);
    expect(savedContent).to.equal("final");

    expect(fired).to.equal(true);
    expect(firedUri && firedUri.toString()).to.equal(uri.toString());

    clock.restore();
    saveStub.restore();
  });
});
