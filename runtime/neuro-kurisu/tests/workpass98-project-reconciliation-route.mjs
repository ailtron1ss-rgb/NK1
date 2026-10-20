import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();
const gateway = core.cognitiveRuntime.actionGateway;
const original = gateway.reconcileToolExecution.bind(gateway);
const calls = [];
gateway.reconcileToolExecution = async (id, input, reason, options) => {
  calls.push({ id, input: structuredClone(input), reason, options: structuredClone(options) });
  return { ok: false, verified: false, tool: id, capability: 'fixture', outcomeClass: 'idempotency-recovery-required', result: { error: 'fixture-only' } };
};

const input = { operation: 'capture', context: { requestId: 'wp98' } };
const options = { idempotencyKey: 'wp98:receipt', decisionId: 'decision:wp98', autonomous: false };
const camera = await core.reconcileToolExecution('android.capture_camera', input, 'wp98-camera-recovery', options);
assert.equal(camera.tool, 'organism.device.capture');
assert.equal(calls[0].id, 'organism.device.capture', 'camera alias must be canonicalized before gateway receipt lookup');
assert.deepEqual(calls[0].input, input);
assert.equal(calls[0].reason, 'wp98-camera-recovery');
assert.deepEqual(calls[0].options, options);

const speech = await core.reconcileToolExecution('android.speak', { text: 'hello' }, 'wp98-speech-recovery', options);
assert.equal(speech.tool, 'organism.device.speak');
assert.equal(calls[1].id, 'organism.device.speak', 'speech alias must be canonicalized before gateway receipt lookup');
assert.equal(calls.length, 2, 'each reconciliation request is forwarded exactly once');

gateway.reconcileToolExecution = original;
console.log('NK1_PROJECT_RECONCILIATION_ROUTE=PASS cameraAlias=true speechAlias=true inputAndReceiptIdentityPreserved=true');
