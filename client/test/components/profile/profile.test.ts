import { ConfigurationTarget, workspace } from "vscode";

import { assert, expect } from "chai";

import {
  AuthType,
  ConnectionType,
  EXTENSION_CONFIG_KEY,
  EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
  ProfileConfig,
  ProfilePromptType,
  ViyaProfile,
  getProfilePrompt,
} from "../../../src/components/profile";

let testProfileName: string;
let testProfileNewName: string;
let profileConfig: ProfileConfig;
let testProfileClientId;
let testOverloadedProfile;
let testEmptyProfile;
let testEmptyItemsProfile;
let legacyProfile;

async function initProfile(): Promise<void> {
  profileConfig = new ProfileConfig();
}

describe("Profiles", async function () {
  before(async () => {
    workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        undefined,
        ConfigurationTarget.Global,
      );
    testProfileClientId = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          connectionType: "rest",
        },
      },
    };
    testEmptyProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {},
      },
    };
    testEmptyItemsProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "",
          context: "",
          clientId: "",
          clientSecret: "",
        },
      },
    };
    testOverloadedProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          username: "sastest",
          tokenFile: "path/to/token.txt",
          connectionType: "rest",
        },
      },
    };
  });

  afterEach(async () => {
    if (testProfileName) {
      testProfileName = "";
    }
    if (testProfileNewName) {
      testProfileNewName = "";
    }
  });

  describe("Legacy Profile", async function () {
    beforeEach(async () => {
      initProfile();
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          legacyProfile,
          ConfigurationTarget.Global,
        );
    });

    this.afterEach(async () => {
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          undefined,
          ConfigurationTarget.Global,
        );
    });

    it("adds connectionType to legacy profiles", async () => {
      profileConfig.migrateLegacyProfiles();

      const profiles = profileConfig.getAllProfiles();
      expect(Object.keys(profiles).length).to.be.greaterThan(0);

      for (const key in profiles) {
        const profile = profiles[key];
        if (profile.connectionType === undefined) {
          assert.fail(`Found undefined connectionType in profile named ${key}`);
        }
      }
    });

    it("removes trailing slash from endpoint on legacy profiles", async () => {
      profileConfig.migrateLegacyProfiles();

      const profiles = profileConfig.getAllProfiles();
      expect(Object.keys(profiles).length).to.be.greaterThan(0);

      for (const key in profiles) {
        const profile = profiles[key];
        if (
          profile.connectionType === ConnectionType.Rest &&
          /\/$/.test(profile.endpoint)
        ) {
          assert.fail(
            `Found trailing slash in endpoint of profile named ${key}`,
          );
        }
      }
    });

    it("fails to validate missing connectionType", async () => {
      const profileByName = profileConfig.getProfileByName("testViyaProfile");
      const validateProfile = profileConfig.validateProfile({
        name: testProfileName,
        profile: profileByName,
      });

      expect(validateProfile.data).to.equal(undefined);
      expect(validateProfile.type).to.equal(
        AuthType.Error,
        "legacy profile did not return correct AuthType",
      );
      expect(validateProfile.error).to.equal(
        "Missing connectionType in active profile.",
        "should return messing connectionType error",
      );
    });
  });

  describe("No Profile", async function () {
    beforeEach(async () => {
      testProfileNewName = "testProfile";
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("validate initial state", async function () {
        const profileLen = profileConfig.length();
        expect(profileLen).to.equal(0, "No profiles should exist");
      });

      it("add a new viya profile", async function () {
        profileConfig.upsertProfile(testProfileNewName, {
          connectionType: ConnectionType.Rest,
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(
          1,
          "A single profile should be in the list",
        );

        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`,
        );
      });
    });
  });

  describe("ClientId/Secret Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      initProfile();
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testProfileClientId,
          ConfigurationTarget.Global,
        );
    });

    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        profileConfig.upsertProfile(testProfileNewName, {
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
          connectionType: ConnectionType.Rest,
        });
        const profilesList = profileConfig.listProfile();
        expect(profilesList).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profilesList).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`,
        );
        expect(profilesList).to.include(
          testProfileName,
          `Profile ${testProfileName} should exist`,
        );
      });

      it("delete a profile", async function () {
        profileConfig.deleteProfile(testProfileName);
        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("list the expected profiles", async function () {
        const profileList = profileConfig.listProfile();
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist",
        );
      });

      it("get profile by name", async function () {
        const testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);
        expect(testProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Host is not matching",
        );
        expect(testProfile.clientId).to.equal(
          "sas.test",
          "Client ID is not matching",
        );
        expect(testProfile.clientSecret).to.equal(
          "",
          "Client Secret is not matching",
        );
        expect(testProfile.context).to.equal(
          "SAS Studio context",
          "Compute Context is not matching",
        );
      });

      it("update single element of the profile", async function () {

        let testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);
        testProfile.endpoint = "https://test2-host.sas.com";
        profileConfig.upsertProfile(testProfileName, testProfile);
        testProfile = profileConfig.getProfileByName(testProfileName);

        expect(testProfile.endpoint).to.equal("https://test2-host.sas.com");
        expect(testProfile.clientId).to.equal("sas.test");
        expect(testProfile).to.not.have.any.keys("tokenFile");
      });
    });

    describe("Validate Profile", async function () {
      it("set active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);

        const testProfile = profileConfig.getActiveProfile();
        expect(testProfileName).to.equal(
          testProfile,
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Active profile endpoint not expected",
        );
      });

      it("validate client id/secret profile", async function () {
        const profileByName = profileConfig.getProfileByName(testProfileName);
        const validateProfile = profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.AuthCode,
          "client id/secret profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "",
          "client id/secret profile should not return error",
        );
      });
    });
  });

  describe("Empty File Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      initProfile();
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testEmptyProfile,
          ConfigurationTarget.Global,
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        const newProfile: ViyaProfile = {
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
          connectionType: ConnectionType.Rest,
        };
        profileConfig.upsertProfile(testProfileNewName, newProfile);
        const profiles = profileConfig.listProfile();

        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list",
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`,
        );
      });

      it("delete a profile", async function () {
        profileConfig.deleteProfile(testProfileName);

        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        const testProfile: ViyaProfile =
          profileConfig.getProfileByName(testProfileName);

        expect(testProfile.endpoint).to.equal(
          undefined,
          "Host is not matching",
        );
        expect(testProfile.context).to.equal(
          undefined,
          "Compute Context is not matching",
        );
      });

      it("list the expected profiles", async function () {
        const profileList = profileConfig.listProfile();
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist",
        );
      });

      it("update single element of the profile", async function () {
        const newProfileSetting = testEmptyProfile;
        newProfileSetting.profiles[testProfileName].endpoint =
          "https://test2-host.sas.com";
        workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            newProfileSetting,
            ConfigurationTarget.Global,
          );
        let testProfile = profileConfig.getProfileByName(testProfileName);
        expect(testProfile.endpoint).to.equal("https://test2-host.sas.com");
      });
    });

    describe("Validate Profiles", async function () {
      it("validate no active profile when only name sent in", async function () {
        const validateProfile = profileConfig.validateProfile({
          name: testProfileName,
          profile: undefined,
        });

        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "No active profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "No Active Profile",
          "No active profile did not return error",
        );
      });

      it("get active profile when no profile active", async function () {
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        expect(activeProfile).to.be.equal(
          undefined,
          "No active profile should be found",
        );
      });
    });
  });

  describe("Overloaded Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      initProfile();
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testOverloadedProfile,
          ConfigurationTarget.Global,
        );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfile = profileConfig.getActiveProfile();

        expect(activeProfile).to.equal(
          testProfileName,
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "https://test-host.sas.com",
          "Active profile endpoint not expected",
        );
      });

      it("validate overloaded file profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Overloaded file should take authcode as precedence
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.AuthCode,
          "validate overloaded file profile did not return correct AuthType",
        );
        expect(validateProfile.error).to.equal(
          "",
          "validate overloaded file profile should not return error",
        );
      });
    });
  });


  describe("Empty Item Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      initProfile();
      workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testEmptyItemsProfile,
          ConfigurationTarget.Global,
        );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);
        const testProfile = profileConfig.getActiveProfile();

        expect(testProfile).to.equal(
          testProfileName,
          "Active profile not successfully set",
        );
      });

      it("get active profile", async function () {
        profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile: ViyaProfile =
          profileConfig.getProfileByName(activeProfileName);

        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set",
        );
        expect(activeProfile.endpoint).to.equal(
          "",
          "Active profile endpoint not expected",
        );
      });
    });
  });

  describe("Viya Input Prompts", async function () {
    it("Valid Profile Input", function () {
      const result = getProfilePrompt(ProfilePromptType.Profile);

      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "Switch Current SAS Profile",
        "Profile title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Select a SAS connection profile",
        "Profile placeholder does not match expected",
      );
    });

    it("Valid New Profile Input", function () {
      const result = getProfilePrompt(ProfilePromptType.NewProfile);

      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "New SAS Connection Profile Name",
        "NewProfile title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter connection name",
        "NewProfile placeholder does not match expected",
      );
    });

    it("Valid Endpoint Input", function () {
      const result = getProfilePrompt(ProfilePromptType.Endpoint);

      expect(result).to.not.equal(undefined);
      expect(result.title).to.equal(
        "SAS Viya Server",
        "Endpoint title does not match expected",
      );
      expect(result.placeholder).to.equal(
        "Enter the URL",
        "Endpoint placeholder does not match expected",
      );
    });
  });
});
