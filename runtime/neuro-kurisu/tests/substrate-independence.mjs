import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as signSignature, verify as verifySignature } from 'node:crypto';
import {
  SubstrateIndependenceEngine,
  hydratePortableState,
  substrateCalibrationSigningPayload,
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
  organism: {
    identity: { name: 'NeuroCore' },
    memory: [{ id: 'm1', text: 'persistent fact' }],
    goals: [{ id: 'g1', status: 'active' }],
    modelCache: new Float32Array([1.5, 2.5]),
    modelWindow: new DataView(new Uint8Array([10, 20, 30]).buffer),
    recentByKey: new Map([['m1', { score: 0.9 }]]),
    recentSet: new Set(['m1', 'm2']),
    eventDate: new Date('2026-11-17T10:00:00.000Z'),
    audioBuffer: Buffer.from([1, 2, 3, 4]),
  },
  world: { tick: 42, location: 'lab', facts: ['stable world fact'] },
  proceduralSkills: { version: 8, skills: [], compoundSkills: [], promotions: 0, demotions: 0, compoundPromotions: 0 },
};

const engine = new SubstrateIndependenceEngine({ profiles: [source, target], minIndependentTrials: 5 });
engine.setInitialBackend(source.backendId);

const changedSourceRevision = new SubstrateIndependenceEngine({
  profiles: [{ ...source, modelRevision: 'rev-b' }, target],
});
assert.equal(changedSourceRevision.restore(engine.snapshot()).restored, true);
assert.equal(changedSourceRevision.preferredRoute(), null,
  'a backend with the same route/name but a changed model revision must not be treated as the same active substrate');
changedSourceRevision.observeBackend(source.backendId);
assert.equal(changedSourceRevision.preferredRoute(), null,
  'observing the old backend identifier cannot silently rebootstrap a different model revision');
assert.throws(() => changedSourceRevision.createTransferPackage({
  sourceBackendId: source.backendId, capturedAt: 1_800_000_000_050, ...payload,
}), /transfer-source-profile-drift/,
  'export must not relabel state from a previous model revision with a new profile digest');

const fallbackBoot = new SubstrateIndependenceEngine({ profiles: [source] });
fallbackBoot.observeBackend('deterministic-policy-fallback');
assert.equal(fallbackBoot.activeBackendId(), null, 'the deterministic fallback is not a model substrate');
fallbackBoot.observeBackend(source.backendId);
assert.equal(fallbackBoot.activeBackendId(), source.backendId, 'a live model provider can initialize after fallback-only startup');

const observed = engine.observeBackend('kobold');
assert.equal(observed.state.activeBackendId, source.backendId,
  'an uncalibrated observed provider must not replace the active substrate');


const transfer = engine.createTransferPackage({
  sourceBackendId: source.backendId,
  capturedAt: 1_800_000_000_000,
  ...payload,
});
assert.equal(transfer.schema, 'nk1.portable-cognitive-state');
assert.equal(engine.verifyTransferPackage(transfer).valid, true);
assert.equal(transfer.payload.world.tick, payload.world.tick, 'portable package must preserve canonical world state');
const hydratedOrganism = hydratePortableState(transfer.payload.organism);
assert.deepEqual([...hydratedOrganism.modelCache], [1.5, 2.5]);
assert.deepEqual([...new Uint8Array(hydratedOrganism.modelWindow.buffer)], [10, 20, 30]);
assert.equal(hydratedOrganism.recentByKey.get('m1').score, 0.9);
assert.deepEqual([...hydratedOrganism.recentSet], ['m1', 'm2']);
assert.equal(hydratedOrganism.eventDate.toISOString(), '2026-11-17T10:00:00.000Z');
assert.deepEqual([...hydratedOrganism.audioBuffer], [1, 2, 3, 4]);

class CustomMap extends Map {}
assert.throws(() => engine.createTransferPackage({
  sourceBackendId: source.backendId, capturedAt: 1_800_000_000_003,
  organism: { custom: new CustomMap([['hidden', 1]]) }, world: payload.world,
  proceduralSkills: payload.proceduralSkills,
}), /map-subclass|portable/i, 'custom Map subclasses must not run custom serialization behaviour');

class CustomFloatArray extends Float32Array {}
assert.throws(() => engine.createTransferPackage({
  sourceBackendId: source.backendId, capturedAt: 1_800_000_000_004,
  organism: { custom: new CustomFloatArray([1, 2]) }, world: payload.world,
  proceduralSkills: payload.proceduralSkills,
}), /typed-array-instance|portable/i, 'custom typed-array subclasses must fail closed');
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
const privacyGate = engine.assessCompatibility(transfer, target);
assert.equal(privacyGate.compatible, false);
assert.ok(privacyGate.reasons.includes('remote-backend-requires-explicit-consent'));

const unpinnedTarget = { ...target, modelRevision: 'host-configured' };
const unpinnedTargetEngine = new SubstrateIndependenceEngine({ profiles: [source, unpinnedTarget] });
unpinnedTargetEngine.setInitialBackend(unpinnedTarget.backendId);
assert.equal(unpinnedTargetEngine.preferredRoute(), null,
  'an unpinned model revision cannot become a persistent substrate preference');
const unpinnedTargetCompatibility = unpinnedTargetEngine.assessCompatibility(
  transfer, unpinnedTarget, { allowExternalBackend: true },
);
assert.equal(unpinnedTargetCompatibility.compatible, false);
assert.ok(unpinnedTargetCompatibility.reasons.includes('target-model-revision-unpinned'));

const unpinnedSource = { ...source, modelRevision: 'host-configured' };
const unpinnedSourceEngine = new SubstrateIndependenceEngine({ profiles: [unpinnedSource, target] });
unpinnedSourceEngine.setInitialBackend(unpinnedSource.backendId);
const unpinnedTransfer = unpinnedSourceEngine.createTransferPackage({
  sourceBackendId: unpinnedSource.backendId, capturedAt: 1_800_000_000_100, ...payload,
});
const unpinnedSourceCompatibility = unpinnedSourceEngine.assessCompatibility(
  unpinnedTransfer, target, { allowExternalBackend: true },
);
assert.equal(unpinnedSourceCompatibility.compatible, false);
assert.ok(unpinnedSourceCompatibility.reasons.includes('source-model-revision-unpinned'));

const unsignedTrials = [
  ['memory-recall', 'task-1'], ['memory-recall', 'task-2'],
  ['goal-continuity', 'task-3'], ['goal-continuity', 'task-4'],
  ['tool-contract', 'task-5'], ['tool-contract', 'task-6'],
].map(([taskFamily, taskId], index) => ({
  trialId: `trial-${index + 1}`,
  transferDigest: transfer.integrity.digest,
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

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeyId = 'nk1-test-evaluator-v1';
const trials = unsignedTrials.map((trial) => {
  const claim = { ...trial, evaluatorKeyId: trustedKeyId };
  const evaluatorSignatureBase64 = signSignature(
    null,
    Buffer.from(substrateCalibrationSigningPayload(claim), 'utf8'),
    privateKey,
  ).toString('base64');
  return { ...claim, evaluatorSignatureBase64 };
});
const verifySignedReceipt = async (trial) => {
  if (trial.evaluatorKeyId !== trustedKeyId || typeof trial.evaluatorSignatureBase64 !== 'string') return false;
  return verifySignature(
    null,
    Buffer.from(substrateCalibrationSigningPayload(trial), 'utf8'),
    publicKey,
    Buffer.from(trial.evaluatorSignatureBase64, 'base64'),
  );
};
const tamperedReceipt = { ...trials[0], taskSuccess01: 0.99 };
assert.equal(await verifySignedReceipt(tamperedReceipt), false,
  'a signed evaluator receipt must not survive a modified metric');

const evaluation = await engine.evaluateMigration({
  transfer,
  targetBackendId: target.backendId,
  trials,
  verifyTrial: verifySignedReceipt,
  allowExternalBackend: true,
});
assert.equal(evaluation.accepted, true);
assert.equal(engine.snapshot().activeBackendId, source.backendId,
  'evaluating a target must not switch the active backend');

const reloadedEngine = new SubstrateIndependenceEngine({ profiles: [source, target], minIndependentTrials: 5 });
assert.equal(reloadedEngine.restore(engine.snapshot()).restored, true);
assert.throws(() => reloadedEngine.promoteBackend(target.backendId, evaluation.evaluationId), /promotion-evidence-required/,
  'a restored accepted score cannot promote until signed holdout receipts are reverified');
assert.equal(
  await reloadedEngine.verifyStoredEvaluation(evaluation.evaluationId, verifySignedReceipt),
  true,
  'persisted holdout receipts must be cryptographically reverified after restart',
);
const promoted = reloadedEngine.promoteBackend(target.backendId, evaluation.evaluationId);
assert.equal(promoted.activeBackendId, target.backendId);
assert.equal(reloadedEngine.preferredRoute(), 'gemini');
assert.equal(promoted.history.at(-1).fromBackendId, source.backendId);
assert.equal(promoted.history.at(-1).toBackendId, target.backendId);

const changedTargetRevision = new SubstrateIndependenceEngine({
  profiles: [source, { ...target, modelRevision: '2026-12' }],
});
assert.equal(changedTargetRevision.restore(reloadedEngine.snapshot()).restored, true);
assert.equal(changedTargetRevision.preferredRoute(), null,
  'a promoted backend with changed model weights/revision must lose its preferred route');
assert.equal(
  await changedTargetRevision.verifyStoredEvaluation(evaluation.evaluationId, verifySignedReceipt),
  false,
  'the previous holdout evidence cannot authorize a different model revision under the same backend ID',
);
const targetRollback = changedTargetRevision.revokeUnverifiedPromotion();
assert.equal(targetRollback.activeBackendId, source.backendId);
assert.equal(changedTargetRevision.preferredRoute(), 'llama.cpp');

const revokedEngine = new SubstrateIndependenceEngine({ profiles: [source, target], minIndependentTrials: 5 });
assert.equal(revokedEngine.restore(reloadedEngine.snapshot()).restored, true);
const revoked = revokedEngine.revokeUnverifiedPromotion();
assert.equal(revoked.activeBackendId, source.backendId,
  'a previously promoted target must fall back if its signed receipts are not trusted after restart');

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

const staleTrials = trials.map((trial, index) => ({ ...trial, trialId: `stale-${index}`, transferDigest: '0'.repeat(64) }));
const stale = await engine.evaluateMigration({
  transfer, targetBackendId: target.backendId, trials: staleTrials,
  verifyTrial: async () => true, allowExternalBackend: true,
});
assert.equal(stale.accepted, false);
assert.ok(stale.reasons.includes('calibration-transfer-lineage-mismatch'));

const rolledBack = reloadedEngine.rollbackBackend();
assert.equal(rolledBack.activeBackendId, source.backendId);
assert.equal(reloadedEngine.preferredRoute(), 'llama.cpp');
assert.equal(rolledBack.lastEvaluation, null,
  'rollback consumes the evaluation so it cannot be replayed for another promotion');
assert.throws(() => reloadedEngine.promoteBackend(target.backendId, evaluation.evaluationId), /promotion-evidence-required/);



console.log('OMESTRO_22_SUBSTRATE_INDEPENDENCE=PASS', JSON.stringify({
  assertions: 17,
  tamperDetection: true,
  accessorAndCycleRejection: true,
  holdoutCalibration: true,
  failClosedEvidence: true,
  backendPromotionAfterGate: true,
}));
