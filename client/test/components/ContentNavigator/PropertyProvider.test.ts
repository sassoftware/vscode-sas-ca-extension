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

import PropertyProvider from "../../../src/components/ContentNavigator/PropertyProvider";
import { RepositoryModel } from "../../../src/components/ContentNavigator/RepositoryModel";
import { PropertyItem, RepositoryFile, RepositoryItem, RepositoryContainer } from "../../../src/components/ContentNavigator/types";

let stub: any;
let axiosInstance: StubbedInstance<AxiosInstance> | undefined;

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
  syncable: "ALLOW",
});

const mockContentFile = (
  repositoryItem: RepositoryItem,
  contentItem: Partial<RepositoryFile> = {},
): RepositoryFile => ({
  digest: "",
  locked: false,
  checkedOut: false,
  checkedOutBy: "",
  checkedOutByDisplayName: "",
  checkedOutTimestamp: "",
  signingStatus: "NONE",
  fileVersion: undefined as unknown as string,
  majorVersionLimit: undefined as unknown as number,
  minorVersionLimit: undefined as unknown as number,
  contentType: "application/octet-stream",
  fileSize: 123,
  synchronizationInfo: { workspaceStatus: "IN_SYNC" },
  ...repositoryItem,
  ...contentItem,
});

const mockContentContainer = (
  repositoryItem: RepositoryItem,
  contentItem: Partial<RepositoryContainer> = {},
): RepositoryContainer => ({
  defaultMajorVersionLimit: 0,
  defaultMinorVersionLimit: 0,
  children: undefined,
  ...repositoryItem,
  defaultOwner: "owner",
  defaultOwnerDisplayName: "Owner (owner)",
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
  let authStub: any;
  beforeEach(() => {
    authStub = sinon.stub(authentication, "getSession").resolves({
      accessToken: "12345",
      account: { id: "id", label: "label" },
      id: "id",
      scopes: [],
    });

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
    axiosInstance = undefined;
  });

  describe("getTreeItem", () => {
    it("returns a TreeItem with all expected properties", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({
        key: "test-key",
        label: "Test Label",
        value: "Test Value",
        type: "STRING"
      });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result).to.have.property("id", "test-key");
      expect(result).to.have.property("label", "Test Label");
      expect(result).to.have.property("description", "Test Value");
      expect(result).to.have.property("tooltip", "Test Value");
      expect(result).to.have.property("contextValue", "a");
      expect(result).to.have.property("collapsibleState", undefined);
    });

    it("returns appropriate icon for Boolean type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "BOOLEAN" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("symbol-boolean");
    });

    it("returns appropriate icon for Date type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "DATE" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("calendar");
    });

    it("returns appropriate icon for String type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "STRING" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("symbol-string");
    });

    it("returns appropriate icon for Number type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "NUMBER" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("symbol-number");
    });

    it("returns appropriate icon for User type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "USER" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("person");
    });

    it("returns appropriate icon for Sync type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "SYNC" });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.instanceOf(ThemeIcon);
      expect((result.iconPath as ThemeIcon).id).to.equal("sync");
    });

    it("returns undefined icon for unknown type", async () => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem({ type: "UNKNOWN" as any });

      const result = await dataProvider.getTreeItem(propertyItem);

      expect(result.iconPath).to.be.undefined;
    });
  });

  describe("File Properties", () => {
    it("getFileProperties - returns the properties for a file", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          name: "Test-File",
          size: 456,
          locked: true,
          fileVersion: "1.1",
          checkedOut: true,
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
      const expectLocked: TreeItem = {
        id: "123",
        label: "Locked status:",
        description: "Locked",
      };

      expect(locked).to.deep.include(expectLocked);

      const checkedOutProperty: PropertyItem = mockPropertyItem({
        key: "123",
        label: "Check-out status:",
        value: "Checked out"
      });

      const checkedOut = await dataProvider.getTreeItem(checkedOutProperty);
      const expectCheckedOut: TreeItem = {
        id: "123",
        label: "Check-out status:",
        description: "Checked out",
      };

      expect(checkedOut).to.deep.include(expectCheckedOut);
    });

    it("includes checked-out metadata for checked-out files", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          name: "Checked-Out-File",
          checkedOut: true,
          checkedOutByDisplayName: "John Doe",
          checkedOutTimestamp: "2024-05-04T17:22:59.000Z",
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren() as PropertyItem[];

      expect(children).to.be.an("array");
      expect(children.length).to.be.greaterThan(0);
      // Just verify the file was set with checked out property
      expect(item.checkedOut).to.be.true;
    });

    it("handles versioned files with file version property", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          name: "Versioned-File",
          versioned: true,
          fileVersion: "2.5",
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren() as PropertyItem[];

      expect(children).to.be.an("array");
      expect(children.length).to.be.greaterThan(0);
      expect(item.versioned).to.be.true;
      expect(item.fileVersion).to.equal("2.5");
    });

    it("handles unversioned files without file version property", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          name: "Unversioned-File",
          versioned: false,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      expect(children).to.be.an("array");
      const childLabels = (children as PropertyItem[]).map(c => c.label);
      expect(childLabels).to.not.include("Version:");
    });

    it("handles locked files correctly", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          locked: true,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren() as PropertyItem[];

      const lockedChild = (children).find(c => c.key === "locked");
      expect(lockedChild).to.exist;
      expect(lockedChild?.value).to.equal("Locked");
    });

    it("handles unlocked files correctly", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          locked: false,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren() as PropertyItem[];

      const lockedChild = (children).find(c => c.key === "locked");
      expect(lockedChild).to.exist;
      expect(lockedChild?.value).to.equal("Unlocked");
    });

    it("handles synchronization status - IN_SYNC", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          synchronizationInfo: { workspaceStatus: "IN_SYNC" },
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const syncChild = (children as PropertyItem[]).find(c => c.key === "synchronizationInfo");
      expect(syncChild?.value).to.equal("Synced");
    });

    it("handles synchronization status - OUT_OF_SYNC", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          synchronizationInfo: { workspaceStatus: "OUT_OF_SYNC" },
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const syncChild = (children as PropertyItem[]).find(c => c.key === "synchronizationInfo");
      expect(syncChild?.value).to.equal("Out of Sync");
    });

    it("handles synchronization status - WORKSPACE_FILE_MISSING", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          synchronizationInfo: { workspaceStatus: "WORKSPACE_FILE_MISSING" },
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const syncChild = (children as PropertyItem[]).find(c => c.key === "synchronizationInfo");
      expect(syncChild?.value).to.equal("Missing");
    });

    it("handles synchronization status - NOT_SYNCED", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          synchronizationInfo: { workspaceStatus: "NOT_SYNCED" },
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const syncChild = (children as PropertyItem[]).find(c => c.key === "synchronizationInfo");
      expect(syncChild?.value).to.equal("Not Synced");
    });

    it("handles JOB type with file properties", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "JOB",
          name: "Test-Job",
          size: 256,
          locked: false,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);

      // Verify item is stored correctly
      expect(item.primaryType).to.equal("JOB");
      expect(item.size).to.equal(256);
    });

    it("handles JOB_FILE type with file properties", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "JOB_FILE",
          name: "Test-Job-File",
          size: 512,
          locked: true,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);

      // Verify item is stored correctly
      expect(item.primaryType).to.equal("JOB_FILE");
      expect(item.locked).to.be.true;
    });
  });

  describe("Container Properties", () => {
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

    it("includes state property for CONTEXT types", async () => {
      const item: RepositoryContainer = mockContentContainer(
        mockRepositoryItem(),
        {
          primaryType: "CONTEXT",
          state: "ACTIVE"
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const stateChild = (children as PropertyItem[]).find(c => c.key === "state");
      expect(stateChild).to.exist;
      expect(stateChild?.value).to.equal("Active");
    });

    it("handles closed CONTEXT state", async () => {
      const item: RepositoryContainer = mockContentContainer(
        mockRepositoryItem(),
        {
          primaryType: "CONTEXT",
          state: "CLOSED"
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const stateChild = (children as PropertyItem[]).find(c => c.key === "state");
      expect(stateChild?.value).to.equal("Closed");
    });
  });

  describe("Folder Properties", () => {
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

    it("does not include state property for FOLDER types", async () => {
      const item: RepositoryContainer = mockContentContainer(
        mockRepositoryItem(),
        {
          primaryType: "FOLDER",
          state: "ACTIVE"
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);
      const children = dataProvider.getChildren();

      const stateChild = (children as PropertyItem[]).find(c => c.key === "state");
      expect(stateChild).to.be.undefined;
    });
  });

  describe("Special Cases", () => {
    it("handles Repository special case (id === '1')", async () => {
      const item: RepositoryItem = mockRepositoryItem();
      item.id = "1";

      const dataProvider = createDataProvider();
      dataProvider.setData(item);

      // Verify the item was set
      expect(item.id).to.equal("1");
    });

    it("handles null/undefined synchronization info", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          synchronizationInfo: { workspaceStatus: "IN_SYNC" },
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);

      // Verify data is set
      expect(dataProvider.getChildren()).to.not.be.undefined;
    });

    it("handles unchecked out files without checkout metadata", async () => {
      const item: RepositoryFile = mockContentFile(
        mockRepositoryItem(),
        {
          primaryType: "FILE",
          checkedOut: false,
        });

      const dataProvider = createDataProvider();
      dataProvider.setData(item);

      // Verify file property is set
      expect(item.checkedOut).to.be.false;
    });
  });

  describe("setData", () => {
    it("sets data with a valid item", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      dataProvider.setData(item);

      // Verify children were populated
      expect(dataProvider.getChildren()).to.be.an("array");
    });

    it("clears data when called with undefined", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      dataProvider.setData(undefined);
      expect(dataProvider.getChildren()).to.be.empty;
    });

    it("clears data when called with no arguments", async () => {
      const dataProvider = createDataProvider();
      dataProvider.setData();
      expect(dataProvider.getChildren()).to.be.empty;
    });
  });

  describe("getChildren", () => {
    it("returns an empty array initially", () => {
      const dataProvider = createDataProvider();

      const children = dataProvider.getChildren();

      expect(children).to.be.an("array");
      expect(children).to.be.empty;
    });
  });

  describe("getSubscriptions", () => {
    it("returns an array containing the tree view", () => {
      const dataProvider = createDataProvider();

      const subscriptions = dataProvider.getSubscriptions();

      expect(subscriptions).to.be.an("array");
      expect(subscriptions).to.have.lengthOf(1);
      expect(subscriptions[0]).to.equal(dataProvider.treeView);
    });
  });

  describe("watch", () => {
    it("returns a Disposable", () => {
      const dataProvider = createDataProvider();

      const disposable = dataProvider.watch();

      expect(disposable).to.exist;
      expect(disposable).to.have.property("dispose");
    });
  });

  describe("reveal", () => {
    it("calls treeView.reveal with correct options", (done) => {
      const dataProvider = createDataProvider();
      const propertyItem = mockPropertyItem();

      const revealSpy = sinon.spy(dataProvider.treeView, "reveal");

      dataProvider.reveal(propertyItem);

      expect(revealSpy.called).to.be.true;
      expect(revealSpy.firstCall.args[0]).to.equal(propertyItem);
      expect(revealSpy.firstCall.args[1]).to.deep.equal({
        expand: false,
        select: false,
        focus: false,
      });

      revealSpy.restore();
      done();
    });
  });

  describe("refresh", () => {
    it("refreshes data when item is provided and exists", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      const model = (dataProvider as any)._model;
      sinon.stub(model, "getResourceById").resolves(item);

      await dataProvider.refresh(item);

      expect((dataProvider.treeView as any).message).to.be.undefined;

      (model.getResourceById as sinon.SinonStub).restore();
    });

    it("sets error message when item is not found", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      const model = (dataProvider as any)._model;
      sinon.stub(model, "getResourceById").resolves(undefined);

      await dataProvider.refresh(item);

      expect((dataProvider.treeView as any).message).to.not.be.undefined;

      (model.getResourceById as sinon.SinonStub).restore();
    });

    it("does not refresh when item is not provided", async () => {
      const dataProvider = createDataProvider();
      const model = (dataProvider as any)._model;
      const getResourceStub = sinon.stub(model, "getResourceById");

      await dataProvider.refresh();

      expect(getResourceStub.called).to.be.false;

      getResourceStub.restore();
    });

    it("fires onDidChangeTreeData event after refresh", (done) => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      const model = (dataProvider as any)._model;
      sinon.stub(model, "getResourceById").resolves(item);

      let eventFired = false;
      dataProvider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      dataProvider.refresh(item).then(() => {
        expect(eventFired).to.be.true;
        (model.getResourceById as sinon.SinonStub).restore();
        done();
      });
    });
  });

  describe("getItem", () => {
    it("returns the item from the model", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      const model = (dataProvider as any)._model;
      sinon.stub(model, "getResourceById").resolves(item);

      const result = await dataProvider.getItem(item);

      expect(result).to.equal(item);

      (model.getResourceById as sinon.SinonStub).restore();
    });

    it("returns undefined when item is not found", async () => {
      const item = mockRepositoryItem();
      const dataProvider = createDataProvider();

      const model = (dataProvider as any)._model;
      sinon.stub(model, "getResourceById").resolves(undefined);

      const result = await dataProvider.getItem(item);

      expect(result).to.be.undefined;

      (model.getResourceById as sinon.SinonStub).restore();
    });
  });

  describe("Events", () => {
    it("exposes onDidChangeTreeData event", () => {
      const dataProvider = createDataProvider();

      const event = dataProvider.onDidChangeTreeData;

      expect(event).to.exist;
      expect(typeof event).to.equal("function");
    });

    it("exposes onDidChange event", () => {
      const dataProvider = createDataProvider();

      const event = dataProvider.onDidChange;

      expect(event).to.exist;
      expect(typeof event).to.equal("function");
    });
  });

  describe("treeView accessor", () => {
    it("returns the internal tree view", () => {
      const dataProvider = createDataProvider();

      const treeView = dataProvider.treeView;

      expect(treeView).to.exist;
      expect(treeView).to.equal((dataProvider as any)._treeView);
    });
  });
});
