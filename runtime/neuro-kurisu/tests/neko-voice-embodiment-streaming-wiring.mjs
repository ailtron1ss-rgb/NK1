import test from 'node:test';
import assert from 'node:assert/strict';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';

function token() {
  return {
    sessionEpoch: 1,
    connectionId: 'android-host-1',
    leaseGeneration: 2,
    routeGeneration: 3,
    audioGeneration: 4,
    turnId: 'voice-turn-1',
  };
}

function frame(sessionId = 'session-stream-1', sequence = 0) {
  return {
    protocol: 'neko.audio.pcm16',
    version: 1,
    sessionId,
    turnId: 'voice-turn-1',
    token: token(),
    sequence,
    capturedAtMs: sequence * 20,
    sampleRateHz: 16000,
    channels: 1,
    encoding: 's16le',
    samples: new Uint8Array(640),
  };
}

function envelope(sessionId, turnId, eventId = 'streaming-embodiment-event') {
  return {
    protocol: 'neko.asr.transcript',
    version: 1,
    eventId,
    sessionId,
    turnId,
    provider: 'faster-whisper-local',
    speakerRole: 'user',
    phase: 'final',
    transcript: 'Проверка потокового входа в NeuroCore',
    confidence01: 0.93,
    language: 'ru-RU',
  };
}

function makeInputPort(calls, options = {}) {
  return {
    async openSession(request) {
      calls.open.push(request);
      return {
        sessionId: 'session-stream-1',
        turnId: request.token.turnId,
        token: request.token,
        frames: (async function* () {
          yield frame('session-stream-1', 0);
          if (options.waitForAbort) {
            await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }));
          }
        })(),
        async close(reason) {
          calls.close.push(reason);
          return options.closeVerified === false
            ? { requested: true, verified: false, reason: 'host-close-unconfirmed' }
            : { requested: true, verified: true };
        },
      };
    },
  };
}

function configureStreaming(runtime, input, contextProvider, boundaryMode = 'provider') {
  assert.equal(typeof runtime.setNekoStreamingAudioInput, 'function', 'streaming audio wiring must be exposed by EmbodimentRuntime');
  if (typeof runtime.setNekoStreamingAudioInput !== 'function') return false;
  runtime.setNekoStreamingAudioInput(input, contextProvider, { boundaryMode });
  runtime.body.sttAvailable = true;
  return true;
}

test('EmbodimentRuntime routes an authorized stream through the coordinator and preserves final provenance', async () => {
  const calls = { open: [], close: [], stream: [], oneShot: [] };
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal(request) { calls.oneShot.push(request); return null; },
    async transcribeStream(request) {
      const sequences = [];
      for await (const inputFrame of request.frames) sequences.push(inputFrame.sequence);
      calls.stream.push({ sessionId: request.sessionId, turnId: request.turnId, sequences });
      return envelope(request.sessionId, request.turnId);
    },
    async cancelSession() { return { requested: true, verified: true }; },
  });
  if (!configureStreaming(runtime, makeInputPort(calls), () => ({
    authorization: { grantId: 'host-consent-1' },
    token: token(),
  }))) return;

  const result = await runtime.listenDetailed();
  assert.deepEqual(result, {
    text: 'Проверка потокового входа в NeuroCore',
    providerId: 'faster-whisper-local',
    confidence01: 0.93,
    language: 'ru-RU',
    eventId: 'streaming-embodiment-event',
    turnId: 'voice-turn-1',
  });
  assert.equal(calls.open.length, 1);
  assert.deepEqual(calls.stream[0].sequences, [0]);
  assert.equal(calls.oneShot.length, 0, 'the one-shot capture path must not be used when streaming is configured');
  assert.equal(runtime.voiceSnapshot().state.listening, false);
});

test('streaming capture fails closed when the host does not issue an explicit authorization grant', async () => {
  const calls = { open: [], close: [], stream: [], oneShot: [] };
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal(request) { calls.oneShot.push(request); return null; },
    async transcribeStream(request) {
      calls.stream.push(request);
      return envelope(request.sessionId, request.turnId);
    },
  });
  if (!configureStreaming(runtime, makeInputPort(calls), () => null)) return;

  assert.equal(await runtime.listenDetailed(), null);
  assert.equal(calls.open.length, 0);
  assert.equal(calls.stream.length, 0);
  assert.equal(calls.oneShot.length, 0);
  assert.equal(runtime.voiceSnapshot().state.lastError, 'voice-capture-authorization-required');
});

test('configured streaming input does not silently fall back to one-shot ASR when provider lacks stream capability', async () => {
  const calls = { open: [], close: [], oneShot: [] };
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal(request) { calls.oneShot.push(request); return envelope(request.sessionId, request.sessionId); },
  });
  if (!configureStreaming(runtime, makeInputPort(calls), () => ({
    authorization: { grantId: 'host-consent-no-stream' },
    token: token(),
  }))) return;

  assert.equal(await runtime.listenDetailed(), null);
  assert.equal(calls.open.length, 1);
  assert.equal(calls.oneShot.length, 0);
  assert.match(runtime.voiceSnapshot().state.lastError, /stream-not-supported/);
});

test('reports voice interruption verified only when both audio host and ASR provider confirm stop', async () => {
  const calls = { open: [], close: [], stream: [], cancel: [] };
  let captureStarted;
  const started = new Promise(resolve => { captureStarted = resolve; });
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal() { return null; },
    async transcribeStream(request) {
      captureStarted();
      await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }));
      return null;
    },
    async cancelSession(request) {
      calls.cancel.push(request);
      return { requested: true, verified: true };
    },
  });
  if (!configureStreaming(runtime, makeInputPort(calls, { waitForAbort: true, closeVerified: true }), () => ({
    authorization: { grantId: 'host-consent-interrupt' },
    token: token(),
  }))) return;

  const pending = runtime.listenDetailed();
  await started;
  assert.equal(await runtime.markVoiceInterruption('user-interrupt'), true);
  assert.equal(calls.cancel.length, 1);
  assert.equal(calls.close.length, 1);
  assert.equal(await pending, null);
  assert.equal(runtime.voiceSnapshot().state.interruptionCount, 1);
});

test('does not claim voice interruption verified when audio host closure is unverified', async () => {
  const calls = { open: [], close: [], stream: [], cancel: [] };
  let captureStarted;
  const started = new Promise(resolve => { captureStarted = resolve; });
  const runtime = new EmbodimentRuntime();
  runtime.setNekoAsrProvider({
    providerId: 'faster-whisper-local',
    isAvailable: () => true,
    async captureFinal() { return null; },
    async transcribeStream(request) {
      captureStarted();
      await new Promise(resolve => request.signal.addEventListener('abort', resolve, { once: true }));
      return null;
    },
    async cancelSession(request) {
      calls.cancel.push(request);
      return { requested: true, verified: true };
    },
  });
  if (!configureStreaming(runtime, makeInputPort(calls, { waitForAbort: true, closeVerified: false }), () => ({
    authorization: { grantId: 'host-consent-interrupt-unverified' },
    token: token(),
  }))) return;

  const pending = runtime.listenDetailed();
  await started;
  assert.equal(await runtime.markVoiceInterruption('user-interrupt'), false);
  assert.equal(calls.cancel.length, 1);
  assert.equal(await pending, null);
  assert.equal(runtime.voiceSnapshot().state.interruptionCount, 0);
});

console.log('NEKO_VOICE_EMBODIMENT_STREAMING_WIRING=PASS');
