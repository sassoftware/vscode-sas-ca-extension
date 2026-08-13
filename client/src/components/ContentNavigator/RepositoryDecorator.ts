// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  FileDecorationProvider,
  l10n,
  ThemeColor,
  Uri,
} from "vscode";


class RepositoryDecorator implements FileDecorationProvider {
  provideFileDecoration(uri: Uri, _token: CancellationToken) {
    if (uri.scheme === 'sasHca') {
      const params = new URLSearchParams(uri.query);
      const isContainer = params.get('isContainer');
      const checkedOut = params.get('checkedOut');
      const checkedOutBy = params.get('checkedOutBy');
      const checkedOutBySelf = params.get('checkedOutBySelf');
      if (isContainer === 'false' && checkedOut === 'true') {
        return {
          badge: checkedOutBySelf === 'true' ? '✅' : '☑️',
          tooltip: l10n.t("Checked out by {name}", { name: checkedOutBy }),
          color: new ThemeColor('editorForeground'),
          propagate: false
        };
      }
    }
    return undefined;
  }
}

export default RepositoryDecorator;
