import assert from 'node:assert/strict';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';
import { CognitiveDependencyGraph } from '../src/organism/core/CognitiveDependencyGraph.ts';

const state = {
  tick: 4,
  at: 1000,
  predictionError: 0,
  needs: { novelty: 0, uncertainty: 0, goalPressure: 0, energy: 1, cognitiveLoad: 0 },
};
const frame = buildCognitiveFrame(state, {
  text: 'urgent input during thermal strain',
  surprise: 0.95,
  embodiment: { bodyEnergy01: 1, cognitiveCapacity01: 1, thermalStrain01: 0.6, ramPressure01: 0.2 },
});

// Safety dirtiness starts before the ordinary governance activation threshold.
assert.equal(frame.domains.governance, false);
assert.equal(frame.dirtyDomains.governance, true);
assert.equal(frame.interrupt.active, true);
assert.ok(frame.interrupt.domains.includes('governance'),
  'an active interrupt must include every dirty domain, including safety-escalated governance');
assert.ok((frame.wakeMask & 64) !== 0,
  'the compact wake mask must include governance when resource pressure marks it dirty');

const graph = new CognitiveDependencyGraph();
const routed = graph.resolve(frame);
assert.ok((routed.wakeMask & 64) !== 0);
assert.equal(graph.shouldWake('governance'), true,
  'the dependency graph must route the safety-escalated governance domain');

console.log('CognitiveFrame resource interrupt routing: PASS');
