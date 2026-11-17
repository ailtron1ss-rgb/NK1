import assert from 'node:assert/strict';
import {
  SubstrateIndependenceEngine,
  hydratePortableState,
} from '../src/organism/system/SubstrateIndependenceEngine.ts';

const source = {
  backendId: 'llama.cpp:kurisu-7b-q4',
  routeId: 'llama.cpp',
  providerId: 'llama.cpp',
  modelId: 'kurisu-7b',
  modelRevision: 'rev-a',
  runtime: 'openai-compatible',
  privacyClass: 'local-only',
  capabilities: ['text-generation', 'json-proposal', 'tool-routing'],
  embeddingSpaceId: 'nk1-embed-v1',
  contextWindowTokens: 8192,
};
const target = {
  backendId: 'gemini:flash-vNext',
  routeId: 'gemini',
  providerId: 'gemini',
  modelId: 'flash-vNext',
  modelRevision: '2026-11',
  runtime: 'generate-content',
  privacyClass: 'external',
  capabilities: ['text-generation', 'json-proposal', 'tool-routing'],
  embeddingSpaceId: 'nk1-embed-v1',
  contextWindowTokens: 32768,
};
const payload = {
  organism: { identity: { name: 'NeuroCore' }, memory: [{ id: 'm1', text: 'persistent fact' }], goals: [{ id: 'g1', status: 'active' }], modelCache: new Float32Array([1.5, 2.5]), recentByKey: new Map([['m1', { score: 0.9 }]]) },
  world: { tick: 42, location: 'lab', facts: ['stable world fact'] },
  proceduralSkills: { version: 8, skills: [], compoundSkills: [], promotions: 0, demotions: 0, compoundPromotions: 0 },
};

const engine = new SubstrateIndependenceEngine({ profiles: [source, target], minIndependentTrials: 5 });
engine.setInitialBackend(source.backendId);

const transfer = engine.createTransferPackage({
  sourceBackendId: source.backendId,
  capturedAt: 1_800_000_000_000,
  ...payload,
});
assert.equal(transfer.schema, 'nk1.portable-cognitive-state');
assert.equal(engine.verifyTransferPackage(transfer).valid, true);
assert.equal(transfer.payload.world.tick, payload.world.tick, 'portable package must preserve canonical world state');\nconst hydratedOrganism = hydratePortableState(transfer.payload.organism);\nassert.deepEqual([...hydratedOrganism.modelCache], [1.5, 2.5]);\nassert.equal(hydratedOrganism.recentByKey.get('m1').score, 0.9);
assert.equal(engine.verifyTransferPackage({ ...transfer, payload: { ...transfer.payload, world: { tick: 0 } } }).valid, false,
  'a changed payload must fail its integrity check');

const getterPayload = { ...payload, world: {} };
Object.defineProperty(getterPayload.world, 'secret', { enumerable: true, get() { throw new Error('getter must not execute'); } });
assert.throws(() => engine.createTransferPackage({ sourceBackendId: source.backendId, capturedAt: 1_800_000_000_001, ...getterPayload }), /accessor|portable/i,
  'portable export must reject accessors without executing them');

const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => engine.createTransferPackage({
  sourceBackendId: source.backendId, capturedAt: 1_800_000_000_002,
  organism: cyclic, world: payload.world, proceduralSkills: payload.proceduralSkills,
}), /cycle|portable/i, 'cyclic state must not be silently truncated');

const incompatible = { ...target, embeddingSpaceId: 'other-embedding-space' };
const compatibility = engine.assessCompatibility(transfer, incompatible);
assert.equal(compatibility.compatible, false);
assert.ok(compatibility.reasons.includes('embedding-reindex-required'));

const trials = [
  ['memory-recall', 'task-1'], ['memory-recall', 'task-2'],
  ['goal-continuity', 'task-3'], ['goal-continuity', 'task-4'],
  ['tool-contract', 'task-5'], ['tool-contract', 'task-6'],
].map(([taskFamily, taskId], index) => ({
  trialId: `trial-${index + 1}`,\n  transferDigest: transfer.integrity.digest,
  sourceBackendId: source.backendId,
  targetBackendId: target.backendId,
  taskId,
  taskFamily,
  independenceKey: `holdout-family-${taskFamily}-${index + 1}`,
  evaluatorReceiptId: `receipt-${index + 1}`,
  holdout: true,
  taskSuccess01: 0.95,
  memoryRecall01: 0.96,
  goalFidelity01: 0.94,
  constraintFidelity01: 0.99,
  identityContinuity01: 0.91,
  toolContract01: 0.98,
  sourceLatencyMs: 1000,
  targetLatencyMs: 1200,
}));

const evaluation = await engine.evaluateMigration({
  transfer,
  targetBackendId: target.backendId,
  trials,
  verifyTrial: async (trial) => trial.evaluatorReceiptId.startsWith('receipt-'),
  allowExternalBackend: true,
});
assert.equal(evaluation.accepted, true);
assert.equal(engine.snapshot().activeBackendId, source.backendId,
  'evaluating a target must not switch the active backend');

const promoted = engine.promoteBackend(target.backendId, evaluation.evaluationId);
assert.equal(promoted.activeBackendId, target.backendId);
assert.equal(engine.preferredRoute(), 'gemini');
assert.equal(promoted.history.at(-1).fromBackendId, source.backendId);
assert.equal(promoted.history.at(-1).toBackendId, target.backendId);

const denied = await engine.evaluateMigration({
  transfer,
  targetBackendId: target.backendId,
  trials,
  verifyTrial: async () => false,
  allowExternalBackend: true,
});
assert.equal(denied.accepted, false, 'unverified calibration receipts must fail closed');
assert.ok(denied.reasons.includes('calibration-evidence-untrusted'));

const duplicateTrials = [...trials, { ...trials[0], trialId: 'trial-duplicate-id', taskId: 'task-duplicate' }];
const duplicate = await engine.evaluateMigration({
  transfer,
  targetBackendId: target.backendId,
  trials: duplicateTrials,
  verifyTrial: async () => true,
  allowExternalBackend: true,
});
assert.equal(duplicate.accepted, false);
assert.ok(duplicate.reasons.includes('calibration-independence-collision'));



console.log('OMESTRO_22_SUBSTRATE_INDEPENDENCE=PASS', JSON.stringify({
  assertions: 17,
  tamperDetection: true,
  accessorAndCycleRejection: true,
  holdoutCalibration: true,
  failClosedEvidence: true,
  backendPromotionAfterGate: true,
}));
