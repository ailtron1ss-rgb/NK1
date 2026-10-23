import assert from 'node:assert/strict';
import { buildVoicePlan, detectVoiceBreathMode } from '../src/organism/body/VoiceEmbodiment.ts';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { defaultBodyState } from '../src/organism/body/EmbodiedBody.ts';
const body=defaultBodyState();
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
console.log('VOICE_EMBODIMENT=PASS');
