import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A terminated-but-unreaped descendant keeps a PID slot and still answers `kill(pid, 0)`.
// Treat it as gone; only a running/blocked process means the group kill failed.
function processIsRunning(pid) {
  try {
    const state = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return state.slice(state.lastIndexOf(')') + 2, state.lastIndexOf(')') + 3) !== 'Z';
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    try { process.kill(pid, 0); return true; } catch (probeError) { return probeError?.code !== 'ESRCH'; }
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installerSource = path.join(repoRoot, 'tools/super-install.mjs');
const helperSource = path.join(repoRoot, 'tools/lib/node-runtime.mjs');

async function createFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk-super-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tools = path.join(root, 'tools');
  const app = path.join(root, 'app');
  const runtime = path.join(root, 'runtime/neuro-kurisu');
  const fakeBin = path.join(root, 'fake-bin');
  for (const dir of [tools, path.join(tools, 'lib'), app, runtime, fakeBin]) await mkdir(dir, { recursive: true });
  await writeFile(path.join(tools, 'super-install.mjs'), await readFile(installerSource));
  await writeFile(path.join(tools, 'lib/node-runtime.mjs'), await readFile(helperSource));
  await writeFile(path.join(root, '.nvmrc'), '24\n');
  for (const [dir, name, version] of [[app, 'app-builder-workspace', '1.0.0'], [runtime, 'neuro-kurisu-organism-evolution', '1.0.0']]) {
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version }, null, 2));
    await writeFile(path.join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { name, version } } }, null, 2));
  }
  const log = path.join(root, 'npm-invocations.txt');
  const fakeNpm = path.join(fakeBin, 'npm');
  await writeFile(fakeNpm, `#!/bin/sh\nprintf '%s\\t%s\\n' "$PWD" "$*" >> "$NK_FAKE_NPM_LOG"\nif [ -n "$NK_FAKE_NPM_FAIL_CWD" ] && [ "$PWD" = "$NK_FAKE_NPM_FAIL_CWD" ]; then exit "${'${NK_FAKE_NPM_EXIT:-17}'}"; fi\nif [ -n "$NK_FAKE_NPM_HANG_CWD" ] && [ "$PWD" = "$NK_FAKE_NPM_HANG_CWD" ]; then sleep 30 & echo $! >> "$NK_FAKE_NPM_CHILD_PIDS"; wait; fi\nexit 0\n`);
  await chmod(fakeNpm, 0o755);
  return { root, app, runtime, log, fakeBin };
}

function run(fixture, moreEnv = {}) {
  return spawnSync(process.execPath, [path.join(fixture.root, 'tools/super-install.mjs')], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      NK_FAKE_NPM_LOG: fixture.log,
      NK_NPM_INSTALL_TIMEOUT_MS: '10000',
      ...moreEnv,
    },
    timeout: 15000,
  });
}

test('install:all runs lockfile-clean npm ci for both app and runtime', async t => {
  const f = await createFixture(t);
  const result = run(f);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /SUPER_INSTALL=PASS workspaces=2 lockfiles=2/);
  const rows = (await readFile(f.log, 'utf8')).trim().split('\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.split('\t')[0]), [f.app, f.runtime]);
  assert.ok(rows.every(row => row.endsWith('ci --no-audit --no-fund')));
});

test('installer stops on the first failed workspace and gives an actionable failure', async t => {
  const f = await createFixture(t);
  const result = run(f, { NK_FAKE_NPM_FAIL_CWD: f.app, NK_FAKE_NPM_EXIT: '17' });
  assert.equal(result.status, 17, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /SUPER_INSTALL=FAIL workspace=app/);
  const rows = (await readFile(f.log, 'utf8')).trim().split('\n');
  assert.equal(rows.length, 1, 'runtime install must not run after the app install fails');
});

test('installer fails before npm when a lockfile is missing', async t => {
  const f = await createFixture(t);
  await rm(path.join(f.runtime, 'package-lock.json'));
  const result = run(f);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /workspace=runtime reason=package-or-lockfile-missing/);
  assert.equal(await readFile(f.log, 'utf8').catch(() => ''), '');
});

test('installer fails closed when package and lockfile roots disagree', async t => {
  const f = await createFixture(t);
  const lockPath = path.join(f.runtime, 'package-lock.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  lock.packages[''].version = '0.0.0';
  await writeFile(lockPath, JSON.stringify(lock));
  const result = run(f);
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /workspace=runtime reason=lockfile-root-mismatch/);
  assert.equal(await readFile(f.log, 'utf8').catch(() => ''), '');
});


test('installer deadline kills the complete npm process group and exits fail-fast', { skip: process.platform === 'win32' }, async t => {
  const f = await createFixture(t);
  const childPidsFile = path.join(f.root, 'child-pids.txt');
  const startedAt = Date.now();
  const result = run(f, {
    NK_NPM_INSTALL_TIMEOUT_MS: '1000',
    NK_FAKE_NPM_HANG_CWD: f.app,
    NK_FAKE_NPM_CHILD_PIDS: childPidsFile,
  });
  const elapsed = Date.now() - startedAt;
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /SUPER_INSTALL=TIMEOUT workspace=app deadlineMs=1000/);
  assert.match(result.stderr, /SUPER_INSTALL=FAIL workspace=app reason=timeout/);
  assert.ok(elapsed < 6000, `timeout should include process cleanup; elapsed=${elapsed}ms`);
  const pidsText = await readFile(childPidsFile, 'utf8');
  const pid = Number(pidsText.trim().split(/\s+/).at(-1));
  assert.ok(Number.isInteger(pid) && pid > 0, 'fake npm child PID should have been captured');
  let stillAlive = true;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!processIsRunning(pid)) { stillAlive = false; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(stillAlive, false, `npm descendant ${pid} must not survive installer timeout`);
});
