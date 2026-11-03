#!/usr/bin/env node
/**
 * Runs the cognitive-cycle soak and writes its evidence artifact.
 *
 * The artifact is `verified: true` in the sense that the harness ran to completion and
 * these numbers are the measured ones. It deliberately does NOT assert that the runtime
 * meets the contract thresholds: the W1 contract decides that, and right now it must
 * FAIL, because the cycle is only deterministic for a finite horizon and no target device
 * has been measured. Emitting the measurement is what makes the defect visible instead of
 * leaving the probe stuck on "file missing".
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PREFIX = 'runtime/neuro-kurisu';

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

const soak = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/cognitive-cycle-soak.mjs'], {
  cwd: resolve(ROOT, PREFIX),
  encoding: 'utf8',
  env: { ...process.env, NK1_SOAK_TICKS: process.env.NK1_SOAK_TICKS ?? '200' },
});
if (soak.status !== 0) {
  process.stderr.write(soak.stderr || soak.stdout || 'soak harness failed\n');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(soak.stdout.slice(soak.stdout.indexOf('{')));
} catch (error) {
  process.stderr.write(`could not parse soak output: ${String(error?.message || error)}\n${soak.stdout}\n`);
  process.exit(1);
}

const artifact = {
  schema: 'nk1.cognitive-cycle-soak.v1',
  generatedAt: new Date().toISOString(),
  sha: git(['rev-parse', 'HEAD']),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  coversPaths: [`${PREFIX}/src/organism/core`, `${PREFIX}/tests/cognitive-cycle-soak.mjs`],
  verified: true,
  metrics: parsed.metrics,
  profile: parsed.profile,
  host: parsed.host,
  knownDefect: parsed.knownDefect,
  limitation: parsed.limitation,
  note: 'Metrics are measured by running the real OrganismRuntime twice. `deterministicTicks` is the measured divergence horizon, not a target; it is below the 10000 the W1 contract requires until the runtime nondeterminism is fixed. `maxTickMs` is a development-host number, not a device measurement.',
};

const out = resolve(ROOT, 'docs/evidence/cognitive-cycle-soak.json');
writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`NK1_CYCLE_SOAK_EVIDENCE=OK sha=${artifact.sha.slice(0, 12)} deterministicTicks=${artifact.metrics.deterministicTicks} maxTickMs=${artifact.metrics.maxTickMs} artifact=${out}`);
