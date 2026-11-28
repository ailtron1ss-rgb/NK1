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
  engine.setConsent(true);
  const initiative = engine.cycle(makeInput(at)).initiative;
  assert.ok(initiative);
  assert.equal(engine.stageMessage(initiative.id, message, at + 1), true);
  return { engine, initiative };
}

{
  const { engine, initiative } = readyEngine();
  assert.equal(engine.acknowledge(initiative.id, 1_002), false,
    'an unclaimed ready message must not be ACKed by an arbitrary caller');
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

  assert.equal(restored.acknowledge(initiative.id, 12_003), false,
    'an expired delivery lease must not accept a late ACK');
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
    consentGranted: true,
    consentDecisionAt: 30_000,
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
  assert.ok(result.internalPlan, 'internal initiative planning must continue without delivery consent');
  assert.equal(result.initiative, null, 'internal plans must not be returned through the delivery-facing field');
  assert.equal(result.internalPlan.internalOnly, true,
    'a plan created without consent must be permanently private');
  assert.equal(engine.latestPlanned(50_001), null,
    'private plans must never enter the user-facing generation lane');
  assert.equal(engine.stageMessage(result.internalPlan.id, message, 50_002), false,
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


{
  const { engine } = readyEngine(200_000);
  assert.equal(engine.summary(200_001).deliveryClaimable, 1,
    'a newly ready initiative must be visible as claimable');
  const first = engine.claimReady(200_002, 1_000);
  assert.equal(first?.deliveryAttemptCount, 1);
  assert.equal(engine.summary(200_003).deliveryLeased, 1,
    'an active lease must be observable as in-flight');
  assert.equal(engine.summary(201_002).deliveryBackoff, 1,
    'an expired lease must remain visible while retry backoff is active');
  assert.equal(engine.summary(202_002).deliveryClaimable, 1,
    'the item becomes claimable again when backoff expires');

  let at = first.deliveryNextAttemptAt;
  for (let attempt = 2; attempt <= 8; attempt += 1) {
    const claim = engine.claimReady(at, 1_000);
    assert.equal(claim?.deliveryAttemptCount, attempt,
      'retry claims must expose monotonic attempt counts');
    at = claim.deliveryNextAttemptAt;
  }
  const finalLease = engine.snapshot().initiatives[0].deliveryLeaseUntil;
  assert.ok(finalLease);
  assert.equal(engine.claimReady(finalLease - 1, 1_000), null,
    'the final in-flight attempt must retain its lease until expiry');
  assert.equal(engine.snapshot().initiatives[0].status, 'ready');
  const diagnostics = engine.summary(at);
  assert.equal(diagnostics.deliveryExhausted, 1,
    'exhausted deliveries must be observable during their final backoff');
  assert.equal(diagnostics.deliveryAttempts, 8);
  assert.equal(diagnostics.deliveryClaimable, 0);
  const terminalClaim = engine.claimReadyWithState(at, 1_000);
  assert.equal(terminalClaim.initiative, null,
    'the delivery attempt budget must remain bounded');
  assert.equal(terminalClaim.stateChanged, true,
    'dead-lettering on a null claim must report a state transition for persistence');
  const deadLetter = engine.snapshot().initiatives[0];
  assert.equal(deadLetter.status, 'deferred',
    'an exhausted outbox item must reach a terminal state after its final backoff');
  assert.equal(deadLetter.reason, 'proactive-delivery-retry-budget-exhausted');
  assert.equal(deadLetter.message, undefined,
    'terminalized delivery payloads must be removed from durable state');
  assert.equal(engine.summary(at).deliveryPending, 0,
    'a dead-letter item must not remain in the ready queue');
  assert.equal(engine.summary(at).deliveryDeadLettered, 1,
    'dead-letter history must remain visible in bounded diagnostics');
}


{
  const { engine } = readyEngine(300_000);
  const before = engine.deliveryPolicy(300_001);
  assert.equal(before.outbox.claimable, 1,
    'the public delivery policy must expose an actionable outbox snapshot');
  assert.equal(before.outbox.pending, 1);
  const claim = engine.claimReady(300_002, 1_000);
  assert.ok(claim);
  const during = engine.deliveryPolicy(300_003);
  assert.equal(during.outbox.leased, 1);
  assert.equal(during.outbox.claimable, 0);
}


{
  const { engine, initiative } = readyEngine(400_000);
  const claim = engine.claimReady(400_002, 1_000);
  assert.ok(claim?.deliveryLeaseUntil);
  assert.equal(engine.acknowledge(initiative.id, claim.deliveryLeaseUntil), false,
    'the delivery lease is exclusive and must be invalid exactly at its expiry timestamp');
}


{
  const { engine, initiative } = readyEngine(500_000);
  const claim = engine.claimReady(500_002, 1_000);
  assert.ok(claim);
  const receipt = engine.acknowledgeWithState(initiative.id, 500_000 + 20 * 60_000 + 1);
  assert.equal(receipt.acknowledged, false);
  assert.equal(receipt.stateChanged, true,
    'a rejected expired ACK must report its TTL-driven deferred transition');
  assert.equal(engine.snapshot().initiatives[0].status, 'deferred');
}

{
  const engine = new AutonomousSocialInitiativeEngine();
  engine.setConsent(true);
  const empty = engine.claimReadyWithState(600_000);
  assert.equal(empty.initiative, null);
  assert.equal(empty.stateChanged, false,
    'a truly empty poll must not require a durable checkpoint');
}


{
  const { engine, initiative } = readyEngine(700_000);
  const firstAttempt = engine.claimReady(700_002, 1_000);
  assert.equal(firstAttempt?.deliveryAttemptCount, 1);
  const secondAttempt = engine.claimReady(702_002, 1_000);
  assert.equal(secondAttempt?.id, initiative.id);
  assert.equal(secondAttempt?.deliveryAttemptCount, 2);
  const stale = engine.acknowledgeWithState(initiative.id, 702_003, firstAttempt.deliveryAttemptCount);
  assert.equal(stale.acknowledged, false,
    'a delayed first-attempt ACK cannot acknowledge the stable ID after retry attempt 2 is current');
  assert.equal(stale.stateChanged, false);
  assert.equal(engine.snapshot().initiatives[0].status, 'ready');
  const current = engine.acknowledgeWithState(initiative.id, 702_004, secondAttempt.deliveryAttemptCount);
  assert.equal(current.acknowledged, true,
    'the current attempt count is accepted while its lease remains live');
}

console.log('AUTONOMOUS_SOCIAL_DELIVERY_OUTBOX=PASS');
