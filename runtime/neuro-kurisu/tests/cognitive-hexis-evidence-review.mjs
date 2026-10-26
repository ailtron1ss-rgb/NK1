import assert from "node:assert/strict";
import { MemoryOS2 } from "../src/organism/developmental/MemoryOS2.ts";
import { sha256Stable } from "../src/organism/core/StableSerialization.ts";
import { adaptHexisEvidence } from "../src/organism/memory/HexisEvidenceAdapter.ts";
import { HexisAdaptationFabric } from "../src/organism/integration/hexis/HexisAdaptationFabric.ts";
import {
  ingestHexisEvidenceForReview,
  decideHexisEvidenceReview,
} from "../src/organism/memory/HexisEvidenceMemoryBridge.ts";

function createMemory(memoryOS, content, confidence = 0.5, kind = "semantic") {
  return memoryOS.encode({
    content,
    kind,
    source: "hexis-evidence-review-regression",
    tags: ["hexis", "evidence-review"],
    context: { regression: "hexis-evidence-review" },
    salience: 0.6,
    emotionalWeight: 0.1,
    identityRelevance: 0.2,
    goalRelevance: 0.4,
    socialRelevance: 0.1,
    predictionError: 0.1,
    confidence,
    epistemicStatus: "belief",
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
    contradictionLinks: [],
  }, { clone: false });
}

function evidence(memoryId, evidenceId, stance = "supports", sourceRef = evidenceId, patch = {}) {
  return {
    memoryId,
    evidenceId,
    stance,
    source: { kind: "document", ref: sourceRef, label: "Independent document" },
    observedAt: "2026-10-26T10:00:00.000Z",
    confidence: 0.82,
    note: "Evidence content for guarded review integration.",
    ...patch,
  };
}

function target(memoryOS, memoryId) {
  return memoryOS.snapshot().items.find((item) => item.id === memoryId);
}

// 1) Evidence ingestion creates a pending Hexis review, but changes no belief.
const memoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const fabric = new HexisAdaptationFabric();
const belief = createMemory(memoryOS, "Belief to be updated only after an explicit Hexis review decision.", 0.5);
const initialConfidence = belief.confidence;
const incoming = evidence(belief.id, "hexis:review:approve-01", "supports", "source:paper-01");
const pending = ingestHexisEvidenceForReview(memoryOS, fabric, incoming);
assert.equal(pending.status, "review-pending");
assert.equal(pending.previewApplied, true);
assert.ok(pending.proposedConfidence01 > pending.baselineConfidence01);
assert.equal(memoryOS.get(belief.id).confidence, initialConfidence, "proposal must not mutate canonical confidence");
assert.equal(fabric.getLearningReview(pending.reviewId)?.items[0]?.status, "pending");

// Preview itself is pure: no belief, metrics, audit or review mutation.
const fabricBeforePreview = structuredClone(fabric.snapshot());
const preview = fabric.previewBeliefRevision({
  memoryId: belief.id,
  confidence01: initialConfidence,
  trust01: belief.sourceAuthority01 ?? 0.5,
  stance: "supports",
  evidence: { ref: "source:preview-only", trust01: 0.7 },
});
assert.equal(preview.applied, true);
assert.deepEqual(fabric.snapshot(), fabricBeforePreview);

// Explicit approval updates the one canonical confidence owner and syncs its projection.
const approved = decideHexisEvidenceReview(memoryOS, fabric, pending.reviewId, pending.reviewItemId, "approve");
assert.equal(approved.status, "decided");
assert.equal(approved.confidenceChanged, true);
assert.ok(approved.auditId);
assert.equal(memoryOS.get(belief.id).confidence, pending.proposedConfidence01);
assert.equal(fabric.snapshot().beliefs.find((item) => item.memoryId === belief.id).confidence01, memoryOS.get(belief.id).confidence);
assert.equal(fabric.getLearningReview(pending.reviewId)?.items[0]?.status, "approved");

// Exact replay does not create another review or change confidence; changed payload conflicts.
const postApproveConfidence = memoryOS.get(belief.id).confidence;
const exactReplay = ingestHexisEvidenceForReview(memoryOS, fabric, incoming);
assert.equal(exactReplay.status, "duplicate");
assert.equal(fabric.snapshot().metrics.reviewsCreated, 1);
assert.equal(memoryOS.get(belief.id).confidence, postApproveConfidence);
const idConflict = ingestHexisEvidenceForReview(memoryOS, fabric, {
  ...incoming,
  note: "Changed content with the same evidence identity must fail closed.",
});
assert.equal(idConflict.status, "conflict");
assert.equal(memoryOS.get(belief.id).confidence, postApproveConfidence);
const explicitTimestampConflict = ingestHexisEvidenceForReview(memoryOS, fabric, {
  ...incoming,
  observedAt: "2026-10-26T10:01:00.000Z",
});
assert.equal(explicitTimestampConflict.status, "conflict", "caller-supplied timestamp is part of canonical evidence identity");

// Legacy callers may omit observedAt, in which case the server receipt clock
// changes on every request but must not make an identical replay conflict.
const receiptMemory = createMemory(memoryOS, "Memory for server-generated evidence receipt timestamps.", 0.52);
const receiptInput = evidence(
  receiptMemory.id,
  "hexis:review:receipt-time-01",
  "supports",
  "source:receipt-time-01",
  { observedAtOrigin: "server-receipt", observedAt: "2026-10-26T10:00:00.000Z" },
);
const receiptPending = ingestHexisEvidenceForReview(memoryOS, fabric, receiptInput);
assert.equal(receiptPending.status, "review-pending");
const receiptReplay = ingestHexisEvidenceForReview(memoryOS, fabric, {
  ...receiptInput,
  observedAt: "2026-10-26T10:05:00.000Z",
});
assert.equal(receiptReplay.status, "duplicate", "generated receipt time must not destabilize idempotent replay");
const receiptConflict = ingestHexisEvidenceForReview(memoryOS, fabric, {
  ...receiptInput,
  observedAt: "2026-10-26T10:05:00.000Z",
  note: "An actual payload change must remain a conflict.",
});
assert.equal(receiptConflict.status, "conflict", "timestamp normalization must not weaken the rest of the evidence digest");

// 2) Contradicting evidence remains a proposal until a reviewer explicitly approves it.
const contradictionMemory = createMemory(memoryOS, "Belief challenged by a source requiring review.", 0.8);
const contradiction = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(contradictionMemory.id, "hexis:review:contradict-01", "contradicts", "source:paper-02"),
);
assert.equal(contradiction.status, "review-pending");
assert.ok(contradiction.proposedConfidence01 < contradiction.baselineConfidence01);
assert.equal(memoryOS.get(contradictionMemory.id).confidence, 0.8);
const contradictionDecision = decideHexisEvidenceReview(
  memoryOS, fabric, contradiction.reviewId, contradiction.reviewItemId, "approve",
);
assert.equal(contradictionDecision.status, "decided");
assert.equal(memoryOS.get(contradictionMemory.id).confidence, contradiction.proposedConfidence01);

// 3) Contextual evidence can be approved without an automatic confidence revision.
const contextMemory = createMemory(memoryOS, "Memory supported by contextual material only.", 0.63);
const contextual = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(contextMemory.id, "hexis:review:context-01", "contextualizes", "source:context-01"),
);
assert.equal(contextual.status, "review-pending");
assert.equal(contextual.previewApplied, false);
const contextualDecision = decideHexisEvidenceReview(
  memoryOS, fabric, contextual.reviewId, contextual.reviewItemId, "approve",
);
assert.equal(contextualDecision.status, "decided");
assert.equal(contextualDecision.confidenceChanged, false);
assert.equal(memoryOS.get(contextMemory.id).confidence, 0.63);

// 4) A stale review cannot overwrite a newer canonical change.
const staleMemory = createMemory(memoryOS, "Memory whose confidence changes while review is pending.", 0.44);
const staleReview = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(staleMemory.id, "hexis:review:stale-01", "supports", "source:stale-01"),
);
assert.equal(staleReview.status, "review-pending");
memoryOS.updateSignals(staleMemory.id, { confidence: 0.71 }, "independent-concurrent-correction");
const staleDecision = decideHexisEvidenceReview(
  memoryOS, fabric, staleReview.reviewId, staleReview.reviewItemId, "approve",
);
assert.equal(staleDecision.status, "rejected");
assert.equal(staleDecision.reason, "stale-review-canonical-confidence-changed");
assert.equal(memoryOS.get(staleMemory.id).confidence, 0.71);
assert.equal(fabric.getLearningReview(staleReview.reviewId)?.items[0]?.status, "pending");

// 5) Correct/forget decisions stay in the review subsystem; they don't mutate/delete memory.
const correctMemory = createMemory(memoryOS, "Memory whose proposed correction needs explicit handling.", 0.55);
const correctionReview = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(correctMemory.id, "hexis:review:correct-01", "supports", "source:correct-01"),
);
const corrected = decideHexisEvidenceReview(
  memoryOS, fabric, correctionReview.reviewId, correctionReview.reviewItemId, "correct", "Human correction recorded for a later dedicated correction workflow.",
);
assert.equal(corrected.status, "decided");
assert.equal(corrected.confidenceChanged, false);
assert.equal(memoryOS.get(correctMemory.id).confidence, 0.55);
assert.ok(memoryOS.get(correctMemory.id));

const forgetMemory = createMemory(memoryOS, "Memory which a reviewer may dismiss without destructive deletion.", 0.57);
const forgetReview = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(forgetMemory.id, "hexis:review:forget-01", "supports", "source:forget-01"),
);
const forgotten = decideHexisEvidenceReview(
  memoryOS, fabric, forgetReview.reviewId, forgetReview.reviewItemId, "forget",
);
assert.equal(forgotten.status, "decided");
assert.equal(forgotten.confidenceChanged, false);
assert.ok(memoryOS.get(forgetMemory.id));

// 6) Protected memory and partial review failures do not leave orphan evidence receipts.
const protectedMemory = createMemory(memoryOS, "Protected identity-related memory.", 0.67, "identity");
const beforeProtected = structuredClone(memoryOS.snapshot());
const blocked = ingestHexisEvidenceForReview(
  memoryOS, fabric,
  evidence(protectedMemory.id, "hexis:review:protected-01", "contradicts", "source:protected-01", { protectedMemory: true }),
);
assert.equal(blocked.status, "blocked");
assert.deepEqual(memoryOS.snapshot(), beforeProtected);

const rollbackMemory = createMemory(memoryOS, "Memory used to test atomic review preparation rollback.", 0.49);
const rollbackFabric = new HexisAdaptationFabric();
const rollbackEvidence = evidence(rollbackMemory.id, "hexis:review:rollback-01", "supports", "source:rollback-01");
const failCreateReview = rollbackFabric.createLearningReview.bind(rollbackFabric);
rollbackFabric.createLearningReview = () => { throw new Error("simulated review queue failure"); };
const failedReview = ingestHexisEvidenceForReview(memoryOS, rollbackFabric, rollbackEvidence);
rollbackFabric.createLearningReview = failCreateReview;
assert.equal(failedReview.status, "rejected");
assert.equal(failedReview.reason, "hexis-review-ingress-failed");
assert.equal(Boolean(target(memoryOS, rollbackMemory.id).evidenceRecords?.some((row) => row.evidenceId === rollbackEvidence.evidenceId)), false);
assert.equal(rollbackFabric.snapshot().learningReviews.length, 0);

// 7) Persisted review metadata must remain bound to the exact canonical receipt.
const tamperingCases = [
  { name: "source-ref", patch: (payload) => ({ source: { ...payload.source, ref: "source:forged-reference" } }) },
  { name: "source-label", patch: (payload) => ({ source: { ...payload.source, label: "Forged source label" } }) },
  { name: "note", patch: () => ({ note: "Forged review text that was never in the canonical receipt." }) },
  { name: "observed-at", patch: () => ({ observedAt: "2026-10-26T11:59:00.000Z" }) },
  { name: "stance", patch: () => ({ stance: "contradicts" }) },
  { name: "confidence", patch: () => ({ evidenceConfidence01: 0.99 }) },
];
for (const tampering of tamperingCases) {
  const tamperMemoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
  const tamperFabric = new HexisAdaptationFabric();
  const tamperMemory = createMemory(tamperMemoryOS, `Memory for ${tampering.name} digest-binding tampering.`, 0.62);
  const tamperEvidence = evidence(
    tamperMemory.id,
    `hexis:review:tamper-${tampering.name}`,
    "supports",
    `source:tamper-${tampering.name}`,
  );
  const tamperPending = ingestHexisEvidenceForReview(tamperMemoryOS, tamperFabric, tamperEvidence);
  assert.equal(tamperPending.status, "review-pending");
  if (tamperPending.status !== "review-pending") continue;

  const tamperedSnapshot = tamperFabric.snapshot();
  const tamperedReview = tamperedSnapshot.learningReviews.find((row) => row.id === tamperPending.reviewId);
  const tamperedItem = tamperedReview?.items.find((row) => row.id === tamperPending.reviewItemId);
  assert.ok(tamperedItem, `expected pending review for ${tampering.name}`);
  tamperedItem.evidence = { ...tamperedItem.evidence, ...tampering.patch(tamperedItem.evidence) };
  tamperFabric.restore(tamperedSnapshot);

  const memoryBeforeDecision = tamperMemoryOS.snapshot();
  const reviewBeforeDecision = tamperFabric.snapshot();
  const decision = decideHexisEvidenceReview(
    tamperMemoryOS, tamperFabric, tamperPending.reviewId, tamperPending.reviewItemId, "approve",
  );
  assert.equal(decision.status, "rejected", `${tampering.name} tampering must be rejected`);
  if (decision.status === "rejected") assert.equal(decision.reason, "canonical-review-evidence-binding-mismatch");
  assert.deepEqual(tamperMemoryOS.snapshot(), memoryBeforeDecision, `${tampering.name} tampering must not mutate canonical memory`);
  assert.deepEqual(tamperFabric.snapshot(), reviewBeforeDecision, `${tampering.name} tampering must leave review state unchanged`);
  assert.equal(tamperMemoryOS.get(tamperMemory.id).confidence, 0.62);
}

// Also preserve approvals for pending reviews produced by an older server build,
// where the server-receipt clock was included in the persisted raw digest.
const serverStampMemoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const serverStampFabric = new HexisAdaptationFabric();
const serverStampMemory = createMemory(serverStampMemoryOS, "Memory for server-stamped evidence binding.", 0.58);
const serverStampEvidence = evidence(
  serverStampMemory.id,
  "hexis:review:server-stamp",
  "supports",
  "source:server-stamp",
  { observedAt: "2026-10-26T10:31:00.000Z", observedAtOrigin: "server-receipt" },
);
const serverStampPending = ingestHexisEvidenceForReview(serverStampMemoryOS, serverStampFabric, serverStampEvidence);
assert.equal(serverStampPending.status, "review-pending");
if (serverStampPending.status === "review-pending") {
  const snapshot = serverStampFabric.snapshot();
  const review = snapshot.learningReviews.find((row) => row.id === serverStampPending.reviewId);
  const item = review?.items.find((row) => row.id === serverStampPending.reviewItemId);
  assert.ok(item);
  assert.equal(item.evidence.observedAtOrigin, "server-receipt");
  const adapted = adaptHexisEvidence(serverStampEvidence);
  assert.equal(adapted.accepted, true);
  if (adapted.accepted) {
    const legacyRawDigest = sha256Stable(adapted.evidence, "legacy").toLowerCase();
    const receipt = serverStampMemoryOS.get(serverStampMemory.id).evidenceRecords
      .find((row) => row.evidenceId === serverStampEvidence.evidenceId);
    assert.ok(receipt);
    assert.notEqual(legacyRawDigest, receipt.digest, "fixture must represent a pre-normalization review");
    item.evidence = { ...item.evidence, digest: legacyRawDigest };
    serverStampFabric.restore(snapshot);
  }
  const approved = decideHexisEvidenceReview(
    serverStampMemoryOS, serverStampFabric, serverStampPending.reviewId, serverStampPending.reviewItemId, "approve",
  );
  assert.equal(approved.status, "decided", "legacy server-receipt review digest must remain approvable");
}

console.log("Hexis evidence → canonical MemoryOS2 → gated Hexis review: PASS", JSON.stringify({
  approvalChangesCanonicalConfidence: true,
  duplicateReplay: exactReplay.status,
  conflict: idConflict.status,
  contextualConfidenceChanged: contextualDecision.confidenceChanged,
  staleReview: staleDecision.reason,
  reviewQueueRollback: failedReview.reason,
}));
