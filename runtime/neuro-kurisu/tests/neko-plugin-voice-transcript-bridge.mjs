import assert from 'node:assert/strict';
import { NekoPluginVoiceTranscriptBridge } from '../src/organism/integration/neko/NekoPluginVoiceTranscriptBridge.ts';

const finalInput = (overrides = {}) => ({
  sessionId: 'session-17',
  turnId: 'turn-42',
  characterName: 'Kurisu',
  provider: 'qwen-asr',
  speakerRole: 'user',
  final: true,
  transcript: '  Проверь, пожалуйста, эту гипотезу.  ',
  ...overrides,
});

function makeBridge({ enabled = true, consent = () => true, enqueue = () => true, targets = ['study_companion'] } = {}) {
  const calls = [];
  const consentCalls = [];
  const bridge = new NekoPluginVoiceTranscriptBridge({
    enabled,
    targetPluginIds: targets,
    hasConsent(context) {
      consentCalls.push(context);
      return consent(context);
    },
    enqueueToPlugins(pluginIds, event) {
      calls.push({ pluginIds, event });
      return enqueue(pluginIds, event);
    },
  });
  return { bridge, calls, consentCalls };
}

{
  const { bridge, calls, consentCalls } = makeBridge({ enabled: false });
  assert.deepEqual(bridge.publishFinal(finalInput()), { accepted: false, reason: 'disabled' });
  assert.equal(calls.length, 0);
  assert.equal(consentCalls.length, 0);
}

{
  const { bridge, calls, consentCalls } = makeBridge({ consent: () => false });
  assert.deepEqual(bridge.publishFinal(finalInput()), { accepted: false, reason: 'consent-denied' });
  assert.equal(calls.length, 0);
  assert.equal(consentCalls.length, 1);
}

{
  const { bridge, calls, consentCalls } = makeBridge({ targets: ['study_companion', 'math_helper'] });
  const result = bridge.publishFinal(finalInput());
  assert.equal(result.accepted, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].pluginIds, ['study_companion', 'math_helper']);
  assert.deepEqual(calls[0].event, {
    event_type: 'voice_transcript_observed',
    event_id: result.eventId,
    lanlan_name: 'Kurisu',
    transcript: 'Проверь, пожалуйста, эту гипотезу.',
    metadata: {
      session_id: 'session-17',
      turn_id: 'turn-42',
      provider: 'qwen-asr',
      voice_source: 'user_asr_final',
    },
  });
  assert.equal(Object.isFrozen(calls[0].pluginIds), true);
  assert.equal(Object.isFrozen(calls[0].event), true);
  assert.equal(Object.isFrozen(calls[0].event.metadata), true);
  assert.equal(consentCalls[0].sessionId, 'session-17');
  assert.deepEqual(consentCalls[0].targetPluginIds, ['study_companion', 'math_helper']);
  assert.deepEqual(bridge.diagnostics(), { enabled: true, subscribers: 2, replayEntries: 1 });
}

{
  const { bridge, calls, consentCalls } = makeBridge();
  const assistant = bridge.publishFinal(finalInput({ speakerRole: 'assistant' }));
  const partial = bridge.publishFinal(finalInput({ final: false }));
  assert.deepEqual(assistant, { accepted: false, reason: 'not-user-final' });
  assert.deepEqual(partial, { accepted: false, reason: 'not-user-final' });
  assert.equal(calls.length, 0);
  assert.equal(consentCalls.length, 0);
}

{
  const { bridge, calls, consentCalls } = makeBridge();
  assert.deepEqual(bridge.publishFinal(finalInput({ transcript: ' \n\t ' })), {
    accepted: false, reason: 'empty-transcript',
  });
  assert.deepEqual(bridge.publishFinal(finalInput({ transcript: 'x'.repeat(4097) })), {
    accepted: false, reason: 'transcript-too-large',
  });
  assert.equal(calls.length, 0);
  assert.equal(consentCalls.length, 0);
}

{
  const { bridge, calls } = makeBridge();
  const params = finalInput();
  let getterCalls = 0;
  Object.defineProperty(params, 'rawAudio', {
    enumerable: true,
    get() { getterCalls += 1; return 'private-audio'; },
  });
  assert.deepEqual(bridge.publishFinal(params), { accepted: false, reason: 'invalid-input' });
  assert.equal(getterCalls, 0);
  const proxy = new Proxy(finalInput(), { getPrototypeOf() { throw new Error('proxy-trap'); } });
  assert.deepEqual(bridge.publishFinal(proxy), { accepted: false, reason: 'invalid-input' });
  assert.deepEqual(bridge.publishFinal({ ...finalInput(), arbitraryMetadata: { secret: true } }), {
    accepted: false, reason: 'invalid-input',
  });
  assert.equal(calls.length, 0);
}

{
  const { bridge, calls } = makeBridge();
  const first = bridge.publishFinal(finalInput());
  const replay = bridge.publishFinal(finalInput());
  assert.equal(first.accepted, true);
  assert.deepEqual(replay, { accepted: true, eventId: first.eventId, replayed: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(bridge.publishFinal(finalInput({ transcript: 'Other text' })), {
    accepted: false, reason: 'event-id-conflict',
  });
  assert.equal(calls.length, 1);
}

{
  let allowEnqueue = false;
  const { bridge, calls } = makeBridge({ enqueue: () => allowEnqueue });
  assert.deepEqual(bridge.publishFinal(finalInput()), { accepted: false, reason: 'enqueue-rejected' });
  allowEnqueue = true;
  assert.equal(bridge.publishFinal(finalInput()).accepted, true, 'failed enqueue must not consume the idempotency receipt');
  assert.equal(calls.length, 2);
}

{
  const { bridge, calls } = makeBridge({ enqueue: () => { throw new Error('transport-down'); } });
  assert.deepEqual(bridge.publishFinal(finalInput()), { accepted: false, reason: 'enqueue-rejected' });
  assert.equal(calls.length, 1);
}

{
  let consent = true;
  const { bridge, calls } = makeBridge({ consent: () => consent });
  const first = bridge.publishFinal(finalInput());
  consent = false;
  assert.deepEqual(bridge.publishFinal(finalInput()), { accepted: false, reason: 'consent-denied' });
  assert.equal(first.accepted, true);
  assert.equal(calls.length, 1, 'revoked consent blocks even an otherwise-idempotent replay');
}

{
  assert.throws(() => new NekoPluginVoiceTranscriptBridge({
    enabled: true,
    targetPluginIds: [],
    hasConsent: () => true,
    enqueueToPlugins: () => true,
  }), /neko-plugin-voice-subscriber-allowlist-required/);
  assert.throws(() => new NekoPluginVoiceTranscriptBridge({
    enabled: true,
    targetPluginIds: ['study_companion', 'study_companion'],
    hasConsent: () => true,
    enqueueToPlugins: () => true,
  }), /neko-plugin-voice-subscriber-id-invalid/);
  assert.throws(() => new NekoPluginVoiceTranscriptBridge({
    enabled: true,
    targetPluginIds: ['study_companion'],
    enqueueToPlugins: () => true,
  }), /neko-plugin-voice-consent-check-required/);
  assert.throws(() => new NekoPluginVoiceTranscriptBridge({
    enabled: true,
    targetPluginIds: ['study_companion'],
    hasConsent: () => true,
  }), /neko-plugin-voice-enqueue-required/);
}

console.log('NEKO_PLUGIN_VOICE_TRANSCRIPT_BRIDGE=PASS cases=10');
