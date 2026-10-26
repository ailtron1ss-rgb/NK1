import assert from "node:assert/strict";
import { adaptHexisEvidence } from "../src/organism/memory/HexisEvidenceAdapter.ts";
import { MemoryOS2 } from "../src/organism/developmental/MemoryOS2.ts";

const valid = {
  memoryId: "belief:kurisu-identity",
  evidenceId: "source:paper-17",
  stance: "supports",
  source: { kind: "document", ref: "sha256:abcdef012345", label: "Paper 17", author: "Researcher" },
  observedAt: "2026-10-26T09:30:00Z",
  confidence: 0.72,
  note: "Supports one limited aspect of the belief.",
};

const first = adaptHexisEvidence(valid);
assert.equal(first.accepted, true);
if (!first.accepted) throw new Error("valid evidence was rejected");
assert.equal(first.duplicate, false);
assert.equal(first.evidence.schema, "nk1.hexis-evidence.v1");
assert.equal(first.evidence.idempotencyKey, valid.memoryId.length + ":" + valid.memoryId + valid.evidenceId.length + ":" + valid.evidenceId);
assert.equal(first.evidence.observedAt, "2026-10-26T09:30:00.000Z");
assert.equal(Object.isFrozen(first.evidence), true);
assert.equal(Object.isFrozen(first.evidence.source), true);

const duplicate = adaptHexisEvidence(valid, new Set([first.evidence.idempotencyKey]));
assert.equal(duplicate.accepted, true);
if (!duplicate.accepted) throw new Error("duplicate should be an explicit accepted no-op");
assert.equal(duplicate.duplicate, true);

for (const patch of [
  { confidence: 1.01 },
  { confidence: -0.01 },
  { confidence: Number.NaN },
  { evidenceId: " padded " },
  { stance: "guess" },
  { observedAt: "not-a-date" },
  { observedAt: "0" },
  { observedAt: "2026-10-26T09:30:00" },
  { observedAt: "2026-02-30T09:30:00Z" },
  { observedAt: "2026-10-26T25:30:00Z" },
  { observedAt: "2026-10-26T09:30:00+99:00" },
  { note: "unsafe\u0085note" },
  { note: "unsafe\u009fnote" },
  { source: { ...valid.source, label: "unsafe\u0085label" } },
  { source: { ...valid.source, author: "unsafe\u009fauthor" } },
  { source: { ...valid.source, ref: "unsafe\u0085reference" } },
  { source: { kind: "document", ref: "" } },
  { protectedMemory: "yes" },
  { note: " " },
]) {
  const result = adaptHexisEvidence({ ...valid, ...patch });
  assert.equal(result.accepted, false, JSON.stringify(patch));
}

let getterCalls = 0;
const hostile = { ...valid };
Object.defineProperty(hostile, "confidence", {
  enumerable: true,
  get() { getterCalls += 1; return 0.99; },
});
assert.equal(adaptHexisEvidence(hostile).accepted, false);
assert.equal(getterCalls, 0);

const protectedEvidence = adaptHexisEvidence({ ...valid, protectedMemory: true });
assert.equal(protectedEvidence.accepted, true);
if (protectedEvidence.accepted) assert.equal(protectedEvidence.evidence.protectedMemory, true);

assert.equal(adaptHexisEvidence({ ...valid, source: new Date() }).accepted, false);

const hostileProxy = new Proxy({ ...valid }, {
  ownKeys() { throw new Error("hostile ownKeys trap"); },
});
assert.equal(adaptHexisEvidence(hostileProxy).accepted, false);

// Exercise the real write boundary: evidence is normalized before MemoryOS2 mutates its lineage.
const memoryOS = new MemoryOS2({ signalFusionProfile: "balanced" });
const memory = memoryOS.encode({
  content: "A stable fact used to verify canonical Hexis evidence provenance.",
  kind: "semantic",
  source: "hexis-evidence-adapter-regression",
  tags: ["hexis", "provenance"],
  context: { regression: "hexis-canonical-ingress" },
  salience: 0.6,
  emotionalWeight: 0.1,
  identityRelevance: 0.2,
  goalRelevance: 0.4,
  socialRelevance: 0.1,
  predictionError: 0.1,
  confidence: 0.5,
  epistemicStatus: "belief",
  entities: [],
  semanticLinks: [],
  temporalLinks: [],
  causalLinks: [],
  contradictionLinks: [],
}, { clone: false });

const sourceInput = {
  source: "https://evidence.example/claim-1",
  provenanceClass: "external",
  sourceAuthority01: 0.9,
  independenceKey: "paper:claim-1",
  observedAt: 1000,
  evidenceFreshnessAt: 1000,
};
const originalConfidence = memory.confidence;
const added = memoryOS.recordEvidence(memory.id, sourceInput);
assert.equal(added.ok, true);
assert.equal(added.added, true);
assert.equal(added.reason, "added");
assert.equal(memoryOS.hasEvidenceLineage(memory.id, sourceInput.independenceKey), true);
assert.equal(memoryOS.evidenceTrail(memory.id)?.independentSources, 2, "canonical source remains alongside the independent evidence");
assert.equal(memoryOS.get(memory.id)?.confidence, originalConfidence, "recording provenance alone must not revise belief confidence");

const trailBeforeDuplicate = memoryOS.evidenceTrail(memory.id);
const reconsolidationsBeforeDuplicate = memoryOS.statsLight().reconsolidations;
const duplicateWrite = memoryOS.recordEvidence(memory.id, {
  ...sourceInput,
  sourceAuthority01: 1,
});
assert.equal(duplicateWrite.ok, true);
assert.equal(duplicateWrite.added, false);
assert.equal(duplicateWrite.reason, "duplicate-source");
assert.deepEqual(memoryOS.evidenceTrail(memory.id), trailBeforeDuplicate, "duplicate evidence must not rewrite canonical lineage");
assert.equal(memoryOS.statsLight().reconsolidations, reconsolidationsBeforeDuplicate, "duplicate evidence must be a true no-op");
assert.equal(memoryOS.get(memory.id)?.confidence, originalConfidence, "duplicate evidence must not ratchet confidence");

const beforeInvalid = memoryOS.evidenceTrail(memory.id);
const reconsolidationsBeforeInvalid = memoryOS.statsLight().reconsolidations;
const invalidInputs = [
  { name: "confidence-out-of-range", value: { ...sourceInput, independenceKey: "bad-confidence", sourceAuthority01: 1.01 }, reason: "invalid-evidence-confidence" },
  { name: "confidence-string", value: { ...sourceInput, independenceKey: "bad-confidence-string", sourceAuthority01: "0.9" }, reason: "invalid-evidence-confidence" },
  { name: "timestamp-string", value: { ...sourceInput, independenceKey: "bad-timestamp", observedAt: "1000" }, reason: "invalid-evidence-timestamp" },
  { name: "bad-freshness", value: { ...sourceInput, independenceKey: "bad-freshness", evidenceFreshnessAt: Number.POSITIVE_INFINITY }, reason: "invalid-evidence-freshness" },
  { name: "overlong-lineage", value: { ...sourceInput, independenceKey: "x".repeat(97) }, reason: "invalid-evidence-independence-key" },
  { name: "control-character-lineage", value: { ...sourceInput, independenceKey: "bad\nlineage" }, reason: "invalid-evidence-independence-key" },
  { name: "control-character-source", value: { ...sourceInput, independenceKey: "bad-source-control", source: "bad\nsource" }, reason: "invalid-evidence-source-identity" },
  { name: "invalid-source-class", value: { ...sourceInput, independenceKey: "bad-source-class", provenanceClass: "untrusted-new-class" }, reason: "invalid-evidence-provenance-class" },
];
for (const item of invalidInputs) {
  const result = memoryOS.recordEvidence(memory.id, item.value);
  assert.equal(result.ok, false, item.name);
  assert.equal(result.added, false, item.name);
  assert.equal(result.reason, item.reason, item.name);
}
assert.deepEqual(memoryOS.evidenceTrail(memory.id), beforeInvalid, "rejected evidence must not touch the canonical lineage");
assert.equal(memoryOS.statsLight().reconsolidations, reconsolidationsBeforeInvalid, "rejected evidence must not change memory mutation counters");

let sourceAuthorityGetterCalls = 0;
const accessorInput = { ...sourceInput, independenceKey: "hostile-accessor" };
Object.defineProperty(accessorInput, "sourceAuthority01", {
  enumerable: true,
  get() { sourceAuthorityGetterCalls += 1; return 0.99; },
});
const accessorResult = memoryOS.recordEvidence(memory.id, accessorInput);
assert.equal(accessorResult.ok, false);
assert.equal(accessorResult.reason, "invalid-evidence-envelope");
assert.equal(sourceAuthorityGetterCalls, 0, "MemoryOS2 must not invoke a getter from an untrusted evidence envelope");

const hostileMemoryInput = new Proxy({ ...sourceInput, independenceKey: "hostile-proxy" }, {
  ownKeys() { throw new Error("hostile evidence proxy"); },
});
assert.equal(memoryOS.recordEvidence(memory.id, hostileMemoryInput).reason, "invalid-evidence-envelope");

const restored = new MemoryOS2({ signalFusionProfile: "balanced" });
restored.restore(memoryOS.snapshot());
assert.equal(restored.hasEvidenceLineage(memory.id, "paper:claim-1"), true, "canonical lineage survives restart");
const restoredBefore = restored.evidenceTrail(memory.id);
const restoredStatsBefore = restored.statsLight().reconsolidations;
const restoredDuplicate = restored.recordEvidence(memory.id, sourceInput);
assert.equal(restoredDuplicate.added, false, "restored source identities stay idempotent");
assert.deepEqual(restored.evidenceTrail(memory.id), restoredBefore);
assert.equal(restored.statsLight().reconsolidations, restoredStatsBefore);

console.log("NK1_HEXIS_CANONICAL_EVIDENCE_INGRESS=PASS adapter=true memoryOS2=true rejectedBeforeMutation=true duplicateNoop=true restore=true");
