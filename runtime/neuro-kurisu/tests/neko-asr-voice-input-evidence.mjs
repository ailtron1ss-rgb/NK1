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
