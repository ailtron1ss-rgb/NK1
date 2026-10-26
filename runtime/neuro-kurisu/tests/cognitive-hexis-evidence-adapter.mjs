import assert from "node:assert/strict";
import { adaptHexisEvidence } from "../src/organism/memory/HexisEvidenceAdapter.ts";

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
assert.equal(first.evidence.idempotencyKey, "belief:kurisu-identity:source:paper-17");
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
console.log("Hexis evidence adapter contract: PASS");
