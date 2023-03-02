import {isAbsolute, relative} from 'node:path';

import {exec} from './util/exec.js';
import {findUp} from './util/find-up.js';

/* cspell: ignore ACMRTUB, cacheinfo */

/**
 * @typedef {object} Scm
 * @property {string} root
 * @property {() => ReadonlySet<string>} getChangedFiles
 * @property {() => ReadonlySet<string>} getUnstagedChangedFiles
 * @property {(path: string) => Promise<void>} stageFile
 * @property {(path: string) => Promise<string>} readFromIndex
 * @property {(path: string, content: string) => Promise<void>} updateIndex
 */

const EMPTY_BLOB = '0'.repeat(40);

/**
 * @param {string} directory
 * @returns {Promise<Scm | null>}
 */
export async function findScm(directory) {
	const root = await findUp(directory, '.git');

	if (root == null) {
		return root;
	}

	/** @param {string[]} args */
	const git = (...args) => exec('git', args, {cwd: root});

	const changedFileMap = new Map(
		(await git('diff-index', '--cached', '--diff-filter=ACMRTUB', 'HEAD'))
			.split('\n')
			.filter(line => line.trim())
			.map(line => {
				const [_oldMode, mode, _oldBlob, blob, _mode, path] = line.split(/\s+/);
				return [path, {mode, blob}];
			}),
	);

	const unstagedChanges = new Set(
		(await git('diff-index', '--diff-filter=ACMRTUB', 'HEAD'))
			.split('\n')
			.flatMap(line => {
				const [, , , blob, , path] = line.split(/\s+/);
				return blob === EMPTY_BLOB ? path : [];
			}),
	);

	return {
		root,
		getChangedFiles() {
			return new Set(changedFileMap.keys());
		},
		getUnstagedChangedFiles() {
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
