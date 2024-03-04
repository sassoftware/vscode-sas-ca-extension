// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { workspace } from "vscode";

import * as fs from "fs";
import * as https from "https";
import * as tls from "tls";

export const installCAs = () => {
  const certFiles: string[] = workspace
    .getConfiguration("SAS.ClinicalAcceleration")
    .get("userProvidedCertificates");
  if (!certFiles?.length) {
    return;
  }

  const userCertificates = [];
  for (const filename of certFiles) {
    if (filename?.length) {
      try {
        userCertificates.push(fs.readFileSync(filename));
      } catch (error) {
        console.log(`Failed to read user provided certificate`, error);
      }
    }
  }
  if (userCertificates.length > 0) {
    https.globalAgent.options.ca =
      tls.rootCertificates.concat(userCertificates);
  }
};
