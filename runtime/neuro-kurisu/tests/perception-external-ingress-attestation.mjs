import assert from 'node:assert/strict';
import { P41SemanticPerceptionEngine } from '../src/organism/cognition/P41SemanticPerception.ts';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import { PerceptualEpistemicGraph } from '../src/organism/cognition/PerceptualEpistemicGraph.ts';

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

const hostileP41 = new P41SemanticPerceptionEngine();
let p41GetterCalls = 0;
const getterP41 = { version: 1, tick: 0, entities: [], relations: [], events: [], snapshots: [], pending: [] };
Object.defineProperty(getterP41, 'scene', {
  enumerable: true,
  get() { p41GetterCalls += 1; return { label: 'attacker-scene' }; },
});
assert.throws(() => hostileP41.restore(getterP41), /inert-snapshot-invalid/,
  'P41 restore must reject accessor-backed checkpoints');
assert.equal(p41GetterCalls, 0, 'P41 restore must not execute accessors');

let p41ProxyTrapCalls = 0;
const proxyP41 = new Proxy({ version: 1, entities: [] }, {
  getPrototypeOf() { p41ProxyTrapCalls += 1; throw new Error('P41 proxy trap'); },
});
assert.throws(() => hostileP41.restore(proxyP41), /inert-snapshot-invalid/,
  'P41 restore must reject proxy-backed checkpoints');
assert.equal(p41ProxyTrapCalls, 0, 'P41 restore must reject proxies before reflection');

const hostileGraph = new PerceptualEpistemicGraph();
let graphGetterCalls = 0;
const getterGraph = { version: 1, claims: [] };
Object.defineProperty(getterGraph, 'claims', {
  enumerable: true,
  get() { graphGetterCalls += 1; return []; },
});
assert.throws(() => hostileGraph.restore(getterGraph), /inert-snapshot-invalid/,
  'epistemic graph restore must reject accessor-backed checkpoints');
assert.equal(graphGetterCalls, 0, 'epistemic graph restore must not execute accessors');


const numericP41 = new P41SemanticPerceptionEngine();
numericP41.restore({
  version: 1,
  tick: -7,
  scene: { label: 'forged-scene', confidence01: 9, stability01: -4, at: -1 },
  entities: [{
    id: 'forged-entity', label: 'chair', kind: 'object',
    confidence01: 9, salience01: -2, present01: 8,
    firstSeenAt: -5, lastSeenAt: -10, observations: -99,
    modalities: ['vision', 'unknown-modality'],
    modalityLastSeenAt: { vision: -4 },
    modalityEvidenceKinds: { vision: 'observed' },
    modalitySourceIds: { vision: ['detector-1'] },
    position: { x: 1e12, y: 0, z: 0 },
    velocity: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
  }],
  modalityReliability: {
    vision: {
      reliability01: 9, observations: -4, conflict01: 7, latency01: -1,
      reportedQuality01: 2, serviceSuccess01: 8,
      calibrationSamples: -3, calibrationMae01: 4, calibrationBias01: -4, lastVerifiedAt: -1,
    },
  },
  actionBias: { explore: 9, verify: -8 },
  metrics: {
    grounding01: 9, temporalBinding01: -1, objectPermanence01: 4,
    crossModalAgreement01: 8, crossModalEvidenceCoverage01: 7,
    outcomeAlignment01: -2, activePerceptionUtility01: 5, unresolvedRate01: 6,
    updates: -1, sceneContinuity01: 3, temporalGrounding01: 2,
    evidenceTraceability01: 9, epistemicContradictions: -1,
  },
});
const numericState = numericP41.snapshot();
assert.equal(numericState.tick, 0);
assert.equal(numericState.scene.confidence01, .12,
  'out-of-range restored scene confidence must fall back to default, not saturate at one');
assert.equal(numericState.scene.stability01, .15);
assert.equal(numericState.entities[0].confidence01, 0);
assert.equal(numericState.entities[0].salience01, 0);
assert.equal(numericState.entities[0].present01, 0);
assert.equal(numericState.entities[0].observations, 1);
assert.equal(numericState.entities[0].position, null,
  'non-finite and implausibly large restored coordinates must be discarded');
assert.equal(numericState.entities[0].velocity, null);
assert.deepEqual(numericState.entities[0].modalities, ['vision']);
assert.equal(numericState.modalityReliability.vision.reliability01, .38);
assert.equal(numericState.modalityReliability.vision.observations, 0);
assert.equal(numericState.modalityReliability.vision.calibrationMae01, 0);
assert.equal(numericState.actionBias.explore, 0);
assert.equal(numericState.actionBias.verify, 0);
assert.equal(numericState.metrics.grounding01, .18);
assert.equal(numericState.metrics.sceneContinuity01, .1);
assert.equal(numericState.metrics.updates, 0);
assert.equal(numericState.metrics.epistemicContradictions, 0);

console.log('PERCEPTION_EXTERNAL_INGRESS_ATTESTATION=PASS hostile=3');

