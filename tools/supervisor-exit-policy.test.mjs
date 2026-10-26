import assert from 'node:assert/strict';
import test from 'node:test';
import { decideSupervisedChildExit, decideSupervisedChildSpawnError } from './supervisor-exit-policy.mjs';

test('clean child exit during shutdown is ignored', () => {
  assert.deepEqual(decideSupervisedChildExit({
    label: 'neuro-kurisu', code: 0, signal: null, shuttingDown: true,
  }), { action: 'ignore', exitCode: 0, reason: 'supervisor-shutdown', message: '' });
});

test('unexpected exit code zero still shuts down the dependent service group', () => {
  assert.deepEqual(decideSupervisedChildExit({
    label: 'runtime', code: 0, signal: null, shuttingDown: false,
  }), {
    action: 'shutdown',
    exitCode: 1,
    reason: 'child:runtime:unexpected-zero-exit',
    message: '[super] runtime exited unexpectedly with code 0',
  });
});

test('signal termination cannot leave the remaining services running alone', () => {
  const result = decideSupervisedChildExit({
    label: 'gateway', code: null, signal: 'SIGTERM', shuttingDown: false,
  });
  assert.equal(result.action, 'shutdown');
  assert.equal(result.exitCode, 1);
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
  assert.equal(result.exitCode, 1);
  assert.ok(result.reason.length < 150);
  assert.doesNotMatch(result.reason, /\n/);
});

console.log('NK1 supervised-child exit policy regressions passed');

test('spawn failure shuts down siblings rather than leaving a partial organism alive', () => {
  assert.deepEqual(decideSupervisedChildSpawnError({
    label: 'research-bridge', errorMessage: 'ENOENT: python3 missing', shuttingDown: false,
  }), {
    action: 'shutdown',
    exitCode: 1,
    reason: 'child:research-bridge:spawn-error',
    message: '[super] research-bridge spawn error: ENOENT: python3 missing',
  });
});

test('spawn errors during coordinated shutdown are ignored and details are sanitized', () => {
  assert.deepEqual(decideSupervisedChildSpawnError({
    label: 'runtime', errorMessage: 'already stopping', shuttingDown: true,
  }), { action: 'ignore', exitCode: 0, reason: 'supervisor-shutdown', message: '' });
  const result = decideSupervisedChildSpawnError({
    label: 'ui-preview',
    errorMessage: 'bad\nmessage\u0000more',
    shuttingDown: false,
  });
  assert.equal(result.action, 'shutdown');
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(result.message, /[\u0000-\u001f\u007f-\u009f]/);
  assert.ok(result.message.length < 320);
});
