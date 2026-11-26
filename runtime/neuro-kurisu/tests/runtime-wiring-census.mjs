/**
 * Wiring census contract: canonical runtime modules must be reachable from a
 * runtime entrypoint, and the census must fail when a new module is left
 * unconnected. The baseline records today's known gaps; it may shrink, never grow.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const script = path.join(root, 'scripts/audit-runtime-wiring.mjs');
const baseline = path.join(root, 'scripts/runtime-wiring-baseline.json');

const raw = execFileSync(process.execPath, [script, '--json'], { cwd: root, encoding: 'utf8' });
const report = JSON.parse(raw);

assert.equal(report.version, 1);
assert.deepEqual(report.missingEntrypoints, [], 'every declared runtime entrypoint must exist');
assert.ok(report.canonicalModules > 100, 'census must scan the canonical runtime, not an empty tree');
assert.equal(report.connectedModules + report.orphanModules, report.canonicalModules);
assert.ok(report.connectionRatio01 > 0.5, `unexpected connection ratio ${report.connectionRatio01}`);

const baselineData = JSON.parse(readFileSync(baseline, 'utf8'));
const known = new Set(baselineData.orphans);
const unexpected = report.orphans.filter(orphan => !known.has(orphan));
assert.deepEqual(unexpected, [], `new unconnected canonical modules: ${unexpected.join(', ')}`);

// Modules that other subsystems depend on must stay reachable.
for (const required of [
  'organism/developmental/P53DevelopmentalSelfModificationLab.ts',
  'organism/research/TheInventionLoop.ts',
  'organism/learning/VerifiedOutcomeArtifact.ts',
  'organism/system/CanonicalSelfAgencyAuthority.ts',
  'organism/system/ActionGateway.ts',
  'organism/persistence/StateMigrations.ts',
]) {
  assert.ok(!known.has(required) && !report.orphans.includes(required), `${required} must be reachable from a runtime entrypoint`);
}

// Every baseline row is a real module path inside the canonical runtime.
assert.ok(baselineData.orphans.every(orphan => /^organism\\/[^/]+\\/.*\\.ts$/.test(orphan)), 'baseline rows must be canonical module paths');

console.log(`runtime wiring census PASS canonicalModules=${report.canonicalModules} connected=${report.connectedModules} knownOrphans=${baselineData.orphans.length}`);
