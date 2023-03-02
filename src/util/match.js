import multimatch from 'multimatch';
import {normalize} from 'node:path';

/**
 * @param {string | readonly string[]} pattern
 * @returns {(file: string) => boolean}
 */
export function createMatcher(pattern) {
	const patterns = Array.isArray(pattern) ? pattern : [pattern];

	return file => multimatch(normalize(file), patterns, {dot: true}).length > 0;
}
