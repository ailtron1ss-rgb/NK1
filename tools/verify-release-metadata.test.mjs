import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(projectRoot, 'tools/verify-release-metadata.mjs');

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk-release-contract-'));
  await mkdir(path.join(root, 'app'), { recursive: true });
  await mkdir(path.join(root, 'runtime/neuro-kurisu'), { recursive: true });
  await mkdir(path.join(root, 'tools'), { recursive: true });
  await mkdir(path.join(root, 'docs'), { recursive: true });
  const rootPkg = { name: 'neuro-kurisu-super', version: '20.0.0-super-final3', scripts: {
    'install:all': 'node tools/super-install.mjs',
    'audit:release-metadata': 'node tools/verify-release-metadata.mjs',
    'test:release-metadata-contract': 'node --test tools/verify-release-metadata.test.mjs',
    'audit:workpass12': 'npm --prefix runtime/neuro-kurisu run audit:workpass12 && npm run audit:assets',
    'test:app:scripts': 'npm --prefix app run test:scripts',
    'test:browser-smoke-verdict': 'node --test app/scripts/browser-smoke-verdict.test.mjs',
    'audit:workpass14': 'npm run audit:release-metadata && npm run test:release-metadata-contract && npm run test:app:scripts && npm run test:browser-smoke-verdict && npm --prefix runtime/neuro-kurisu run test:memory-retrieval-benchmark && npm --prefix runtime/neuro-kurisu run test:memory-retrieval-experiment && npm --prefix runtime/neuro-kurisu run typecheck && npm run audit:server-imports && npm run audit:ui-api-linkage && npm run audit:assets && npm run audit:release-metadata',
  }};
  const superV = { version: '20.0.0-super-final3', canonicalRuntime: 'Neuro-Kurisu 35.40.0', schema: 223,
    releaseStatus: 'implementation-workpass; release gates remain open',
    build: 'v20-WILL-LUMINA-HEXIS-LETTA-CONSCIO-WORKPASS14',
    releaseRoot: 'Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS14_2026-10-10',
    sourceBaseline: 'Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS13_2026-10-10.zip',
    latestIntegration: 'WorkPass 14 release contract', readinessNote: 'WorkPass 14 remains implementation workpass' };
  const appPkg = { name: 'app-builder-workspace', scripts: { 'test:scripts': "node --test 'scripts/**/*.test.mjs'" }, dependencies: { react: '^19.0.0' }, devDependencies: { typescript: '^5.7.0' } };
  const runtimePkg = { name: 'neuro-kurisu-organism-evolution', version: '35.40.0', dependencies: {}, devDependencies: {} };
  const appLock = { name: appPkg.name, lockfileVersion: 3, packages: { '': { name: appPkg.name, dependencies: appPkg.dependencies, devDependencies: appPkg.devDependencies } } };
  const runtimeLock = { name: runtimePkg.name, lockfileVersion: 3, packages: { '': { name: runtimePkg.name, version: runtimePkg.version, dependencies: {}, devDependencies: {} } } };
  const json = async (p, d) => writeFile(path.join(root, p), JSON.stringify(d, null, 2));
  await json('package.json', rootPkg); await json('SUPER_VERSION.json', superV);
  await json('app/package.json', appPkg); await json('app/package-lock.json', appLock);
  await json('runtime/neuro-kurisu/package.json', runtimePkg); await json('runtime/neuro-kurisu/package-lock.json', runtimeLock);
  await writeFile(path.join(root, 'CHANGELOG.md'), '# WorkPass 14\n');
  await writeFile(path.join(root, 'Список дел.md'), '# Список дел — WorkPass 14\n');
  await writeFile(path.join(root, 'README.md'), 'Install: npm run install:all\n');
  await writeFile(path.join(root, 'docs/RUNBOOK.md'), 'Install: npm run install:all\n');
  await writeFile(path.join(root, 'docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.md'), '# WorkPass 14 status\n');
  await json('docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.json', { counts: { DONE: 1, PARTIAL: 0, TODO: 0 }, items: [{ id: 'G01', status: 'DONE' }] });
  await json('docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS14.json', { overallPercent: 80, workstreams: [{ weight: 100, completionPercent: 80 }], normalizedTaskInventory: { count: 1, counts: { DONE: 1, PARTIAL: 0, TODO: 0 } } });
  return root;
}

function run(root) { return spawnSync(process.execPath, [validator, '--root', root], { encoding: 'utf8' }); }

test('release metadata validator accepts aligned manifests and lockfiles', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.summary.failed, 0);
});

test('release metadata validator fails closed on version mismatch', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const p = path.join(root, 'package.json'); const d = JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8'));
  d.version = '20.0.0-mismatched'; await writeFile(p, JSON.stringify(d, null, 2));
  const r = run(root); assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /root-version-aligned[\s\S]*?"pass": false/);
});

test('release metadata validator detects lockfile drift', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const p = path.join(root, 'app/package-lock.json'); const d = JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8'));
  d.packages[''].dependencies.react = '^18.0.0'; await writeFile(p, JSON.stringify(d, null, 2));
  const r = run(root); assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /app-lock-dependencies-aligned[\s\S]*?"pass": false/);
});


test('release metadata validator detects normalized task count drift', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const p = path.join(root, 'docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.json');
  const fs = await import('node:fs/promises'); const d = JSON.parse(await fs.readFile(p, 'utf8')); d.counts.DONE = 2; await fs.writeFile(p, JSON.stringify(d, null, 2));
  const r = run(root); assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout, /status-inventory-counts-align[\s\S]*?\"pass\": false/);
});

test('release metadata validator detects weighted score arithmetic drift', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const p = path.join(root, 'docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS14.json');
  const fs = await import('node:fs/promises'); const d = JSON.parse(await fs.readFile(p, 'utf8')); d.overallPercent = 91; await fs.writeFile(p, JSON.stringify(d, null, 2));
  const r = run(root); assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout, /scorecard-weighted-total-aligns[\s\S]*?\"pass\": false/);
});


test('release metadata validator follows active workpass status filenames', async t => {
  const root = await fixture(); t.after(() => rm(root, { recursive: true, force: true }));
  const fs = await import('node:fs/promises');
  await fs.rename(
    path.join(root, 'docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.json'),
    path.join(root, 'docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.json'),
  );
  const r = run(root);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14\.json/);
});
