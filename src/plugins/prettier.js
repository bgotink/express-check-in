import fs from 'node:fs/promises';
import {join} from 'node:path';
import prettier from 'prettier';

/**
 * @type {import('../plugin.js').PluginFactory}
 */
const plugin = async (rootDirectory, directory) => {
	/** @type {string=} */
	let ignorePath;

	for (const dir of [directory, rootDirectory]) {
		const file = join(dir, '.prettierignore');
		try {
			if ((await fs.stat(file)).isFile()) {
				ignorePath = file;
				break;
			}
		} catch {
			// ignore
		}
	}

	return async (
		filename,
		content,
		{check, resolveConfig, markChecked, markExamined, writeFile},
	) => {
		const fileInfo = await prettier.getFileInfo(filename, {
			resolveConfig,
			ignorePath,
		});

		if (fileInfo.ignored || fileInfo.inferredParser == null) {
			return;
		}

		markExamined();

		const options = {
			...(await prettier.resolveConfig(filename, {
				editorconfig: true,
			})),
			filepath: filename,
		};

		if (check) {
			const isFormatted = prettier.check(content, options);

			markChecked(isFormatted);
			return;
		}

		const output = prettier.format(content, options);

		if (output !== content) {
			await writeFile(output);
		}
	};
};
export default plugin;
