import {spellCheckDocument, fileToDocument} from 'cspell-lib';

/**
 * @type {import('../plugin.js').PluginFactory}
 */
const plugin =
	() =>
	async (filename, content, {resolveConfig, markExamined, markChecked}) => {
		const document = fileToDocument(filename, content);

		const result = await spellCheckDocument(
			document,
			{
				generateSuggestions: false,
				noConfigSearch: !resolveConfig,
			},
			{},
		);

		if (result.checked) {
			markExamined();
			markChecked(
				!result.issues?.length,
				result.issues?.map(issue => JSON.stringify(issue.text)).join(', '),
			);
		}
	};

export default plugin;
