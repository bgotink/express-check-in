#!/usr/bin/env node
'use strict';

import chalk from 'chalk';
import mri from 'mri';

import expressCheckIn, {FailReason} from '.';

const args = mri(process.argv.slice(2), {
  alias: {
    'resolve-config': 'resolveConfig',
    plugin: 'plugins',
    // 'ignore-path': 'ignorePath',
  },
});

expressCheckIn({
  ...args,

  onFoundChangedFiles: changedFiles => {
    console.log(
      `🎯  Found ${chalk.bold(changedFiles.length)} changed ${
        changedFiles.length === 1 ? 'file' : 'files'
      }.`,
    );
  },

  onPartiallyStagedFile: file => {
    console.log(`✍️  Fixing up partially staged ${chalk.bold(file)}.`);
  },

  onWriteFile: file => {
    console.log(`✍️  Fixing up ${chalk.bold(file)}.`);
  },

  onCheckFile: (file, isOkay, reason) => {
    if (!isOkay) {
      console.log(`⛔️  Check failed: ${chalk.bold(file)} – ${reason}`);
    }
  },

  onExamineFile: file => {
    console.log(`🔍  Examining ${chalk.bold(file)}.`);
  },
})
  .then(expressCheckInResult => {
    if (expressCheckInResult.success) {
      console.log('✅  Everything is awesome!');
    } else {
      if (expressCheckInResult.errors.indexOf(FailReason.BailOnWrite) !== -1) {
        console.log(
          '✗ File had to be modified and expressCheckIn was set to bail mode.',
        );
      }
      if (expressCheckInResult.errors.indexOf(FailReason.CheckFailed) !== -1) {
        console.log('✗ Issues found in the above file(s).');
      }
      process.exit(1); // ensure git hooks abort
    }
  })
  .catch(err => {
    console.error(`⚠️ Unexpected error: ${err.message}`);
    process.exit(1);
  });
