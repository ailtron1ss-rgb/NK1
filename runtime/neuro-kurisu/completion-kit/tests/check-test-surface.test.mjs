import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTestSurface } from '../scripts/check-test-surface.mjs';

test('accepts gate commands declared by either repository package manifest', () => {
  const report = auditTestSurface({
    gates: { gates: [{ id: 'foundation', scripts: ['typecheck', 'test:runtime'] }] },
    rootScripts: { typecheck: 'npm run typecheck' },
    runtimeScripts: { 'test:runtime': 'node tests/runtime.mjs' }
  });
  assert.equal(report.pass, true);
  assert.deepEqual(report.failures, []);
});

test('fails closed when a gate references a command absent from both manifests', () => {
  const report = auditTestSurface({
    gates: { gates: [{ id: 'memory', scripts: ['test:missing-memory-gate'] }] },
    rootScripts: {},
    runtimeScripts: {}
  });
  assert.equal(report.pass, false);
  assert.deepEqual(report.failures, ['missing-gate-script:memory:test:missing-memory-gate']);
});

test('rejects duplicate gate identifiers and empty script lists', () => {
  const report = auditTestSurface({
    gates: { gates: [
      { id: 'foundation', scripts: ['typecheck'] },
      { id: 'foundation', scripts: [] }
    ] },
    rootScripts: { typecheck: 'tsc --noEmit' },
    runtimeScripts: {}
  });
  assert.equal(report.pass, false);
  assert.ok(report.failures.includes('duplicate-or-empty-gate-id:foundation'));
  assert.ok(report.failures.includes('gate-has-no-scripts:foundation'));
});
