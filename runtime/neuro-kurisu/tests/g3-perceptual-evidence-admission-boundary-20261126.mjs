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

const beforeReplay = compiler.snapshot();
const replayed = compiler.recordExternalEvidence({
  at: 1_800_000_000_000,
  claim: 'caller supplied verified flag',
  confidence01: 0.99,
  modality: 'sensor',
  verified: true,
});
assert.deepEqual(compiler.snapshot(), beforeReplay, 'replaying an identical external event must not inflate counters or metrics');
assert.deepEqual(replayed, callerClaim, 'replay must return the original derived row');

// Numeric coercion and saturation are not acceptable at an untrusted producer boundary.
assert.throws(
  () => compiler.recordExternalEvidence({
    at: 1_800_000_000_001,
    claim: 'string confidence must not be coerced',
    confidence01: '0.99',
    modality: 'sensor',
  }),
  /external-perceptual-evidence-confidence-invalid/,
);
assert.throws(
  () => compiler.recordExternalEvidence({
    at: 1_800_000_000_001,
    claim: 'out-of-range confidence must not be saturated',
    confidence01: 1.01,
    modality: 'sensor',
  }),
  /external-perceptual-evidence-confidence-invalid/,
);


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

const semanticIngress = new PerceptualEvidenceCompiler();
semanticIngress.compile({
  at: 1_800_000_000_002,
  semantic: {
    entities: [{
      id: 'p41-entity-1',
      label: 'unattested camera object',
      present01: 0.9,
      confidence01: 0.99,
      modalities: ['vision'],
      modalityEvidenceKinds: { vision: 'observed' },
      modalityLastSeenAt: { vision: 1_800_000_000_002 },
      lastSeenAt: 1_800_000_000_002,
    }],
    relations: [],
    events: [],
    scene: { label: 'unknown', at: 1_800_000_000_002, confidence01: 0 },
    modalityReliability: {},
    pending: [],
    metrics: { crossModalAgreement01: 0.7 },
  },
});
assert.equal(semanticIngress.snapshot().evidence[0]?.kind, 'derived', 'P41 output must not bypass the host-admission boundary');
assert.equal(semanticIngress.snapshot().metrics.groundedSignalRatio01, 0, 'unattested P41 labels must not count as grounded observations');

const semanticEventIngress = new PerceptualEvidenceCompiler();
semanticEventIngress.compile({
  at: 1_800_000_000_003,
  semantic: {
    entities: [],
    relations: [],
    events: [{
      id: 'p41-event-1',
      label: 'unattested door opened',
      lastAt: 1_800_000_000_003,
      confidence01: 0.99,
      modalities: ['vision'],
      evidenceKind: 'observed',
      modalityEvidenceKinds: { vision: 'observed' },
      modalityLastSeenAt: { vision: 1_800_000_000_003 },
    }],
    scene: { label: 'unknown', at: 1_800_000_000_003, confidence01: 0 },
    modalityReliability: {},
    pending: [],
    metrics: { crossModalAgreement01: 0.7 },
  },
});
assert.equal(semanticEventIngress.snapshot().evidence[0]?.kind, 'derived', 'P41 event evidence must pass through the same host admission downgrade as entity and relation evidence');
assert.equal(semanticEventIngress.snapshot().metrics.groundedSignalRatio01, 0, 'unattested P41 event labels must not count as external grounding');

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
const recoveredEvidence = recoveredOwner.perceptualEvidence.snapshot();
assert.equal(recoveredEvidence.evidence[0]?.claim, 'evidence survives owner snapshot', 'the canonical embodiment owner must restore its evidence rows');
assert.equal(recoveredEvidence.evidence[0]?.kind, 'derived', 'owner restore must not promote an unattested row');
assert.equal(recoveredEvidence.updates, 1, 'owner restore must derive the count from accepted rows');
assert.equal(recoveredEvidence.metrics.groundedSignalRatio01, 0, 'owner restore must reset unverified aggregate grounding metrics');
assert.notEqual(recoveredEvidence.lastHash, '');

console.log('G3_PERCEPTUAL_EVIDENCE_ADMISSION_BOUNDARY=PASS');


// External evidence admission itself must reject accessors and Proxies before
// consulting any producer-controlled property.
{
  const guarded = new PerceptualEvidenceCompiler();
  let getterInvoked = false;
  const hostile = { at: 1_800_000_000_010, confidence01: 1, claim: 'hostile claim' };
  Object.defineProperty(hostile, 'claim', {
    enumerable: true,
    get() { getterInvoked = true; return 'forged claim'; },
  });
  assert.throws(
    () => guarded.recordExternalEvidence(hostile),
    /external-perceptual-evidence-input-invalid/,
  );
  assert.equal(getterInvoked, false);

  let proxyTrapInvoked = false;
  const proxy = new Proxy({ at: 1_800_000_000_011, confidence01: 1, claim: 'proxy claim' }, {
    get() { proxyTrapInvoked = true; throw new Error('external-evidence-proxy-get'); },
    ownKeys() { proxyTrapInvoked = true; throw new Error('external-evidence-proxy-ownKeys'); },
  });
  assert.throws(
    () => guarded.recordExternalEvidence(proxy),
    /external-perceptual-evidence-input-invalid/,
  );
  assert.equal(proxyTrapInvoked, false);
  assert.equal(guarded.snapshot().evidence.length, 0);
}

console.log('G3_EXTERNAL_EVIDENCE_HOSTILE_INPUT=PASS');
