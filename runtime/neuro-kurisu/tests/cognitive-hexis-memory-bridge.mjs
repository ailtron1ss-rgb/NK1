import assert from "node:assert/strict";
import { MemoryOS2 } from "../src/organism/developmental/MemoryOS2.ts";
import { decideHexisEvidenceReview, ingestHexisEvidenceForReview, ingestHexisEvidenceIntoMemory } from "../src/organism/memory/HexisEvidenceMemoryBridge.ts";
import { HexisAdaptationFabric } from "../src/organism/integration/hexis/HexisAdaptationFabric.ts";

const memoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const memory = memoryOS.encode({
  content: "NK1 canonical memory target for Hexis provenance integration checks.",
  kind: "semantic",
  source: "hexis-bridge-regression",
  tags: ["hexis", "provenance"],
  context: { regression: "hexis-memory-bridge" },
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.51,
  epistemicStatus: "belief",
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });
const initialConfidence = memory.confidence;
const initialEstimatedBytes = memoryOS.budgetDiagnostics().estimatedBytes;

const evidence = {
  memoryId: memory.id,
  evidenceId: "hexis:evidence:0001",
  stance: "contradicts",
  source: { kind: "document", ref: "sha256:independent-paper-1", label: "Independent source", author: "Researcher" },
  observedAt: "2026-10-26T09:30:00Z",
  confidence: 0.81,
  note: "This is contrary evidence; it must not silently rewrite the belief.",
};

const first = ingestHexisEvidenceIntoMemory(memoryOS, evidence);
assert.equal(first.status, "accepted");
assert.equal(first.stance, "contradicts");
assert.equal(memoryOS.get(memory.id).confidence, initialConfidence, "evidence ingress must not revise belief confidence");
const trail = memoryOS.evidenceTrail(memory.id);
assert.ok(trail);
assert.ok(trail.sources.some((source) => source.independenceKey && source.source.includes("document:sha256:independent-paper-1")));
const persisted = memoryOS.snapshot().items.find((item) => item.id === memory.id);
assert.equal(persisted.evidenceRecords.length, 1);
assert.equal(persisted.evidenceRecords[0].stance, "contradicts");
assert.equal(persisted.evidenceRecords[0].sourceRef, "sha256:independent-paper-1");
assert.equal(persisted.evidenceRecords[0].confidence01, 0.81);
assert.ok(
  memoryOS.budgetDiagnostics().estimatedBytes > initialEstimatedBytes,
  "the canonical memory byte budget must account for the new persisted evidence record and replay lineage",
);

const beforeDuplicate = structuredClone(memoryOS.snapshot());
const duplicate = ingestHexisEvidenceIntoMemory(memoryOS, evidence);
assert.equal(duplicate.status, "duplicate");
assert.equal(duplicate.reason, "duplicate-evidence");
assert.deepEqual(memoryOS.snapshot(), beforeDuplicate, "exact evidence replay must be a no-op");

const changedPayload = { ...evidence, note: "same identity, changed evidence content" };
const conflict = ingestHexisEvidenceIntoMemory(memoryOS, changedPayload);
assert.equal(conflict.status, "conflict", "same ID with a different digest must fail closed");
assert.deepEqual(memoryOS.snapshot(), beforeDuplicate, "conflicting replay must not mutate canonical memory");

const blocked = ingestHexisEvidenceIntoMemory(memoryOS, { ...evidence, evidenceId: "hexis:evidence:protected", protectedMemory: true });
assert.equal(blocked.status, "blocked");
assert.equal(blocked.reason, "protected-memory-review-required");
assert.deepEqual(memoryOS.snapshot(), beforeDuplicate, "protected-memory ingress must not mutate memory");

const missing = ingestHexisEvidenceIntoMemory(memoryOS, { ...evidence, memoryId: "missing-memory" });
assert.equal(missing.status, "rejected");
assert.equal(missing.reason, "memory-not-found");

// The canonical public writer rejects hostile accessor envelopes without invoking getters.
let evidenceGetterCalls = 0;
const hostileRecord = {
  evidenceId: "hexis:evidence:hostile",
  digest: "a".repeat(64),
  stance: "supports",
  sourceKind: "document",
  sourceRef: "hostile-source",
  confidence01: 0.7,
  observedAt: Date.parse("2026-10-26T09:31:00Z"),
  independenceKey: "hostile-source-key",
};
Object.defineProperty(hostileRecord, "confidence01", {
  enumerable: true,
  get() { evidenceGetterCalls += 1; return 0.7; },
});
const beforeHostileIngress = structuredClone(memoryOS.snapshot());
const hostileIngress = memoryOS.recordEvidence(memory.id, hostileRecord);
assert.equal(hostileIngress.ok, false);
if (!hostileIngress.ok) assert.equal(hostileIngress.reason, "invalid-evidence-envelope");
assert.equal(evidenceGetterCalls, 0, "hostile evidence getter must never execute");
assert.deepEqual(memoryOS.snapshot(), beforeHostileIngress, "malformed evidence envelope must not mutate canonical memory");

// Control characters are rejected by the MemoryOS2 boundary as well, even when bypassing the bridge.
const controlIngress = memoryOS.recordEvidence(memory.id, {
  evidenceId: "hexis:evidence:control",
  digest: "b".repeat(64),
  stance: "supports",
  sourceKind: "document" + String.fromCharCode(1) + "forged",
  sourceRef: "control-source",
  confidence01: 0.7,
  observedAt: Date.parse("2026-10-26T09:32:00Z"),
  independenceKey: "control-source-key",
});
assert.equal(controlIngress.ok, false);
if (!controlIngress.ok) assert.equal(controlIngress.reason, "invalid-evidence-record");
assert.deepEqual(memoryOS.snapshot(), beforeHostileIngress, "control-character rejection must be side-effect free");

// C1 controls must also fail at the canonical MemoryOS2 boundary when callers bypass Hexis.
const c1Patches = [
  { sourceKind: "document" + String.fromCharCode(0x85) + "forged" },
  { sourceRef: "source" + String.fromCharCode(0x9f) },
  { label: "label" + String.fromCharCode(0x80) },
  { author: "author" + String.fromCharCode(0x85) },
  { note: "note" + String.fromCharCode(0x9f) },
];
for (let index = 0; index < c1Patches.length; index += 1) {
  const beforeC1 = structuredClone(memoryOS.snapshot());
  const rejected = memoryOS.recordEvidence(memory.id, {
    evidenceId: `hexis:evidence:c1-${index}`,
    digest: "c".repeat(64),
    stance: "supports",
    sourceKind: "document",
    sourceRef: "c1-source",
    confidence01: 0.7,
    observedAt: Date.parse("2026-10-26T09:33:00Z"),
    independenceKey: `c1-source-${index}`,
    ...c1Patches[index],
  });
  assert.equal(rejected.ok, false, `C1 control field ${index} must be rejected by MemoryOS2`);
  if (!rejected.ok) assert.ok(
    rejected.reason === "invalid-evidence-record" || rejected.reason === "invalid-evidence-metadata",
    `unexpected C1 rejection reason: ${rejected.reason}`,
  );
  assert.deepEqual(memoryOS.snapshot(), beforeC1, "C1 rejection must leave canonical memory unchanged");
}


const restored = new MemoryOS2({ signalFusionProfile: "balanced" });
restored.restore(memoryOS.snapshot());
assert.equal(restored.get(memory.id).confidence, initialConfidence);
assert.equal(ingestHexisEvidenceIntoMemory(restored, evidence).status, "duplicate", "the durable memory snapshot must preserve replay identity");

// Exercise the exact-key rollover path: the visible detail ring is bounded, but
// the Bloom lineage guard must still prevent an old evidence ID from being re-applied.
const rolloverMemoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const rolloverMemory = rolloverMemoryOS.encode({
  content: "Long-lived memory used to verify evidence replay protection after detail rotation.",
  kind: "semantic",
  source: "hexis-rollover-regression",
  tags: ["hexis", "rollover"],
  context: { regression: "hexis-evidence-rollover" },
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.58,
  epistemicStatus: "belief",
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });
const makeEvidence = (index) => ({
  memoryId: rolloverMemory.id,
  evidenceId: `hexis:rollover:${index}`,
  stance: index % 2 ? "supports" : "contextualizes",
  source: { kind: "document", ref: "same-independent-publisher", label: "Publisher" },
  observedAt: new Date(Date.UTC(2026, 9, 26, 10, 0, index)).toISOString(),
  confidence: 0.6 + (index % 10) / 100,
  note: `evidence item ${index}`,
});
for (let index = 0; index < 90; index += 1) {
  const result = ingestHexisEvidenceIntoMemory(rolloverMemoryOS, makeEvidence(index));
  assert.equal(result.status, "accepted", `evidence ${index} should be accepted`);
}
const afterRollover = structuredClone(rolloverMemoryOS.snapshot());
assert.equal(afterRollover.items.find((item) => item.id === rolloverMemory.id).evidenceRecords.length, 64);
assert.equal(ingestHexisEvidenceIntoMemory(rolloverMemoryOS, makeEvidence(0)).status, "duplicate");
assert.deepEqual(rolloverMemoryOS.snapshot().items.find((item) => item.id === rolloverMemory.id), afterRollover.items.find((item) => item.id === rolloverMemory.id), "rolled-over replay must not mutate the item");

const afterRolloverRestore = new MemoryOS2({ signalFusionProfile: "balanced" });
afterRolloverRestore.restore(rolloverMemoryOS.snapshot());
assert.equal(ingestHexisEvidenceIntoMemory(afterRolloverRestore, makeEvidence(0)).status, "duplicate", "replay guard must survive restart/restore after rollover");

// Review lifecycle: evidence is persisted first, but canonical belief confidence
// changes only after an explicit approve decision with the exact pending receipt.
const reviewMemoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const reviewMemory = reviewMemoryOS.encode({
  content: "Memory used to test a reviewed belief revision.",
  kind: "semantic",
  source: "hexis-review-regression",
  tags: ["hexis", "review"],
  context: { regression: "hexis-review-lifecycle" },
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.8,
  epistemicStatus: "belief",
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });
const reviewFabric = new HexisAdaptationFabric();
const reviewEvidence = {
  memoryId: reviewMemory.id,
  evidenceId: "hexis:evidence:review-approve",
  stance: "contradicts",
  source: { kind: "document", ref: "sha256:review-source-1", label: "Review source" },
  observedAt: "2026-10-26T10:01:00Z",
  confidence: 0.95,
  note: "Contradicting evidence must wait for explicit review approval.",
};
const confidenceBeforeReview = reviewMemoryOS.get(reviewMemory.id).confidence;
const reviewPending = ingestHexisEvidenceForReview(reviewMemoryOS, reviewFabric, reviewEvidence);
assert.equal(reviewPending.status, "review-pending");
if (!("reviewId" in reviewPending)) throw new Error("review pending result must carry review identifiers");
assert.equal(reviewMemoryOS.get(reviewMemory.id).confidence, confidenceBeforeReview, "preview must not revise canonical confidence");
const pendingRecord = reviewFabric.getLearningReview(reviewPending.reviewId);
assert.ok(pendingRecord);
assert.equal(pendingRecord.status, "pending");
assert.equal(pendingRecord.items[0].status, "pending");
assert.equal(reviewPending.previewApplied, true);
const approvedReview = decideHexisEvidenceReview(
  reviewMemoryOS, reviewFabric, reviewPending.reviewId, reviewPending.reviewItemId, "approve",
);
assert.equal(approvedReview.status, "decided");
if (approvedReview.status === "decided") {
  assert.equal(approvedReview.confidenceChanged, true);
  assert.ok(approvedReview.confidence01 < confidenceBeforeReview);
}
assert.ok(reviewFabric.getLearningReview(reviewPending.reviewId)?.items[0].status === "approved");

// A failed review-store operation must roll back both owners so a retry is not
// permanently trapped behind a canonical duplicate-evidence receipt.
const rollbackMemoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const rollbackMemory = rollbackMemoryOS.encode({
  content: "Memory used to test cross-ledger rollback.",
  kind: "semantic",
  source: "hexis-review-rollback-regression",
  tags: ["hexis", "rollback"],
  context: { regression: "hexis-review-ingress-rollback" },
  salience: 0.5,
  emotionalWeight: 0.1,
  identityRelevance: 0.1,
  goalRelevance: 0.3,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.6,
  epistemicStatus: "belief",
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });
const rollbackFabric = new HexisAdaptationFabric();
const rollbackMemoryBefore = structuredClone(rollbackMemoryOS.snapshot());
const rollbackFabricBefore = rollbackFabric.snapshot();
rollbackFabric.createLearningReview = () => { throw new Error("injected-review-store-failure"); };
const failedReview = ingestHexisEvidenceForReview(rollbackMemoryOS, rollbackFabric, {
  ...reviewEvidence,
  memoryId: rollbackMemory.id,
  evidenceId: "hexis:evidence:review-rollback",
  source: { kind: "document", ref: "sha256:review-rollback-source" },
});
assert.equal(failedReview.status, "rejected");
if (failedReview.status === "rejected") assert.equal(failedReview.reason, "hexis-review-ingress-failed");
assert.deepEqual(rollbackMemoryOS.snapshot(), rollbackMemoryBefore, "failed review creation must roll back canonical evidence");
assert.deepEqual(rollbackFabric.snapshot(), rollbackFabricBefore, "failed review creation must roll back Hexis review state");

// If the canonical memory changes after preview, approval is rejected as stale
// and the review remains pending rather than overwriting newer state.
const stalePending = ingestHexisEvidenceForReview(reviewMemoryOS, reviewFabric, {
  ...reviewEvidence,
  evidenceId: "hexis:evidence:review-stale",
  source: { kind: "document", ref: "sha256:review-source-2" },
  observedAt: "2026-10-26T10:02:00Z",
});
assert.equal(stalePending.status, "review-pending");
if (!("reviewId" in stalePending)) throw new Error("stale test requires pending review identifiers");
reviewMemoryOS.updateSignals(reviewMemory.id, { confidence: 0.2 }, "external-confidence-change");
const beforeStaleDecision = structuredClone(reviewMemoryOS.snapshot());
const staleDecision = decideHexisEvidenceReview(
  reviewMemoryOS, reviewFabric, stalePending.reviewId, stalePending.reviewItemId, "approve",
);
assert.equal(staleDecision.status, "rejected");
if (staleDecision.status === "rejected") assert.equal(staleDecision.reason, "stale-review-canonical-confidence-changed");
assert.deepEqual(reviewMemoryOS.snapshot(), beforeStaleDecision, "stale approval must not overwrite newer canonical confidence");
assert.equal(reviewFabric.getLearningReview(stalePending.reviewId)?.items[0].status, "pending");

console.log("Hexis evidence → canonical MemoryOS2 bridge: PASS", JSON.stringify({
  confidencePreserved: memoryOS.get(memory.id).confidence === initialConfidence,
  retainedEvidence: memoryOS.get(memory.id).evidenceRecords.length,
  rolloverRecords: afterRollover.items.find((item) => item.id === rolloverMemory.id).evidenceRecords.length,
}));
