import assert from 'node:assert/strict';
import { B401B420AdaptiveCognitiveResearchCore } from '../src/organism/system/B401B420AdaptiveCognitiveResearchCore.ts';

const core = new B401B420AdaptiveCognitiveResearchCore();
const state = core.snapshot();
state.fastAction = Array(7).fill(0.8);
state.mediumAction = Array(7).fill(0.5);
state.slowAction = Array(7).fill(0.2);
core.restore(state);
const actions = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const input = {
  tick: 1,
  context01: Array(8).fill(0.5),
  baseProbabilities: Object.fromEntries(actions.map((action) => [action, 1 / actions.length])),
  baseUtilities: Object.fromEntries(actions.map((action) => [action, 0.5])),
  reward01: 0.5, surprise01: 0.1, novelty01: 0.2, uncertainty01: 0.3, predictionError01: 0.1,
};
core.beforeDecision(input);
const scores = core.snapshot().last.expertScores['continuum-memory'];
const expected = 0.45 + 0.36 * (0.8 - 0.5) + 0.22 * (0.5 - 0.2);
assert.equal(scores.length, actions.length);
for (const score of scores) assert.ok(Math.abs(score - expected) < 1e-12, `expected timescale-difference score ${expected}, got ${score}`);
console.log('WORKPASS71_CONTINUUM_TIMESCALE=PASS', JSON.stringify({ expected, scores }));
