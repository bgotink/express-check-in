import {isAbsolute, relative} from 'path';
import {exec} from './util/exec';
import {findUp} from './util/find-up';

/* cspell: ignore ACMRTUB, cacheinfo */

interface Scm {
  readonly root: string;

  getChangedFiles(): ReadonlySet<string>;

  getUnstagedChangedFiles(): ReadonlySet<string>;

  stageFile(path: string): Promise<void>;

  readFromIndex(path: string): Promise<string>;

  updateIndex(path: string, content: string): Promise<void>;
}

const EMPTY_BLOB = '0'.repeat(40);

export async function findScm(directory: string): Promise<Scm | null> {
  const root = await findUp(directory, '.git');

  if (root == null) {
    return root;
  }

  const git = (...args: string[]) => exec('git', args, {cwd: root});

  const changedFileMap = new Map<string, {blob: string; mode: string}>(
    (await git('diff-index', '--cached', '--diff-filter=ACMRTUB', 'HEAD'))
      .split('\n')
      .map(line => {
        if (!line.trim()) {
          return [null!, null!];
        }

        const [, mode, , blob, , path] = line.split(/\s+/) as [
          oldMode: string,
          newMode: string,
          oldBlob: string,
          newBlob: string,
          mode: string,
          path: string,
        ];

        return [path, {mode, blob}];
      }),
  );
  changedFileMap.delete(null!);

  const unstagedChanges = new Set<string>(
    (await git('diff-index', '--diff-filter=ACMRTUB', 'HEAD'))
      .split('\n')
      .map(line => {
        const [, , , blob, , path] = line.split(/\s+/) as [
          oldMode: string,
          newMode: string,
          oldBlob: string,
          newBlob: string,
          mode: string,
          path: string,
        ];

        return blob === EMPTY_BLOB ? path : null!;
      }),
  );
  unstagedChanges.delete(null!);

  return {
    root,
    getChangedFiles() {
      return new Set(changedFileMap.keys());
    },
    getUnstagedChangedFiles(this: Scm) {
      return unstagedChanges;
    },

    async stageFile(path) {
      await git('add', path);
    },

    async readFromIndex(path) {
      const blob = changedFileMap.get(path);

      if (blob == null) {
        throw new Error('Invalid action: reading unchanged file');
      }

      return git('cat-file', '-p', blob.blob);
    },

    async updateIndex(path, content) {
      const relativePath = isAbsolute(path) ? relative(root, path) : path;
      const mode = changedFileMap.get(path);

      if (mode == null) {
        throw new Error('Invalid action: writing to unchanged file');
      }

      const object = await exec(
        'git',
        ['hash-object', '-w', '--stdin', '--path', relativePath],
        {cwd: root, input: content},
      );

      await git(
        'update-index',
        '--cacheinfo',
        `${mode.mode},${object.trim()},${relativePath}`,
      );
    },
  };
}
