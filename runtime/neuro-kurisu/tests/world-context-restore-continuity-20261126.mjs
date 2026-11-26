import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const context = (tick, location, fact) => ({
  tick,
  location,
  energy: 0.82,
  attention: 0.61,
  uncertainty: 0.18,
  facts: [fact],
  objects: [],
  events: ['grounded-observation'],
});

const first = context(40, 'north-lab', 'door is closed');
const next = context(41, 'south-lab', 'door is open');

const source = new WorldSubsystemRuntime();
source.observeGroundedContext(first);
const snapshot = source.snapshot();
const learningSnapshot = source.worldLearningSnapshot();

assert.deepEqual(
  snapshot.unifiedLatentWorldState.currentObservation?.context,
  first,
  'fixture must persist the previous context in the canonical unified latent owner',
);

const restored = new WorldSubsystemRuntime();
restored.restoreFromPersisted({
  persisted: { worldModel: snapshot.world },
  cognition: {
    residualWorld: snapshot.residualWorld,
    contextualWorld: snapshot.contextualWorld,
    p27: snapshot.p27,
    brainSubstrate: snapshot.brainSubstrate,
  },
  consciousness: { activeInference: snapshot.activeInference },
  advanced: {
    worldModel2: snapshot.worldModel2,
    unifiedLatentWorldState: snapshot.unifiedLatentWorldState,
    auroraKernel: snapshot.auroraKernel,
    p24: snapshot.p24,
    p50CausalSelfWorld: snapshot.p50,
    p51GroundedCausalWorkspace: snapshot.p51,
    p52CounterfactualDevelopment: snapshot.p52,
    p57RealityFirstObservatory: snapshot.p57,
    p79EmbodiedSituationModel: snapshot.p79,
    groundedWorld: snapshot.groundedWorld,
    p83PersistentRealityModel: snapshot.p83PersistentRealityModel,
    worldLearning: learningSnapshot,
  },
  learning: { p44PredictiveWorld: snapshot.p44 },
});

assert.deepEqual(
  restored.unifiedLatentWorldState.currentObservation()?.context,
  first,
  'restore must retain the last canonical grounded context',
);

const beforePassiveUpdates = restored.worldLearningSnapshot().stats.passiveUpdates;
restored.observeGroundedContext(next);
const afterPassiveUpdates = restored.worldLearningSnapshot().stats.passiveUpdates;

assert.equal(
  afterPassiveUpdates,
  beforePassiveUpdates + 1,
  'the first changed grounded observation after restore must count one passive world update',
);
assert.deepEqual(
  restored.worldLearningSnapshot().p27Latent,
  restored.p27NeuralWorld.snapshot().latent,
  'the cached P27 latent must be synchronized after the canonical P27 owner is restored',
);

console.log('WORLD_CONTEXT_RESTORE_CONTINUITY=PASS');


// Empty snapshots are a supported first-boot/legacy state: they must not invent
// a previous context or a phantom passive transition.
const emptyRestore = new WorldSubsystemRuntime();
emptyRestore.restoreFromPersisted({});
const emptyPassiveBefore = emptyRestore.worldLearningSnapshot().stats.passiveUpdates;
emptyRestore.observeGroundedContext(first);
assert.equal(emptyRestore.worldLearningSnapshot().stats.passiveUpdates, emptyPassiveBefore);
assert.deepEqual(emptyRestore.worldLearningSnapshot().p27Latent, emptyRestore.p27NeuralWorld.snapshot().latent);

// Legacy snapshots may have WorldModel2 and P27 state but no unified latent
// observation. Preserve their canonical P27 owner and do not hallucinate a
// context baseline from unrelated legacy caches.
const legacy = new WorldSubsystemRuntime();
const legacyP27Owner = source.snapshot().p27;
legacy.restoreFromPersisted({
  cognition: { p27: legacyP27Owner },
  advanced: {
    worldModel2: snapshot.worldModel2,
    // A legacy cached latent can be stale; the restored P27 owner is canonical.
    worldLearning: { ...learningSnapshot, p27Latent: { id: 'legacy-stale-cache', vector: [99] } },
  },
});
const legacyPassiveBefore = legacy.worldLearningSnapshot().stats.passiveUpdates;
legacy.observeGroundedContext(next);
assert.equal(legacy.worldLearningSnapshot().stats.passiveUpdates, legacyPassiveBefore);
assert.deepEqual(legacy.worldLearningSnapshot().p27Latent, legacy.p27NeuralWorld.snapshot().latent);

// Malformed persisted context and counters must fail closed. A corrupt latent
// cache must not override P27 after its owner has been restored.
const malformedUnified = {
  ...snapshot.unifiedLatentWorldState,
  currentObservation: {
    id: 'malformed-observation',
    context: { tick: 'not-a-tick', location: ['not-a-location'], facts: 'not-an-array' },
  },
};
const malformed = new WorldSubsystemRuntime();
malformed.restoreFromPersisted({
  cognition: { p27: snapshot.p27 },
  advanced: {
    worldModel2: snapshot.worldModel2,
    unifiedLatentWorldState: malformedUnified,
    worldLearning: {
      version: 1,
      stats: {
        observations: -9,
        passiveUpdates: 2.5,
        actionUpdates: Number.NaN,
        lastPassiveError01: Number.NaN,
        lastActionError01: 4.2,
        modelAgreement01: Number.POSITIVE_INFINITY,
        lastAt: -1,
        brainActionSamples: -3,
        brainValidated: 'yes',
      },
      lastWorldLatentId: { forged: true },
      p27Latent: { id: 'forged-cache', vector: ['NaN', 999] },
    },
  },
});
const malformedStats = malformed.worldLearningSnapshot().stats;
assert.equal(malformedStats.observations, 0);
assert.equal(malformedStats.passiveUpdates, 0);
assert.equal(malformedStats.actionUpdates, 0);
assert.equal(malformedStats.lastPassiveError01, 0);
assert.equal(malformedStats.lastActionError01, 0);
assert.equal(malformedStats.modelAgreement01, 0);
assert.equal(malformedStats.lastAt, 0);
assert.equal(malformedStats.brainActionSamples, 0);
assert.equal(malformedStats.brainValidated, false);
assert.equal(typeof malformed.worldLearningSnapshot().lastWorldLatentId === 'string' || malformed.worldLearningSnapshot().lastWorldLatentId === null, true);
assert.deepEqual(malformed.worldLearningSnapshot().p27Latent, malformed.p27NeuralWorld.snapshot().latent);
const malformedPassiveBefore = malformedStats.passiveUpdates;
malformed.observeGroundedContext(next);
assert.equal(malformed.worldLearningSnapshot().stats.passiveUpdates, malformedPassiveBefore);

