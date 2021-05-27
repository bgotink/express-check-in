import multimatch from 'multimatch';
import {normalize} from 'path';

export function createMatcher(pattern: string | readonly string[]) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];

  return (file: string) =>
    multimatch(normalize(file), patterns, {dot: true}).length > 0;
}
