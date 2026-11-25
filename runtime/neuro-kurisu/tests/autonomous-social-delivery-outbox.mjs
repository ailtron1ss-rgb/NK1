import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const makeInput = (at, overrides = {}) => ({
  at,
  externalInput: false,
  socialNeed01: .9,
  relationship01: .4,
  energy01: .9,
  identity01: .95,
  novelty01: .9,
  topics: [{
    topic: 'A distinct causal question about how memory evidence should change future decisions',
    source: 'reflection',
    salience01: .9,
    freshness01: .9,
  }],
  quietPeriodMs: 0,
  cooldownMs: 0,
  startupGraceMs: 0,
  ...overrides,
});
const message = 'A useful observation about the project can connect evidence to a better decision.';

function readyEngine(at = 1_000) {
  const engine = new AutonomousSocialInitiativeEngine();
  const initiative = engine.cycle(makeInput(at)).initiative;
  assert.ok(initiative);
  assert.equal(engine.stageMessage(initiative.id, message, at + 1), true);
  return { engine, initiative };
}

{
  const { engine, initiative } = readyEngine();
  const first = engine.claimReady(1_002, 5_000);
  assert.equal(first?.id, initiative.id);
  assert.equal(first?.deliveryAttemptCount, 1);
  assert.equal(first?.deliveryLeaseUntil, 6_002);
  assert.equal(first?.deliveryNextAttemptAt, 7_002);
  assert.equal(engine.claimReady(1_003, 5_000), null,
    'a second consumer must not claim an item while the first delivery lease is live');
  assert.equal(engine.latestReady(1_003), null,
    'legacy read-only access must not bypass a live delivery lease');

  const restored = new AutonomousSocialInitiativeEngine();
  restored.restore(engine.snapshot());
  assert.equal(restored.claimReady(6_001, 5_000), null,
    'the lease and retry delay must survive snapshot/restore');
  const second = restored.claimReady(7_002, 5_000);
  assert.equal(second?.id, initiative.id, 'retry must retain the stable idempotency identity');
  assert.equal(second?.deliveryAttemptCount, 2);
  assert.equal(second?.deliveryLeaseUntil, 12_002);
  assert.equal(second?.deliveryNextAttemptAt, 14_002);

  assert.equal(restored.acknowledge(initiative.id, 7_003), true);
  assert.equal(restored.acknowledge(initiative.id, 7_004), false);
  assert.equal(restored.claimReady(20_000, 5_000), null,
    'acknowledged messages cannot be delivered again');
  const settled = restored.snapshot().initiatives[0];
  assert.equal(settled.status, 'executed');
  assert.equal(settled.deliveryLeaseUntil, undefined);
  assert.equal(settled.deliveryNextAttemptAt, undefined);
}

{
  const { engine } = readyEngine(10_000);
  engine.setConsent(false);
  assert.equal(engine.claimReady(10_002, 5_000), null,
    'revoked consent must block an already staged message');
  assert.equal(engine.snapshot().initiatives[0].status, 'deferred');
}

{
  const { engine } = readyEngine(Date.UTC(2026, 10, 25, 23, 0, 0));
  engine.setQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
  assert.equal(engine.claimReady(Date.UTC(2026, 10, 25, 23, 0, 2), 5_000), null,
    'quiet hours must be rechecked at the actual delivery claim boundary');
}

{
  const { engine, initiative } = readyEngine(30_000);
  const restored = new AutonomousSocialInitiativeEngine();
  restored.restore({
    version: 1,
    cycles: 1,
    planned: 1,
    executed: 0,
    deferred: 0,
    reciprocity01: .54,
    initiative01: .34,
    initiatives: [{
      ...initiative,
      status: 'ready',
      message,
      stagedAt: 30_001,
    }],
    startedAt: 30_000,
    lastExternalInputAt: 0,
    lastInitiativeAt: 30_000,
  });
  const claimed = restored.claimReady(30_002, 5_000);
  assert.equal(claimed?.id, initiative.id);
  assert.equal(claimed?.deliveryAttemptCount, 1,
    'legacy ready snapshots must migrate into the new delivery lifecycle');
}


{
  const engine = new AutonomousSocialInitiativeEngine();
  assert.equal(engine.deliveryPolicy().consentGranted, false,
    'fresh installs must not grant unsolicited delivery consent by default');
  const result = engine.cycle(makeInput(50_000));
  assert.ok(result.initiative, 'internal initiative planning must continue without delivery consent');
  assert.equal(result.initiative.internalOnly, true,
    'a plan created without consent must be permanently private');
  assert.equal(engine.latestPlanned(50_001), null,
    'private plans must never enter the user-facing generation lane');
  assert.equal(engine.stageMessage(result.initiative.id, message, 50_002), false,
    'private plans must not be stageable as user-facing messages');
  const restored = new AutonomousSocialInitiativeEngine();
  const legacy = engine.snapshot();
  delete legacy.consentGranted;
  restored.restore(legacy);
  assert.equal(restored.deliveryPolicy().consentGranted, false,
    'legacy snapshots without an explicit consent decision must restore fail-closed');
}

{
  const engine = new AutonomousSocialInitiativeEngine();
  const privatePlan = engine.cycle(makeInput(70_000)).initiative;
  assert.ok(privatePlan?.internalOnly);
  engine.setConsent(true);
  const restored = new AutonomousSocialInitiativeEngine();
  restored.restore(engine.snapshot());
  assert.equal(restored.latestPlanned(70_001), null,
    'a private thought must remain private after consent is granted and state is restored');
}

console.log('AUTONOMOUS_SOCIAL_DELIVERY_OUTBOX=PASS');
