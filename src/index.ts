import {promises as fs} from 'fs';
import {resolve} from 'path';

import {findScm} from './scm';
import {detectAvailableBuiltins, resolvePlugins} from './plugin';
import {createMatcher} from './util/match';

export interface Options {
  bail?: boolean;
  check?: boolean;
  directory?: string;
  pattern?: string | readonly string[];
  plugins?: string | readonly string[];
  resolveConfig?: boolean;
  staged?: boolean;
  verbose?: boolean;
  onCheckFile?(file: string, isOkay: boolean, reason?: string): void;
  onExamineFile?(file: string): void;
  onFoundChangedFiles?(file: readonly string[]): void;
  onPartiallyStagedFile?(file: string): void;
  onWriteFile?(file: string): void;
}

export const enum FailReason {
  BailOnWrite = 'BAIL_ON_WRITE',
  CheckFailed = 'CHECK_FAILED',
}

export default async function expressCheckIn({
  bail = false,
  check = false,
  directory = process.cwd(),
  pattern,
  plugins: pluginNames = detectAvailableBuiltins(),
  resolveConfig = true,
  staged = false,
  verbose = false,
  onCheckFile,
  onExamineFile,
  onFoundChangedFiles,
  onPartiallyStagedFile,
  onWriteFile,
}: Options) {
  const scm = await findScm(directory);

  if (scm == null) {
    throw new Error(`Couldn't find git repository`);
  }

  let changedFiles: readonly string[];
  let changeIndexOnly: ReadonlySet<string>;

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

  const plugin = await (await resolvePlugins(pluginNames))(scm.root, directory);

  const failReasons = new Set<FailReason>();

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
      async writeFile(newContent: string) {
        if (newContent === content) {
          return;
        }

        onWriteFile?.(path);
        if (bail) {
          failReasons.add(FailReason.BailOnWrite);
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
          failReasons.add(FailReason.CheckFailed);
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
