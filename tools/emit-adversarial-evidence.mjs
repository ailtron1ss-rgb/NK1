#!/usr/bin/env node
/**
 * Runs the adversarial self-modification harness on the current commit and writes
 * the evidence artifact the progress contract expects. The artifact records the
 * real measured metrics and the exact HEAD it was produced at; it is never written
 * when the harness fails, so a green artifact always means the suite actually ran.
 *
 * Usage: node tools/emit-adversarial-evidence.mjs [--out <file>]
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
let out = 'docs/evidence/self-modification-adversarial.json';
for (let i = 0; i < args.length; i += 1) if (args[i] === '--out') out = args[++i];

const run = spawnSync('node', ['--experimental-strip-types', 'tests/self-modification-adversarial.mjs'], {
  cwd: resolve(ROOT, PREFIX),
  encoding: 'utf8',
  timeout: 300000,
});
if (run.status !== 0) {
  console.error(`adversarial harness failed (exit ${run.status}); no evidence written`);
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
if (parsed?.verified !== true) {
  console.error('harness did not report verified:true; no evidence written');
  process.exit(1);
}

const artifact = {
  schema: 'nk1.self-modification-adversarial.v1',
  generatedAt: new Date().toISOString(),
  sha: git(['rev-parse', 'HEAD']),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  coversPaths: [`${PREFIX}/src/organism/analysis`, `${PREFIX}/tests/self-modification-adversarial.mjs`],
  verified: true,
  metrics: parsed.metrics,
  note: 'Metrics are produced by tests/self-modification-adversarial.mjs driving the real guard, divergence gate, danger model and candidate pool. No mocks. The artifact is written only when every adversarial case is refused.',
};

const outPath = resolve(ROOT, out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`NK1_ADVERSARIAL_EVIDENCE=OK sha=${artifact.sha.slice(0, 12)} cases=${parsed.metrics.adversarialCasesPassed} artifact=${outPath}`);
