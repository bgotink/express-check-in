// @ts-check

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'uvu';

/**
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function isDirectory(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
function exec(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    /** @type {Buffer[]} */
    const stdout = [];
    child.stdout.on('data', buffer => stdout.push(buffer));

    /** @type {Buffer[]} */
    const stderr = [];
    child.stderr.on('data', buffer => stderr.push(buffer));

    child.on('close', (code, signal) => {
      if (code || signal) {
        reject(
          new Error(
            `Command "${[command, ...args].join(' ')}" exited with ${
              code ? `code ${code}` : `signal ${signal}`
            }\nstdout:\n\n${Buffer.concat(
              stdout,
            ).toString()}\n\nstderr:\n\n${Buffer.concat(stderr).toString()}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

const tmpDirectory = path.join(tmpdir(), 'express-check-in');
await fs.mkdir(tmpDirectory, {recursive: true});

const fixturesPath = fileURLToPath(new URL('__fixtures__', import.meta.url));
const repoPath = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * @param  {...(() => Promise<void>)} promiseFactories
 * @returns {Promise<void>}
 */
function chain(...promiseFactories) {
  return promiseFactories.reduce(
    (promise, factory) => promise.then(() => factory()),
    Promise.resolve(),
  );
}

/**
 * @param {string} name
 */
async function loadFixture(name) {
  const fixturePath = path.resolve(fixturesPath, name);

  const repo = await fs.mkdtemp(tmpDirectory + path.sep);
  const repoFiles = path.join(repo, 'src');

  try {
    /** @param {string[]} args */
    function git(...args) {
      return exec('git', args, repo);
    }

    const [fixtureSettings] = await Promise.all([
      fs
        .readFile(path.join(fixturePath, 'fixture.json'), 'utf-8')
        .then(text => JSON.parse(text)),
      git('init').then(() =>
        Promise.all([
          chain(
            () => git('config', 'commit.gpgSign', 'false'),
            /* cspell:disable */
            () => git('config', 'user.name', 'Testy McTestface'),
            () => git('config', 'user.email', 'testy@example.com'),
            /* cspell:enable */
          ),
          fs.writeFile(
            path.join(repo, '.git/info/exclude'),
            '.prettierrc.yml\n.editorconfig\n',
          ),
        ]),
      ),
      fs.copyFile(
        path.join(repoPath, '.prettierrc.yml'),
        path.join(repo, '.prettierrc.yml'),
      ),
      fs.copyFile(
        path.join(repoPath, '.editorconfig'),
        path.join(repo, '.editorconfig'),
      ),
    ]);

    {
      const committed = path.join(fixturePath, 'committed');
      if (await isDirectory(committed)) {
        await fs.cp(committed, repoFiles, {recursive: true});
        await git('add', '-A', ':/');
        await git('commit', '-m', 'committed state');
      }
    }

    {
      const staged = path.join(fixturePath, 'staged');
      if (await isDirectory(staged)) {
        if (fixtureSettings.clean) {
          await fs.rm(repoFiles, {recursive: true, force: true});
        }
        await fs.cp(staged, repoFiles, {recursive: true});
        await git('add', '-A', ':/');
      }
    }

    {
      const unstaged = path.join(fixturePath, 'unstaged');
      if (await isDirectory(unstaged)) {
        if (fixtureSettings.clean) {
          await fs.rm(repoFiles, {recursive: true, force: true});
        }
        await fs.cp(unstaged, repoFiles, {recursive: true});
      }
    }

    await exec(fixtureSettings.command, fixtureSettings.args ?? [], repo);

    {
      const expectedWorkingDirectory = path.join(
        fixturePath,
        'expected-working-directory',
      );
      if (await isDirectory(expectedWorkingDirectory)) {
        for (const file of await fs.readdir(expectedWorkingDirectory)) {
          assert.equal(
            await fs.readFile(path.join(repoFiles, file), 'utf-8'),
            await fs.readFile(
              path.join(expectedWorkingDirectory, file),
              'utf-8',
            ),
            `Expected content of file ${file} in the working directory`,
          );
        }
      }
    }

    {
      const expectedIndex = path.join(fixturePath, 'expected-index');
      if (await isDirectory(expectedIndex)) {
        await git('restore', 'src');
        for (const file of await fs.readdir(expectedIndex)) {
          assert.equal(
            await fs.readFile(path.join(repoFiles, file), 'utf-8'),
            await fs.readFile(path.join(expectedIndex, file), 'utf-8'),
            `Expected content of file ${file} in the index`,
          );
        }
      }
    }
  } finally {
    await fs.rm(repo, {recursive: true, force: true});
  }
}

for (const fixture of await fs.readdir(fixturesPath)) {
  test(`fixture ${fixture}`, () => loadFixture(fixture));
}

test.run();
