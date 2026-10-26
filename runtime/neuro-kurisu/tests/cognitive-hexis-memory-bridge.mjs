import assert from "node:assert/strict";
import { MemoryOS2 } from "../src/organism/developmental/MemoryOS2.ts";
import { ingestHexisEvidenceIntoMemory } from "../src/organism/memory/HexisEvidenceMemoryBridge.ts";

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

console.log("Hexis evidence → canonical MemoryOS2 bridge: PASS", JSON.stringify({
  confidencePreserved: memoryOS.get(memory.id).confidence === initialConfidence,
  retainedEvidence: memoryOS.get(memory.id).evidenceRecords.length,
  rolloverRecords: afterRollover.items.find((item) => item.id === rolloverMemory.id).evidenceRecords.length,
}));
