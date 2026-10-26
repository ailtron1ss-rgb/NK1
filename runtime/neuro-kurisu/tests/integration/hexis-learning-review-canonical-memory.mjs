import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { MemoryOS2 } from '../../src/organism/developmental/MemoryOS2.ts';
import { HexisAdaptationFabric } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';
import { P65EpistemicLedger } from '../../src/organism/memory/P65EpistemicLedger.ts';
import { SourceMonitor } from '../../src/organism/memory/SourceMonitor.ts';
import { MemoryFabric, MemoryLifecycleCommandConflictError } from '../../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../../src/organism/memory/SemanticMemoryGraph.ts';

function encode(memoryOS, content, kind = 'semantic', source = 'learning-review-fixture') {
  return memoryOS.encode({
    content,
    kind,
    source,
    tags: ['review'],
    context: { fixture: 'hexis-learning-review' },
    salience: .5,
    emotionalWeight: .1,
    identityRelevance: kind === 'identity' || kind === 'autobiographical' ? .9 : .1,
    goalRelevance: .2,
    socialRelevance: .1,
    predictionError: .1,
    confidence: .7,
    epistemicStatus: 'fact',
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  }, { clone: false });
}

// Correction creates a canonical temporal revision, and records its review origin once.
const memoryOS = new MemoryOS2({ signalFusionProfile: 'balanced' });
const events = new EventLog(128);
const makeMemoryFabric = (store, eventLog) => new MemoryFabric(
  store,
  eventLog,
  new MultiTimescaleMemory(),
  new MemorySubstrateCoordinator(),
  new UnifiedMemorySystem(),
  new P62MemoryFabric(),
  new SemanticMemoryGraph(),
);
const fabric = makeMemoryFabric(memoryOS, events);
const original = encode(memoryOS, 'The original learned fact.');
const reviewed = new HexisAdaptationFabric().createLearningReview({
  periodStart: 0,
  periodEnd: 10,
  summary: 'Review a single learned fact.',
  items: [{
    kind: 'semantic_belief',
    title: 'semantic memory',
    content: original.content,
    sourceMemoryId: original.id,
    evidence: { confidence: original.confidence, source: original.source },
  }],
});
const item = reviewed.items[0];
assert.ok(item);
const reviewId = reviewed.id;
const itemId = item.id;
const correctionText = 'The corrected canonical fact.';
const correctionOptions = {
  reason: 'hexis-learning-review-correction',
  source: 'hexis-learning-review',
  confidence: original.confidence,
};
const correctionCommandId = 'hexis-review-correction:fixture-' + reviewId + '-' + itemId;
const corrected = fabric.reviseContent(original.id, correctionText, correctionOptions, {
  commandId: correctionCommandId,
  tick: 2,
});
assert.ok(corrected);
assert.notEqual(corrected.id, original.id, 'a content correction must create a revision row');
assert.equal(memoryOS.get(original.id).supersededById, corrected.id, 'the old row must point to its corrected successor');
assert.equal(memoryOS.temporalAt(original.id, Date.now())?.id, corrected.id, 'current temporal recall must select the corrected revision');
const eventsAfterCorrection = events.list().length;
const retryCorrection = fabric.reviseContent(original.id, correctionText, correctionOptions, {
  commandId: correctionCommandId,
  tick: 3,
});
assert.equal(retryCorrection?.id, corrected.id, 'the same review correction command must replay the same revision');
assert.equal(memoryOS.temporalChain(original.id).length, 2, 'retry must not create another temporal revision');
assert.equal(events.list().length, eventsAfterCorrection, 'replaying correction must not emit a second lifecycle event');
assert.ok(fabric.snapshot().mutationReceipts.some(row => row.commandId === correctionCommandId), 'correction command receipt is durable');

const reviewEvidenceKey = 'hexis-review:fixture-' + reviewId + '-' + itemId;
const evidenceCommandId = 'hexis-review-evidence:fixture-' + reviewId + '-' + itemId + '-' + corrected.id;
const receipt = fabric.recordEvidence(corrected.id, {
  source: 'hexis-learning-review:' + reviewId,
  provenanceClass: 'unknown',
  sourceAuthority01: .5,
  independenceKey: reviewEvidenceKey,
}, { commandId: evidenceCommandId, tick: 4 });
assert.equal(receipt.ok, true);
assert.equal(receipt.added, true, 'the review origin is recorded once on the corrected memory');
assert.equal(memoryOS.hasEvidenceLineage(corrected.id, reviewEvidenceKey), true);

const restored = new MemoryOS2({ signalFusionProfile: 'balanced' });
restored.restore(memoryOS.snapshot());
const restoredEvents = new EventLog(128);
restoredEvents.restore(events.list());
const restoredFabric = makeMemoryFabric(restored, restoredEvents);
restoredFabric.restore(fabric.snapshot());
assert.equal(restored.hasEvidenceLineage(corrected.id, reviewEvidenceKey), true, 'the review lineage survives restore');
const eventsBeforeReplay = restoredEvents.list().length;
const restoredCorrection = restoredFabric.reviseContent(original.id, correctionText, correctionOptions, {
  commandId: correctionCommandId,
  tick: 5,
});
assert.equal(restoredCorrection?.id, corrected.id, 'restored correction receipt returns the same revision');
assert.equal(restoredEvents.list().length, eventsBeforeReplay, 'restored correction replay emits no duplicate event');
const restoredEvidence = restoredFabric.recordEvidence(corrected.id, {
  source: 'hexis-learning-review:' + reviewId,
  provenanceClass: 'unknown',
  sourceAuthority01: .5,
  independenceKey: reviewEvidenceKey,
}, { commandId: evidenceCommandId, tick: 6 });
assert.equal(restoredEvidence.added, false, 'restored evidence receipt prevents a duplicate independent source');
assert.equal(restoredEvents.list().length, eventsBeforeReplay, 'restored evidence replay emits no duplicate event');
assert.throws(() => restoredFabric.reviseContent(original.id, 'Conflicting correction payload.', correctionOptions, {
  commandId: correctionCommandId,
  tick: 7,
}), MemoryLifecycleCommandConflictError, 'same mutation command ID with a different correction must fail closed');
assert.equal(memoryOS.temporalChain(original.id).length, 2, 'restore replay must preserve a single correction revision');
assert.equal(restored.indexDiagnostics().pass, true);

// The canonical memory policy already forbids deleting protected identity and quarantined records.
const identity = encode(restored, 'Stable identity fact.', 'identity', 'identity-fixture');
const autobiographical = encode(restored, 'Protected autobiographical event.', 'autobiographical', 'autobiographical-fixture');
const quarantined = encode(restored, 'An untrusted quarantined claim.', 'semantic', 'quarantined-fixture');
restored.revise(quarantined.id, 'quarantined', 'fixture-quarantine');
assert.equal(restored.forgetById(identity.id, 'hexis-learning-review-forget'), false);
assert.equal(restored.forgetById(autobiographical.id, 'hexis-learning-review-forget'), false);
assert.equal(restored.forgetById(quarantined.id, 'hexis-learning-review-forget'), false);

// Verify that the public Core coordinator applies canonical side effects before finalizing the review.
const coreSource = await readFile(new URL('../../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const reviewStart = coreSource.indexOf('hexisDecideLearningReview(reviewId: string');
const reviewEnd = coreSource.indexOf("hexisListLearningReviews(status = 'pending')", reviewStart);
assert.ok(reviewStart >= 0 && reviewEnd > reviewStart, 'the learning-review coordinator must remain in Core');
const body = coreSource.slice(reviewStart, reviewEnd);
const applyCorrectionAt = body.indexOf('this.memorySubsystem.fabric.reviseContent');
const recordEvidenceAt = body.indexOf('this.memorySubsystem.fabric.recordEvidence');
const commitDecisionAt = body.indexOf('this.hexisAdaptation.decideLearningReview');
assert.ok(applyCorrectionAt >= 0 && recordEvidenceAt > applyCorrectionAt, 'correction must be applied and linked to canonical memory');
assert.ok(commitDecisionAt > recordEvidenceAt, 'the review status must be finalized after the canonical correction/evidence');
assert.ok(body.includes("memory.kind === 'identity' || memory.kind === 'autobiographical' || memory.epistemicStatus === 'quarantined'"),
  'protected and quarantined memories must not be changed through this review path');
assert.ok(body.includes('if (!removed)'), 'a rejected canonical deletion must keep the review pending');
assert.ok(body.includes('alreadyAbsent: true'), 'forget retries must be safely idempotent after a previous deletion');
assert.ok(body.includes('reviewEvidence.revisionGroupId'), 'review decisions must retain their reviewed revision anchor');
assert.ok(body.includes("review-source-memory-superseded"), 'stale reviews must not mutate a newer revision');
assert.ok(body.includes('expectedGroupRows.length'), 'an absent reviewed row must not be mistaken for a completed forget while its revision chain remains');
assert.ok(body.includes('const recoveredCorrection = Boolean('), 'a correction committed before review closure must be recognized on retry');
assert.ok(body.includes("memory.supersedesId === requestedMemory.id"), 'the recovered correction must directly supersede the exact reviewed row');
assert.ok(body.includes("memory.source === 'hexis-learning-review'"), 'only a revision attributable to this workflow is eligible for correction recovery');
assert.ok(body.includes("memory.content === String(correction ?? '').trim()"), 'recovery must match the exact requested corrected text');
assert.ok(body.includes('hexis-review-correction:'), 'correction mutations must use a stable lifecycle command ID');
assert.ok(body.includes('!recoveredCorrection'), 'other stale review revisions remain rejected');

assert.ok(body.includes('p65EpistemicLedger.record'), 'review events must enter the canonical P65 epistemic ledger');
assert.ok(body.includes('sourceMonitor.record'), 'review events must enter the SourceMonitor lineage graph');
assert.ok(body.includes("evidenceClass: 'unverified' as const"), 'review metadata must not masquerade as external corroboration');
assert.ok(body.includes('priorReviewClaim') && body.includes('priorReviewTrace'), 'review provenance writes must be replay-safe across partial restore');

// The same review event is an observable system event and an explicitly unverified epistemic claim.
const p65 = new P65EpistemicLedger();
const sourceMonitor = new SourceMonitor();
const sourceId = 'hexis-review:review-fixture:item-fixture';
const capturedAt = 1_800_000_000_700;
const eventFingerprint = createHash('sha256').update(JSON.stringify({
  schemaVersion: 1, reviewId: 'review-fixture', itemId: 'item-fixture', decision: 'correct',
  sourceMemoryId: corrected.id, correctionHash: createHash('sha256').update(corrected.content).digest('hex'),
})).digest('hex');
const eventContent = 'Hexis learning-review request correct; review=review-fixture; item=item-fixture; memory=' + corrected.id + '. This is process provenance, not external truth.';
const provenance = {
  sourceId,
  sourceKind: 'hexis-learning-review',
  capturedAt,
  evidenceClass: 'unverified',
  contentFingerprint: eventFingerprint,
  citation: 'memory:' + corrected.id,
};
const p65ClaimId = p65.record({
  tick: 7,
  at: capturedAt,
  kind: 'observation',
  content: eventContent,
  confidence01: .5,
  source: 'hexis-review',
  provenance,
});
assert.ok(p65ClaimId);
sourceMonitor.record({
  id: sourceId,
  source: 'system',
  kind: 'hexis-learning-review',
  confidence: .5,
  epistemicStatus: 'observation',
  at: capturedAt,
  provenance,
});
assert.equal(p65.snapshot().claimsData.find(row => row.id === p65ClaimId)?.provenance?.evidenceClass, 'unverified');
assert.equal(sourceMonitor.lineage(sourceId)[0]?.provenance?.contentFingerprint, eventFingerprint);
const restoredP65 = new P65EpistemicLedger();
restoredP65.restore(p65.persistenceSnapshot());
const restoredSourceMonitor = new SourceMonitor();
restoredSourceMonitor.restore(sourceMonitor.snapshot());
assert.equal(restoredP65.sourceLineage(p65ClaimId)[0]?.provenance?.sourceId, sourceId);
assert.equal(restoredSourceMonitor.lineage(sourceId)[0]?.provenance?.evidenceClass, 'unverified');

console.log('HEXIS_LEARNING_REVIEW_CANONICAL_MEMORY=PASS', JSON.stringify({
  originalMemory: original.id,
  correctedMemory: corrected.id,
  reviewId,
  evidenceAdded: receipt.added,
  restoreReplayBlocked: !restored.recordEvidence(corrected.id, {
    source: 'hexis-learning-review:' + reviewId,
    provenanceClass: 'unknown',
    sourceAuthority01: .5,
    independenceKey: reviewEvidenceKey,
  }).added,
  protectedForgetBlocked: true,
}));
