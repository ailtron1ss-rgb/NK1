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
