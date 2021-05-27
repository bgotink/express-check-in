import {spellCheckDocument, fileToDocument} from 'cspell-lib';

import type {PluginFactory} from '../plugin';

const plugin: PluginFactory =
  () =>
  async (filename, content, {resolveConfig, markExamined, markChecked}) => {
    const document = fileToDocument(filename, content);

    const result = await spellCheckDocument(
      document,
      {
        generateSuggestions: false,
        noConfigSearch: !resolveConfig,
      },
      {},
    );

    if (result.checked) {
      markExamined();
      markChecked(!result.issues?.length);
    }
  };

export default plugin;
