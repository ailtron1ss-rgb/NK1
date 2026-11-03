#!/usr/bin/env node
/**
 * Runs the owning test set on the current commit and writes a reproducible
 * evidence artifact. This exists because GitHub Actions on this repository has been
 * blocked by an account billing failure, so exact-head CI results are unavailable
 * and "tests were not run" cannot be distinguished from "tests failed".
 *
 * The runner never claims more than it observed: it records the exit code and a
 * bounded tail of stdout/stderr per step, and marks the artifact `verified: false`
 * when any step fails. It does not modify the working tree.
 *
 * Usage: node tools/run-local-gate.mjs [--prefix <dir>] [--out <file>] [--step <script>]
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function parseArgs(argv) {
  const out = { prefix: 'runtime/neuro-kurisu', out: null, steps: [], timeoutMs: 600000 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prefix') out.prefix = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--step') out.steps.push(argv[++i]);
    else if (arg === '--timeout-ms') out.timeoutMs = Number(argv[++i]);
  }
  return out;
}

/**
 * The owning gate set. Each entry is a package.json script that must exist; a missing
 * script is recorded as a failure rather than silently skipped, so the artifact
 * cannot look green because a step was renamed away.
 */
const DEFAULT_STEPS = [
  'test:cognitive-cycle-boundary',
  'test:cognitive-cycle-boundary-runtime-wiring',
  'test:workpass287:cognitive-cycle',
  'test:self-analysis-substrate',
  'test:world-perception',
  'test:big-pass-224',
];

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readScripts(prefix) {
  const pkgPath = resolve(ROOT, prefix, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}

function tail(text, max = 2000) {
  const value = String(text ?? '');
  return value.length <= max ? value : `…${value.slice(value.length - max)}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const steps = args.steps.length ? args.steps : DEFAULT_STEPS;
  const scripts = readScripts(args.prefix);
  const sha = git(['rev-parse', 'HEAD']);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const results = [];

  for (const step of steps) {
    if (!scripts[step]) {
      results.push({ step, status: 'missing-script', exitCode: null, tail: '' });
      continue;
    }
    const started = Date.now();
    const run = spawnSync('npm', ['--prefix', args.prefix, 'run', step], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: args.timeoutMs,
    });
    results.push({
      step,
      status: run.status === 0 ? 'pass' : 'fail',
      exitCode: run.status,
      durationMs: Date.now() - started,
      tail: tail(`${run.stdout ?? ''}\n${run.stderr ?? ''}`),
    });
  }

  const failed = results.filter((r) => r.status !== 'pass');
  const artifact = {
    schema: 'nk1.local-gate.v1',
    generatedAt: new Date().toISOString(),
    sha,
    branch,
    node: process.version,
    prefix: args.prefix,
    verified: failed.length === 0,
    steps: results,
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      failedSteps: failed.map((r) => r.step),
    },
  };

  const outPath = resolve(ROOT, args.out ?? `docs/evidence/local-gate-${sha.slice(0, 12) || 'unknown'}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`NK1_LOCAL_GATE=${artifact.verified ? 'PASS' : 'FAIL'} sha=${sha.slice(0, 12)} passed=${artifact.summary.passed}/${artifact.summary.total} artifact=${outPath}`);
  if (!artifact.verified) console.log(`failed: ${artifact.summary.failedSteps.join(', ')}`);
  process.exit(artifact.verified ? 0 : 1);
}

main();
