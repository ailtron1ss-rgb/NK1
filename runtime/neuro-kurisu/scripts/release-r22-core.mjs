import { spawnSync } from 'node:child_process';
import process from 'node:process';

const NODE = process.execPath;
const strip = (file) => [NODE, '--experimental-strip-types', file];
const plain = (file) => [NODE, file];
const steps = [
  ['typecheck', plain('scripts/typecheck-runtime.mjs')],
  ['memory-value-byte', strip('tests/p2897-memory-value-per-byte.mjs')],
  ['correction-capsules', strip('tests/p2898-correction-aware-capsules.mjs')],
  ['actionability-holdout', strip('tests/p2896-actionable-world-model.mjs')],
  ['semantic-audit', plain('scripts/audit-semantic-coverage.mjs')],
  ['operation-coverage', plain('scripts/audit-operation-semantic-coverage.mjs')],
  ['operation-test', strip('tests/p2899-operation-semantic-coverage.mjs')],
  ['operation-runtime', strip('tests/p2902-runtime-operation-evidence.mjs')],
  ['anti-decoration', plain('scripts/audit-r22-anti-decoration.mjs')],
  ['mobile-equivalence', strip('tests/p2868-mobile-semantic-equivalence.mjs')],
  ['causal-calibration', strip('tests/p2842-causal-calibration.mjs')],
  ['manifests', plain('scripts/generate-manifests.mjs')],
  ['archive-manifest', plain('scripts/generate-archive-manifest.mjs')],
  ['contract', plain('scripts/audit-release-contract.mjs')],
  ['release-source', strip('scripts/verify-release-source.mjs')],
];

const timeoutMs = 120000;
const results = [];
const env = { ...process.env, TERM: process.env.TERM || 'xterm' };
for (const [name, command] of steps) {
  const [exe, ...args] = command;
  const r = spawnSync(exe, args, { stdio: 'inherit', timeout: timeoutMs, windowsHide: true, cwd: process.cwd(), env });
  results.push({ name, status: r.status, signal: r.signal, error: r.error?.message ?? null });
  if (r.error || r.status !== 0) {
    console.error(JSON.stringify({ pass: false, failed: name, results }));
    process.exit(1);
  }
}
console.log(JSON.stringify({ pass: true, profile: 'functional-core', steps: results.length, results }));
