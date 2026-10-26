import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryOS2 } from '../../src/organism/developmental/MemoryOS2.ts';
import { HexisAdaptationFabric } from '../../src/organism/integration/hexis/HexisAdaptationFabric.ts';

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
const corrected = memoryOS.reviseContent(original.id, 'The corrected canonical fact.', {
  reason: 'hexis-learning-review-correction',
  source: 'hexis-learning-review',
  confidence: original.confidence,
});
assert.ok(corrected);
assert.notEqual(corrected.id, original.id, 'a content correction must create a revision row');
assert.equal(memoryOS.get(original.id).supersededById, corrected.id, 'the old row must point to its corrected successor');
assert.equal(memoryOS.temporalAt(original.id, Date.now())?.id, corrected.id, 'current temporal recall must select the corrected revision');

const reviewEvidenceKey = 'hexis-review:fixture-' + reviewId + '-' + itemId;
const receipt = memoryOS.recordEvidence(corrected.id, {
  source: 'hexis-learning-review:' + reviewId,
  provenanceClass: 'unknown',
  sourceAuthority01: .5,
  independenceKey: reviewEvidenceKey,
});
assert.equal(receipt.ok, true);
assert.equal(receipt.added, true, 'the review origin is recorded once on the corrected memory');
assert.equal(memoryOS.hasEvidenceLineage(corrected.id, reviewEvidenceKey), true);
const restored = new MemoryOS2({ signalFusionProfile: 'balanced' });
restored.restore(memoryOS.snapshot());
assert.equal(restored.hasEvidenceLineage(corrected.id, reviewEvidenceKey), true, 'the review lineage survives restore');
assert.equal(restored.recordEvidence(corrected.id, {
  source: 'hexis-learning-review:' + reviewId,
  provenanceClass: 'unknown',
  sourceAuthority01: .5,
  independenceKey: reviewEvidenceKey,
}).added, false, 'a retry after restore must not append the same review source twice');
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
const recordEvidenceAt = body.indexOf('this.memorySubsystem.memoryOS.recordEvidence');
const commitDecisionAt = body.indexOf('this.hexisAdaptation.decideLearningReview');
assert.ok(applyCorrectionAt >= 0 && recordEvidenceAt > applyCorrectionAt, 'correction must be applied and linked to canonical memory');
assert.ok(commitDecisionAt > recordEvidenceAt, 'the review status must be finalized after the canonical correction/evidence');
assert.ok(body.includes("memory.kind === 'identity' || memory.kind === 'autobiographical' || memory.epistemicStatus === 'quarantined'"),
  'protected and quarantined memories must not be changed through this review path');
assert.ok(body.includes('if (!removed)'), 'a rejected canonical deletion must keep the review pending');
assert.ok(body.includes('alreadyAbsent: true'), 'forget retries must be safely idempotent after a previous deletion');

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
