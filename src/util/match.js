import micromatch from 'micromatch';
import {normalize} from 'node:path';

/**
 * @param {string | readonly string[]} pattern
 * @returns {(file: string) => boolean}
 */
export function createMatcher(pattern) {
	const patterns = Array.isArray(pattern) ? pattern : [pattern];

	return file => micromatch.isMatch(normalize(file), patterns, {dot: true});
}
