#!/usr/bin/env node
'use strict';

import {parseArgs} from 'node:util';

import expressCheckIn from './index.js';

/** @param {unknown} text */
function bold(text) {
	return `\x1b[1m${text}\x1b[22m`;
}

const {
	values: {
		bail,
		check,
		directory,
		pattern,
		plugin: plugins,
		'resolve-config': resolveConfig,
		staged,
		verbose,
	},
} = parseArgs({
	// cspell:ignore positionals
	allowPositionals: false,
	strict: true,
	options: {
		bail: {
			type: 'boolean',
			default: false,
		},
		check: {
			type: 'boolean',
			default: false,
		},
		directory: {
			type: 'string',
		},
		pattern: {
			type: 'string',
			multiple: true,
		},
		plugin: {
			type: 'string',
			multiple: true,
		},
		'resolve-config': {
			type: 'boolean',
			default: true,
		},
		staged: {
			type: 'boolean',
			default: false,
		},
		verbose: {
			type: 'boolean',
			default: false,
			short: 'v',
		},
	},
});

expressCheckIn({
	bail,
	check,
	directory,
	pattern,
	plugins,
	resolveConfig,
	staged,
	verbose,

	onFoundChangedFiles: changedFiles => {
		console.log(
			`🎯  Found ${bold(changedFiles.length)} changed ${
				changedFiles.length === 1 ? 'file' : 'files'
			}.`,
		);
	},

	onPartiallyStagedFile: file => {
		console.log(`✍️  Fixing up partially staged ${bold(file)}.`);
	},

	onWriteFile: file => {
		console.log(`✍️  Fixing up ${bold(file)}.`);
	},

	onCheckFile: (file, isOkay, reason) => {
		if (!isOkay) {
			console.log(`⛔️  Check failed: ${bold(file)} – ${reason}`);
		}
	},

	onExamineFile: file => {
		console.log(`🔍  Examining ${bold(file)}.`);
	},
})
	.then(expressCheckInResult => {
		if (expressCheckInResult.success) {
			console.log('✅  Everything is awesome!');
		} else {
			if (expressCheckInResult.errors.indexOf('BAIL_ON_WRITE') !== -1) {
				console.log(
					'✗ File had to be modified and expressCheckIn was set to bail mode.',
				);
			}
			if (expressCheckInResult.errors.indexOf('CHECK_FAILED') !== -1) {
				console.log('✗ Issues found in the above file(s).');
			}
			process.exit(1); // ensure git hooks abort
		}
	})
	.catch(err => {
		console.error(`⚠️ Unexpected error: ${err.message}`);
		process.exit(1);
	});
