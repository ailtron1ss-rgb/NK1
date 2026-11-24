import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// Keep synthetic events recent but behind wall clock for getters that use Date.now().
const at = Date.now() - 60_000;
const input = {
  at,
  externalInput: false,
  socialNeed01: .95,
  relationship01: .4,
  energy01: .9,
  identity01: .96,
  novelty01: .6,
  topics: [{
    topic: 'Investigate a bounded unresolved question about autonomous task continuation',
    source: 'reflection',
    salience01: .9,
    freshness01: .9,
    interestFit01: .7,
    affectFit01: .6,
  }],
  quietPeriodMs: 0,
  cooldownMs: 0,
  startupGraceMs: 0,
};

function createInitiative(engine, offset = 0, topic = input.topics[0].topic) {
  const result = engine.cycle({
    ...input,
    topics: [{ ...input.topics[0], topic }],
    at: at + offset,
  });
  assert.equal(result.shouldInitiate, true);
  assert.ok(result.initiative?.id);
  return result.initiative;
}

const plannedEngine = new AutonomousSocialInitiativeEngine();
const planned = createInitiative(plannedEngine);
assert.equal(planned.status, 'planned');
assert.equal(plannedEngine.cancel(planned.id, at + 1), true,
  'a planned internal initiative must support explicit cancellation');
let plannedSnapshot = plannedEngine.snapshot();
assert.equal(plannedSnapshot.initiatives[0].status, 'cancelled');
assert.equal(plannedSnapshot.initiatives[0].resolvedAt, at + 1);
assert.equal(plannedSnapshot.cancelled, 1);
assert.equal(plannedSnapshot.deferred, 0,
  'cancellation is terminal and must not be misreported as temporary deferral');
assert.equal(plannedEngine.latestPlanned(at + 2), null);
assert.equal(plannedEngine.stageMessage(planned.id, 'A safe message ready to be delivered.', at + 2), false);
assert.equal(plannedEngine.acknowledge(planned.id, at + 3), false);
assert.equal(plannedEngine.defer(planned.id, at + 3), false,
  'a cancelled initiative cannot be reopened as deferred');
assert.equal(plannedEngine.cancel(planned.id, at + 3), false,
  'repeated cancellation is idempotent and does not double count');

const readyEngine = new AutonomousSocialInitiativeEngine();
const ready = createInitiative(readyEngine, 10);
assert.equal(readyEngine.stageMessage(ready.id, 'A short, safe thought that is ready for delivery.', at + 11), true);
assert.ok(readyEngine.latestReady(at + 12));
assert.equal(readyEngine.cancel(ready.id, at + 13), true,
  'a staged but not yet acknowledged message must be cancellable');
assert.equal(readyEngine.latestReady(at + 14), null,
  'a cancelled ready message must never remain visible in the delivery queue');
assert.equal(readyEngine.acknowledge(ready.id, at + 15), false,
  'a cancelled message cannot be acknowledged as delivered');

const consentEngine = new AutonomousSocialInitiativeEngine();
const consentReady = createInitiative(consentEngine, 20);
assert.equal(consentEngine.stageMessage(consentReady.id, 'A pending thought that must be withdrawn.', at + 21), true);
consentEngine.setConsent(false);
const consentSnapshot = consentEngine.snapshot();
assert.equal(consentSnapshot.initiatives[0].status, 'cancelled',
  'revoking consent must cancel pending user-visible initiatives rather than leave resumable deferrals');
assert.equal(consentSnapshot.cancelled, 1);
consentEngine.setConsent(true);
assert.equal(consentEngine.latestReady(at + 22), null,
  'granting consent later must not resurrect an initiative cancelled by revocation');

const restored = new AutonomousSocialInitiativeEngine();
restored.restore(consentSnapshot);
assert.equal(restored.snapshot().initiatives[0].status, 'cancelled');
assert.equal(restored.snapshot().cancelled, 1);
assert.equal(restored.acknowledge(consentReady.id, at + 23), false,
  'cancelled delivery state must remain terminal after restart');

const unsafeCancelledSnapshot = structuredClone(consentSnapshot);
unsafeCancelledSnapshot.initiatives[0].topic = { unsafe: true };
const privacyRestored = new AutonomousSocialInitiativeEngine();
privacyRestored.restore(unsafeCancelledSnapshot);
assert.equal(privacyRestored.snapshot().initiatives[0].status, 'cancelled',
  'privacy sanitization must not convert a terminal cancellation into a deferred active item');
assert.equal(privacyRestored.snapshot().cancelled, 1);
assert.equal(privacyRestored.snapshot().deferred, consentSnapshot.deferred,
  'restoring cancelled content must not manufacture a deferred event');


const config = { performanceProfile: 'mobile', cycleResultMode: 'operational', checkpointMinIntervalMs: 0 };
const coreStore = new MemoryStateStore();
const core = new OrganismCore(coreStore, config);
await core.init();
try {
  // Seed through the same canonical initiative owner used by OrganismCore.
  const coreEngine = core.organismSystems.agency.autonomousSocialInitiative;
  // Core initialization may create its own startup initiative; isolate this explicit Core API test.
  coreEngine.restore(new AutonomousSocialInitiativeEngine().snapshot());
  const coreInitiative = createInitiative(coreEngine, 30);
  assert.equal(core.cancelAutonomousSocialInitiative(coreInitiative.id, at + 31), true,
    'OrganismCore must expose explicit cancellation of a pending autonomous social initiative');
  assert.equal(core.snapshot().system.autonomousSocialInitiative.initiatives[0].status, 'cancelled');
  await core.flush();
  const persisted = await coreStore.load();
  assert.equal(persisted.system.autonomousSocialInitiative.initiatives[0].status, 'cancelled',
    'Core cancellation must be included in the durable state snapshot');

  const resumed = new OrganismCore(new MemoryStateStore({ initial: persisted }), config);
  await resumed.init();
  try {
    assert.equal(resumed.snapshot().system.autonomousSocialInitiative.initiatives.find(row => row.id === coreInitiative.id)?.status, 'cancelled',
      'Core cancellation must survive a process restart');
    assert.equal(resumed.acknowledgeAutonomousSocialInitiative(coreInitiative.id, at + 32), false);

  const deliveredInitiative = createInitiative(coreEngine, 40,
    'Review a separate unresolved question about bounded memory continuity');
  assert.equal(core.stageAutonomousSocialInitiativeMessage(deliveredInitiative.id,
    'A short message acknowledged by the host UI.', at + 41), true);
  assert.ok(core.pendingAutonomousSocialInitiativeMessage());
  assert.equal(core.acknowledgeAutonomousSocialInitiative(deliveredInitiative.id, at + 42), true);
  await core.flush();
  const deliveredState = await coreStore.load();
  assert.equal(deliveredState.system.autonomousSocialInitiative.initiatives
    .find(row => row.id === deliveredInitiative.id)?.status, 'executed',
    'staging and UI acknowledgement must be durable, not only an in-memory projection');
  } finally {
    await resumed.flush();
  }
} finally {
  await core.flush();
}

console.log('AUTONOMOUS_SOCIAL_INITIATIVE_CANCELLATION=PASS');
