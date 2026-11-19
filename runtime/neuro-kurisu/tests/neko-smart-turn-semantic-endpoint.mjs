import test from 'node:test';
import assert from 'node:assert/strict';
import { NekoSmartTurnCoordinator } from '../src/organism/integration/neko/NekoSmartTurnCoordinator.ts';

function pcm16(samples = 6400, value = 0) {
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i += 1) view.setInt16(i * 2, value, true);
  return bytes;
}
function predictor(probability01 = 0.82, overrides = {}) {
  const calls = [];
  return {
    calls,
    port: {
      modelId: 'pipecat-smart-turn-v3.2-cpu',
      modelVersion: 'f766f81d3cfdf7737ac64aad813d91bbfd56bf93',
      isAvailable: () => true,
      async evaluate(input) {
        calls.push(input);
        return { probability01 };
      },
      ...overrides,
    },
  };
}
function audio(coordinator, seconds = 1) {
  const frameSamples = 1600; // 100 ms
  for (let i = 0; i < seconds * 10; i += 1) {
    assert.equal(coordinator.pushAudioFrame({
      sampleRateHz: 16_000,
      pcm16: pcm16(frameSamples, i),
    }), true);
  }
}

test('Smart Turn evaluates PCM16 mono 16 kHz audio only after a pause candidate', async () => {
  const { port, calls } = predictor(0.82);
  const coordinator = new NekoSmartTurnCoordinator('session-smart-a', port);
  audio(coordinator, 2);
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const result = await coordinator.evaluateSemanticEndpoint();
  assert.equal(result.status, 'ok');
  assert.equal(result.decision, 'complete');
  assert.equal(result.probability01, 0.82);
  assert.equal(result.threshold, 0.5);
  assert.equal(result.audioSamples, 32_000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sampleRateHz, 16_000);
  assert.equal(calls[0].channels, 1);
  assert.equal(calls[0].encoding, 'pcm_s16le');
  assert.equal(calls[0].audioPcm16.byteLength, 64_000);
  assert.equal(coordinator.state, 'candidate-complete');
});

test('probability below threshold remains incomplete and waits for continuation', async () => {
  const { port } = predictor(0.49);
  const coordinator = new NekoSmartTurnCoordinator('session-smart-b', port);
  audio(coordinator, 1);
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const result = await coordinator.evaluateSemanticEndpoint();
  assert.equal(result.status, 'ok');
  assert.equal(result.decision, 'incomplete');
  assert.equal(coordinator.state, 'wait-continuation');
});

test('Smart Turn is never asked to evaluate without a pause candidate', async () => {
  const { port, calls } = predictor();
  const coordinator = new NekoSmartTurnCoordinator('session-smart-c', port);
  audio(coordinator, 1);
  coordinator.notifySpeechActivity('speech-started');
  const result = await coordinator.evaluateSemanticEndpoint();
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'no-pause-candidate');
  assert.equal(calls.length, 0);
});

test('short audio below the minimum evidence duration does not reach the model', async () => {
  const { port, calls } = predictor();
  const coordinator = new NekoSmartTurnCoordinator('session-smart-d', port);
  coordinator.pushAudioFrame({ sampleRateHz: 16_000, pcm16: pcm16(1000) });
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const result = await coordinator.evaluateSemanticEndpoint();
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'insufficient_audio');
  assert.equal(calls.length, 0);
});

test('speech resumption fences an in-flight Smart Turn result as stale', async () => {
  let release;
  let started;
  const evaluationStarted = new Promise(resolve => { started = resolve; });
  const { port } = predictor(0.99, {
    async evaluate(input) {
      started();
      return new Promise(resolve => { release = () => resolve({ probability01: 0.99 }); });
    },
  });
  const coordinator = new NekoSmartTurnCoordinator('session-smart-e', port);
  audio(coordinator, 1);
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const pending = coordinator.evaluateSemanticEndpoint();
  await evaluationStarted;
  coordinator.notifySpeechActivity('speech-resumed');
  release();
  const result = await pending;
  assert.equal(result.status, 'stale');
  assert.equal(result.reason, 'activity-resumed');
  assert.equal(coordinator.latestEvaluation, null);
  assert.equal(coordinator.state, 'speech-active');
});

test('a newer pause evaluation supersedes an older inference without concurrent model calls', async () => {
  let releaseFirst;
  let firstStarted;
  const started = new Promise(resolve => { firstStarted = resolve; });
  let callCount = 0;
  const { port } = predictor(0.8, {
    async evaluate() {
      callCount += 1;
      if (callCount === 1) {
        firstStarted();
        return new Promise(resolve => { releaseFirst = () => resolve({ probability01: 0.8 }); });
      }
      return { probability01: 0.7 };
    },
  });
  const coordinator = new NekoSmartTurnCoordinator('session-smart-f', port);
  audio(coordinator, 1);
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const first = coordinator.evaluateSemanticEndpoint();
  await started;
  const second = coordinator.evaluateSemanticEndpoint();
  releaseFirst();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status, 'superseded');
  assert.equal(secondResult.status, 'ok');
  assert.equal(secondResult.probability01, 0.7);
  assert.equal(callCount, 2);
  assert.equal(coordinator.latestEvaluation, secondResult);
});

test('provider unavailable and malformed probabilities fail as non-authoritative evidence', async () => {
  const unavailable = predictor(0.8, { isAvailable: () => false });
  const first = new NekoSmartTurnCoordinator('session-smart-g', unavailable.port);
  audio(first, 1);
  first.notifySpeechActivity('speech-started');
  first.notifySpeechActivity('candidate-pause');
  assert.equal((await first.evaluateSemanticEndpoint()).reason, 'provider-unavailable');
  const malformed = predictor(Number.NaN);
  const second = new NekoSmartTurnCoordinator('session-smart-h', malformed.port);
  audio(second, 1);
  second.notifySpeechActivity('speech-started');
  second.notifySpeechActivity('candidate-pause');
  const result = await second.evaluateSemanticEndpoint();
  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'invalid-smart-turn-probability');
});

test('input frames reject wrong sample rates, odd byte counts and oversized frames', () => {
  const { port } = predictor();
  const coordinator = new NekoSmartTurnCoordinator('session-smart-i', port);
  assert.throws(() => coordinator.pushAudioFrame({ sampleRateHz: 48_000, pcm16: pcm16(100) }), /invalid-smart-turn-audio-frame/);
  assert.throws(() => coordinator.pushAudioFrame({ sampleRateHz: 16_000, pcm16: new Uint8Array(3) }), /invalid-smart-turn-audio-frame/);
  assert.throws(() => coordinator.pushAudioFrame({ sampleRateHz: 16_000, pcm16: pcm16(16_001) }), /invalid-smart-turn-audio-frame/);
});

test('the rolling PCM buffer is bounded to the model eight-second context', () => {
  const { port } = predictor();
  const coordinator = new NekoSmartTurnCoordinator('session-smart-j', port);
  audio(coordinator, 10);
  assert.equal(coordinator.audioSamples, 8 * 16_000);
  assert.equal(coordinator.audioDurationMs, 8_000);
});

test('reset and close invalidate old generations and prevent further mutation', async () => {
  const { port } = predictor();
  const coordinator = new NekoSmartTurnCoordinator('session-smart-k', port);
  audio(coordinator, 1);
  coordinator.notifySpeechActivity('speech-started');
  coordinator.notifySpeechActivity('candidate-pause');
  const oldGeneration = coordinator.generation;
  coordinator.reset();
  assert.equal(coordinator.generation, oldGeneration + 1);
  assert.equal(coordinator.state, 'idle');
  assert.equal(coordinator.audioSamples, 0);
  coordinator.close();
  assert.equal(coordinator.state, 'closed');
  assert.equal(coordinator.pushAudioFrame({ sampleRateHz: 16_000, pcm16: pcm16(100) }), false);
  const result = await coordinator.evaluateSemanticEndpoint();
  assert.equal(result.status, 'stale');
  assert.equal(result.reason, 'coordinator-closed');
});

console.log('NEKO_SMART_TURN_SEMANTIC_ENDPOINT=PASS tests=10');
