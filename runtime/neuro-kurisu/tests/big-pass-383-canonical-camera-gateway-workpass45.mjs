import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store = new MemoryStateStore();
const seed = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await seed.init();
const core = new OrganismCore(store, { cycleResultMode: 'operational', checkpointMinIntervalMs: 0 });
await core.init();
const tools = core.actionToolsSnapshot();
const camera = tools.find(row => row.id === 'organism.device.capture');
assert.ok(camera, 'canonical organism device camera action must be registered');
assert.equal(camera.requiresIdempotencyKey, true, 'physical camera action requires stable durable idempotency');
assert.equal(camera.hasReceiptReconciliation, true, 'physical camera action exposes read-only local receipt reconciliation');
assert.equal(tools.some(row => row.id === 'android.capture_camera'), false, 'legacy duplicate executor must not remain registered');

// The legacy ID remains a routing alias, not a second executor. No camera command is
// invoked because the required key is absent, and the canonical result makes the refusal explicit.
const noKey = await core.executeTool('android.capture_camera', { cameraId: 0, retain: false }, 'legacy-camera-alias-without-key');
assert.equal(noKey.tool, 'organism.device.capture');
assert.equal(noKey.outcomeClass, 'idempotency-key-required');
assert.equal(noKey.result.error, 'idempotency-key-required');

// Direct embodied-runtime calls cannot bypass the ActionGateway after the migration.
const { EmbodimentRuntime } = await import('../src/organism/body/EmbodimentRuntime.ts');
const body = new EmbodimentRuntime();
const bypass = await body.captureCamera(0, false);
assert.equal(bypass.ok, false);
assert.equal(bypass.error, 'camera-capture-action-gateway-required');

console.log(JSON.stringify({ ok: true, pass: 'workpass45-canonical-camera-gateway', assertions: 7, result: 'single canonical camera tool; required key; receipt lookup; legacy alias normalization; raw EmbodimentRuntime path fails closed', physicalDeviceTouched: false }));
