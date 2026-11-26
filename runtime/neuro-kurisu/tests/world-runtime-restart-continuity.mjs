import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const original = new WorldSubsystemRuntime();
const firstContext = {
  tick: 5,
  location: 'lab-west',
  energy: 0.88,
  attention: 0.74,
  uncertainty: 0.16,
  facts: ['west door is closed'],
  objects: [],
  events: ['door-observed'],
};

original.observeGroundedContext(firstContext);
const persisted = original.snapshot();
const learning = original.worldLearningSnapshot();

const restored = new WorldSubsystemRuntime();
restored.restoreFromPersisted({
  persisted: { worldModel: persisted.world },
  cognition: {
    residualWorld: persisted.residualWorld,
    contextualWorld: persisted.contextualWorld,
    p27: persisted.p27,
    brainSubstrate: persisted.brainSubstrate,
  },
  advanced: {
    worldModel2: persisted.worldModel2,
    unifiedLatentWorldState: persisted.unifiedLatentWorldState,
    groundedWorld: persisted.groundedWorld,
    p83PersistentRealityModel: persisted.p83PersistentRealityModel,
    worldModelEnsemble: persisted.worldModelEnsemble,
    auroraKernel: persisted.auroraKernel,
    p24: persisted.p24,
    worldLearning: learning,
  },
  consciousness: { activeInference: persisted.activeInference },
  learning: { p44PredictiveWorld: persisted.p44 },
});

assert.deepEqual(
  restored.unifiedLatentWorldState.currentObservation()?.context,
  firstContext,
  'the canonical previous world observation must survive restart',
);
assert.deepEqual(
  restored.worldLearningSnapshot().p27Latent.vector,
  persisted.p27.latent.vector,
  'world learning must use the restored P27 latent, not the constructor default',
);

const beforePassiveUpdates = restored.worldLearningSnapshot().stats.passiveUpdates;
restored.observeGroundedContext({
  ...firstContext,
  tick: 6,
  energy: 0.72,
  facts: ['west door is open'],
  events: ['door-state-changed'],
});
assert.equal(
  restored.worldLearningSnapshot().stats.passiveUpdates,
  beforePassiveUpdates + 1,
  'the first post-restart observation must be compared with the restored world context',
);

console.log('WORLD_RUNTIME_RESTART_CONTINUITY=PASS');
