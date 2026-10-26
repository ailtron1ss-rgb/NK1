import assert from "node:assert/strict";
import { MemorySubsystemRuntime } from "../src/organism/core/MemorySubsystemRuntime.ts";
import { HexisAdaptationFabric } from "../src/organism/integration/hexis/HexisAdaptationFabric.ts";
import { OrganismSystemFabric } from "../src/organism/core/OrganismSystemFabric.ts";

function createMemory(memoryOS, content, confidence = 0.5) {
  return memoryOS.encode({
    content,
    kind: "semantic",
    source: "hexis-memory-fabric-integration-regression",
    tags: ["hexis", "memory-fabric"],
    context: { regression: "hexis-memory-fabric-ingress" },
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

function evidence(memoryId, evidenceId, patch = {}) {
  return {
    memoryId,
    evidenceId,
    stance: "supports",
    source: { kind: "document", ref: "sha256:memory-fabric-paper", label: "Evidence source" },
    observedAt: "2026-10-26T10:30:00.000Z",
    confidence: 0.82,
    note: "A canonical evidence note that belongs in the protected review queue, not the lifecycle event payload.",
    ...patch,
  };
}

const owner = new MemorySubsystemRuntime();
const hexis = new HexisAdaptationFabric();
const system = new OrganismSystemFabric({ memory: owner, hexisAdaptation: hexis });
const memory = createMemory(owner.memoryOS, "Canonical belief whose confidence requires review approval.", 0.5);
const initialConfidence = memory.confidence;
// Simulate the active organism cycle; evidence/review actions must reuse this
// logical counter rather than replacing it with an ISO timestamp in milliseconds.
owner.events.append({
  id: "test-cycle-27",
  tick: 27,
  at: Date.now(),
  type: "cycle",
  payload: { source: "hexix-fabric-ingress-regression" },
});
const incoming = evidence(memory.id, "hexis:fabric-ingress:001");

const pending = system.ingestHexisEvidenceForReview(incoming);
assert.equal(pending.status, "review-pending");
assert.equal(owner.memoryOS.get(memory.id).confidence, initialConfidence, "evidence append must not revise confidence before review");
const eventsAfterIngress = owner.events.list();
const evidenceEvents = eventsAfterIngress.filter((event) =>
  event.type === "memory-lifecycle" &&
  event.payload.action === "record-evidence" &&
  event.payload.evidenceId === incoming.evidenceId,
);
assert.equal(evidenceEvents.length, 1, "canonical MemoryFabric writer emits one lifecycle receipt");
assert.equal(evidenceEvents[0].tick, 27, "evidence ingress must preserve the logical organism tick");
assert.ok(evidenceEvents[0].tick < 1_000_000_000, "wall-clock milliseconds must never be stored as a logical tick");
assert.equal(Object.hasOwn(evidenceEvents[0].payload, "note"), false, "private evidence note must not leak into lifecycle event");
assert.equal(Object.hasOwn(evidenceEvents[0].payload, "sourceRef"), false, "raw source reference must not leak into lifecycle event");
const receipt = owner.fabric.snapshot().mutationReceipts.find((item) =>
  item.action === "record-evidence" && item.memoryId === memory.id,
);
assert.ok(receipt, "evidence append must be covered by the MemoryFabric idempotency ledger");
assert.equal(receipt.outcome, "applied");
assert.equal(receipt.evidenceInput.note, incoming.note);

// Snapshot callers must not get a mutable reference to the stored receipt payload.
const detachedReceiptSnapshot = owner.fabric.snapshot();
const detachedEvidenceReceipt = detachedReceiptSnapshot.mutationReceipts.find((item) =>
  item.action === "record-evidence" && item.memoryId === memory.id,
);
detachedEvidenceReceipt.evidenceInput.note = "snapshot caller attempted to rewrite the canonical receipt";
assert.equal(
  owner.fabric.snapshot().mutationReceipts.find((item) => item.commandId === receipt.commandId).evidenceInput.note,
  incoming.note,
  "MemoryFabric receipt snapshots must deep-copy nested evidence input",
);

const beforeReplayEvents = owner.events.list();
const beforeReplayReviews = hexis.snapshot().learningReviews.length;
const replay = system.ingestHexisEvidenceForReview(incoming);
assert.equal(replay.status, "duplicate");
assert.deepEqual(owner.events.list(), beforeReplayEvents, "evidence retry must not emit a second lifecycle event");
assert.equal(hexis.snapshot().learningReviews.length, beforeReplayReviews, "evidence retry must not create a second review");

const decision = system.decideHexisEvidenceReview(pending.reviewId, pending.reviewItemId, "approve");
assert.equal(decision.status, "decided");
assert.equal(decision.confidenceChanged, true);
assert.ok(owner.memoryOS.get(memory.id).confidence > initialConfidence);
assert.equal(
  hexis.snapshot().beliefs.find((belief) => belief.memoryId === memory.id).confidence01,
  owner.memoryOS.get(memory.id).confidence,
  "Hexis belief projection must be rebased to canonical MemoryOS2 confidence",
);
const confidenceEvents = owner.events.list().filter((event) =>
  event.type === "memory-lifecycle" &&
  event.payload.action === "update-signals" &&
  event.payload.memoryId === memory.id &&
  Array.isArray(event.payload.fields) &&
  event.payload.fields.includes("confidence"),
);
assert.equal(confidenceEvents.length, 1, "approval emits one canonical confidence lifecycle event");
assert.equal(confidenceEvents[0].tick, 27, "approval must reuse the logical organism tick instead of evidence timestamp milliseconds");
assert.ok(confidenceEvents[0].tick < 1_000_000_000, "approval tick must remain a logical cycle count");
assert.ok(owner.fabric.snapshot().mutationReceipts.some((item) =>
  item.action === "update-signals" && item.memoryId === memory.id,
), "approved confidence mutation must be idempotency-receipted");

const afterApprovalConfidence = owner.memoryOS.get(memory.id).confidence;
const replayAfterApproval = system.ingestHexisEvidenceForReview(incoming);
assert.equal(replayAfterApproval.status, "duplicate");
assert.equal(owner.memoryOS.get(memory.id).confidence, afterApprovalConfidence);

// Failed review preparation must atomically rollback all canonical owners,
// including MemoryFabric command receipts and EventLog history, so retry remains possible.
const rollbackMemory = createMemory(owner.memoryOS, "A second memory used to test cross-owner rollback.", 0.47);
const rollbackFabric = new HexisAdaptationFabric();
const rollbackSystem = new OrganismSystemFabric({ memory: owner, hexisAdaptation: rollbackFabric });
const rollbackInput = evidence(rollbackMemory.id, "hexis:fabric-ingress:rollback");
const memoryBefore = structuredClone(owner.memoryOS.snapshot());
const memoryFabricBefore = structuredClone(owner.fabric.snapshot());
const eventsBefore = structuredClone(owner.events.list());
const reviewBefore = structuredClone(rollbackFabric.snapshot());
const realCreateReview = rollbackFabric.createLearningReview.bind(rollbackFabric);
rollbackFabric.createLearningReview = () => { throw new Error("simulated review-queue outage"); };
const failed = rollbackSystem.ingestHexisEvidenceForReview(rollbackInput);
rollbackFabric.createLearningReview = realCreateReview;
assert.equal(failed.status, "rejected");
assert.equal(failed.reason, "hexis-review-ingress-failed");
assert.deepEqual(owner.memoryOS.snapshot(), memoryBefore, "failed review must rollback canonical memory");
assert.deepEqual(owner.fabric.snapshot(), memoryFabricBefore, "failed review must remove the MemoryFabric receipt");
assert.deepEqual(owner.events.list(), eventsBefore, "failed review must remove the lifecycle event");
assert.deepEqual(rollbackFabric.snapshot(), reviewBefore, "failed review must rollback the review queue");
const retried = rollbackSystem.ingestHexisEvidenceForReview(rollbackInput);
assert.equal(retried.status, "review-pending", "same evidence must be retryable after an atomic rollback");
assert.equal(owner.events.list().filter((event) =>
  event.type === "memory-lifecycle" &&
  event.payload.action === "record-evidence" &&
  event.payload.evidenceId === rollbackInput.evidenceId,
).length, 1);

console.log("Hexis → MemoryFabric → review approval integration: PASS", JSON.stringify({
  canonicalWriter: true,
  evidenceEventCount: 1,
  duplicateReplay: replay.status,
  approvedConfidence: owner.memoryOS.get(memory.id).confidence,
  rollbackRetry: retried.status,
}));
