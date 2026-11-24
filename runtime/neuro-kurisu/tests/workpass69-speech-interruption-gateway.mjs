import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EmbodimentRuntime } from '../src/organism/body/EmbodimentRuntime.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const base = new URL('../src/organism/', import.meta.url);
const embodimentSrc = await readFile(new URL('body/EmbodimentRuntime.ts', base), 'utf8');
const runtimeSrc = await readFile(new URL('core/OrganismRuntime.ts', base), 'utf8');
const coreSrc = await readFile(new URL('core/OrganismCore.ts', base), 'utf8');
const bridgeSrc = await readFile(new URL('body/AndroidEmbodimentBridge.ts', base), 'utf8');

assert.doesNotMatch(embodimentSrc, /interruptTermuxTts\s*\(/, 'EmbodimentRuntime must not terminate physical TTS directly');
assert.match(embodimentSrc, /setSpeechInterruptGatewayDispatcher/, 'interruption must use a separately injected gateway dispatcher');
assert.match(runtimeSrc, /core\.executeTool\('organism\.device\.speech\.interrupt'/, 'runtime must route interruption through canonical Core/ActionGateway');
assert.match(coreSrc, /id:\s*'organism\.device\.speech\.interrupt'/, 'Core must own the one keyed interruption adapter');
assert.match(coreSrc, /ToolExecutionUncertainError\(`tts-interrupt-outcome-uncertain:/, 'uncertain interrupt must leave its keyed receipt pending');
assert.match(coreSrc, /canonicalActionToolId\(id: string\).*android\.speak.*organism\.device\.speak/, 'legacy android.speak must resolve to canonical speech executor');
assert.match(coreSrc, /canonicalSkillToolId = \(toolId: string\).*android\.speak.*organism\.device\.speak/, 'reusable skills must canonicalize the legacy alias');
assert.doesNotMatch(runtimeSrc, /registerActionTool\(\{\s*id:\s*'android\.speak'/, 'runtime must not register a duplicate physical speech executor');
assert.match(bridgeSrc, /prior-tts-process-still-unresolved/, 'a new utterance must not implicitly kill an unresolved prior utterance');
assert.match(bridgeSrc, /active-tts-target-mismatch-playback-state-unavailable/, 'cancellation must never signal a different utterance');
const policyGateway = new ActionGateway();
policyGateway.registerTool({ id: 'organism.device.speech.interrupt', capability: 'device.speech.interrupt', destructive: false, requiresIdempotencyKey: true, execute: async () => ({ ok: true }) });
const interruptPolicy = policyGateway.listTools().find(tool => tool.id === 'organism.device.speech.interrupt');
assert.ok(interruptPolicy, 'canonical interruption tool must be registered in ActionGateway');
assert.equal(interruptPolicy.requiresIdempotencyKey, true, 'physical interruption must have a durable key');
assert.equal(interruptPolicy.requiresApproval, false, 'user-requested stop should not be blocked by a privileged-device approval gate');

const body = new EmbodimentRuntime();
body.body.ttsAvailable = true; // internal fixture only; this test does not claim live hardware.
const speechCalls = [];
const interruptCalls = [];
body.setSpeechGatewayDispatcher(async (text, options, speechEventId) => {
  speechCalls.push({ text, speechEventId });
  return { ok: false, uncertain: true, outcomeClass: 'idempotency-recovery-required', reason: 'simulated-ack-gap' };
});
body.setSpeechInterruptGatewayDispatcher(async (speechEventId, reason, interruptEventId) => {
  interruptCalls.push({ speechEventId, reason, interruptEventId });
  return { ok: true, uncertain: false, outcomeClass: 'executed-unverified', reason: 'playback-unverified' };
});
assert.equal(await body.speak('hello', { speechEventId: 'speech-case-69' }), false);
assert.equal(body.voiceSnapshot().state.speaking, true, 'unknown speech outcome remains interruptible/reconcilable');
assert.equal(await body.speak('must not overlap', { speechEventId: 'speech-case-69-next' }), false);
assert.equal(speechCalls.length, 1, 'a new utterance must not overlap an unresolved one');
assert.equal(await body.markVoiceInterruption('user-stop'), true);
assert.deepEqual(interruptCalls.map(x => x.speechEventId), ['speech-case-69']);
assert.equal(interruptCalls[0].reason, 'user-stop');
assert.match(interruptCalls[0].interruptEventId, /^speech-interrupt-[a-f0-9]{48}$/);
assert.equal(body.voiceSnapshot().state.speaking, false, 'accepted process-interruption request exits local speaking state');
assert.equal(body.voiceSnapshot().state.interruptionCount, 1);
assert.match(body.voiceSnapshot().state.lastError, /playback-unverified/, 'UI status must not claim the audio stopped independently');

const uncertainBody = new EmbodimentRuntime();
uncertainBody.body.ttsAvailable = true;
uncertainBody.setSpeechGatewayDispatcher(async () => ({ ok: false, uncertain: true, outcomeClass: 'idempotency-recovery-required' }));
uncertainBody.setSpeechInterruptGatewayDispatcher(async () => ({ ok: false, uncertain: true, outcomeClass: 'idempotency-recovery-required', reason: 'interrupt-ack-gap' }));
assert.equal(await uncertainBody.speak('hello', { speechEventId: 'speech-case-unknown' }), false);
assert.equal(await uncertainBody.markVoiceInterruption('user-stop'), false);
assert.equal(uncertainBody.voiceSnapshot().state.speaking, true, 'uncertain cancellation preserves uncertainty, not false stopped state');
assert.match(uncertainBody.voiceSnapshot().state.lastError, /unknown-reconciliation-required/);

// Race: interruption can finish before a speech dispatcher returns its uncertain ACK.
let releaseSpeech;
const raceBody = new EmbodimentRuntime();
raceBody.body.ttsAvailable = true;
raceBody.setSpeechGatewayDispatcher(() => new Promise(resolve => { releaseSpeech = resolve; }));
raceBody.setSpeechInterruptGatewayDispatcher(async () => ({ ok: true, outcomeClass: 'executed-unverified', reason: 'playback-unverified' }));
const pendingSpeak = raceBody.speak('race utterance', { speechEventId: 'speech-case-race' });
await new Promise(resolve => setImmediate(resolve));
assert.equal(await raceBody.markVoiceInterruption('user-stop'), true);
releaseSpeech({ ok: false, uncertain: true, outcomeClass: 'idempotency-recovery-required' });
assert.equal(await pendingSpeak, false);
assert.equal(raceBody.voiceSnapshot().state.speaking, false, 'late speech ACK must not undo the newer interrupt state');
assert.match(raceBody.voiceSnapshot().state.lastError, /playback-unverified/);

console.log('WORKPASS69_SPEECH_INTERRUPT=PASS keyed-gateway=true single-owner=true unknown-preserved=true');
