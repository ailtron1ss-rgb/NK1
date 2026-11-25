import assert from 'node:assert/strict';
import { AutonomousSocialInitiativeEngine } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

const atHourUtc = (hour, dayOffset = 0) => Date.UTC(2026, 10, 2 + dayOffset, hour, 30, 0);

const runtimeInput = at => ({
  at, externalInput: false, socialNeed01: .95, relationship01: .4,
  energy01: .9, identity01: .96, novelty01: .6,
  topics: [{
    topic: 'Investigate a bounded unresolved question about the current project',
    source: 'reflection', salience01: .9, freshness01: .9, interestFit01: .7, affectFit01: .6,
  }],
  quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
});

const engine = new AutonomousSocialInitiativeEngine();
engine.setConsent(true);
engine.setQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
const quiet = engine.cycle(runtimeInput(atHourUtc(23)));
assert.equal(quiet.shouldInitiate, false, 'quiet hours suppress unsolicited user-visible delivery');
assert.equal(engine.deliveryPolicy().suppressedByQuietHours, 1);
assert.equal(engine.deliveryPolicy().suppressedByConsent, 0);
assert.equal(engine.cycle(runtimeInput(atHourUtc(12, 1)).topics ? { ...runtimeInput(atHourUtc(12, 1)), topics: [{ topic: 'A different unresolved question about project architecture and evidence', source: 'reflection', salience01: .9, freshness01: .9, interestFit01: .7, affectFit01: .6 }] } : runtimeInput(atHourUtc(12, 1))).shouldInitiate, true,
  'internal initiative can resume outside the quiet window');

const noConsent = new AutonomousSocialInitiativeEngine();
noConsent.setConsent(false);
assert.equal(noConsent.cycle(runtimeInput(atHourUtc(12))).shouldInitiate, false,
  'revoked consent blocks unsolicited delivery even outside quiet hours');
assert.equal(noConsent.deliveryPolicy().suppressedByConsent, 1);

const restored = new AutonomousSocialInitiativeEngine();
restored.restore(noConsent.snapshot());
assert.equal(restored.deliveryPolicy().consentGranted, false, 'revoked consent must survive restart');
const restoredQuiet = new AutonomousSocialInitiativeEngine();
restoredQuiet.restore(engine.snapshot());
assert.equal(restoredQuiet.deliveryPolicy().quietHoursEnabled, true);
assert.equal(restoredQuiet.mayDeliverUserVisible(atHourUtc(23)), false);

const legacy = new AutonomousSocialInitiativeEngine();
legacy.restore({
  version: 1, cycles: 3, planned: 0, executed: 0, deferred: 0,
  reciprocity01: .5, initiative01: .3, initiatives: [], startedAt: 1_800_000_000_000,
  lastExternalInputAt: 0, lastInitiativeAt: 0,
});
assert.equal(legacy.deliveryPolicy().consentGranted, false,
  'legacy snapshots without an explicit timestamped consent decision restore fail-closed');
assert.equal(legacy.deliveryPolicy().quietHoursEnabled, false);
console.log('SELF_MOTIVATION_DELIVERY_CONSENT=PASS');
