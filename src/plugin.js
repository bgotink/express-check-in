import {createRequire} from 'node:module';
import {join} from 'node:path';

/**
 * @typedef {(rootDirectory: string, directory: string) => Plugin | Promise<Plugin>} PluginFactory
 */

/**
 * @typedef {(
 *   filename: string,
 *   content: string,
 *   opts: {
 *     readonly check: boolean;
 *     readonly resolveConfig: boolean;
 *     readonly markExamined: () => void;
 *     readonly markChecked: (isOkay: boolean, reason?: string) => void;
 *     readonly writeFile: (newContent: string) => Promise<void>;
 *   },
 * ) => Promise<void>} Plugin
 */

/**
 * @typedef {object} LoadedPluginFactory
 * @property {string} name
 * @property {PluginFactory} factory
 */

/**
 * @typedef {object} LoadedPlugin
 * @property {string} name
 * @property {Plugin} plugin
 */

const builtinDetection = new Map([
	['cspell-lib', 'cspell'],
	['prettier', 'prettier'],
]);

const builtinPlugins = new Set(builtinDetection.values());

export async function detectAvailableBuiltins() {
	return (
		await Promise.all(
			Array.from(
				builtinDetection,
				/** @return {Promise<[string, boolean]>} */ async ([pkg, plugin]) => {
					try {
						await import(pkg);
						return [plugin, true];
					} catch {
						return [plugin, false];
					}
				},
			),
		)
	)
		.filter(([, isImportable]) => isImportable)
		.map(([plugin]) => plugin);
}

/**
 * @param {string | readonly string[]} names
 * @returns {Promise<PluginFactory>}
 */
export async function resolvePlugins(names) {
	const factories = await Promise.all(
		[names].flat().map(
			/** @returns {Promise<LoadedPluginFactory>} */
			async name => {
				let path;
				if (builtinPlugins.has(name)) {
					path = new URL(`./plugins/${name}.js`, import.meta.url).href;
				} else {
					let fullName = name;
					if (!/^(?:@[^/]+\/)?express-check-in-plugin(?:-|$)/.test(name)) {
						if (/^@[^/]+$/.test(name)) {
							fullName = `${name}/express-check-in-plugin`;
						} else {
							const match = /^(?<scope>@[^/]+)\/(?<name>.*)$/.exec(name);

							if (match) {
								const groups =
									/** @type {NonNullable<typeof match['groups']>} */ (
										match.groups
									);
								fullName = `${groups.scope}/express-check-in-plugin-${groups.name}`;
							} else {
								fullName = `express-check-in-plugin-${name}`;
							}
						}
					}

					try {
						path = createRequire(join(process.cwd(), '<synthetic>')).resolve(
							fullName,
						);
					} catch {
						throw new Error(
							fullName !== name
								? `Failed to resolve plugin ${JSON.stringify(
										fullName,
								  )} (included as ${name})`
								: `Failed to resolve plugin ${JSON.stringify(name)}`,
						);
					}
				}

				return {
					name,
					factory: await /** @type {Promise<PluginFactory>} */ (
						import(path).then(module => module.default ?? module)
					),
				};
			},
		),
	);

	return async (rootDirectory, directory) =>
		combinePlugins(
			await Promise.all(
				factories.map(async ({name, factory}) => ({
					name,
					plugin: await factory(rootDirectory, directory),
				})),
			),
		);
}

/**
 * @param {readonly LoadedPlugin[]} plugins
 * @returns {Plugin}
 */
function combinePlugins(plugins) {
	return async (filename, content, opts) => {
		let isExamined = false;
		let isChecked = false;
		/** @type {string[]} */
		const failedCheckReasons = [];

		let isWritten = false;

		function markExamined() {
			if (!isExamined) {
				isExamined = true;
				opts.markExamined();
			}
		}

		/** @param {string} c */
		async function writeFile(c) {
			isWritten = true;
			content = c;
		}

		for (const {plugin, name: pluginName} of plugins) {
			await plugin(filename, content, {
				...opts,
				markChecked(isOkay, reason) {
					isChecked = true;

					if (!isOkay) {
						failedCheckReasons.push(
							reason ? `${reason} (${pluginName})` : pluginName,
						);
					}
				},
				markExamined,
				writeFile,
			});
		}

		if (isChecked) {
			opts.markChecked(
				!failedCheckReasons.length,
				failedCheckReasons.join(', '),
			);
		}

		if (isWritten) {
			await opts.writeFile(content);
		}
	};
}
