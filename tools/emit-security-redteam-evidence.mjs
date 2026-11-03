#!/usr/bin/env node
/**
 * Runs the security red-team harness on the current commit and writes the evidence
 * artifact the W7 contract expects. The artifact records the real measured metrics and
 * the exact HEAD it was produced at; it is never written when the harness fails, so a
 * green artifact always means the attacks were actually exercised.
 *
 * Usage: node tools/emit-security-redteam-evidence.mjs [--out <file>]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PREFIX = 'runtime/neuro-kurisu';

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

const args = process.argv.slice(2);
let out = 'docs/evidence/security-redteam.json';
for (let i = 0; i < args.length; i += 1) if (args[i] === '--out') out = args[++i];

const run = spawnSync('node', ['--experimental-strip-types', 'tests/security-redteam.mjs'], {
  cwd: resolve(ROOT, PREFIX),
  encoding: 'utf8',
  timeout: 300000,
});
if (run.status !== 0) {
  console.error(`red-team harness failed (exit ${run.status}); no evidence written`);
  console.error(String(run.stderr ?? '').slice(-2000));
  process.exit(1);
}

let parsed;
try {
  const start = String(run.stdout).indexOf('{');
  parsed = JSON.parse(String(run.stdout).slice(start));
} catch (error) {
  console.error(`could not parse harness output: ${error.message}`);
  process.exit(1);
}
if (parsed?.verified !== true || Number(parsed?.metrics?.criticalBypasses ?? 1) !== 0) {
  console.error('harness did not report a clean verified run; no evidence written');
  process.exit(1);
}

const artifact = {
  schema: 'nk1.security-redteam.v1',
  generatedAt: new Date().toISOString(),
  sha: git(['rev-parse', 'HEAD']),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  coversPaths: [`${PREFIX}/src/organism/system/OutcomeVerificationService.ts`, `${PREFIX}/src/organism/learning/CanonicalTemporalCreditAuthority.ts`, `${PREFIX}/src/organism/analysis`, `${PREFIX}/tests/security-redteam.mjs`],
  verified: true,
  metrics: parsed.metrics,
  note: 'Metrics are produced by tests/security-redteam.mjs driving the real verification service, temporal-credit authority, guard, danger model and candidate pool through the T1-T12 attack patterns. No mocks. The artifact is written only when every attack is refused.',
};

const outPath = resolve(ROOT, out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`NK1_SECURITY_REDTEAM_EVIDENCE=OK sha=${artifact.sha.slice(0, 12)} cases=${parsed.metrics.redTeamCasesPassed} bypasses=${parsed.metrics.criticalBypasses} artifact=${outPath}`);
