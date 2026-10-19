import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { EmbodiedRecoveryController } from '../src/organism/body/EmbodiedRecoveryController.ts';

const root = new URL('../src/organism/', import.meta.url);
const embodiment = await readFile(new URL('body/EmbodimentRuntime.ts', root), 'utf8');
const runtime = await readFile(new URL('core/OrganismRuntime.ts', root), 'utf8');
const core = await readFile(new URL('core/OrganismCore.ts', root), 'utf8');

assert.doesNotMatch(embodiment, /speakViaTermux(?:WithOutcome)?\s*\(/, 'EmbodimentRuntime must not execute physical TTS directly');
assert.match(embodiment, /speechGatewayDispatcher/, 'embodiment should dispatch speech via the injected gateway');
assert.match(embodiment, /action-gateway-speech-dispatcher-unavailable/, 'missing gateway wiring must fail closed');
assert.match(runtime, /core\.executeTool\('organism\.device\.speak'/, 'runtime TTS needs to enter canonical ActionGateway');
assert.match(runtime, /idempotencyKey,decisionId:speechEventId/, 'speech intent must preserve a stable operation key');
assert.match(core, /speakViaTermuxWithOutcome/, 'physical adapter must use explicit TTS outcome semantics');
assert.match(core, /ToolExecutionUncertainError\(`tts-outcome-uncertain:/, 'ambiguous output must remain pending rather than become failure-no-effect');
assert.match(core, /verified: false, commandAccepted: true/, 'successful command exit must not be overstated as an independently verified audio outcome');

const gateway = new ActionGateway();
gateway.registerTool({ id: 'organism.device.speak', capability: 'device.speech', destructive: false, requiresIdempotencyKey: true, execute: async () => ({ ok: true }) });
gateway.registerTool({ id: 'android.speak', capability: 'android.tts', destructive: false, requiresIdempotencyKey: true, execute: async () => ({ ok: true }) });
const rows = Object.fromEntries(gateway.listTools().map(row => [row.id, row]));
for (const id of ['organism.device.speak', 'android.speak']) {
  assert.equal(rows[id].requiresIdempotencyKey, true, `${id} must require durable idempotency`);
  assert.equal(rows[id].requiresApproval, false, `${id} is standard conversational output, not privileged device control`);
}
const recovery = new EmbodiedRecoveryController();
const before = recovery.snapshot();
recovery.record({tick:4,at:Date.now(),action:'respond',status:'ambiguous',realityClass:'device-actuation',source:'android-termux',verified01:0,independent01:0,effect01:0,consequenceError01:1,verificationMode:'none',sourceStable:true,freshBefore01:1,freshAfter01:1});
const after = recovery.snapshot();
assert.equal(after.actionStates.respond.attempts, (before.actionStates.respond?.attempts ?? 0) + 1, 'ambiguous action should be recorded as an attempt');
assert.equal(after.actionStates.respond.failures, 0, 'unknown outcome must not count as failed effect');
assert.equal(after.actionStates.respond.failureStreak, 0, 'unknown outcome must not increase retry penalty');
assert.equal(after.actionStates.respond.cooldownUntil, 0, 'unknown outcome must not automatically retry or back off as a failure');
assert.equal(after.actionStates.respond.reliability01, before.actionStates.respond?.reliability01 ?? 0.5, 'unknown outcome must not change reliability estimate');
assert.equal(after.lastRecoveryReason, before.lastRecoveryReason, 'unknown outcome must not rewrite recovery failure reason');
console.log('WORKPASS68_SPEECH_GATEWAY=PASS no-bypass=true keyed=true uncertain-is-not-failure=true');
