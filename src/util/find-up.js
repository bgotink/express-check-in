import fs from 'node:fs/promises';
import {join, dirname, parse, resolve} from 'node:path';

/**
 * @param {string} from
 * @param {string} subDirectory
 */
export async function findUp(from, subDirectory) {
  let current = resolve(from);
  const {root} = parse(current);

  while (true) {
    if ((await fs.stat(join(current, subDirectory))).isDirectory()) {
      return current;
    }

    if (current === root) {
      return null;
    }

    current = dirname(current);
  }
}
