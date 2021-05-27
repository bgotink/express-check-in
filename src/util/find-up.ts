import {promises as fs} from 'fs';
import {join, dirname, parse, resolve} from 'path';

export async function findUp(from: string, subDirectory: string) {
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
