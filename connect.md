# Connect to SAS Clinical Acceleration

# Profiles

Profiles make it simpler to switch between multiple SAS deployments where the SAS Clinical Acceleration services are deployed. Multiple SAS Viya profiles are used to switch between contexts. There is no limit to the number of profiles that can be stored.

Profiles are configured in VS Code and stored in the VS Code settings.json file. The profile settings can be modified by hand, if necessary.

The following commands are supported for profiles:

| Command                                   | Title                                                        |
| ----------------------------------------- | ------------------------------------------------------------ |
| `SAS Clinical Acceleration.addProfile`    | SAS Clinical Acceleration: Add New Connection Profile        |
| `SAS Clinical Acceleration.switchProfile` | SAS Clinical Acceleration: Switch Current Connection profile |
| `SAS Clinical Acceleration.updateProfile` | SAS Clinical Acceleration: Update Connection profile         |
| `SAS Clinical Acceleration.deleteProfile` | SAS Clinical Acceleration: Delete Connection profile         |

## Profile Anatomy (SAS Viya)

The following parameters listed below make up the profile settings for configuring a connection to SAS Viya.

| Name                | Description                           | Additional Notes                                                                                                                                      |
| ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | Name of the profile                   | Displays on the status bar                                                                                                                            |
| **Endpoint**        | Viya endpoint                         | Appears when hovering over the status bar                                                                                                             |

### Add New SAS Viya Profile

To add a new SAS Viya profile, open the command palette (`F1`, or `Ctrl+Shift+P` on Windows or Linux, or `Shift+CMD+P` on OSX). Execute the `SAS Clinical Acceleration.addProfile` command, then enter a name and the URI to a SAS Viya instance in each of the respective prompts.

For more information about the authentication process, please see the blog post [Authentication to SAS Viya: a couple of approaches](https://blogs.sas.com/content/sgf/2021/09/24/authentication-to-sas-viya/). A SAS administrator can follow the steps 1 and 2 in the post to register a new client.

## Delete a Connection Profile

To delete a connection profile, execute the `SAS Clinical Acceleration.deleteProfile` command and then select the profile you want to delete.

## Switch the Current Connection Profile

To switch the current connection profile:

1. Execute the `SAS Clinical Acceleration.switchProfile` command.
2. If no profiles are found, the extension prompts you to [create a new profile](#add-new-sas-profile).
3. Select a profile to active.

The status bar item displays the name of the selected profile.

## Update a Connection Profile

To update a connection profile:

1. Execute the `SAS Clinical Acceleration.updateProfile` command.
2. Select a profile to update.
3. Follow the prompts to update the profile.

To update the name of a profile, delete and recreate it, or modify the profile by editing the settings.json file by hand.

#### Notes:

- There is a potential issue with switching between multiple profiles on Windows. For more information, see [#215](https://github.com/sassoftware/vscode-sas-extension/issues/215).

