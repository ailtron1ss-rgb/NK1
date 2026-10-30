import assert from 'node:assert/strict';
import test from 'node:test';
import { connectNativeSpeechHostRouter } from '../src/organism/body/NativeSpeechHostRouter.ts';

function event(overrides = {}) {
  return {
    protocol: 'nk1.native-speech-provider-event',
    version: 1,
    eventId: 'native-1',
    operationId: 'operation-1',
    sequence: 1,
    provider: 'termux-tts-speak',
    monotonicTimeMs: 100,
    phase: 'process-spawned',
    playbackVerified: false,
    ...overrides,
  };
}

function source() {
  const listeners = new Set();
  return {
    runtime: {
      subscribeNativeSpeechEvents(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    emit(value) { for (const listener of [...listeners]) listener(value); },
    listenerCount() { return listeners.size; },
  };
}

test('host router forwards versioned provider telemetry without promoting it to playback', () => {
  const bus = source();
  const received = [];
  const disconnect = connectNativeSpeechHostRouter(bus.runtime, (message) => received.push(message));
  bus.emit(event());
  assert.equal(received.length, 1);
  assert.equal(received[0].type, 'nk1.native_speech_provider_event');
  assert.equal(received[0].protocol, 'nk1.native-speech-host-envelope');
  assert.equal(received[0].event.eventId, 'native-1');
  assert.equal(received[0].event.operationId, 'operation-1');
  assert.equal(received[0].event.phase, 'process-spawned');
  assert.equal(received[0].event.playbackVerified, false);
  disconnect();
  assert.equal(bus.listenerCount(), 0);
});

test('host router rejects duplicate, regressing sequence, regressing clock and malformed events', () => {
  const bus = source();
  const received = [];
  connectNativeSpeechHostRouter(bus.runtime, (message) => received.push(message));
  bus.emit(event());
  bus.emit(event());
  bus.emit(event({ eventId: 'native-old-seq', sequence: 1, monotonicTimeMs: 110 }));
  bus.emit(event({ eventId: 'native-old-time', sequence: 2, monotonicTimeMs: 99 }));
  bus.emit(event({ eventId: 'native-fake-playback', sequence: 2, monotonicTimeMs: 110, playbackVerified: true }));
  bus.emit({ eventId: 'bad' });
  bus.emit(event({ eventId: 'native-next', sequence: 2, monotonicTimeMs: 110, phase: 'process-exited' }));
  assert.deepEqual(received.map((item) => item.event.eventId), ['native-1', 'native-next']);
});

test('publisher failures are isolated and disconnect is idempotent', () => {
  const bus = source();
  const disconnect = connectNativeSpeechHostRouter(bus.runtime, () => { throw new Error('host-down'); });
  assert.doesNotThrow(() => bus.emit(event()));
  disconnect();
  disconnect();
  assert.equal(bus.listenerCount(), 0);
  assert.doesNotThrow(() => bus.emit(event({ eventId: 'after-disconnect', sequence: 2 })));
});
