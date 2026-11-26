import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const at = Date.UTC(2026, 10, 25, 12, 30, 0);
const input = (time, topic) => ({
  at: time,
  externalInput: false,
  socialNeed01: .95,
  relationship01: .4,
  energy01: .9,
  identity01: .96,
  novelty01: .6,
  topics: [{
    topic,
    source: 'reflection',
    salience01: .9,
    freshness01: .9,
    interestFit01: .7,
    affectFit01: .6,
  }],
  quietPeriodMs: 0,
  cooldownMs: 0,
  startupGraceMs: 0,
});

const privateEngine = new AutonomousSocialInitiativeEngine();
const privateResult = privateEngine.cycle(input(at, 'A private reflective candidate about architecture and memory ownership'));
assert.equal(privateResult.shouldInitiate, false);
assert.equal(privateResult.initiative, null, 'private planning must not leak through the delivery result');
assert.ok(privateResult.internalPlan, 'consent denial must preserve an internal-only candidate');
assert.equal(privateResult.internalPlan.internalOnly, true);
assert.equal(privateEngine.latestPlanned(at), null, 'private candidates never enter delivery generation');
assert.equal(privateEngine.latestInternalPlan(at)?.id, privateResult.internalPlan.id);

const secondPrivateResult = privateEngine.cycle(input(at + 1000, 'A second private reflective candidate about the same project'));
assert.equal(secondPrivateResult.internalPlan, null, 'one pending private plan suppresses duplicate internal candidate generation');
assert.equal(privateEngine.snapshot().initiatives.filter(row => row.status === 'planned' && row.internalOnly === true).length, 1);

assert.equal(
  privateEngine.stageMessage(privateResult.internalPlan.id, 'This private thought must never be staged', at + 1000),
  false,
);
privateEngine.setConsent(true);
assert.equal(privateEngine.latestPlanned(at + 1000), null, 'opt-in never retroactively promotes a private candidate');

const freshDeliverable = privateEngine.cycle(input(at + 2000, 'A new consented conversation candidate about evidence-based planning'));
assert.equal(freshDeliverable.internalPlan ?? null, null);
assert.equal(freshDeliverable.shouldInitiate, true);
assert.ok(freshDeliverable.initiative);
assert.equal(freshDeliverable.initiative.internalOnly, false);
assert.equal(privateEngine.latestInternalPlan(at + 2000)?.id, privateResult.internalPlan.id);

const quietEngine = new AutonomousSocialInitiativeEngine();
quietEngine.setConsent(true);
quietEngine.setQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
const quietAt = Date.UTC(2026, 10, 25, 23, 30, 0);
const quiet = quietEngine.cycle(input(quietAt, 'A private idea formed during the configured quiet interval'));
assert.equal(quiet.shouldInitiate, false);
assert.equal(quiet.initiative, null, 'quiet-hours plans must not leak through the delivery result');
assert.ok(quiet.internalPlan);
assert.equal(quiet.internalPlan.internalOnly, true);
assert.equal(quietEngine.latestPlanned(quietAt), null);
assert.equal(quietEngine.latestInternalPlan(quietAt)?.id, quiet.internalPlan.id);

const corruptedReady = new AutonomousSocialInitiativeEngine();
corruptedReady.restore({
  version: 1,
  cycles: 1,
  planned: 1,
  executed: 0,
  deferred: 0,
  reciprocity01: .5,
  initiative01: .3,
  consentGranted: true,
  consentDecisionAt: at,
  quietHoursEnabled: false,
  quietStartHourUtc: 22,
  quietEndHourUtc: 8,
  suppressedByConsent: 0,
  suppressedByQuietHours: 0,
  initiatives: [{
    id: 'private-ready-corruption',
    contact: null,
    kind: 'share-thought',
    priority01: .8,
    status: 'ready',
    internalOnly: true,
    createdAt: at,
    reason: 'private reflection',
    topic: 'A private reflection that must remain non-deliverable',
    topicSource: 'reflection',
    openingIntent: 'share-observation',
    message: 'This text must be removed during restore',
    stagedAt: at,
  }],
  startedAt: at,
  lastExternalInputAt: 0,
  lastInitiativeAt: at,
});
assert.equal(corruptedReady.latestReady(at), null);
assert.equal(corruptedReady.acknowledge('private-ready-corruption', at), false);
assert.equal(corruptedReady.snapshot().initiatives[0].status, 'deferred');
assert.equal(corruptedReady.snapshot().initiatives[0].reason, 'private-plan-restored-as-deliverable');
assert.equal(corruptedReady.snapshot().initiatives[0].message, undefined);
assert.equal(corruptedReady.snapshot().initiatives[0].stagedAt, undefined);
assert.equal(corruptedReady.snapshot().initiatives[0].deliveryLeaseUntil, undefined);
assert.equal(corruptedReady.latestReady(at), null,
  'a restored private plan must remain non-deliverable after the recovery pass');
assert.equal(corruptedReady.snapshot().deferred, 1);


const corruptedPlanned = new AutonomousSocialInitiativeEngine();
corruptedPlanned.restore({
  version: 1,
  cycles: 1,
  planned: 1,
  executed: 0,
  deferred: 0,
  reciprocity01: .5,
  initiative01: .3,
  consentGranted: true,
  consentDecisionAt: at,
  quietHoursEnabled: false,
  quietStartHourUtc: 22,
  quietEndHourUtc: 8,
  suppressedByConsent: 0,
  suppressedByQuietHours: 0,
  initiatives: [{
    id: 'private-planned-corruption',
    contact: null,
    kind: 'share-thought',
    priority01: .8,
    status: 'planned',
    internalOnly: true,
    createdAt: at,
    reason: 'private reflection',
    topic: 'A private plan with a forged staged payload',
    topicSource: 'reflection',
    openingIntent: 'share-observation',
    message: 'This internal-only message must be scrubbed',
    stagedAt: at,
  }],
  startedAt: at,
  lastExternalInputAt: 0,
  lastInitiativeAt: at,
});
const sanitizedPrivatePlan = corruptedPlanned.latestInternalPlan(at);
assert.ok(sanitizedPrivatePlan);
assert.equal(sanitizedPrivatePlan.status, 'planned');
assert.equal(sanitizedPrivatePlan.message, undefined);
assert.equal(sanitizedPrivatePlan.stagedAt, undefined);
assert.equal(corruptedPlanned.latestPlanned(at), null);
assert.equal(corruptedPlanned.latestReady(at), null);

console.log('AUTONOMY_INTERNAL_PLAN_BOUNDARY=PASS');
