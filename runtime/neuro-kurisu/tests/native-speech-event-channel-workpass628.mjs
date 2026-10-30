import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeSpeechEventChannel } from '../src/organism/body/NativeSpeechEventChannel.ts';

test('native provider events preserve per-operation identity and monotonic sequence', () => {
  let now = 10;
  const channel = createNativeSpeechEventChannel(() => now++);
  const received = [];
  channel.subscribe(event => received.push(event));
  const requested = channel.publish('speech-A', { phase: 'command-requested' });
  const spawned = channel.publish('speech-A', { phase: 'process-spawned' });
  const exited = channel.publish('speech-A', { phase: 'process-exited', exitCode: 0, signal: null });
  const other = channel.publish('speech-B', { phase: 'command-requested' });
  assert.deepEqual([requested.sequence, spawned.sequence, exited.sequence, other.sequence], [1, 2, 3, 1]);
  assert.deepEqual([requested.monotonicTimeMs, spawned.monotonicTimeMs, exited.monotonicTimeMs], [10, 11, 12]);
  assert.equal(exited.operationId, 'speech-A');
  assert.equal(exited.playbackVerified, false);
  assert.equal(received.length, 4);
});

test('native event observers cannot disrupt provider execution and can unsubscribe', () => {
  const channel = createNativeSpeechEventChannel(() => 1);
  const seen = [];
  channel.subscribe(() => { throw new Error('observer-failure'); });
  const unsubscribe = channel.subscribe(event => seen.push(event.phase));
  assert.equal(channel.publish('speech-C', { phase: 'interrupt-requested' }).phase, 'interrupt-requested');
  unsubscribe();
  channel.publish('speech-C', { phase: 'interrupt-unconfirmed', reason: 'still unknown' });
  assert.deepEqual(seen, ['interrupt-requested']);
});

test('invalid operation identity and invalid monotonic time fail closed', () => {
  const channel = createNativeSpeechEventChannel(() => Number.NaN);
  assert.equal(channel.publish('speech-D', { phase: 'command-requested' }), null);
  const validClock = createNativeSpeechEventChannel(() => 0);
  assert.equal(validClock.publish('  ', { phase: 'command-requested' }), null);
});

test('native process events are explicitly not playback lifecycle evidence', () => {
  const channel = createNativeSpeechEventChannel(() => 42);
  const spawned = channel.publish('speech-E', { phase: 'process-spawned' });
  const exited = channel.publish('speech-E', { phase: 'process-exited', exitCode: 0 });
  assert.equal(spawned.playbackVerified, false);
  assert.equal(exited.playbackVerified, false);
  assert.equal(spawned.phase, 'process-spawned');
  assert.equal(exited.phase, 'process-exited');
});

test('reentrant observers preserve a single delivery order for every subscriber', () => {
  const channel = createNativeSpeechEventChannel(() => 7);
  const first = [];
  const second = [];
  let nested = false;
  channel.subscribe(event => {
    first.push(event.sequence);
    if (!nested) {
      nested = true;
      channel.publish(event.operationId, { phase: 'process-spawned' });
    }
  });
  channel.subscribe(event => second.push(event.sequence));
  channel.publish('speech-F', { phase: 'command-requested' });
  assert.deepEqual(first, [1, 2]);
  assert.deepEqual(second, [1, 2]);
});


test('native event timestamps never regress within one operation when the clock sample moves backwards', () => {
  const samples = [100, 95, 120];
  const channel = createNativeSpeechEventChannel(() => samples.shift());
  const first = channel.publish('speech-clock', { phase: 'command-requested' });
  const second = channel.publish('speech-clock', { phase: 'process-spawned' });
  const third = channel.publish('speech-clock', { phase: 'process-exited', exitCode: 0 });
  assert.deepEqual([first.monotonicTimeMs, second.monotonicTimeMs, third.monotonicTimeMs], [100, 100, 120]);
});
