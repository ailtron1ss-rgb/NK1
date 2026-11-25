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

const sensorCheckpoint = new P41SemanticPerceptionEngine().ingest({
  at: 3_000,
  sensor: { location: 'restore-lab', freshness01: .95 },
});
const persistedEntity = sensorCheckpoint.entities.find(row => row.modalities.includes('sensor'));
assert.ok(persistedEntity);
const forgedCheckpoint = {
  ...sensorCheckpoint,
  sceneEvidenceKind: 'observed',
  entities: [{
    ...persistedEntity,
    modalityEvidenceKinds: { sensor: 'observed' },
    modalitySourceIds: { sensor: ['sensor', 'restore-lab-device'] },
  }],
  relations: [{
    id: 'restored-relation', from: 'a', relation: 'near', to: 'b',
    confidence01: .99, modality: 'sensor', evidenceKind: 'observed', at: 3_000,
  }],
  events: [{
    id: 'restored-event', label: 'persisted-event', confidence01: .99,
    modalities: ['sensor'], startedAt: 3_000, lastAt: 3_000, persistence01: .99,
    evidenceKind: 'observed', modalityEvidenceKinds: { sensor: 'observed' },
  }],
  epistemic: {
    version: 1, claims: [{
      id: 'persisted-claim', at: 3_000, modality: 'sensor', claim: 'door is open',
      source: 'observed', confidence01: .99, targetIds: [],
    }],
    contradictionPairs: 0, resolvedPairs: 0, corroboratedPairs: 1, meanConfidence01: .99, lastAt: 3_000,
  },
};
const restoredPerception = new P41SemanticPerceptionEngine();
restoredPerception.restore(forgedCheckpoint);
const restoredP41 = restoredPerception.snapshot();
assert.equal(restoredP41.sceneEvidenceKind, 'model-output',
  'P41 scene provenance must lose live-observation authority after restart');
assert.equal(restoredP41.entities[0].modalityEvidenceKinds?.sensor, 'model-output',
  'persisted P41 sensor labels must be re-attested before returning to observed');
assert.equal(restoredP41.relations[0].evidenceKind, 'model-output');
assert.equal(restoredP41.events[0].evidenceKind, 'model-output');
assert.equal(restoredP41.events[0].modalityEvidenceKinds?.sensor, 'model-output');
assert.equal(restoredP41.epistemic?.claims[0].source, 'model-output',
  'epistemic graph restore must not preserve caller-saved observed claims');

const restoredCompiler = new PerceptualEvidenceCompiler();
restoredCompiler.restore({
  version: 1, updates: 1, lastAt: 3_000, scene: 'restore-lab',
  evidence: [{
    id: 'persisted-observed-evidence', at: 3_000, modality: 'sensor',
    claim: 'restored observed claim', confidence01: .99, uncertainty01: .01,
    kind: 'observed', parents: ['sensor-source'],
  }],
  activeQuery: null,
  metrics: {
    grounding01: .99, semanticCoverage01: .9, crossModalAgreement01: .9,
    temporalBinding01: .9, groundedSignalRatio01: 1, conflict01: 0, unresolved01: 0,
  },
  lastHash: 'persisted',
});
assert.equal(restoredCompiler.snapshot().evidence[0].kind, 'model-output',
  'persisted evidence rows cannot retain an observed label after restore');
assert.equal(restoredCompiler.snapshot().metrics.groundedSignalRatio01, 0,
  'restored grounded ratio must be recomputed from downgraded evidence');

console.log('PERCEPTION_EXTERNAL_INGRESS_ATTESTATION=PASS');
