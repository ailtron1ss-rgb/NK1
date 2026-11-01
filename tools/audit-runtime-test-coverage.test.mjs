import assert from 'node:assert/strict';
import test from 'node:test';
import { findDuplicateTestScriptInvocations } from './audit-runtime-test-coverage.mjs';

test('detects repeated nested test invocations inside one composite test script', () => {
  const duplicates = findDuplicateTestScriptInvocations({
    'test:rebuild-recovered': [
      'npm --prefix runtime/neuro-kurisu run test:planner-restore',
      'npm run test:planner-restore',
      'npm run test:memory-restore',
    ].join(' && '),
  });

  assert.deepEqual(duplicates, [
    { script: 'test:rebuild-recovered', target: 'test:planner-restore', count: 2 },
  ]);
});

test('does not treat a shared child test across separate scripts as a duplicate', () => {
  const duplicates = findDuplicateTestScriptInvocations({
    'test:unit': 'npm run test:planner-restore',
    'test:integration': 'npm --prefix runtime/neuro-kurisu run test:planner-restore',
  });

  assert.deepEqual(duplicates, []);
});

test('ignores repeated test calls in non-test release scripts', () => {
  const duplicates = findDuplicateTestScriptInvocations({
    'release:brain216': 'npm run test:planner-restore && npm run test:planner-restore',
    'audit:release': 'npm run test:planner-restore && npm run test:planner-restore',
  });

  assert.deepEqual(duplicates, []);
});

test('returns deterministic findings and ignores non-test child commands', () => {
  const duplicates = findDuplicateTestScriptInvocations({
    'test:zeta': 'npm run build && npm run test:b && npm run test:b',
    'test:alpha': 'npm run test:a && npm --prefix app run test:a',
  });

  assert.deepEqual(duplicates, [
    { script: 'test:alpha', target: 'test:a', count: 2 },
    { script: 'test:zeta', target: 'test:b', count: 2 },
  ]);
});
