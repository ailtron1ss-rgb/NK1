import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';
import { createRealityEvidenceEventId, createStableEvidenceEventId } from '../src/organism/system/EvidenceEventIdentity.ts';

const identity = ['decision:feedback-17', 'exec-feedback-17', 'device.inspect', { sensor: 'door', sample: 1 }];
const stable = createStableEvidenceEventId('outcome', identity);
assert.match(stable ?? '', /^outcome:[a-f0-9]{40}$/);
assert.equal(createStableEvidenceEventId('outcome', identity), stable, 'the exact identity tuple must be deterministic');
assert.notEqual(createStableEvidenceEventId('outcome', [...identity, 'changed']), stable, 'a changed identity tuple must not alias the prior event');
assert.equal(createStableEvidenceEventId('Invalid namespace', identity), undefined, 'unsupported namespaces must fail closed');
const hostile = {};
Object.defineProperty(hostile, 'payload', { enumerable: true, get() { throw new Error('getter-must-not-run'); } });
assert.equal(createStableEvidenceEventId('outcome', hostile), undefined, 'hostile data must not mint an event identity');

const projectionId = createRealityEvidenceEventId('event:source-1', 'action-consequence', 'door=open');
assert.match(projectionId, /^nk1-reality:action-consequence:[a-f0-9]{48}$/);
assert.equal(createRealityEvidenceEventId('event:source-1', 'action-consequence', 'door=open'), projectionId);
assert.notEqual(createRealityEvidenceEventId('event:source-1', 'action-consequence', 'door=closed'), projectionId);
assert.throws(() => createRealityEvidenceEventId('event:\nsource', 'outcome', 'x'), /reality-evidence-event-identity-invalid/);

const ledger = new RealityEvidenceLedger(128);
const original = {
  eventId: projectionId,
  tick: 7,
  at: 100,
  realityClass: 'device-observation',
  claim: 'door=open',
  confidence01: 0.91,
  independenceKey: 'camera:front',
  parentIds: ['event:source-1'],
};
const first = ledger.record(original);
assert.equal(first.id, projectionId, 'a projection ID is the immutable row ID');
const replay = ledger.record({ ...original, at: 999 });
assert.equal(replay.id, first.id, 'later delivery time must not create another event');
assert.equal(ledger.snapshot().total, 1, 'an exact replay must not inflate total evidence count');
assert.equal(ledger.recent(256).length, 1);

const reduced = ledger.record({ ...original, at: 1000, confidence01: 0.72 });
assert.equal(reduced.confidence01, 0.72, 'same event identity may be conservatively recalibrated downward');
assert.equal(ledger.snapshot().total, 1, 'confidence calibration is not a new event');
assert.throws(() => ledger.record({ ...original, at: 1001, confidence01: 0.99 }), /reality-evidence-event-id-conflict/,
  'a stable identity must never be reused to inflate evidence confidence');
assert.equal(ledger.findByEventId(projectionId), undefined, 'conflicting identity must be removed from active and lookup evidence');
assert.ok(ledger.snapshot().quarantinedEventIds?.includes(projectionId));
assert.equal(ledger.claimAssessment('door=open').externalSamples, 0, 'quarantined evidence cannot ground a claim');
assert.equal(ledger.claimAssessment('door=open').promotionAllowed, false);
assert.throws(() => ledger.record(original), /reality-evidence-event-id-quarantined/,
  'quarantined IDs cannot be revived by a later retry');

const userReportedOnly = new RealityEvidenceLedger(128);
userReportedOnly.record({
  eventId: 'user-report:1', tick: 1, at: 10, realityClass: 'user-reported',
  claim: 'door=open', confidence01: 1, independenceKey: 'user:session-1', parentIds: [],
});
const reportAssessment = userReportedOnly.claimAssessment('door=open');
assert.equal(reportAssessment.userReportedSamples, 1);
assert.equal(reportAssessment.externalSamples, 0, 'a user report is context, not independent device/world evidence');
assert.equal(reportAssessment.qualifiedIndependentExternalSources, 0);
assert.equal(reportAssessment.promotionAllowed, false);
assert.equal(userReportedOnly.snapshot().externalCount, 0);

const corroborated = new RealityEvidenceLedger(128);
corroborated.record({ eventId: 'camera:event-1', tick: 1, at: 10, realityClass: 'device-observation', claim: 'door=open', confidence01: 0.9, independenceKey: 'camera:front', parentIds: [] });
corroborated.record({ eventId: 'http:event-2', tick: 2, at: 11, realityClass: 'external-observation', claim: 'door=open', confidence01: 0.87, independenceKey: 'api:door-state', parentIds: [] });
assert.equal(corroborated.claimAssessment('door=open').qualifiedIndependentExternalSources, 2);
assert.equal(corroborated.claimAssessment('door=open').independentPromotionAllowed, true);
corroborated.record({ eventId: 'camera:event-3', tick: 3, at: 12, realityClass: 'device-observation', claim: 'door=closed', confidence01: 0.92, independenceKey: 'camera:side', parentIds: [] });
const disputed = corroborated.claimAssessment('door=open');
assert.equal(disputed.contradictionDetected, true, 'high-confidence structured contradictory evidence must be surfaced');
assert.equal(disputed.independentPromotionAllowed, false, 'corroboration cannot override a qualified contradiction');

const bounded = new RealityEvidenceLedger(128);
for (let index = 0; index < 130; index += 1) {
  bounded.record({
    eventId: `event:${index}`, tick: index, at: 1000 + index, realityClass: 'device-observation',
    claim: 'battery=ready', confidence01: 0.8, independenceKey: `device:${index}`, parentIds: [],
  });
}
assert.equal(bounded.recent(256).length, 128, 'active evidence must remain bounded');
assert.equal(bounded.recent(256).some(row => row.eventId === 'event:0'), false, 'the oldest event should leave the active evidence window');
assert.equal(bounded.findByEventId('event:0')?.claim, 'battery=ready', 'the replay index must outlive the active window');
const boundedRestore = new RealityEvidenceLedger(128);
boundedRestore.restore(bounded.snapshot());
boundedRestore.record({
  eventId: 'event:0', tick: 0, at: 9999, realityClass: 'device-observation',
  claim: 'battery=ready', confidence01: 0.8, independenceKey: 'device:0', parentIds: [],
});
assert.equal(boundedRestore.snapshot().total, 130, 'replay after restore must not inflate lifetime event totals');
assert.equal(boundedRestore.recent(256).some(row => row.eventId === 'event:0'), false, 'replayed historical evidence must not re-enter the active window');

const completeCycle = new RealityEvidenceLedger(128);
const cycleParents = Array.from({ length: 11 }, (_, index) => `cycle-stage:${index + 1}`);
const completeCycleRow = completeCycle.record({
  eventId: 'cycle:complete-lineage', tick: 42, at: 42000,
  realityClass: 'derived', claim: 'cognitive-cycle-completeness', confidence01: 0.95,
  independenceKey: 'cycle:42', parentIds: cycleParents,
});
assert.equal(completeCycleRow.parentIds.length, 11,
  'the bounded reality ledger must preserve the full 11-stage cognitive-cycle lineage');
const restoredCompleteCycle = new RealityEvidenceLedger(128);
restoredCompleteCycle.restore(completeCycle.snapshot());
assert.deepEqual(restoredCompleteCycle.findByEventId('cycle:complete-lineage')?.parentIds, cycleParents,
  'restoration must retain the full bounded cognitive-cycle lineage');

const restoreConflictBase = new RealityEvidenceLedger(128);
restoreConflictBase.record({
  eventId: 'restore:event-1', tick: 8, at: 200, realityClass: 'device-observation',
  claim: 'switch=on', confidence01: 0.9, independenceKey: 'sensor:switch', parentIds: [],
});
const forged = restoreConflictBase.snapshot();
forged.quarantinedEventIds = [];
forged.recent.push({ ...forged.recent[0], claim: 'switch=off', confidence01: 0.1 });
const restoreConflict = new RealityEvidenceLedger(128);
restoreConflict.restore(forged);
assert.ok(restoreConflict.snapshot().quarantinedEventIds?.includes('restore:event-1'),
  'restore must reconstruct quarantine from conflicting duplicate rows even when its persisted quarantine list is absent');
assert.equal(restoreConflict.recent(256).length, 0, 'conflicting restored evidence must not remain active');

const invalidAggregate = new RealityEvidenceLedger(128);
invalidAggregate.restore({
  version: 1, total: 999999, externalCount: 999999, simulatorCount: 0, independentSources: 999999,
  recent: [{ id: 'bad', tick: -1, at: -1, realityClass: 'device-observation', claim: 'door=open', confidence01: 100, independenceKey: 'camera:front', parentIds: [] }],
});
assert.equal(invalidAggregate.snapshot().recent.length, 0, 'malformed persisted evidence must be rejected');
assert.equal(invalidAggregate.snapshot().externalCount, 0, 'aggregate counts must be recomputed from validated rows');

const runtimeSource = readFileSync(resolve(process.cwd(), 'src/organism/core/OrganismRuntime.ts'), 'utf8');
assert.match(runtimeSource, /createRealityEvidenceEventId/);
assert.equal((runtimeSource.match(/eventId:createRealityEvidenceEventId\(/g) ?? []).length, 6,
  'the five runtime action/reality projections must use stable upstream event identities');
assert.match(runtimeSource, /createStableEvidenceEventId\('cycle-lineage'/,
  'cognitive-cycle completeness must be bound to its complete stage lineage');

console.log('NK1_FEEDBACK_REALITY_LEDGER=PASS stableEventIdentity=true replayIdempotent=true confidenceCannotInflate=true userReportsNotExternal=true contradictoryEvidenceGated=true restoreConflictQuarantine=true boundedReceipts=true runtimeWiring=true');
