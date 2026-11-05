import test from 'node:test';
import assert from 'node:assert/strict';

const coordinatorModule = await import('../src/organism/integration/neko/NekoVoiceTurnCoordinator.ts').catch(() => ({
  NekoVoiceTurnCoordinator: class {
    async captureFinal() { return { status: 'rejected', reason: 'implementation-missing' }; }
    async cancel() { return false; }
  },
}));

function token(turnId = 'turn-1') {
  return {
    sessionEpoch: 1,
    connectionId: 'connection-1',
    leaseGeneration: 2,
    routeGeneration: 3,
    audioGeneration: 4,
    turnId,
  };
}

function frame(sequence, overrides = {}) {
  return {
    protocol: 'neko.audio.pcm16',
    version: 1,
    sessionId: 'session-1',
    turnId: 'turn-1',
    token: token(),
    sequence,
    capturedAtMs: sequence * 20,
    sampleRateHz: 16000,
    channels: 1,
    encoding: 's16le',
    samples: new Uint8Array(640),
    ...overrides,
  };
}

async function* audioFrames(count = 4) {
  for (let sequence = 0; sequence < count; sequence += 1) yield frame(sequence);
}

function acceptedTranscript(sessionId = 'session-1') {
  return {
    status: 'accepted',
    sessionId,
    eventId: 'coordinator-event-1',
    turnId: 'turn-1',
    provider: 'stream-asr-test',
    transcript: 'Курису, проверка голосового хода',
    confidence01: 0.96,
  };
}

function createCoordinator(overrides = {}) {
  const calls = { open: [], close: [], vad: [], boundary: [], asr: [], interrupt: [] };
  const input = {
    async openSession(request) {
      calls.open.push(request);
      return {
        sessionId: 'session-1',
        turnId: 'turn-1',
        token: request.token,
        frames: audioFrames(),
        async close(reason) { calls.close.push(reason); },
      };
    },
  };
  const activity = {
    async observe(inputFrame, request) {
      calls.vad.push({ sequence: inputFrame.sequence, request });
      return inputFrame.sequence === 2 ? 'candidate_pause' : 'none';
    },
  };
  const boundary = {
    async evaluate(request) {
      calls.boundary.push(request);
      return {
        status: 'OK',
        decision: 'COMPLETE',
        generation: request.generation,
        activitySeq: request.activitySeq,
      };
    },
  };
  const adapter = {
    async captureFinalFromStream(request) {
      const sequences = [];
      for await (const inputFrame of request.frames) sequences.push(inputFrame.sequence);
      calls.asr.push({ request, sequences });
      return acceptedTranscript(request.sessionId);
    },
    async interrupt(reason) {
      calls.interrupt.push(reason);
      return { status: 'verified', sessionId: 'session-1' };
    },
  };
  const coordinator = new coordinatorModule.NekoVoiceTurnCoordinator({
    audioInput: input,
    voiceActivity: activity,
    turnBoundary: boundary,
    asrAdapter: adapter,
    boundaryMode: 'smart-turn',
    ...overrides,
  });
  return { coordinator, calls };
}

test('Smart Turn closes a segment only after a current OK/COMPLETE evaluation', async () => {
  assert.equal(typeof coordinatorModule.NekoVoiceTurnCoordinator, 'function');
  const { coordinator, calls } = createCoordinator();
  const result = await coordinator.captureFinal({
    authorization: { grantId: 'host-grant-1' },
    token: token(),
    signal: new AbortController().signal,
  });
  assert.equal(result.status, 'accepted');
  assert.deepEqual(calls.boundary.map(x => x.activitySeq), [3]);
  assert.deepEqual(calls.asr[0].sequences, [0, 1, 2]);
  assert.equal(calls.close.length, 1);
});

test('native provider endpointing bypasses Smart Turn even when VAD reports candidate_pause', async () => {
  const { coordinator, calls } = createCoordinator({
    boundaryMode: 'provider',
    turnBoundary: { async evaluate() { throw new Error('native endpoint must not call Smart Turn'); } },
  });
  const result = await coordinator.captureFinal({
    authorization: { grantId: 'host-grant-2' },
    token: token(),
    signal: new AbortController().signal,
  });
  assert.equal(result.status, 'accepted');
  assert.equal(calls.boundary.length, 0);
  assert.equal(calls.asr[0].sequences.length, 4);
});

test('UNAVAILABLE Smart Turn is a distinct terminal outcome, not INCOMPLETE', async () => {
  const { coordinator, calls } = createCoordinator({
    turnBoundary: {
      async evaluate(request) {
        calls.boundary.push(request);
        return {
          status: 'UNAVAILABLE',
          decision: 'INCOMPLETE',
          generation: request.generation,
          activitySeq: request.activitySeq,
          reason: 'model-asset-unavailable',
        };
      },
    },
  });
  const result = await coordinator.captureFinal({
    authorization: { grantId: 'host-grant-3' },
    token: token(),
    signal: new AbortController().signal,
  });
  assert.deepEqual(result, { status: 'error', reason: 'turn-boundary-unavailable:model-asset-unavailable' });
  assert.equal(calls.asr.length, 0);
});

test('rejects a source sequence gap and never sends partial PCM as a valid final turn', async () => {
  const { coordinator, calls } = createCoordinator({
    audioInput: {
      async openSession(request) {
        return {
          sessionId: 'session-1',
          turnId: 'turn-1',
          token: request.token,
          frames: (async function* () {
            yield frame(0);
            yield frame(2);
          })(),
          async close(reason) { calls.close.push(reason); },
        };
      },
    },
  });
  const result = await coordinator.captureFinal({
    authorization: { grantId: 'host-grant-4' },
    token: token(),
    signal: new AbortController().signal,
  });
  assert.deepEqual(result, { status: 'error', reason: 'audio-sequence-gap' });
  assert.equal(calls.asr.length, 0);
});

console.log('NEKO_VOICE_TURN_COORDINATOR=PASS');
