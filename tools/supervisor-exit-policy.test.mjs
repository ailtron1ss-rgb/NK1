import assert from 'node:assert/strict';
import test from 'node:test';
import { decideSupervisedChildExit } from './supervisor-exit-policy.mjs';

test('clean child exit during shutdown is ignored', () => {
  assert.deepEqual(decideSupervisedChildExit({
    label: 'neuro-kurisu', code: 0, signal: null, shuttingDown: true,
  }), { action: 'ignore', reason: 'supervisor-shutdown', message: '' });
});

test('unexpected exit code zero still shuts down the dependent service group', () => {
  assert.deepEqual(decideSupervisedChildExit({
    label: 'runtime', code: 0, signal: null, shuttingDown: false,
  }), {
    action: 'shutdown',
    reason: 'child:runtime:unexpected-zero-exit',
    message: '[super] runtime exited unexpectedly with code 0',
  });
});

test('signal termination cannot leave the remaining services running alone', () => {
  const result = decideSupervisedChildExit({
    label: 'gateway', code: null, signal: 'SIGTERM', shuttingDown: false,
  });
  assert.equal(result.action, 'shutdown');
  assert.equal(result.reason, 'child:gateway:SIGTERM');
  assert.match(result.message, /exited unexpectedly via SIGTERM/);
});

test('abnormal and unknown exits produce deterministic shutdown reasons', () => {
  assert.equal(decideSupervisedChildExit({
    label: 'ui-preview', code: 137, signal: null, shuttingDown: false,
  }).reason, 'child:ui-preview:exit-137');
  assert.equal(decideSupervisedChildExit({
    label: '', code: null, signal: null, shuttingDown: false,
  }).reason, 'child:unknown-service:exit-unknown');
});

test('service labels and signal text are bounded and sanitized', () => {
  const result = decideSupervisedChildExit({
    label: 'gate\nway'.repeat(30), code: null, signal: 'SIG\nTERM', shuttingDown: false,
  });
  assert.equal(result.action, 'shutdown');
  assert.ok(result.reason.length < 150);
  assert.doesNotMatch(result.reason, /\n/);
});

console.log('NK1 supervised-child exit policy regressions passed');
