import assert from 'node:assert/strict';
import { WorldModel2 } from '../src/organism/developmental/WorldModel2.ts';

const model = new WorldModel2();
const base = { tick: 0, location:'growth-lab', energy:.8, attention:.75, uncertainty:.3, facts:[], objects:[], events:[] };
model.observeContext(base);
for (let i = 1; i <= 1000; i += 1) {
  const context = { ...base, tick:i, uncertainty:(i % 17) / 20, facts:[`fact-${i}`], events:[`event-${i}`] };
  model.observeContext(context);
  model.applyMemoryEvidence({ memoryIds:[`memory-${i}`], query:`query-${i}`, confidence01:.55 + (i % 7) * .03, salience01:.45, at:i });
  model.inferCause(`cause-${i % 700}`, `effect-${i}`, i % 3 !== 0);
  model.predict(i % 2 === 0 ? 'explore' : 'verify', .55, .3);
  model.observeTransition({ action:i % 2 === 0 ? 'explore' : 'verify', before:context, after:{...context, tick:i+1, energy:.79, uncertainty:.28}, reward:i % 4 === 0 ? .82 : .58, surprise:i % 5 === 0 ? .5 : .14, at:i });
}
const state = model.snapshot();
assert.ok(Object.keys(state.memoryEvidence).length <= 128, `memory evidence grew to ${Object.keys(state.memoryEvidence).length}`);
assert.ok(state.causal.length <= 512, `causal hypotheses grew to ${state.causal.length}`);
assert.ok(Object.keys(state.transitionHypotheses).length <= 2048, `transition hypotheses grew to ${Object.keys(state.transitionHypotheses).length}`);
assert.ok(state.predictionErrors.length <= 512, `prediction error history grew to ${state.predictionErrors.length}`);
assert.ok(Object.keys(state.pendingPredictions).length <= 256, `pending predictions grew to ${Object.keys(state.pendingPredictions).length}`);
assert.ok(Number.isFinite(state.memoryEvidence01), 'memory evidence became non-finite');
assert.ok(Number.isFinite(state.learnedTransitions), 'learned transitions became non-finite');
console.log(`P2866_WORLD_MODEL_STATE_GROWTH=PASS memoryEvidence=${Object.keys(state.memoryEvidence).length} causal=${state.causal.length} transitionHypotheses=${Object.keys(state.transitionHypotheses).length} pending=${Object.keys(state.pendingPredictions).length}`);
