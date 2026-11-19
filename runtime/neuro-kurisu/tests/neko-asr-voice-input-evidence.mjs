import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

function makeRuntime(input) {
  const observations = [];
  const runtime = Object.create(OrganismRuntime.prototype);
  Object.assign(runtime, {
    voiceTranscriptObserverSessionId: 'runtime-session-1',
    voiceTranscriptCharacterName: 'Kurisu',
    nekoPluginVoiceTranscriptBridge: null,
    queue: Promise.resolve(),
    embodiment: {
      async listen() { return input?.text ?? null; },
      async listenDetailed() { return input; },
      speechInputProviderId: input?.providerId ?? 'termux-speech-to-text',
      userActivity() {},
      voiceSnapshot() { return { state: { speaking: false, listening: false }, plan: null }; },
    },
    core: {
      recordMultimodalObservation(value) { observations.push(value); },
      async beginBatch() {},
      async endBatch() {},
      runtimeMetadataSnapshot() { return { stage: 'operational', replaySignature: 'test-replay' }; },
      consciousnessSnapshot() { return { identityContinuity: { continuity: 0.93 } }; },
    },
    journal: { async write() {} },
    continuityLedger: { async record() {} },
    async stepInternal() {
      return {
        cycle: {
          state: {
            tick: 12,
            needs: { energy: 0.8, uncertainty: 0.2 },
            predictionError: 0.1,
            selfPredictionError: 0.1,
            lastAction: 'respond',
          },
          memories: [],
          goals: [],
        },
        worldAction: 'communicate',
        language: null,
      };
    },
  });
  return { runtime, observations };
}

const providerInput = {
  text: 'Проверь, пожалуйста, эту гипотезу.',
  providerId: 'faster-whisper-local',
  confidence01: 0.37,
  language: 'ru-RU',
  eventId: 'evt-asr-41',
  turnId: 'turn-asr-19',
  speechAdmission: {
    decision: 'admit',
    reason: 'speech_window',
    voicedAudioMs: 256,
  },
  smartTurnEvaluation: {
    status: 'ok',
    decision: 'complete',
    probability01: 0.88,
    modelId: 'pipecat-smart-turn-v3.2-cpu',
    modelVersion: 'f766f81d3cfdf7737ac64aad813d91bbfd56bf93',
  },
};

{
  const { runtime, observations } = makeRuntime(providerInput);
  assert.equal(await runtime.listen(), providerInput.text);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].confidence, 0.37,
    'cognitive speech evidence must retain the ASR provider confidence instead of replacing it with a constant');
  assert.deepEqual(observations[0].evidence, [
    'faster-whisper-local',
    'asr-event:evt-asr-41',
    'asr-turn:turn-asr-19',
    'asr-language:ru-RU',
    'speech-admission:admit',
    'speech-admission-reason:speech_window',
    'speech-admission-voiced-ms:256',
    'smart-turn-status:ok',
    'smart-turn-decision:complete',
    'smart-turn-probability:0.880',
    'smart-turn-model:pipecat-smart-turn-v3.2-cpu',
  ]);
}

{
  const { runtime, observations } = makeRuntime(providerInput);
  const result = await runtime.voiceTurn({ deliberate: false, speak: false });
  assert.equal(result.text, providerInput.text);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].confidence, 0.37,
    'voiceTurn must not discard calibrated ASR confidence');
  assert.ok(observations[0].evidence.includes('voice-turn'));
  assert.ok(observations[0].evidence.includes('asr-event:evt-asr-41'));
  assert.ok(observations[0].evidence.includes('speech-admission:admit'));
  assert.ok(observations[0].evidence.includes('speech-admission-reason:speech_window'));
  assert.ok(observations[0].evidence.includes('smart-turn-status:ok'));
  assert.ok(observations[0].evidence.includes('smart-turn-decision:complete'));
}

{
  const legacyInput = { text: 'Legacy Termux transcript', providerId: 'termux-speech-to-text' };
  const { runtime, observations } = makeRuntime(legacyInput);
  assert.equal(await runtime.listen(), legacyInput.text);
  assert.equal(observations[0].confidence, 0.86,
    'the existing legacy speech fallback keeps its prior confidence behavior when ASR confidence is unavailable');
  assert.deepEqual(observations[0].evidence, ['termux-speech-to-text']);
}

console.log('NEKO_ASR_VOICE_INPUT_EVIDENCE=PASS cases=3');
