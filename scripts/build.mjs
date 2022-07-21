#!/usr/bin/env node

import {execSync} from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

// Start fresh

rmSync('dist', {recursive: true, force: true});
mkdirSync('dist');

// TypeScript

execSync('tsc -p tsconfig.json');

// Write metadata

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
// Allow the package to be published
delete packageJson.private;
// Remove all scripts and development info
delete packageJson.devDependencies;
delete packageJson.scripts;
delete packageJson.packageManager;

writeFileSync('dist/package.json', JSON.stringify(packageJson, null, 2));

copyFileSync('README.md', 'dist/README.md');
copyFileSync('LICENSE.md', 'dist/LICENSE.md');
