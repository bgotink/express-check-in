import {createRequire} from 'module';
import {join} from 'path';

export interface PluginFactory {
  (rootDirectory: string, directory: string): Plugin | Promise<Plugin>;
}

export interface Plugin {
  (
    filename: string,
    content: string,
    opts: {
      readonly check: boolean;
      readonly resolveConfig: boolean;
      readonly markExamined: () => void;
      readonly markChecked: (isOkay: boolean, reason?: string) => void;
      readonly writeFile: (newContent: string) => Promise<void>;
    },
  ): Promise<void>;
}

interface LoadedPluginFactory {
  name: string;
  factory: PluginFactory;
}

interface LoadedPlugin {
  name: string;
  plugin: Plugin;
}

const builtinDetection = new Map([
  ['cspell-lib', 'cspell'],
  ['prettier', 'prettier'],
]);

const builtinPlugins = new Set(builtinDetection.values());

export function detectAvailableBuiltins(): string[] {
  return Array.from(builtinDetection)
    .filter(([pkg]) => {
      try {
        require.resolve(pkg);
        return true;
      } catch {
        return false;
      }
    })
    .map(([, name]) => name);
}

export async function resolvePlugins(
  names: string | readonly string[],
): Promise<PluginFactory> {
  const factories = await Promise.all(
    [names].flat().map(async (name): Promise<LoadedPluginFactory> => {
      let path;
      if (builtinPlugins.has(name)) {
        try {
          path = require.resolve(`./plugins/${name}`);
        } catch {
          throw new Error(`Failed to load builtin ${JSON.stringify(name)}`);
        }
      } else {
        let fullName = name;
        if (!/^(?:@[^/]+\/)?express-check-in-plugin(?:-|$)/.test(name)) {
          if (/^@[^/]+$/.test(name)) {
            fullName = `${name}/express-check-in-plugin`;
          } else {
            const match = /^(?<scope>@[^/]+)\/(?<name>.*)$/.exec(name);

            if (match) {
              fullName = `${match.groups!.scope}/express-check-in-plugin-${
                match.groups!.name
              }`;
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
        factory: await (import(path).then(
          module => module.default ?? module,
        ) as Promise<PluginFactory>),
      };
    }),
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

function combinePlugins(plugins: LoadedPlugin[]): Plugin {
  return async (filename, content, opts) => {
    let isExamined = false;
    let isChecked = false;
    const failedCheckReasons: string[] = [];

    let isWritten = false;

    function markExamined() {
      if (!isExamined) {
        isExamined = true;
        opts.markExamined();
      }
    }

    async function writeFile(c: string) {
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
