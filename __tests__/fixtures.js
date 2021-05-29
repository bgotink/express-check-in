// @ts-check

const {default: test} = require('ava');
const {spawn} = require('child_process');
const fs = require('fs-extra');
const {tmpdir} = require('os');
const path = require('path');

/**
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function exists(p) {
  try {
    await fs.stat(p);
    return true;
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
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const outputs = [];
    child.stdout.on('data', buffer => outputs.push(buffer));

    child.on('close', (code, signal) => {
      if (code || signal) {
        reject(
          new Error(
            `Command "${[command, ...args].join(' ')}" exited with ${
              code ? `code ${code}` : `signal ${signal}`
            }\nOutput:\n\n${Buffer.concat(outputs).toString()}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

const tmpDirectory = path.join(tmpdir(), 'express-check-in');
const fixturesPath = path.join(__dirname, '__fixtures__');

/**
 * @param {string} name
 * @param {import('ava').ExecutionContext} t
 */
async function loadFixture(name, t) {
  const fixturePath = path.resolve(fixturesPath, name);

  await fs.mkdir(tmpDirectory, {recursive: true});
  const repo = await fs.mkdtemp(tmpDirectory + path.sep);
  const repoFiles = path.join(repo, 'src');

  t.teardown(() => {
    fs.removeSync(repo);
  });

  /** @param {string[]} args */
  function git(...args) {
    return exec('git', args, repo);
  }

  const [fixtureSettings] = await Promise.all([
    fs.readJson(path.join(fixturePath, 'fixture.json')),
    git('init').then(() =>
      Promise.all([
        git('config', 'commit.gpgSign', 'false'),
        fs.writeFile(
          path.join(repo, '.git/info/exclude'),
          '.prettierrc.yml\n.editorconfig\n',
        ),
      ]),
    ),
    fs.copyFile(
      path.join(__dirname, '..', '.prettierrc.yml'),
      path.join(repo, '.prettierrc.yml'),
    ),
    fs.copyFile(
      path.join(__dirname, '..', '.editorconfig'),
      path.join(repo, '.editorconfig'),
    ),
  ]);

  {
    const committed = path.join(fixturePath, 'committed');
    if (await exists(committed)) {
      await fs.copy(committed, repoFiles);
      await git('add', '-A', ':/');
      await git('commit', '-m', 'committed state');
    }
  }

  {
    const staged = path.join(fixturePath, 'staged');
    if (await exists(staged)) {
      if (fixtureSettings.clean) {
        await fs.remove(repoFiles);
      }
      await fs.copy(staged, repoFiles);
      await git('add', '-A', ':/');
    }
  }

  {
    const unstaged = path.join(fixturePath, 'unstaged');
    if (await exists(unstaged)) {
      if (fixtureSettings.clean) {
        await fs.remove(repoFiles);
      }
      await fs.copy(unstaged, repoFiles);
    }
  }

  await exec(fixtureSettings.command, fixtureSettings.args ?? [], repo);

  {
    const expectedWorkingDirectory = path.join(
      fixturePath,
      'expected-working-directory',
    );
    if (await exists(expectedWorkingDirectory)) {
      for (const file of await fs.readdir(expectedWorkingDirectory)) {
        t.is(
          await fs.readFile(path.join(repoFiles, file), 'utf-8'),
          await fs.readFile(path.join(expectedWorkingDirectory, file), 'utf-8'),
          `Expected content of file ${file} in the working directory`,
        );
      }
    }
  }

  {
    const expectedIndex = path.join(fixturePath, 'expected-index');
    if (await exists(expectedIndex)) {
      await git('restore', 'src');
      for (const file of await fs.readdir(expectedIndex)) {
        t.is(
          await fs.readFile(path.join(repoFiles, file), 'utf-8'),
          await fs.readFile(path.join(expectedIndex, file), 'utf-8'),
          `Expected content of file ${file} in the index`,
        );
      }
    }
  }
}

for (const fixture of fs.readdirSync(fixturesPath)) {
  test(`fixture ${fixture}`, t => loadFixture(fixture, t));
}
