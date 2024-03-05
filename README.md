# `express-check-in`

[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![npm](https://img.shields.io/npm/v/express-check-in.svg?style=flat-square)](https://npmjs.org/@bgotink/express-check-in)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE.md)

> Validate and fixup code at check-in

## Install

With `yarn`:

```shellsession
yarn add --dev prettier express-check-in
```

With `npm`:

```shellsession
npm install --save-dev prettier express-check-in
```

## Usage

With `yarn`:

```shellsession
yarn express-check-in
```

With [`npx`](https://npm.im/npx):

```shellsession
npx -p prettier@latest -p express-check-in express-check-in
```

> Note: You can (_should_) change `latest` to a specific version of Prettier.

With `npm`:

```shellsession
npm exec express-check-in
```

## Plugins

The express-check-in command has a plugin-based architecture. There are two built-in plugins, `prettier` and `cspell`. Both of these are by default enabled if the required dependency is installed (respectively the `prettier` and `cspell-lib` packages).

To do:

- Write documentation on how to write your own plugins
- Load 3rd party plugins automatically?
- Provide `eslint --fix` plugin?

## Pre-Commit Hook

You can run `express-check-in` as a pre-commit hook using [`husky`](https://github.com/typicode/husky).

```shellsession
yarn add --dev husky
yarn husky add .husky/pre-commit "yarn express-check-in --staged"
```

## CLI Flags

### `--staged`

Pre-commit mode. Under this flag only staged files will be formatted, and they will be re-staged after formatting.

Partially staged files will be re-staged after formatting, but the files on disk will not be updated to reflect these changes. This prevents conflicts between the unstaged changes and the changes made by express-check-in.

### `--pattern`

Filters the files for the given [micromatch](https://github.com/micromatch/micromatch) pattern.  
For example `express-check-in --pattern "**/*.*(js|jsx)"` or `express-check-in --pattern "**/*.js" --pattern "**/*.jsx"`

### `--plugin`

Explicitly pass what plugins to use, e.g.

```shellsession
express-check-in --plugin prettier
```

will only use the `prettier` builtin plugin, even if the `cspell` builtin plugin could also be loaded.

### `--verbose`

Outputs the name of each file right before it is processed. This can be useful if Prettier throws an error and you can't identify which file is causing the problem.

### `--bail`

Prevent `git commit` if any files are fixed.

### `--check`

Check that files are correctly formatted, but don't format them. This is useful on CI to verify that all changed files in the current branch were correctly formatted.

### `--no-resolve-config`

Do not resolve prettier config when determining which files to format, just use standard set of supported file types & extensions prettier supports. This may be useful if you do not need any customization and see performance issues.

By default, express-check-in will check your prettier configuration file for any overrides you define to support formatting of additional file extensions.

Example `.prettierrc` file to support formatting files with `.cmp` or `.page` extensions as html.

```
{
    "printWidth": 120,
    "bracketSpacing": false,
    "overrides": [
        {
            "files": "*.{cmp,page}",
            "options": {"parser": "html"}
        }
    ],
}
```

## Project

This project started as a fork of [`pretty-quick`](https://github.com/azz/pretty-quick). Some functionality, e.g. mercurial support, is removed to make it possible to restage partially staged files. The prettier-only implementation is expanded to also support other checks, such as spell checking via `cspell`.
