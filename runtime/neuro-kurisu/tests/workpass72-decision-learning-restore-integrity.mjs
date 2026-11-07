import assert from 'node:assert/strict';
import { CognitiveQuorumEngine, defaultCognitiveQuorum } from '../src/organism/system/CognitiveQuorum.ts';
import { MetaMemoryController } from '../src/organism/system/MetaMemoryController.ts';
import { SparsePredictiveGraph } from '../src/organism/system/SparsePredictiveGraph.ts';
import { DevelopmentalPhaseScheduler } from '../src/organism/system/DevelopmentalPhaseScheduler.ts';
import { LocalNeuralCreditAssigner } from '../src/organism/system/LocalNeuralCreditAssigner.ts';

/**
 * WorkPass72 — decision/learning owner restore integrity. Each of these owners
 * previously merged the persisted snapshot with a bare spread, so NaN reached
 * scalars that feed multiplicative EMAs (quorum mean score, credit mean, memory
 * precision, predictive error), counts could go negative, and `last`/`phase`
 * could take arbitrary values.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);

// --- CognitiveQuorumEngine -------------------------------------------------
{
  const q = new CognitiveQuorumEngine();
  const d = defaultCognitiveQuorum();
  q.restore({ version: 1, decisions: NaN, accepted: -1, rejected: Infinity, meanScore01: NaN, meanDissent01: 5, last: { action: 'respond', accepted: true, score01: NaN, threshold01: 9, dissent01: -1, votes: [{ member: 'constitution', score01: NaN, weight01: 9, reason: 7 }, null, 'x'] } });
  const st = q.snapshot();
  finite(st.meanScore01, 'quorum meanScore');
  assert.equal(st.meanScore01, d.meanScore01, 'quorum NaN mean falls back');
  finite(st.meanDissent01, 'quorum meanDissent');
  assert.equal(st.decisions, 0, 'quorum NaN decisions -> 0');
  assert.equal(st.accepted, 0, 'quorum negative accepted -> 0');
  finite(st.rejected, 'quorum rejected');
  assert.ok(st.last, 'quorum keeps a sanitized last decision');
  finite(st.last.score01, 'quorum last score');
  assert.ok(st.last.threshold01 <= 1, 'quorum last threshold clamped');
  assert.equal(st.last.votes.length, 1, 'quorum drops malformed votes');
  finite(st.last.votes[0].score01, 'quorum vote score');
  // malformed `last` (no action) is dropped entirely.
  q.restore({ version: 1, last: { score01: 1 } });
  assert.equal(q.snapshot().last, undefined, 'quorum drops last without action');
  assert.doesNotThrow(() => q.restore({ get meanScore01() { throw new Error('hostile'); } }));
  // EMA stays finite after a poisoned restore + evaluate.
  q.evaluate({ action: 'respond', constitutional01: .9, worldConfidence01: .7, memorySupport01: .6, epistemic01: .7, budget01: .8, identity01: .9, urgency01: .5 });
  finite(q.snapshot().meanScore01, 'quorum EMA after poisoned restore');
  const valid = { version: 1, decisions: 3, accepted: 2, rejected: 1, meanScore01: .6, meanDissent01: .1 };
  q.restore(valid);
  assert.equal(q.snapshot().meanScore01, .6, 'quorum valid snapshot round-trips');
}

// --- MetaMemoryController --------------------------------------------------
{
  const m = new MetaMemoryController();
  m.restore({ version: 1, cycles: NaN, retrievals: -3, replays: Infinity, compressions: NaN, meanPrecision01: NaN, semanticCompression01: 9, forgettingRisk01: -1 });
  const st = m.snapshot();
  finite(st.meanPrecision01, 'meta precision');
  assert.equal(st.meanPrecision01, .5, 'meta NaN precision falls back');
  finite(st.semanticCompression01, 'meta compression');
  assert.ok(st.semanticCompression01 <= 1, 'meta compression clamped');
  assert.equal(st.forgettingRisk01, 0, 'meta negative risk clamps');
  assert.equal(st.cycles, 0, 'meta NaN cycles -> 0');
  assert.equal(st.retrievals, 0, 'meta negative retrievals -> 0');
  assert.doesNotThrow(() => m.restore({ get meanPrecision01() { throw new Error('hostile'); } }));
  m.step({ salience01: .6, repeat01: .5, reliability01: .7, load01: .7, uncertainty01: .3 });
  finite(m.summary().meanPrecision01, 'meta EMA after poisoned restore');
}

// --- SparsePredictiveGraph -------------------------------------------------
{
  const g = new SparsePredictiveGraph();
  g.restore({ version: 1, cycles: NaN, nodes: -1, edges: 1e12, activeEdges: 1e12, meanError01: NaN, prediction01: Infinity, lastNovelty01: -1 });
  const st = g.snapshot();
  finite(st.meanError01, 'graph meanError');
  finite(st.prediction01, 'graph prediction');
  assert.equal(st.nodes, 0, 'graph negative nodes -> 0');
  assert.ok(st.edges <= 16384, 'graph edges capped');
  assert.ok(st.activeEdges <= st.edges, 'graph activeEdges never exceeds edges');
  assert.equal(st.lastNovelty01, 0, 'graph negative novelty clamps');
  assert.doesNotThrow(() => g.restore({ get meanError01() { throw new Error('hostile'); } }));
  g.step({ novelty01: .5, predictionError01: .3, coherence01: .6, sparsity01: .4 });
  finite(g.summary().prediction01, 'graph EMA after poisoned restore');
}

// --- DevelopmentalPhaseScheduler -------------------------------------------
{
  const s = new DevelopmentalPhaseScheduler();
  s.restore({ version: 1, cycles: NaN, phase: 'bogus', transitions: -1, freeze01: NaN, phaseFitness01: 9 });
  const st = s.snapshot();
  assert.equal(st.phase, 'stabilize', 'scheduler unknown phase falls back');
  finite(st.freeze01, 'scheduler freeze');
  finite(st.phaseFitness01, 'scheduler fitness');
  assert.ok(st.phaseFitness01 <= 1, 'scheduler fitness clamped');
  assert.equal(st.cycles, 0, 'scheduler NaN cycles -> 0');
  assert.equal(st.transitions, 0, 'scheduler negative transitions -> 0');
  assert.doesNotThrow(() => s.restore({ get phase() { throw new Error('hostile'); } }));
  const valid = { version: 1, cycles: 5, phase: 'learn', transitions: 2, freeze01: .3, phaseFitness01: .7 };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'scheduler valid snapshot round-trips');
}

// --- LocalNeuralCreditAssigner ---------------------------------------------
{
  const a = new LocalNeuralCreditAssigner();
  a.restore({ version: 1, cycles: NaN, assignments: -2, meanCredit01: NaN, meanGain01: Infinity, lastCredit01: -1 });
  const st = a.snapshot();
  finite(st.meanCredit01, 'credit mean');
  assert.equal(st.meanCredit01, .5, 'credit NaN mean falls back');
  finite(st.meanGain01, 'credit gain');
  assert.equal(st.lastCredit01, 0, 'credit negative last clamps');
  assert.equal(st.cycles, 0, 'credit NaN cycles -> 0');
  assert.equal(st.assignments, 0, 'credit negative assignments -> 0');
  assert.doesNotThrow(() => a.restore({ get meanCredit01() { throw new Error('hostile'); } }));
  a.assign({ predictionError01: .3, reward01: .7, eligibility01: .5, stability01: .8 });
  finite(a.summary().meanCredit01, 'credit EMA after poisoned restore');
}

console.log('WORKPASS72_DECISION_LEARNING_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['CognitiveQuorumEngine', 'MetaMemoryController', 'SparsePredictiveGraph', 'DevelopmentalPhaseScheduler', 'LocalNeuralCreditAssigner'] }));
