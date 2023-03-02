import fs from 'node:fs/promises';
import {resolve} from 'node:path';

import {findScm} from './scm.js';
import {detectAvailableBuiltins, resolvePlugins} from './plugin.js';
import {createMatcher} from './util/match.js';

/**
 * @typedef {object} Options
 * @property {boolean} [bail]
 * @property {boolean} [check]
 * @property {string} [directory]
 * @property {string | readonly string[]} [pattern]
 * @property {string | readonly string[]} [plugins]
 * @property {boolean} [resolveConfig]
 * @property {boolean} [staged]
 * @property {boolean} [verbose]
 * @property {(file: string, isOkay: boolean, reason?: string) => void} [onCheckFile]
 * @property {(file: string) => void} [onExamineFile]
 * @property {(file: readonly string[]) => void} [onFoundChangedFiles]
 * @property {(file: string) => void} [onPartiallyStagedFile]
 * @property {(file: string) => void} [onWriteFile]
 */

/**
 * @typedef {'BAIL_ON_WRITE' | 'CHECK_FAILED'} FailReason
 */

/**
 * @param {Options} options
 */
export default async function expressCheckIn({
  bail = false,
  check = false,
  directory = process.cwd(),
  pattern,
  plugins: pluginNames,
  resolveConfig = true,
  staged = false,
  verbose = false,
  onCheckFile,
  onExamineFile,
  onFoundChangedFiles,
  onPartiallyStagedFile,
  onWriteFile,
}) {
  const scm = await findScm(directory);

  if (scm == null) {
    throw new Error(`Couldn't find git repository`);
  }

  /** @type {readonly string[]} */
  let changedFiles;
  /** @type {ReadonlySet<string>} */
  let changeIndexOnly;

  if (staged) {
    changedFiles = Array.from(scm.getChangedFiles());
    changeIndexOnly = scm.getUnstagedChangedFiles();
  } else {
    changedFiles = Array.from(scm.getUnstagedChangedFiles());
    changeIndexOnly = new Set();
  }

  if (pattern != null) {
    changedFiles = changedFiles.filter(createMatcher(pattern));
  }

  onFoundChangedFiles?.(changedFiles);

  if (changedFiles.length === 0) {
    return {
      success: true,
      errors: [],
    };
  }

  const plugin = await (
    await resolvePlugins(pluginNames ?? (await detectAvailableBuiltins()))
  )(scm.root, directory);

  /** @type {Set<FailReason>} */
  const failReasons = new Set();

  for (const path of changedFiles) {
    const useIndex = changeIndexOnly.has(path);
    const resolvedPath = resolve(scm.root, path);

    const content = await (useIndex
      ? scm.readFromIndex(path)
      : fs.readFile(resolvedPath, 'utf-8'));

    // Handle
    await plugin(resolvedPath, content, {
      check,
      resolveConfig,
      async writeFile(newContent) {
        if (newContent === content) {
          return;
        }

        onWriteFile?.(path);
        if (bail) {
          failReasons.add('BAIL_ON_WRITE');
        } else {
          if (useIndex) {
            onPartiallyStagedFile?.(path);
            await scm.updateIndex(path, newContent);
          } else {
            await fs.writeFile(resolvedPath, newContent);
            if (staged) {
              await scm.stageFile(path);
            }
          }
        }
      },
      markChecked(isOkay, reason) {
        onCheckFile?.(path, isOkay, reason);
        if (!isOkay) {
          failReasons.add('CHECK_FAILED');
        }
      },
      markExamined() {
        if (onExamineFile && verbose) {
          onExamineFile(path);
        }
      },
    });
  }

  return {
    success: failReasons.size === 0,
    errors: Array.from(failReasons),
  };
}
