import assert from 'node:assert/strict';
import { buildVoicePlan, detectVoiceBreathMode } from '../src/organism/body/VoiceEmbodiment.ts';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { defaultBodyState, normalizePersistedBodyState } from '../src/organism/body/EmbodiedBody.ts';
const body=defaultBodyState();
assert.deepEqual(normalizePersistedBodyState(body), body, 'valid persisted body snapshots should round-trip through the canonical schema');
let bodyRestoreGetterReads = 0;
const getterBackedBody = { ...body };
Object.defineProperty(getterBackedBody, 'schemaVersion', {
  enumerable: true, configurable: true,
  get() { bodyRestoreGetterReads++; return 1; },
});
assert.equal(normalizePersistedBodyState(getterBackedBody), null);
assert.equal(bodyRestoreGetterReads, 0, 'body checkpoint validation must not execute caller-owned getters');
const cyclicBody = { ...body };
cyclicBody.self = cyclicBody;
assert.equal(normalizePersistedBodyState(cyclicBody), null, 'cyclic body snapshots must be rejected');
assert.equal(normalizePersistedBodyState({
  ...body, telemetry: { ...body.telemetry, battery01: Number.NaN },
}), null, 'non-finite body telemetry must not enter live resource regulation');
assert.equal(normalizePersistedBodyState({
  ...body, sleep: 'deep-sleep', awake: true,
}), null, 'inconsistent sleep/awake state must fail closed');
assert.equal(detectVoiceBreathMode('Привет, Курису'), 'ping');
assert.equal(detectVoiceBreathMode('Почему это работает?'), 'lecture');
assert.equal(detectVoiceBreathMode('Ты настоящая или нет?'), 'confess');
assert.equal(detectVoiceBreathMode('Ты не права в этом'), 'argue');
const plan=buildVoicePlan({text:'Объясни, почему модель мира ошиблась',action:'verify',mode:'learn',needs:{energy:.7,cognitiveLoad:.4,uncertainty:.72,socialNeed:.3,novelty:.5,identityCoherence:.84,goalPressure:.55},body,continuity01:.8,grounding01:.7});
assert.equal(plan.mode,'lecture');
assert.equal(plan.language,'ru-RU');
assert.ok(plan.prosody.rate>=.72 && plan.prosody.rate<=1.25);
assert.ok(plan.prosody.pitch>=.72 && plan.prosody.pitch<=1.28);
assert.ok(plan.prosody.emphasis01>=0 && plan.prosody.emphasis01<=1);
// WorkPass334: an STT exception must not strand the runtime in a permanent listening state.
const runtime = new EmbodimentRuntime();
// This test targets lifecycle recovery, not platform capability detection or a real microphone.
runtime.body = { ...defaultBodyState(), sttAvailable: true };
runtime.setSpeechInputDispatcher(async () => { throw new Error('simulated microphone bridge failure'); });
assert.equal(await runtime.listen(), null);
let voiceState = runtime.voiceSnapshot().state;
assert.equal(voiceState.listening, false, 'STT failure must always release the listening state');
assert.equal(voiceState.listenCount, 1);
assert.match(voiceState.lastError, /stt-provider-failed:simulated microphone bridge failure/);

// A later STT attempt remains usable after the failure rather than being wedged.
runtime.setSpeechInputDispatcher(async () => 'Привет, Курису');
assert.equal(await runtime.listen(), 'Привет, Курису');
voiceState = runtime.voiceSnapshot().state;
assert.equal(voiceState.listening, false);
assert.equal(voiceState.listenCount, 2);
assert.equal(voiceState.lastError, null);

 // WorkPass422: one listening lease at a time; completion of one request must not clear another.
 let finishFirstListen;
 runtime.setSpeechInputDispatcher(() => new Promise((resolve) => { finishFirstListen = resolve; }));
 const firstListen = runtime.listen();
 assert.equal(runtime.voiceSnapshot().state.listening, true);
 assert.equal(await runtime.listen(), null, 'a concurrent STT request must not start a second microphone operation');
 assert.equal(runtime.voiceSnapshot().state.listening, true, 'the rejected overlap must not release the active listen state');
 assert.match(runtime.voiceSnapshot().state.lastError ?? '', /stt-listen-already-active/);
 finishFirstListen('  первая строка\nвторая строка  ');
 assert.equal(await firstListen, 'первая строка вторая строка', 'transcripts are normalized before entering cognition');
 voiceState = runtime.voiceSnapshot().state;
 assert.equal(voiceState.listening, false);
 assert.equal(voiceState.listenCount, 3, 'rejected overlap must not increment the accepted-listen counter');
 assert.equal(voiceState.lastError, null);

 // JavaScript/platform adapters can violate TypeScript declarations at runtime.
 runtime.setSpeechInputDispatcher(async () => 42);
 assert.equal(await runtime.listen(), null, 'non-string provider output must not leak into the cognitive input');
 assert.equal(runtime.voiceSnapshot().state.lastError, 'stt-invalid-result');

 // WorkPass430: speech input must be bounded and plain-data checked before voice planning.
 const speechGuard = new EmbodimentRuntime();
 speechGuard.body = { ...defaultBodyState(), ttsAvailable: true };
 let ttsDispatches = 0;
 speechGuard.setSpeechGatewayDispatcher(async () => { ttsDispatches++; return { ok: true }; });
 let coercionCalls = 0;
 const hostileSpeechText = { toString() { coercionCalls++; return 'must not be spoken'; } };
 assert.equal(await speechGuard.speak(hostileSpeechText), false,
   'non-string speech requests must be rejected rather than coerced');
 assert.equal(coercionCalls, 0, 'speech boundary must not execute custom text coercion');
 assert.equal(ttsDispatches, 0, 'invalid speech text must never reach the TTS gateway');
 assert.equal(speechGuard.voiceSnapshot().state.lastError, 'tts-invalid-text');

 let contextGetterCalls = 0;
 const hostileSpeechContext = Object.defineProperty({}, 'action', {
   enumerable: true, get() { contextGetterCalls++; return 'respond'; },
 });
 assert.equal(await speechGuard.speak('Привет', hostileSpeechContext), false,
   'accessor-backed voice context must be rejected before planning');
 assert.equal(contextGetterCalls, 0, 'voice planning must not execute caller-owned context getters');
 assert.equal(ttsDispatches, 0);

 const boundedContext = { action: 'respond', mode: 'chat', continuity01: Number.NaN };
 assert.equal(await speechGuard.speak('Привет', boundedContext), false,
   'non-finite context confidence cannot change voice policy');
 assert.equal(speechGuard.voiceSnapshot().state.lastError, 'tts-invalid-context');
 assert.equal(ttsDispatches, 0);

 assert.equal(runtime.voiceSnapshot().state.listening, false);
 runtime.setSpeechInputDispatcher(async () => '   ');
 assert.equal(await runtime.listen(), null, 'empty normalized transcripts remain an explicit no-result');


 // WorkPass433: validate motor-executor payload before sampling device telemetry or coercing text.
 const { EmbodiedActionExecutor, normalizeEmbodiedActionInput } = await import('../src/organism/body/EmbodiedActionExecutor.ts');
 assert.equal(normalizeEmbodiedActionInput({ spokenText: 'hello', allowCamera: false })?.spokenText, 'hello');
 let inputGetterCalls = 0;
 const getterMotorInput = Object.defineProperty({}, 'spokenText', {
   enumerable: true, get() { inputGetterCalls++; return 'do not speak'; },
 });
 assert.equal(normalizeEmbodiedActionInput(getterMotorInput), null);
 assert.equal(inputGetterCalls, 0, 'motor input descriptors must be validated without invoking accessors');
 assert.equal(normalizeEmbodiedActionInput({ spokenText: { toString() { throw new Error('must not coerce'); } } }), null);
 assert.equal(normalizeEmbodiedActionInput(Object.assign(Object.create({ allowCamera: true }), { spokenText: 'hello' })), null,
   'inherited properties cannot silently authorize a physical capability');
 assert.equal(normalizeEmbodiedActionInput({ speechEventId: 'x'.repeat(141) }), null);
 
 const actionBody = new EmbodimentRuntime();
 actionBody.body = { ...defaultBodyState(), telemetry: { ...defaultBodyState().telemetry, source: 'mock' } };
 let sampleCalls = 0;
 actionBody.sample = async () => { sampleCalls++; return actionBody.snapshot(); };
 let cameraCalls = 0, speechCalls = 0;
 actionBody.speak = async () => { speechCalls++; return true; };
 const executor = new EmbodiedActionExecutor(actionBody);
 const rejectedMotorResult = await executor.execute('respond', getterMotorInput);
 assert.equal(rejectedMotorResult.status, 'failed');
 assert.equal(rejectedMotorResult.reason, 'embodied-action-input-invalid');
 assert.equal(sampleCalls, 0, 'rejected motor inputs must be blocked before telemetry or I/O');
 assert.equal(speechCalls, 0, 'rejected motor input must not reach TTS');
 assert.equal(cameraCalls, 0);

console.log('VOICE_EMBODIMENT=PASS');
