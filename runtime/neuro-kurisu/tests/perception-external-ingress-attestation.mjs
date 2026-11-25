import assert from 'node:assert/strict';
import { P41SemanticPerceptionEngine } from '../src/organism/cognition/P41SemanticPerception.ts';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';

const perception = new P41SemanticPerceptionEngine();
const world = perception.ingest({
  at: 1_000,
  world: {
    scene: 'caller-claimed-room',
    evidenceKind: 'observed',
    objects: [{ label: 'caller-claimed-device', confidence01: .99, evidenceKind: 'observed' }],
  },
});
assert.equal(world.sceneEvidenceKind, 'model-output',
  'a caller-provided world evidence label must not become a host observation');
const entity = world.entities.find(row => row.label === 'caller-claimed-device');
assert.ok(entity);
assert.equal(entity.modalityEvidenceKinds?.world, 'model-output',
  'world entity provenance must downgrade self-asserted observed evidence');

const compiler = new PerceptualEvidenceCompiler();
const record = compiler.recordExternalEvidence({
  at: 2_000,
  claim: 'caller-claimed-independent-outcome',
  confidence01: .99,
  verified: true,
});
assert.equal(record.kind, 'derived',
  'legacy verified=true is a caller assertion, not a verification credential');
assert.ok(compiler.snapshot().metrics.groundedSignalRatio01 <= .036 + 1e-12,
  'unattested external evidence must not receive the observed-evidence metric boost');
console.log('PERCEPTION_EXTERNAL_INGRESS_ATTESTATION=PASS');
