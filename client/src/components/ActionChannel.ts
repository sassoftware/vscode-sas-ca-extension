// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { OutputChannel, l10n, window } from "vscode";
import { formatLogDate } from './ContentNavigator/utils';

let outputChannel: OutputChannel;
export const EventFn = (line: string) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(l10n.t("SAS Clinical Acceleration"), 'log');
  }
  outputChannel.show(true);
  outputChannel.appendLine(formatLogDate(new Date(), "en-US") + ' ' + line);
};
