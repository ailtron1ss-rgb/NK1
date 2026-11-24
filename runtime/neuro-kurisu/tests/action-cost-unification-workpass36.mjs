import assert from 'node:assert/strict';
import { ACTION_COSTS, actionCost } from '../src/organism/core/ActionCostPolicy.ts';
import { ActiveInferenceEngine } from '../src/organism/world/ActiveInferenceEngine.ts';
import { ContextualWorldModel } from '../src/organism/world/ContextualWorldModel.ts';
import { WorldModel } from '../src/organism/world/WorldModel.ts';

const contextual = new ContextualWorldModel();
const internalWorld = new WorldModel();
const active = new ActiveInferenceEngine();
const worldState = { energy: .65, cognitiveLoad: .3, uncertainty: .4, novelty: .5 };
const needs = { energy: .65, cognitiveLoad: .3, uncertainty: .4, novelty: .5, goalPressure: .3, socialNeed: .3, identityCoherence: .8 };
const organismState = { version: 29, tick: 4, at: 0, needs, predictionError: .2, attentionBudget: .8, lastAction: 'none', lastActionSuccess: null, autonomyScore: .5, selfPredictionError: .1, predictedNextAction: 'none', lastPredictionConfidence: .5, worldContextVersion: 1 };

for (const [action, canonicalCost] of Object.entries(ACTION_COSTS)) {
  assert.equal(actionCost(action), canonicalCost);
  const score = active.score(internalWorld, worldState, needs, [action]).get(action);
  assert.equal(score?.actionCost, canonicalCost, `${action}: active inference must use canonical cost`);
  const prediction = contextual.predict(organismState, action);
  const expectedLoad = Math.max(0, Math.min(1, needs.cognitiveLoad + canonicalCost * .18 - (action === 'rest' ? .12 : 0)));
  assert.equal(prediction.nextLoad01, expectedLoad, `${action}: contextual world model must use canonical cost`);
}

console.log('ACTION_COST_UNIFICATION=PASS', JSON.stringify({ actions: Object.keys(ACTION_COSTS).length, costOwner: 'ActionCostPolicy' }));
