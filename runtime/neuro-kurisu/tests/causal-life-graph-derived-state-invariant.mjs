import assert from 'node:assert/strict';
import { CausalLifeGraph } from '../src/organism/system/CausalLifeGraph.ts';

const graph = new CausalLifeGraph();
const at = 1_700_000_000_008;

graph.upsertNode({
  kind: 'experience',
  refId: 'experience:memory-policy-adjustment',
  label: 'Memory policy adjusted after outcome',
  tick: 8,
  at,
  confidence01: 0.9,
  external01: 1,
});

assert.equal(graph.snapshot().observedChains, 1, 'snapshot must include derived chain counters immediately after a node upsert');
assert.equal(graph.snapshot().lastAt, at, 'snapshot must carry the latest graph event timestamp');
assert.equal(graph.snapshot().totalNodes, 1, 'snapshot must retain canonical node count');

graph.upsertNode({
  kind: 'experience',
  refId: 'experience:memory-policy-adjustment',
  label: 'Memory policy adjustment confirmed',
  tick: 9,
  at: at + 1,
  confidence01: 0.95,
});
assert.equal(graph.snapshot().observedChains, 1, 'updating an existing node must refresh derived counters without duplicating its lineage identity');
assert.equal(graph.snapshot().nodes[0].tick, 9, 'existing node tick must be updated');

const snapshot = graph.snapshot();
const restored = new CausalLifeGraph();
restored.restore(snapshot);
assert.deepEqual(restored.snapshot(), snapshot, 'snapshot/restore must be a stable round trip');

const complete = new CausalLifeGraph();
complete.recordCycle({
  tick: 42,
  at: at + 100,
  experience: { id: 'experience-42', label: 'Experience', confidence01: 0.9 },
  emotion: { id: 'emotion-42', label: 'Concern', confidence01: 0.8 },
  memory: { id: 'memory-42', label: 'Relevant memory', confidence01: 0.9 },
  decision: { id: 'decision-42', label: 'Investigate', confidence01: 0.85 },
  action: { id: 'action-42', label: 'Inspect evidence', confidence01: 0.9 },
  outcome: { id: 'outcome-42', label: 'Issue confirmed', confidence01: 0.9, external01: 1 },
  learning: { id: 'learning-42', label: 'Prefer source-backed claims', confidence01: 0.9 },
  selfChange: { id: 'self-change-42', label: 'Increase provenance scrutiny', confidence01: 0.85 },
});
const summary = complete.summary();
assert.equal(summary.observedChains, 1, 'one complete cognitive cycle should count as one observed chain');
assert.equal(summary.completeChains, 1, 'a cycle containing every required node kind should count as complete');
assert.equal(summary.chainCoverage01, 1, 'complete-chain coverage must be derived consistently');
assert.equal(summary.edges, 7, 'recordCycle should connect its eight chain stages');
assert.equal(complete.hasCompleteChainAtTick(42), true, 'cycle completeness query must agree with summary counters');

console.log('CAUSAL_LIFE_GRAPH_DERIVED_STATE_INVARIANT=PASS', JSON.stringify(summary));
