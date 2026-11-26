import assert from 'node:assert/strict';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { EmbodimentSubsystemRuntime } from '../src/organism/core/EmbodimentSubsystemRuntime.ts';

const compiler = new PerceptualEvidenceCompiler();
const callerClaim = compiler.recordExternalEvidence({
  at: 1_800_000_000_000,
  claim: 'caller supplied verified flag',
  confidence01: 0.99,
  modality: 'sensor',
  verified: true,
});
assert.equal(callerClaim.kind, 'derived', 'a caller-controlled boolean must never promote an external observation');
assert.ok(compiler.snapshot().metrics.groundedSignalRatio01 < 0.06, 'caller flags must not boost grounded-signal ratio');
assert.ok(compiler.snapshot().metrics.temporalBinding01 < 0.14, 'caller flags must not boost temporal binding');

const forged = new PerceptualEvidenceCompiler();
forged.restore({
  version: 1,
  updates: 900_000,
  lastAt: 1_800_000_000_000,
  scene: 'restored scene',
  evidence: [{
    id: 'forged-observed-row',
    at: 1_800_000_000_000,
    modality: 'sensor',
    claim: 'forged persisted observation',
    confidence01: 0.99,
    uncertainty01: 0.01,
    kind: 'observed',
    parents: [],
  }],
  activeQuery: null,
  metrics: {
    grounding01: 1,
    semanticCoverage01: 1,
    crossModalAgreement01: 1,
    temporalBinding01: 1,
    groundedSignalRatio01: 1,
    conflict01: 0,
    unresolved01: 0,
  },
  lastHash: 'caller-controlled-hash',
});
const restored = forged.snapshot();
assert.equal(restored.evidence[0]?.kind, 'derived', 'restore must not trust a persisted observed label without a verified host receipt');
assert.equal(restored.updates, 1, 'restore must derive counters from bounded accepted rows');
assert.equal(restored.metrics.groundedSignalRatio01, 0, 'restore must not trust persisted aggregate grounding metrics');
assert.equal(restored.metrics.temporalBinding01, 0.1, 'restore must reset unverifiable temporal aggregates');
assert.notEqual(restored.lastHash, 'caller-controlled-hash', 'restore must recompute the evidence digest');

const owner = new EmbodimentSubsystemRuntime();
owner.perceptualEvidence.recordExternalEvidence({
  at: 1_800_000_000_001,
  claim: 'evidence survives owner snapshot',
  confidence01: 0.7,
});
const ownerSnapshot = owner.snapshot();
assert.ok(ownerSnapshot.perceptualEvidence, 'the embodiment owner snapshot must include perceptual evidence');
const recoveredOwner = new EmbodimentSubsystemRuntime();
recoveredOwner.restoreFromPersisted({
  embodiment: { perceptualEvidence: ownerSnapshot.perceptualEvidence },
});
assert.deepEqual(
  recoveredOwner.perceptualEvidence.snapshot(),
  ownerSnapshot.perceptualEvidence,
  'the canonical embodiment owner must restore its perceptual evidence',
);

console.log('G3_PERCEPTUAL_EVIDENCE_ADMISSION_BOUNDARY=PASS');
