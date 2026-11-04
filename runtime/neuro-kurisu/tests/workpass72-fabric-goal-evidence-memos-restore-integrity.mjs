import assert from 'node:assert/strict';
import { P62MemoryFabric, defaultP62 } from '../src/organism/memory/P62MemoryFabric.ts';
import { P68GoalEcology, defaultP68 } from '../src/organism/developmental/P68GoalEcology.ts';
import { P54LongHorizonEvidence, defaultP54 } from '../src/organism/developmental/P54LongHorizonEvidence.ts';
import { P59MemoryOperatingSystem, defaultP59 } from '../src/organism/developmental/P59MemoryOperatingSystem.ts';

/**
 * WorkPass72 — memory fabric / goal ecology / long-horizon evidence / memory OS
 * restore integrity. Each owner merged a persisted snapshot with a bare spread,
 * letting NaN reach recall quality, goal vitality, evidence-window metrics and
 * memory-health ratios.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P62MemoryFabric --------------------------------------------------------
{
  const p = new P62MemoryFabric();
  p.restore({ version: 1, queries: -1, hits: NaN, conflictEvents: -1, meanQuality01: 9, meanCoverage01: -1, meanConflict01: NaN, lastFrame: { query: 5, hits: [{ id: 'h1', content: 5, kind: 5, source: 5, confidence01: 9, relevance01: -1, support01: NaN, conflict01: 9, provenance: ['p', 5] }, { content: 'no-id' }], sourcesUsed: ['s', 5], sourceDiversity01: NaN, semanticCoverage01: 9, conflictPressure01: -1, redundancy01: NaN, retrievalQuality01: 9, at: -1 }, history: [{ query: 'q', hits: [], sourcesUsed: [], sourceDiversity01: 9, semanticCoverage01: -1, conflictPressure01: NaN, redundancy01: 9, retrievalQuality01: -1, at: -1 }, null] });
  const st = p.snapshot();
  assert.equal(st.queries, 0, 'p62 negative queries -> 0');
  assert.equal(st.hits, 0, 'p62 NaN hits -> 0');
  assert.equal(st.meanQuality01, 1, 'p62 over-1 quality -> 1');
  assert.equal(st.meanCoverage01, 0, 'p62 negative coverage -> 0');
  assert.equal(st.meanConflict01, .15, 'p62 NaN conflict -> default');
  assert.equal(st.lastFrame.hits.length, 1, 'p62 drops hit without id');
  assert.equal(st.lastFrame.hits[0].confidence01, 1, 'p62 over-1 confidence -> 1');
  assert.equal(st.lastFrame.hits[0].relevance01, 0, 'p62 negative relevance -> 0');
  assert.equal(st.lastFrame.hits[0].support01, 0, 'p62 NaN support -> 0');
  assert.deepEqual(st.lastFrame.hits[0].provenance, ['p'], 'p62 drops non-string provenance');
  assert.equal(st.lastFrame.semanticCoverage01, 1, 'p62 over-1 coverage -> 1');
  assert.equal(st.lastFrame.at, 0, 'p62 negative at -> 0');
  assert.equal(st.history.length, 1, 'p62 drops non-object frame');
  assert.equal(st.history[0].retrievalQuality01, 0, 'p62 negative retrieval quality -> 0');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP62();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p62 default round-trips');
}

// --- P68GoalEcology ---------------------------------------------------------
{
  const p = new P68GoalEcology();
  p.restore({ version: 1, cycles: -1, completed: NaN, abandoned: -1, paused: NaN, reactivated: -1, pruned: NaN, meanVitality01: 9, meanStaleness01: -1, meanConflict01: NaN, goalPressure01: 9, activeCount: -1, lastTopGoalId: 5, lastMode: 5, history: [{ id: 'g1', title: 5, status: 'bogus', vitality01: 9, staleness01: -1, conflict01: NaN, progress01: 9 }, { title: 'no-id' }] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p68 negative cycles -> 0');
  assert.equal(st.completed, 0, 'p68 NaN completed -> 0');
  assert.equal(st.meanVitality01, 1, 'p68 over-1 vitality -> 1');
  assert.equal(st.meanStaleness01, 0, 'p68 negative staleness -> 0');
  assert.equal(st.meanConflict01, .12, 'p68 NaN conflict -> default');
  assert.equal(st.activeCount, 0, 'p68 negative activeCount -> 0');
  assert.equal(st.lastTopGoalId, null, 'p68 non-string lastTopGoalId -> null');
  assert.equal(st.lastMode, 'observe', 'p68 non-string lastMode -> default');
  assert.equal(st.history.length, 1, 'p68 drops view without id');
  assert.equal(st.history[0].status, 'candidate', 'p68 unknown status -> candidate');
  assert.equal(st.history[0].vitality01, 1, 'p68 over-1 view vitality -> 1');
  assert.equal(st.history[0].staleness01, 0, 'p68 negative view staleness -> 0');
  assert.equal(st.history[0].conflict01, 0, 'p68 NaN view conflict -> 0');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP68();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p68 default round-trips');
}

// --- P54LongHorizonEvidence -------------------------------------------------
{
  const p = new P54LongHorizonEvidence();
  p.restore({ version: 1, windows: [{ startTick: -1, endTick: NaN, cycles: -1, meanPredictionError01: 9, meanSelfPredictionError01: -1, meanIdentity01: NaN, meanGrounding01: 9, meanCausalAlignment01: -1, improvement01: NaN, stress01: 9 }], cycles: -1, baselineError01: 9, currentError01: -1, stability01: NaN, drift01: 9, lastAt: -1 });
  const st = p.snapshot();
  assert.equal(st.windows.length, 1, 'p54 keeps window');
  assert.equal(st.windows[0].startTick, 0, 'p54 negative startTick -> 0');
  assert.equal(st.windows[0].endTick, 0, 'p54 NaN endTick -> 0');
  assert.equal(st.windows[0].meanPredictionError01, 1, 'p54 over-1 error -> 1');
  assert.equal(st.windows[0].meanSelfPredictionError01, 0, 'p54 negative error -> 0');
  assert.equal(st.windows[0].meanIdentity01, 0, 'p54 NaN identity -> 0');
  assert.equal(st.windows[0].stress01, 1, 'p54 over-1 stress -> 1');
  assert.equal(st.cycles, 0, 'p54 negative cycles -> 0');
  assert.equal(st.baselineError01, 1, 'p54 over-1 baseline -> 1');
  assert.equal(st.currentError01, 0, 'p54 negative current -> 0');
  assert.equal(st.stability01, .8, 'p54 NaN stability -> default');
  assert.equal(st.drift01, 1, 'p54 over-1 drift -> 1');
  assert.equal(st.lastAt, 0, 'p54 negative lastAt -> 0');
  assert.doesNotThrow(() => p.restore(hostile('windows')));
  const pDefault = defaultP54();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p54 default round-trips');
}

// --- P59MemoryOperatingSystem -----------------------------------------------
{
  const p = new P59MemoryOperatingSystem();
  p.restore({ version: 1, cycles: -1, encodes: NaN, reconsolidations: -1, compressions: NaN, protectedCycles: -1, meanHealth01: 9, meanRetention01: -1, lastPlan: { mode: 'bogus', priority01: 9, retentionBias01: -1, reasons: ['r', 5] }, history: [{ tick: -1, at: NaN, mode: 'bogus', health01: 9, retention01: -1 }, null] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p59 negative cycles -> 0');
  assert.equal(st.encodes, 0, 'p59 NaN encodes -> 0');
  assert.equal(st.meanHealth01, 1, 'p59 over-1 health -> 1');
  assert.equal(st.meanRetention01, 0, 'p59 negative retention -> 0');
  assert.equal(st.lastPlan.mode, 'maintenance', 'p59 unknown plan mode -> maintenance');
  assert.equal(st.lastPlan.priority01, 1, 'p59 over-1 priority -> 1');
  assert.equal(st.lastPlan.retentionBias01, 0, 'p59 negative retention bias -> 0');
  assert.deepEqual(st.lastPlan.reasons, ['r'], 'p59 drops non-string reasons');
  assert.equal(st.history.length, 1, 'p59 drops non-object history row');
  assert.equal(st.history[0].mode, 'maintenance', 'p59 unknown history mode -> maintenance');
  assert.equal(st.history[0].tick, 0, 'p59 negative tick -> 0');
  assert.equal(st.history[0].health01, 1, 'p59 over-1 history health -> 1');
  assert.equal(st.history[0].retention01, 0, 'p59 negative history retention -> 0');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP59();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p59 default round-trips');
}

console.log('WORKPASS72_FABRIC_GOAL_EVIDENCE_MEMOS_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P62MemoryFabric', 'P68GoalEcology', 'P54LongHorizonEvidence', 'P59MemoryOperatingSystem'] }));
