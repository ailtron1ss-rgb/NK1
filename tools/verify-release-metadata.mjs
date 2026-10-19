#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '..');
const args = process.argv.slice(2);
let root = defaultRoot;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--root') {
    if (!args[i + 1]) {
      console.error('--root requires a directory');
      process.exit(2);
    }
    root = path.resolve(args[++i]);
  } else if (args[i].startsWith('--root=')) {
    root = path.resolve(args[i].slice('--root='.length));
  } else {
    console.error(`Unknown argument: ${args[i]}`);
    process.exit(2);
  }
}

const checks = [];
const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail ?? '') });
async function json(rel) {
  try {
    return JSON.parse(await readFile(path.join(root, rel), 'utf8'));
  } catch (err) {
    check(`read:${rel}`, false, err?.message || 'could not read/parse JSON');
    return null;
  }
}
async function text(rel) {
  try { return await readFile(path.join(root, rel), 'utf8'); }
  catch (err) { check(`read:${rel}`, false, err?.message || 'could not read file'); return ''; }
}

const rootPkg = await json('package.json');
const superVersion = await json('SUPER_VERSION.json');
const appPkg = await json('app/package.json');
const appLock = await json('app/package-lock.json');
const runtimePkg = await json('runtime/neuro-kurisu/package.json');
const runtimeLock = await json('runtime/neuro-kurisu/package-lock.json');
const changelog = await text('CHANGELOG.md');
const taskList = await text('Список дел.md');
const readme = await text('README.md');
const runbook = await text('docs/RUNBOOK.md');
const passMatch = String(superVersion?.build ?? '').match(/WORKPASS(\d+)/i);
const currentPass = passMatch ? Number(passMatch[1]) : 0;
const currentPassTag = Number.isInteger(currentPass) && currentPass > 0 ? `WORKPASS${currentPass}` : 'WORKPASS_UNKNOWN';
// Current report names follow the actual release metadata date instead of a frozen date.
// The fallback preserves older isolated contract fixtures that predate SUPER_VERSION.date.
const statusDateCandidate = String(superVersion?.date ?? '');
const statusDate = /^\d{4}-\d{2}-\d{2}$/.test(statusDateCandidate) ? statusDateCandidate : '2026-10-10';
const statusReport = await text(`docs/PROJECT_CURRENT_STATUS_${statusDate}_${currentPassTag}.md`);
const statusInventory = await json(`docs/PROJECT_CURRENT_STATUS_${statusDate}_${currentPassTag}.json`);
const scorecard = await json(`docs/PROJECT_PROGRESS_SCORECARD_${statusDate}_${currentPassTag}.json`);

if (rootPkg && superVersion) {
  check('root-version-aligned', rootPkg.version === superVersion.version,
    `package.json=${rootPkg.version}; SUPER_VERSION.json=${superVersion.version}`);
  check('runtime-version-aligned', superVersion.canonicalRuntime === `Neuro-Kurisu ${runtimePkg?.version}`,
    `SUPER_VERSION.json=${superVersion.canonicalRuntime}; runtime package=${runtimePkg?.version}`);
  check('schema-is-valid', Number.isInteger(superVersion.schema) && superVersion.schema > 0,
    `schema=${superVersion.schema}`);
  check('not-marked-release-ready', /implementation-workpass/i.test(superVersion.releaseStatus || '') && !/release.ready/i.test(superVersion.releaseStatus || ''),
    `releaseStatus=${superVersion.releaseStatus}`);
  check('workpass-build-lineage', currentPass >= 1 && new RegExp(`WORKPASS${currentPass}`).test(superVersion.build || '') && new RegExp(`WORKPASS${currentPass}`).test(superVersion.releaseRoot || '') && new RegExp(`WORKPASS${currentPass - 1}`).test(superVersion.sourceBaseline || ''),
    `currentPass=${currentPass}; build=${superVersion.build}; releaseRoot=${superVersion.releaseRoot}; sourceBaseline=${superVersion.sourceBaseline}`);
  check('current-workpass-integration', new RegExp(`WorkPass\\s*${currentPass}`, 'i').test(superVersion.latestIntegration || '') && new RegExp(`WorkPass\\s*${currentPass}`, 'i').test(superVersion.readinessNote || ''),
    `latestIntegration and readinessNote identify WorkPass ${currentPass}`);
}

for (const [label, pkg, lock] of [['app', appPkg, appLock], ['runtime', runtimePkg, runtimeLock]]) {
  const lockRoot = lock?.packages?.[''];
  check(`${label}-lock-root-present`, Boolean(lockRoot), `package-lock packages[""] ${lockRoot ? 'present' : 'missing'}`);
  if (pkg && lockRoot) {
    check(`${label}-lock-name-aligned`, pkg.name === lockRoot.name, `manifest=${pkg.name}; lock=${lockRoot.name}`);
    if (pkg.version !== undefined) check(`${label}-lock-version-aligned`, pkg.version === lockRoot.version, `manifest=${pkg.version}; lock=${lockRoot.version}`);
    check(`${label}-lock-dependencies-aligned`, JSON.stringify(pkg.dependencies || {}) === JSON.stringify(lockRoot.dependencies || {}), 'dependencies in manifest and lock root must match');
    check(`${label}-lock-devDependencies-aligned`, JSON.stringify(pkg.devDependencies || {}) === JSON.stringify(lockRoot.devDependencies || {}), 'devDependencies in manifest and lock root must match');
  }
}

const scripts = rootPkg?.scripts || {};
for (const key of ['install:all', 'test:app:scripts', 'test:browser-smoke-verdict', 'audit:release-metadata', 'test:release-metadata-contract', `audit:workpass${currentPass}`]) {
  check(`root-script:${key}`, typeof scripts[key] === 'string' && scripts[key].trim().length > 0, scripts[key] || 'missing');
}
check('root-workpass12-alias-delegates-runtime', /runtime\/neuro-kurisu.*audit:workpass12/.test(scripts['audit:workpass12'] || ''), scripts['audit:workpass12'] || 'missing');
check('root-current-workpass-alias-runs-gates', /audit:release-metadata/.test(scripts[`audit:workpass${currentPass}`] || '') && /test:app:scripts/.test(scripts[`audit:workpass${currentPass}`] || '') && /test:browser-smoke-verdict/.test(scripts[`audit:workpass${currentPass}`] || '') && /test:memory-retrieval-benchmark/.test(scripts[`audit:workpass${currentPass}`] || '') && /audit:server-imports/.test(scripts[`audit:workpass${currentPass}`] || ''), scripts[`audit:workpass${currentPass}`] || 'missing');
check('root-memory-experiment-runs-standalone', currentPass < 16 || (typeof scripts['test:memory-retrieval-experiment'] === 'string' && typeof scripts['audit:workpass16:memory-experiment'] === 'string' && /test:memory-retrieval-experiment/.test(scripts['audit:workpass16:memory-experiment'])), `${scripts['test:memory-retrieval-experiment'] || 'missing'}; ${scripts['audit:workpass16:memory-experiment'] || 'separate alias not required before WorkPass16'}`);
check('app-script-test-alias-exists', typeof appPkg?.scripts?.['test:scripts'] === 'string', appPkg?.scripts?.['test:scripts'] || 'missing');
check('changelog-has-current-workpass', new RegExp(`WorkPass ${currentPass}`).test(changelog), `CHANGELOG.md includes WorkPass ${currentPass}`);
check('tasklist-has-current-workpass', new RegExp(`WorkPass ${currentPass}`).test(taskList), `Список дел.md includes WorkPass ${currentPass}`);
check('install-docs-use-project-installer', readme.includes('npm run install:all') && runbook.includes('npm run install:all') && !/npm --prefix app ci/.test(readme + '\n' + runbook), 'README and runbook use the canonical installer for both app/runtime lockfiles');
check('current-status-report-present', new RegExp(`WorkPass ${currentPass}`).test(statusReport), `current status report exists and identifies WorkPass ${currentPass}`);
if (statusInventory && scorecard) {
  const rows = Array.isArray(statusInventory.items) ? statusInventory.items : [];
  const ids = rows.map(x => x.id);
  const counts = Object.fromEntries(['DONE','PARTIAL','TODO'].map(status => [status, rows.filter(x => x.status === status).length]));
  const weights = Array.isArray(scorecard.workstreams) ? scorecard.workstreams : [];
  const weightTotal = weights.reduce((sum, x) => sum + Number(x.weight || 0), 0);
  const computedScore = weights.reduce((sum, x) => sum + Number(x.weight || 0) * Number(x.completionPercent || 0) / 100, 0);
  check('status-inventory-ids-unique', ids.length === new Set(ids).size && ids.every(Boolean), `rows=${rows.length}; uniqueIds=${new Set(ids).size}`);
  check('status-inventory-counts-align', rows.length === statusInventory.counts?.DONE + statusInventory.counts?.PARTIAL + statusInventory.counts?.TODO && ['DONE','PARTIAL','TODO'].every(k => counts[k] === statusInventory.counts?.[k] && counts[k] === scorecard.normalizedTaskInventory?.counts?.[k]), `computed=${JSON.stringify(counts)}; inventory=${JSON.stringify(statusInventory.counts)}; scorecard=${JSON.stringify(scorecard.normalizedTaskInventory?.counts)}`);
  check('scorecard-weight-sum-100', Math.abs(weightTotal - 100) < 1e-9, `weightTotal=${weightTotal}`);
  check('scorecard-weighted-total-aligns', Math.abs(computedScore - Number(scorecard.overallPercent)) < 0.011, `computed=${computedScore.toFixed(2)}; declared=${scorecard.overallPercent}`);
  check('scorecard-inventory-count-aligns', Number(scorecard.normalizedTaskInventory?.count) === rows.length, `scorecard=${scorecard.normalizedTaskInventory?.count}; rows=${rows.length}`);
}

const result = {
  title: 'Neuro-Kurisu SUPER release metadata contract',
  root,
  checkedAt: new Date().toISOString(),
  ok: checks.every(x => x.pass),
  summary: { total: checks.length, passed: checks.filter(x => x.pass).length, failed: checks.filter(x => !x.pass).length },
  checks,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
