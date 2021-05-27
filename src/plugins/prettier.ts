import {promises as fs} from 'fs';
import {join} from 'path';
import * as prettier from 'prettier';

import type {PluginFactory} from '../plugin';

const plugin: PluginFactory = async (rootDirectory, directory) => {
  let ignorePath: string | undefined;

  for (const dir of [directory, rootDirectory]) {
    const file = join(dir, '.prettierignore');
    try {
      if ((await fs.stat(file)).isFile()) {
        ignorePath = file;
        break;
      }
    } catch {
      // ignore
    }
  }

  return async (
    filename,
    content,
    {check, resolveConfig, markChecked, markExamined, writeFile},
  ) => {
    const fileInfo = await prettier.getFileInfo(filename, {
      resolveConfig,
      ignorePath,
    });

    if (fileInfo.ignored || fileInfo.inferredParser == null) {
      return;
    }

    markExamined();

    const options: prettier.Options = {
      ...(await prettier.resolveConfig(filename, {
        editorconfig: true,
      })),
      filepath: filename,
    };

    if (check) {
      const isFormatted = prettier.check(content, options!);

      markChecked(isFormatted);
      return;
    }

    const output = prettier.format(content, options!);

    if (output !== content) {
      await writeFile(output);
    }
  };
};
export default plugin;
