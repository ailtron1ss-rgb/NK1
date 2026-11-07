import assert from 'node:assert/strict';
import { B291UnifiedSelfAgencyGate, defaultB291State } from '../src/organism/system/B291UnifiedSelfAgencyGate.ts';
import { B292IntentTrace, defaultB292IntentTrace } from '../src/organism/system/B292IntentTrace.ts';
import { B333AutonomousGoalGenesisGate, defaultB333State } from '../src/organism/system/B333AutonomousGoalGenesisGate.ts';
import { B334AutonomousProjectLifecycleGate, defaultB334State } from '../src/organism/system/B334AutonomousProjectLifecycleGate.ts';
import { B335AutonomousProjectHoldoutGate, defaultB335State } from '../src/organism/system/B335AutonomousProjectHoldoutGate.ts';

/**
 * WorkPass72 — self-agency / autonomy gate cluster: unified self-agency gate,
 * intention trace, autonomous goal-genesis gate, project lifecycle gate and
 * project holdout gate each merged a persisted snapshot with `{...d,...r,...}`
 * so that any scalar the caller omitted or set to a hostile value leaked
 * straight into live state (NaN gate pressures, unknown modes/phases, negative
 * counters, malformed lifecycle records).
 */

const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- B291UnifiedSelfAgencyGate ----------------------------------------------
{
  const m = new B291UnifiedSelfAgencyGate();
  m.restore({ version: 1, cycles: -1, gate01: 9, mode: 'bogus', hold01: NaN,
    workingGoalId: 5, modeCounts: { maintain: -1 }, actionCounts: { x: -1 },
    recent: [{ tick: -1, mode: 'bogus', action: 'x', hold01: 9 }, 'z'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'b291 negative cycles -> 0');
  assert.equal(st.gate01, 1, 'b291 over-1 gate -> 1');
  assert.equal(st.mode, 'maintain', 'b291 unknown mode -> default');
  assert.ok(Number.isFinite(st.hold01) && st.hold01 >= 0 && st.hold01 <= 1, 'b291 NaN hold -> finite default');
  assert.equal(st.workingGoalId, null, 'b291 non-string goal -> null');
  assert.equal(st.modeCounts.maintain, 0, 'b291 negative mode count -> 0');
  assert.equal(st.actionCounts.x, 0, 'b291 negative action count -> 0');
  assert.equal(st.recent.length, 1, 'b291 drops non-object recent');
  assert.equal(st.recent[0].hold01, 1, 'b291 over-1 recent hold -> 1');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  m.restore(defaultB291State());
  assert.deepEqual(m.snapshot(), defaultB291State(), 'b291 default round-trips');
}

// --- B292IntentTrace --------------------------------------------------------
{
  const m = new B292IntentTrace();
  m.restore({ version: 1, switchCount: -1, commitment01: 9, currentIntent: 5,
    records: [{ tick: -1, reward01: 'x', autonomy01: 9, mode: 5 }, 'z'] });
  const st = m.snapshot();
  assert.equal(st.switchCount, 0, 'b292 negative switches -> 0');
  assert.equal(st.commitment01, 1, 'b292 over-1 commitment -> 1');
  assert.equal(st.currentIntent, null, 'b292 non-string intent -> null');
  assert.equal(st.records.length, 1, 'b292 drops non-object records');
  assert.equal(st.records[0].reward01, null, 'b292 non-number reward -> null');
  assert.equal(st.records[0].autonomy01, 1, 'b292 over-1 autonomy -> 1');
  assert.equal(typeof st.records[0].mode, 'string', 'b292 non-string mode -> default');
  assert.doesNotThrow(() => m.restore(hostile('records')));
  m.restore(defaultB292IntentTrace());
  assert.deepEqual(m.snapshot(), defaultB292IntentTrace(), 'b292 default round-trips');
}

// --- B333AutonomousGoalGenesisGate ------------------------------------------
{
  const m = new B333AutonomousGoalGenesisGate();
  m.restore({ version: 1, decisions: -1, lesion01: 9, internallySourcedGoals: -1,
    seenGoalIds: [5, 'g'],
    recent: [{ tick: -1, internalPressure01: 9, externalInput: 'yes', outcome01: 'x' }, 'z'] });
  const st = m.snapshot();
  assert.equal(st.decisions, 0, 'b333 negative decisions -> 0');
  assert.equal(st.lesion01, 1, 'b333 over-1 lesion -> 1');
  assert.equal(st.internallySourcedGoals, 0, 'b333 negative internal goals -> 0');
  assert.deepEqual(st.seenGoalIds, ['g'], 'b333 drops non-string goal ids');
  assert.equal(st.recent.length, 1, 'b333 drops non-object evidence');
  assert.equal(st.recent[0].internalPressure01, 1, 'b333 over-1 pressure -> 1');
  assert.equal(st.recent[0].externalInput, false, 'b333 non-boolean flag -> false');
  assert.equal(st.recent[0].outcome01, null, 'b333 non-number outcome -> null');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  m.restore(defaultB333State());
  assert.deepEqual(m.snapshot(), defaultB333State(), 'b333 default round-trips');
}

// --- B334AutonomousProjectLifecycleGate -------------------------------------
{
  const m = new B334AutonomousProjectLifecycleGate();
  m.restore({ version: 1, cycles: -1, projectPersistence01: 9,
    recent: [{ id: 5, status: 'bogus', stage: 'bogus', progress01: 9, autonomous: 'yes', history: ['genesis', 'bogus'] }, 'z'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'b334 negative cycles -> 0');
  assert.equal(st.projectPersistence01, 1, 'b334 over-1 persistence -> 1');
  assert.equal(st.recent.length, 1, 'b334 drops non-object records');
  assert.equal(typeof st.recent[0].id, 'string', 'b334 non-string id -> default');
  assert.equal(st.recent[0].status, 'active', 'b334 unknown status -> default');
  assert.equal(st.recent[0].stage, 'genesis', 'b334 unknown stage -> default');
  assert.equal(st.recent[0].progress01, 1, 'b334 over-1 progress -> 1');
  assert.equal(st.recent[0].autonomous, false, 'b334 non-boolean autonomous -> false');
  assert.deepEqual(st.recent[0].history, ['genesis'], 'b334 filters invalid stages');
  assert.doesNotThrow(() => m.restore(hostile('recent')));
  m.restore(defaultB334State());
  assert.deepEqual(m.snapshot(), defaultB334State(), 'b334 default round-trips');
}

// --- B335AutonomousProjectHoldoutGate ---------------------------------------
{
  const m = new B335AutonomousProjectHoldoutGate();
  m.restore({ version: 1, cycles: -1, phase: 'bogus', strategyRetention01: 9, eligible: 'yes', projectId: 5,
    baselineActions: [{ action: 5, count: -1 }, 'z'] });
  const st = m.snapshot();
  assert.equal(st.cycles, 0, 'b335 negative cycles -> 0');
  assert.equal(st.phase, 'baseline', 'b335 unknown phase -> default');
  assert.equal(st.strategyRetention01, 1, 'b335 over-1 retention -> 1');
  assert.equal(st.eligible, false, 'b335 non-boolean eligible -> false');
  assert.equal(st.projectId, null, 'b335 non-string project id -> null');
  assert.equal(st.baselineActions.length, 1, 'b335 drops non-object stats');
  assert.equal(st.baselineActions[0].count, 0, 'b335 negative count -> 0');
  assert.equal(typeof st.baselineActions[0].action, 'string', 'b335 non-string action -> default');
  assert.doesNotThrow(() => m.restore(hostile('baselineActions')));
  m.restore(defaultB335State());
  assert.deepEqual(m.snapshot(), defaultB335State(), 'b335 default round-trips');
}

console.log('WORKPASS72_B291_B292_B333_B334_B335_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: 5 }));
