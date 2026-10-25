import assert from 'node:assert/strict';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { resolveCognitiveRoutingPolicy } from '../src/organism/core/CognitiveRoutingPolicy.ts';

const state = {
  version: 1,
  tick: 10,
  at: 1_000,
  needs: {
    energy: 0.8,
    cognitiveLoad: 0.1,
    uncertainty: 0,
    socialNeed: 0,
    novelty: 0,
    identityCoherence: 0.8,
    goalPressure: 0,
  },
  predictionError: 0,
  attentionBudget: 0.8,
  lastAction: 'none',
  lastActionSuccess: null,
  autonomyScore: 0.1,
  selfPredictionError: 0,
  predictedNextAction: 'none',
  lastPredictionConfidence: 0.8,
  worldContextVersion: 1,
};

function frameFor({ energy = 0.8, thermal = 0.2, ram = 0.2 } = {}) {
  return buildCognitiveFrame(state, {
    novelty: 0,
    embodiment: {
      bodyEnergy01: energy,
      cognitiveCapacity01: 0.8,
      thermalStrain01: thermal,
      sensoryFreshness01: 1,
      awake: true,
      battery01: 0.7,
      cpuLoad01: 0.1,
      ramPressure01: ram,
    },
  });
}

const scenarios = [
  { name: 'low-energy', input: { energy: 0.17 }, type: 'resource-critical' },
  { name: 'high-thermal', input: { thermal: 0.83 }, type: 'thermal-critical' },
  { name: 'high-ram-pressure', input: { ram: 0.87 }, type: 'memory-pressure' },
];

for (const scenario of scenarios) {
  const frame = frameFor(scenario.input);
  assert.equal(frame.interrupt?.type, scenario.type, `${scenario.name}: expected specific severity`);
  assert.equal(
    frame.interrupt?.active,
    true,
    `${scenario.name}: a critical label must activate an interrupt even if its weighted score is below 0.72`,
  );
  assert.ok(
    frame.interrupt?.priority01 !== undefined && frame.interrupt.priority01 < 0.72,
    `${scenario.name}: fixture must exercise the weighted-threshold mismatch`,
  );
  const route = resolveCognitiveRoutingPolicy(
    { wakeMask: frame.wakeMask, interrupt: frame.interrupt! },
    3,
  );
  assert.equal(route.maxCounterfactualBranches, 0, `${scenario.name}: critical condition must stop optional counterfactuals`);
  assert.equal(route.allowMatchedCounterfactual, false);
}

console.log('COGNITIVE_FRAME_CRITICAL_INTERRUPT=PASS scenarios=3 routeClosed=true');
