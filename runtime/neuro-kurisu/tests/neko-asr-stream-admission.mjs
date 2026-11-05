import test from 'node:test';
import assert from 'node:assert/strict';
import { NekoAsrTranscriptAdapter } from '../src/organism/integration/neko/NekoAsrTranscriptAdapter.ts';

function token() {
  return {
    sessionEpoch: 1, connectionId: 'connection-1', leaseGeneration: 2,
    routeGeneration: 3, audioGeneration: 4, turnId: 'turn-1',
  };
}

function frame(sequence = 0) {
  return {
    protocol: 'neko.audio.pcm16', version: 1, sessionId: 'session-1',
    turnId: 'turn-1', token: token(), sequence, capturedAtMs: sequence * 20,
    sampleRateHz: 16000, channels: 1, encoding: 's16le', samples: new Uint8Array(640),
  };
}

function envelope(sessionId, turnId = 'turn-1', overrides = {}) {
  return {
    protocol: 'neko.asr.transcript', version: 1, eventId: 'stream-event-1',
    sessionId, turnId, provider: 'stream-asr-test', speakerRole: 'user',
    phase: 'final', transcript: 'Потоковая речь принята', confidence01: 0.94,
    ...overrides,
  };
}

function captureStream(adapter, request) {
  return typeof adapter.captureFinalFromStream === 'function'
    ? adapter.captureFinalFromStream(request)
    : Promise.resolve({ status: 'rejected', reason: 'stream-not-supported' });
}

function provider(overrides = {}) {
  const calls = { stream: [], capture: [], cancel: [] };
  return {
    calls,
    port: {
      providerId: 'stream-asr-test',
      isAvailable: () => true,
      async captureFinal(input) { calls.capture.push(input); return null; },
      async transcribeStream(input) {
        calls.stream.push(input);
        return envelope(input.sessionId, input.turnId);
      },
      async cancelSession(input) {
        calls.cancel.push(input);
        return { requested: true, verified: true };
      },
      ...overrides,
    },
  };
}

test('admits one stream final through the existing transcript boundary with host session and turn binding', async () => {
  const { port, calls } = provider();
  const adapter = new NekoAsrTranscriptAdapter(port);
  const result = await captureStream(adapter, {
    sessionId: 'session-1', turnId: 'turn-1', token: token(),
    frames: [frame()][Symbol.iterator](),
    signal: new AbortController().signal,
  });
  assert.equal(result.status, 'accepted');
  assert.equal(result.transcript, 'Потоковая речь принята');
  assert.equal(calls.stream.length, 1);
  assert.equal(calls.stream[0].sessionId, 'session-1');
  assert.equal(calls.stream[0].turnId, 'turn-1');
  assert.equal(calls.stream[0].signal instanceof AbortSignal, true);
  assert.equal(calls.capture.length, 0, 'stream admission must not fall back to one-shot capture');
});

test('rejects a provider envelope bound to another turn before admitting its transcript', async () => {
  const { port } = provider({
    async transcribeStream(input) { return envelope(input.sessionId, 'different-turn'); },
  });
  const result = await captureStream(new NekoAsrTranscriptAdapter(port), {
    sessionId: 'session-1', turnId: 'turn-1', token: token(),
    frames: [frame()][Symbol.iterator](), signal: new AbortController().signal,
  });
  assert.deepEqual(result, { status: 'rejected', reason: 'turn-mismatch' });
});

test('reserves one active stream and fences a final result that resolves after abort', async () => {
  let release;
  let started;
  const isStarted = new Promise(resolve => { started = resolve; });
  const { port } = provider({
    async transcribeStream(input) {
      started();
      return new Promise(resolve => { release = () => resolve(envelope(input.sessionId, input.turnId)); });
    },
  });
  const adapter = new NekoAsrTranscriptAdapter(port);
  const controller = new AbortController();
  const pending = adapter.captureFinalFromStream({
    sessionId: 'session-1', turnId: 'turn-1', token: token(),
    frames: [frame()][Symbol.iterator](), signal: controller.signal,
  });
  await isStarted;
  const overlap = await adapter.captureFinalFromStream({
    sessionId: 'session-2', turnId: 'turn-2',
    token: { ...token(), turnId: 'turn-2' }, frames: [frame()][Symbol.iterator](),
    signal: new AbortController().signal,
  });
  assert.deepEqual(overlap, { status: 'rejected', reason: 'session-already-active' });
  controller.abort('voice-session-replaced');
  release();
  assert.deepEqual(await pending, { status: 'cancelled', sessionId: 'session-1' });
});

test('requires stream-capable provider and matching host turn token', async () => {
  const { port } = provider();
  const adapter = new NekoAsrTranscriptAdapter({ ...port, transcribeStream: undefined });
  const unsupported = await captureStream(adapter, {
    sessionId: 'session-1', turnId: 'turn-1', token: token(),
    frames: [frame()][Symbol.iterator](), signal: new AbortController().signal,
  });
  assert.deepEqual(unsupported, { status: 'rejected', reason: 'stream-not-supported' });
});
console.log('NEKO_ASR_STREAM_ADMISSION=PASS');
