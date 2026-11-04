import test from 'node:test';
import assert from 'node:assert/strict';
import { NekoAsrTranscriptAdapter } from '../src/organism/integration/neko/NekoAsrTranscriptAdapter.ts';

function transcript(overrides = {}) {
  return {
    protocol: 'neko.asr.transcript',
    version: 1,
    eventId: 'evt-001',
    sessionId: 'session-1',
    turnId: 'turn-1',
    provider: 'faster-whisper-local',
    speakerRole: 'user',
    phase: 'final',
    transcript: ' Привет, Курису!  ',
    confidence01: 0.92,
    language: 'ru-RU',
    ...overrides,
  };
}

function sileroFrame(index, probability01 = 0.9, patch = {}) {
  return {
    sampleRateHz: 16_000,
    startSample: index * 512,
    endSample: (index + 1) * 512,
    probability01,
    ...patch,
  };
}

function provider(result, overrides = {}) {
  const calls = { capture: [], cancel: [] };
  const port = {
    providerId: 'faster-whisper-local',
    async isAvailable() { return true; },
    async captureFinal(input) { calls.capture.push(input); return typeof result === 'function' ? result(input) : result; },
    async cancelSession(input) { calls.cancel.push(input); return { requested: true, verified: true }; },
    ...overrides,
  };
  return { port, calls };
}

test('accepts only a final user transcript bound to the active host session', async () => {
  const { port, calls } = provider(input => transcript({ sessionId: input.sessionId }));
  const adapter = new NekoAsrTranscriptAdapter(port);
  const result = await adapter.captureFinal();
  assert.equal(result.status, 'accepted');
  assert.equal(result.transcript, 'Привет, Курису!');
  assert.equal(result.provider, 'faster-whisper-local');
  assert.equal(calls.capture.length, 1);
  assert.equal(calls.capture[0].signal instanceof AbortSignal, true);
  assert.equal(calls.capture[0].sessionId.length > 0, true);
});

test('collects sample-scoped VAD admission as shadow evidence without owning transcript admission', async () => {
  let lastSnapshot = null;
  const { port } = provider(async input => {
    for (let index = 0; index < 8; index += 1) {
      lastSnapshot = input.observeSileroProbabilityWindow(sileroFrame(index));
    }
    return transcript({ sessionId: input.sessionId });
  });
  const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
  assert.equal(result.status, 'accepted');
  assert.equal(result.speechAdmission?.decision, 'admit');
  assert.equal(result.speechAdmission?.reason, 'speech_window');
  assert.equal(result.speechAdmission?.sampleRateHz, 16_000);
  assert.equal(result.speechAdmission?.voicedAudioMs, 256);
  assert.equal(result.speechAdmission?.terminalAudioEndSample, 7 * 512);
  assert.equal(lastSnapshot, result.speechAdmission);
  assert.equal(Object.isFrozen(result.speechAdmission), true);
});

test('malformed local VAD evidence is diagnostic only and never rejects a valid ASR transcript', async () => {
  const { port } = provider(async input => {
    assert.equal(input.observeSileroProbabilityWindow(sileroFrame(0, Number.NaN)), null);
    return transcript({ sessionId: input.sessionId });
  });
  const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
  assert.equal(result.status, 'accepted');
  assert.equal(result.speechAdmission, undefined);
  assert.equal(result.speechAdmissionError, 'invalid-speech-probability-window');
});

test('late VAD probability callbacks are fenced after the ASR capture completes', async () => {
  let lateObserver;
  const { port } = provider(async input => {
    lateObserver = input.observeSileroProbabilityWindow;
    lateObserver(sileroFrame(0));
    return transcript({ sessionId: input.sessionId });
  });
  const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
  const before = result.speechAdmission;
  assert.ok(before);
  assert.equal(lateObserver(sileroFrame(1)), null);
  assert.equal(result.speechAdmission, before);
  assert.equal(result.speechAdmission?.audioEndSample, 512);
});

test('rejects partial and non-user transcripts before exposing text', async () => {
  for (const patch of [{ phase: 'partial' }, { speakerRole: 'assistant' }, { speakerRole: 'unknown' }]) {
    const { port } = provider(input => transcript({ sessionId: input.sessionId, ...patch }));
    const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
    assert.equal(result.status, 'rejected');
    assert.equal(result.transcript, undefined);
  }
});

test('rejects session spoofing, malformed objects, and unsafe transcript size', async () => {
  const cases = [
    () => transcript({ sessionId: 'other-session' }),
    input => transcript({ transcript: 'x'.repeat(4001), sessionId: input.sessionId }),
    input => transcript({ confidence01: Number.NaN, sessionId: input.sessionId }),
    input => transcript({ extraAuthority: true, sessionId: input.sessionId }),
  ];
  for (const make of cases) {
    const { port } = provider(make);
    const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
    assert.equal(result.status, 'rejected');
  }
  const accessor = transcript();
  Object.defineProperty(accessor, 'transcript', { enumerable: true, get() { throw new Error('getter must not run'); } });
  const { port } = provider(input => { const value = accessor; value.sessionId = input.sessionId; return value; });
  const result = await new NekoAsrTranscriptAdapter(port).captureFinal();
  assert.equal(result.status, 'rejected');
});

test('deduplicates replayed final event IDs and rejects conflicting replay payloads', async () => {
  let emitted = transcript();
  const { port } = provider(input => ({ ...emitted, sessionId: input.sessionId }));
  const adapter = new NekoAsrTranscriptAdapter(port);
  const first = await adapter.captureFinal();
  assert.equal(first.status, 'accepted');
  const second = await adapter.captureFinal();
  assert.equal(second.status, 'replayed');
  emitted = transcript({ transcript: 'Подмена текста' });
  const third = await adapter.captureFinal();
  assert.equal(third.status, 'rejected');
  assert.equal(third.reason, 'event-id-conflict');
});

test('allows only one active provider capture at a time', async () => {
  let release;
  const { port } = provider(() => new Promise(resolve => { release = resolve; }));
  const adapter = new NekoAsrTranscriptAdapter(port);
  const pending = adapter.captureFinal();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const overlap = await adapter.captureFinal();
  assert.equal(overlap.status, 'rejected');
  assert.equal(overlap.reason, 'session-already-active');
  release(transcript({ sessionId: adapter.activeSessionId }));
  assert.equal((await pending).status, 'accepted');
});

test('reserves the capture slot before awaiting provider availability', async () => {
  let makeAvailable;
  const releaseCaptures = [];
  const availability = new Promise(resolve => { makeAvailable = resolve; });
  let captureCalls = 0;
  const port = {
    providerId: 'faster-whisper-local',
    isAvailable: () => availability,
    async captureFinal(input) {
      captureCalls += 1;
      const eventId = 'evt-race-' + captureCalls;
      return new Promise(resolve => releaseCaptures.push(() => resolve(transcript({ sessionId: input.sessionId, eventId }))));
    },
  };
  const adapter = new NekoAsrTranscriptAdapter(port);
  const first = adapter.captureFinal();
  const second = adapter.captureFinal();
  makeAvailable(true);
  while (releaseCaptures.length < 1) await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  for (const release of releaseCaptures) release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status, 'accepted');
  assert.equal(secondResult.status, 'rejected');
  assert.equal(secondResult.reason, 'session-already-active');
  assert.equal(captureCalls, 1);
});

test('reports cancellation only when the provider confirms the capture stopped', async () => {
  let release;
  const { port, calls } = provider(() => new Promise(resolve => { release = resolve; }), {
    async cancelSession(input) { calls.cancel.push(input); return { requested: true, verified: false, reason: 'host-process-exited-only' }; },
  });
  const adapter = new NekoAsrTranscriptAdapter(port);
  const pending = adapter.captureFinal();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const result = await adapter.interrupt('user-interrupt');
  assert.equal(result.status, 'unverified');
  assert.equal(calls.cancel.length, 1);
  release(transcript({ sessionId: adapter.activeSessionId }));
  assert.equal((await pending).status, 'cancelled');
});

test('verified cancellation fences a late provider transcript', async () => {
  let release;
  const { port } = provider(() => new Promise(resolve => { release = resolve; }));
  const adapter = new NekoAsrTranscriptAdapter(port);
  const pending = adapter.captureFinal();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const result = await adapter.interrupt('user-interrupt');
  assert.equal(result.status, 'verified');
  release(transcript({ sessionId: adapter.activeSessionId ?? 'stale-session' }));
  assert.equal((await pending).status, 'cancelled');
});

console.log('NEKO_ASR_TRANSCRIPT_ADAPTER_TESTS=PASS');
