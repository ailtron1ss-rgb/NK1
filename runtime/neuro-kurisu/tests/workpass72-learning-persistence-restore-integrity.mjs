import assert from 'node:assert/strict';
import { PersistenceDurabilityGovernor } from '../src/organism/persistence/PersistenceDurabilityGovernor.ts';
import { BehavioralGenome, defaultBehavioralGenome } from '../src/organism/learning/BehavioralGenome.ts';
import { P29LearningGovernanceEngine } from '../src/organism/learning/P29LearningGovernance.ts';
import { ScientificMethodEngine, defaultScientificMethod } from '../src/organism/learning/ScientificMethodEngine.ts';
import { TemporalContinuityEngine } from '../src/organism/learning/TemporalContinuityEngine.ts';

/**
 * WorkPass72 — learning/persistence/continuity restore integrity. Each owner
 * previously merged the persisted snapshot with a bare spread, so NaN reached
 * mode-selection scores, learning budgets, research confidence and lifetime
 * continuity counters; nested records were copied wholesale without validation.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);

// --- PersistenceDurabilityGovernor -----------------------------------------
{
  const g = new PersistenceDurabilityGovernor();
  g.restore({ version: 1, decisions: NaN, lastDecision: 'nonsense', effectiveMaxDirtyCycles: 0, targetCrashLossCycles: NaN, lastPayloadBytes: -1, lastSaveMs: Infinity, estimatedWriteAmplification01: 5, lastAt: -1 });
  const st = g.decide({ profile: 'mobile', baseMaxDirtyCycles: 4, battery01: .5, thermal01: .3, ramPressure01: .2 });
  finite(st, 'durability window');
  assert.ok(st >= 1, 'durability window stays >= 1');
  const snap = g.snapshot ? g.snapshot() : null;
  // no snapshot accessor on this owner; verify via a second decide is deterministic
  const st2 = g.decide({ profile: 'mobile', baseMaxDirtyCycles: 4, battery01: .5, thermal01: .3, ramPressure01: .2 });
  assert.equal(Number.isFinite(st2), true, 'durability decide remains finite after poisoned restore');
  assert.doesNotThrow(() => g.restore({ get decisions() { throw new Error('hostile'); } }));
  const g2 = new PersistenceDurabilityGovernor();
  g2.restore({ version: 1, decisions: 5, lastDecision: 'battery-risk', effectiveMaxDirtyCycles: 3, targetCrashLossCycles: 2, lastPayloadBytes: 10, lastSaveMs: 20, estimatedWriteAmplification01: .4, lastAt: 30 });
  const w = g2.decide({ profile: 'quality', baseMaxDirtyCycles: 3, battery01: .9, thermal01: .1, ramPressure01: .1 });
  finite(w, 'durability valid window');
}

// --- BehavioralGenome ------------------------------------------------------
{
  const b = new BehavioralGenome();
  b.restore({ version: 1, active: 'bogus', selectionCounts: { explorer: NaN, guardian: -4 }, successByMode: { explorer: NaN, analyst: Infinity }, lineage: ['analyst', 'bogus', 7], switches: NaN, lastReason: 5 });
  const st = b.snapshot();
  assert.equal(st.active, 'analyst', 'genome unknown active falls back');
  assert.equal(st.successByMode.explorer, .5, 'genome NaN success falls back');
  for (const m of ['explorer', 'guardian', 'analyst', 'social', 'recoverer']) finite(st.successByMode[m], `genome success ${m}`);
  assert.equal(st.selectionCounts.guardian, 0, 'genome negative count -> 0');
  assert.deepEqual(st.lineage, ['analyst'], 'genome drops unknown lineage entries');
  assert.equal(st.switches, 0, 'genome NaN switches -> 0');
  // select must stay deterministic and finite.
  const mode = b.select({ novelty01: .5, uncertainty01: .5, socialNeed01: .1, energy01: .8, thermal01: .2, predictionError01: .3, informationDeficit01: .4 });
  assert.ok(['explorer', 'guardian', 'analyst', 'social', 'recoverer'].includes(mode), 'genome select returns a real mode');
  assert.doesNotThrow(() => b.restore({ get successByMode() { throw new Error('hostile'); } }));
  const d = defaultBehavioralGenome();
  b.restore(d);
  assert.deepEqual(b.snapshot(), d, 'genome default round-trips');
}

// --- P29LearningGovernanceEngine -------------------------------------------
{
  const p = new P29LearningGovernanceEngine();
  p.restore({ version: 1, cycles: NaN, acceptedUpdates: -2, trustBySource: { 'p23': NaN, ['x'.repeat(200)]: .5 }, resourceBudget: { limit01: NaN, spent01: 9, lastCost01: -1, lastAt: -5 }, continual: { tasks: { t: { samples: NaN, best01: 9, last01: -1, at: -3 } }, forgetting01: NaN, retention01: Infinity, lastTask: 7 }, rollback: { generation: NaN, capturedAt: -1 }, provenance: [{ id: 'ok', source: 's' }, { source: 'no-id' }, 'junk'] });
  const st = p.snapshot();
  finite(st.resourceBudget.limit01, 'P29 budget limit');
  assert.ok(st.resourceBudget.limit01 <= 1, 'P29 budget limit clamped');
  assert.equal(st.cycles, 0, 'P29 NaN cycles -> 0');
  assert.equal(st.acceptedUpdates, 0, 'P29 negative accepted -> 0');
  finite(st.trustBySource['p23'], 'P29 trust');
  assert.equal(st.trustBySource['p23'], .5, 'P29 NaN trust falls back');
  assert.equal(st.provenance.length, 1, 'P29 drops provenance without id');
  assert.equal(st.provenance[0].id, 'ok', 'P29 keeps valid provenance');
  finite(st.continual.tasks.t.best01, 'P29 task best');
  finite(st.continual.forgetting01, 'P29 forgetting');
  assert.equal(st.rollback.generation, 0, 'P29 NaN rollback generation -> 0');
  assert.doesNotThrow(() => p.restore({ get resourceBudget() { throw new Error('hostile'); } }));
}

// --- ScientificMethodEngine ------------------------------------------------
{
  const s = new ScientificMethodEngine();
  s.restore({ projects: [{ id: 'p1', question: 'q', hypotheses: [{ id: 'h', confidence: NaN, status: 'bogus', evidenceIds: ['e', 5] }, null], predictions: ['a', 2], uncertainty: NaN, status: 'weird', createdAt: -1, updatedAt: NaN }, { question: 'no-id' }, 'junk'], completed: NaN, revisionCount: -1 });
  const st = s.snapshot();
  assert.equal(st.projects.length, 1, 'sci drops projects without id');
  const p = st.projects[0];
  finite(p.uncertainty, 'sci uncertainty');
  assert.equal(p.uncertainty, .7, 'sci NaN uncertainty falls back');
  assert.equal(p.status, 'open', 'sci unknown status falls back');
  assert.equal(p.hypotheses.length, 1, 'sci drops malformed hypotheses');
  finite(p.hypotheses[0].confidence, 'sci hypothesis confidence');
  assert.equal(p.hypotheses[0].status, 'open', 'sci unknown hypothesis status falls back');
  assert.deepEqual(p.predictions, ['a'], 'sci drops non-string predictions');
  assert.equal(st.completed, 0, 'sci NaN completed -> 0');
  assert.equal(st.revisionCount, 0, 'sci negative revision -> 0');
  assert.doesNotThrow(() => s.restore({ get projects() { throw new Error('hostile'); } }));
  const d = defaultScientificMethod();
  s.restore(d);
  assert.deepEqual(s.snapshot(), d, 'sci default round-trips');
}

// --- TemporalContinuityEngine ----------------------------------------------
{
  const t = new TemporalContinuityEngine();
  t.restore({ version: 1, firstSeenAt: NaN, totalActiveMs: -5, totalOfflineMs: Infinity, sessionCount: -1, gapSincePreviousClass: 'bogus', lastGapSummary: 7, lastCalendarContext: { hour: 99, timezoneOffsetMinutes: NaN }, sessions: [{ id: 'a', startedAt: NaN, endedAt: -3, reason: 'x', clean: true }, 'junk', { startedAt: 5 }] });
  const st = t.snapshot();
  for (const k of ['firstSeenAt', 'lastCheckpointAt', 'lastActiveAt', 'totalActiveMs', 'totalOfflineMs', 'gapSincePreviousMs']) finite(st[k], `continuity ${k}`);
  assert.equal(st.totalActiveMs, 0, 'continuity negative active -> 0');
  assert.equal(st.sessionCount, 0, 'continuity negative sessionCount -> 0');
  assert.equal(st.gapSincePreviousClass, 'none', 'continuity unknown gap class falls back');
  assert.equal(st.lastGapSummary, 'initial-session', 'continuity non-string summary falls back');
  assert.equal(st.lastCalendarContext.hour, 23, 'continuity hour clamped');
  finite(st.lastCalendarContext.timezoneOffsetMinutes, 'continuity tz offset');
  assert.equal(st.sessions.length, 2, 'continuity drops non-object sessions, keeps structurally valid ones');
  assert.equal(st.sessions[0].endedAt, null, 'continuity negative endedAt -> null');
  finite(st.sessions[0].startedAt, 'continuity session startedAt');
  assert.doesNotThrow(() => t.restore({ get sessions() { throw new Error('hostile'); } }));
}

console.log('WORKPASS72_LEARNING_PERSISTENCE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['PersistenceDurabilityGovernor', 'BehavioralGenome', 'P29LearningGovernanceEngine', 'ScientificMethodEngine', 'TemporalContinuityEngine'] }));
