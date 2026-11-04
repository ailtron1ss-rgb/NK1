import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

function makeRuntime(transcript, observer) {
  const observations = [];
  const runtime = Object.create(OrganismRuntime.prototype);
  Object.assign(runtime, {
    voiceTranscriptObserverSessionId: 'runtime-session-1',
    voiceTranscriptCharacterName: 'Kurisu',
    nekoPluginVoiceTranscriptBridge: observer ?? null,
    queue: Promise.resolve(),
    embodiment: {
      async listen() { return transcript; },
      userActivity() {},
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

{
  const emitted = [];
  const observer = {
    publishFinal(input) {
      emitted.push(input);
      return { accepted: true, eventId: 'test-event' };
    },
  };
  const { runtime, observations } = makeRuntime('  Привет, Курису.  ', observer);
  const text = await runtime.listen();
  assert.equal(text, '  Привет, Курису.  ');
  assert.equal(emitted.length, 1);
  assert.deepEqual({
    sessionId: emitted[0].sessionId,
    characterName: emitted[0].characterName,
    provider: emitted[0].provider,
    speakerRole: emitted[0].speakerRole,
    final: emitted[0].final,
    transcript: emitted[0].transcript,
  }, {
    sessionId: 'runtime-session-1',
    characterName: 'Kurisu',
    provider: 'termux-speech-to-text',
    speakerRole: 'user',
    final: true,
    transcript: 'Привет, Курису.',
  });
  assert.match(emitted[0].turnId, /^asr-/);
  assert.equal(observations[0].modality, 'speech');
}

{
  const emitted = [];
  const observer = { publishFinal(input) { emitted.push(input); return { accepted: true, eventId: 'voice-turn-event' }; } };
  const { runtime, observations } = makeRuntime('Explain this equation.', observer);
  const result = await runtime.voiceTurn({ deliberate: false, speak: false });
  assert.equal(result.text, 'Explain this equation.');
  assert.equal(result.spoken, false);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].transcript, 'Explain this equation.');
  assert.equal(emitted[0].final, true);
  assert.equal(observations[0].modality, 'speech');
  assert.equal(observations[0].salience, 0.74);
}

{
  const emitted = [];
  const observer = { publishFinal(input) { emitted.push(input); return { accepted: true, eventId: 'unused' }; } };
  const { runtime } = makeRuntime(null, observer);
  assert.equal(await runtime.listen(), null);
  assert.equal(emitted.length, 0);
}

{
  const { runtime, observations } = makeRuntime('A valid transcript.', {
    publishFinal() { throw new Error('plugin transport is offline'); },
  });
  assert.equal(await runtime.listen(), 'A valid transcript.');
  assert.equal(observations.length, 1, 'plugin observer failures cannot suppress the canonical speech observation');
}

{
  const { runtime } = makeRuntime('A valid transcript.', null);
  assert.equal(await runtime.listen(), 'A valid transcript.');
}

console.log('NEKO_PLUGIN_VOICE_RUNTIME_WIRING=PASS cases=5');
