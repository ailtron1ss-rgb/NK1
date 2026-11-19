import assert from 'node:assert/strict';
import { AutonomousDecisionReceiptLog } from '../src/organism/system/AutonomousDecisionReceipt.ts';
import { AutonomousSocialInitiativeEngine, withinQuietHoursUtc } from '../src/organism/system/AutonomousSocialInitiativeEngine.ts';

// ---- Phase 5: decision explanation receipts ------------------------------

const log = new AutonomousDecisionReceiptLog();
const opened = log.open({
  id: 'receipt:1:dec-1', tick: 1, at: 1_000,
  trigger: 'goal:intrinsic:resolve-uncertainty', source: 'endogenous',
  driveContributions: { epistemic: .81, novelty: .44, homeostatic: .2 },
  dominantDrive: 'epistemic',
  goalId: 'g-deadbeef', goalSource: 'internal',
  candidates: [
    { action: 'verify', score: .72, confidence: .61 },
    { action: 'explore', score: .68, confidence: .55 },
    { action: 'wait', score: .3, confidence: .4 },
  ],
  selectedAction: 'verify', confidence01: .61, resourceCost01: .24,
  safety: { authorized: true, reason: 'goal:g-deadbeef' },
});
assert.equal(opened.selectedAction, 'verify', 'receipt must record the selected action');
assert.equal(opened.candidates.find(c => c.action === 'verify')?.selected, true, 'selected candidate must be marked');
assert.deepEqual(opened.rejected.map(r => r.action), ['explore', 'wait'], 'rejected alternatives must be the non-selected candidates in rank order');
assert.equal(opened.safety.authorized, true, 'safety decision must be recorded');

// Explainability must be derived from the record, not invented.
const openExplanation = log.explain(1);
assert.ok(openExplanation, 'a receipt must be explainable');
assert.match(openExplanation.answer, /verify/, 'explanation must name the selected action');
assert.match(openExplanation.answer, /epistemic/, 'explanation must cite the dominant drive');
assert.match(openExplanation.answer, /Outcome not yet observed/, 'an open receipt must not claim an outcome it does not have');
assert.match(openExplanation.answer, /Learning consequence not yet recorded/, 'an open receipt must not claim learning it does not have');

// Close with outcome + learning consequence.
assert.equal(log.close(1, { success01: .74, reward01: .7, surprise01: .22, at: 1_500 }), true, 'close must attach the observed outcome');
assert.equal(log.recordLearning(1, { accepted: true, gain11: .31, note: 'goal-progress-accepted' }), true, 'recordLearning must attach the consequence');
const closedExplanation = log.explain(1);
assert.match(closedExplanation.answer, /Outcome: success 0\.74/, 'a closed receipt must report the real outcome');
assert.match(closedExplanation.answer, /Learning: accepted/, 'a closed receipt must report the real learning consequence');

// Unknown tick must not fabricate an answer.
assert.equal(log.explain(999), null, 'explaining an unknown tick must return null, not a fabricated narrative');

// Idempotent open per id.
const reopened = log.open({ id: 'receipt:1:dec-1', tick: 1, at: 1_000, trigger: 'other', source: 'external', selectedAction: 'rest', confidence01: .9, resourceCost01: .1, safety: { authorized: false, reason: 'x' } });
assert.equal(reopened.selectedAction, 'verify', 'opening an existing id must be idempotent');
assert.equal(log.diagnostics().created, 1, 'idempotent open must not double-count');

// Fail-closed restore: malformed receipts are dropped, valid ones survive.
const restored = new AutonomousDecisionReceiptLog();
restored.restore({
  version: 1, created: 9, closed: 4,
  receipts: [
    { id: '', tick: 2, at: 2, trigger: 'bad', source: 'endogenous', candidates: [], rejected: [], selectedAction: 'verify', confidence01: .5, resourceCost01: .1, safety: { authorized: true, reason: 'x' } },
    { id: 'receipt:5:ok', tick: 5, at: 5_000, trigger: 'external-user-turn', source: 'external', candidates: [{ action: 'respond', score: .6, confidence: .5, selected: true }], rejected: [], selectedAction: 'respond', confidence01: .5, resourceCost01: .2, safety: { authorized: true, reason: 'policy-allowed' }, outcome: { success01: .6, reward01: .6, surprise01: .1, at: 5_500 }, closedAt: 5_500 },
  ],
});
assert.equal(restored.diagnostics().stored, 1, 'a receipt without an id must be dropped on restore');
assert.equal(restored.forTick(5)?.selectedAction, 'respond', 'a structurally valid receipt must survive restore');
assert.equal(restored.forTick(2), null, 'an invalid receipt must not be restored');

// ---- Phase 4: quiet hours + consent gating -------------------------------

const start = 1_800_000_000_000;
const atHourUtc = (hour, dayOffset = 0) => {
  const d = new Date(Date.UTC(2026, 10, 2 + dayOffset, hour, 30, 0));
  return d.getTime();
};
assert.equal(withinQuietHoursUtc(atHourUtc(23), 22, 8), true, '23:00 UTC must fall in a 22->8 quiet window');
assert.equal(withinQuietHoursUtc(atHourUtc(3), 22, 8), true, '03:00 UTC must fall in a 22->8 quiet window');
assert.equal(withinQuietHoursUtc(atHourUtc(12), 22, 8), false, '12:00 UTC must fall outside a 22->8 quiet window');
assert.equal(withinQuietHoursUtc(atHourUtc(9), 8, 17), true, '09:00 UTC must fall in a same-day 8->17 window');
assert.equal(withinQuietHoursUtc(atHourUtc(18), 8, 17), false, '18:00 UTC must fall outside a same-day 8->17 window');

const engine = new AutonomousSocialInitiativeEngine();
const runtimeInput = (at) => ({
  at, externalInput: false, socialNeed01: .95, relationship01: .4, energy01: .9, identity01: .96, novelty01: .6,
  topics: [{ topic: 'Investigate a bounded unresolved question about the current project', source: 'reflection', salience01: .9, freshness01: .9, interestFit01: .7, affectFit01: .6 }],
  quietPeriodMs: 0, cooldownMs: 0, startupGraceMs: 0,
});

// Quiet hours must suppress only user-visible delivery, and be counted separately.
engine.setQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
const quietResult = engine.cycle(runtimeInput(atHourUtc(23)));
assert.equal(quietResult.shouldInitiate, false, 'quiet hours must suppress user-visible initiative');
assert.equal(engine.deliveryPolicy().suppressedByQuietHours, 1, 'quiet-hours suppression must be counted distinctly');
assert.equal(engine.deliveryPolicy().suppressedByConsent, 0, 'quiet hours must not be counted as consent suppression');

// Outside the window (next day), initiative resumes.
const dayResult = engine.cycle(runtimeInput(atHourUtc(12, 1)));
assert.equal(dayResult.shouldInitiate, true, 'initiative must resume outside quiet hours');

// Revoking consent blocks delivery even outside quiet hours and is counted as consent.
const consentEngine = new AutonomousSocialInitiativeEngine();
consentEngine.setConsent(false);
const consentResult = consentEngine.cycle(runtimeInput(atHourUtc(12)));
assert.equal(consentResult.shouldInitiate, false, 'revoked consent must block user-visible initiative');
assert.equal(consentEngine.deliveryPolicy().suppressedByConsent, 1, 'consent suppression must be counted distinctly');

// Consent + quiet-hours policy must survive a restart.
const restoredEngine = new AutonomousSocialInitiativeEngine();
restoredEngine.restore(consentEngine.snapshot());
assert.equal(restoredEngine.deliveryPolicy().consentGranted, false, 'revoked consent must survive restore');
const restoredQuiet = new AutonomousSocialInitiativeEngine();
restoredQuiet.restore(engine.snapshot());
assert.equal(restoredQuiet.deliveryPolicy().quietHoursEnabled, true, 'quiet hours must survive restore');
assert.equal(restoredQuiet.deliveryPolicy().quietStartHourUtc, 22, 'quiet start hour must survive restore');
assert.equal(restoredQuiet.mayDeliverUserVisible(atHourUtc(23)), false, 'restored quiet hours must still suppress delivery');

// Backward compatibility: an old snapshot without the new fields restores to the granted default.
const legacy = new AutonomousSocialInitiativeEngine();
legacy.restore({ version: 1, cycles: 3, planned: 0, executed: 0, deferred: 0, reciprocity01: .5, initiative01: .3, initiatives: [], startedAt: start, lastExternalInputAt: 0, lastInitiativeAt: 0 });
assert.equal(legacy.deliveryPolicy().consentGranted, true, 'a legacy snapshot must restore to the granted default, not silently revoke consent');
assert.equal(legacy.deliveryPolicy().quietHoursEnabled, false, 'quiet hours must default to disabled for legacy snapshots');

console.log('SELFMOTIVATION_AUTONOMY_UNIT=PASS');
