#!/usr/bin/env node

import {exec} from 'node:child_process';
import {readFile, writeFile, rm, mkdir, copyFile, cp} from 'node:fs/promises';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

// Start fresh

await rm('dist', {recursive: true, force: true});
await mkdir('dist');

// TypeScript

await promisify(exec)('tsc -p tsconfig.compile.json');

// Write metadata

await Promise.all([
  cp('src', 'dist', {recursive: true}),
  copyFile('README.md', 'dist/README.md'),
  copyFile('LICENSE.md', 'dist/LICENSE.md'),

  readFile('package.json', 'utf-8').then(async rawPackageJson => {
    const packageJson = JSON.parse(rawPackageJson);
    // Allow the package to be published
    delete packageJson.private;
    // Remove all scripts and development info
    delete packageJson.devDependencies;
    delete packageJson.scripts;
    delete packageJson.packageManager;

    await writeFile('dist/package.json', JSON.stringify(packageJson, null, 2));
  }),
]);
