import assert from 'node:assert/strict';
import { LifelongDevelopmentSystem, defaultLifelongDevelopment } from '../src/organism/learning/LifelongDevelopmentSystem.ts';
import { AutobiographicalNarrativeEngine, defaultNarrative } from '../src/organism/cognition/evolution/AutobiographicalNarrative.ts';
import { ValueEvolutionEngine, defaultValueEvolution } from '../src/organism/cognition/evolution/ValueEvolutionEngine.ts';
import { BehavioralInfluenceLedger } from '../src/organism/system/BehavioralInfluenceLedger.ts';

/**
 * WorkPass72 — lifelong development / narrative / value evolution / influence
 * ledger restore integrity. Each owner merged a persisted snapshot with a bare
 * spread, letting NaN reach sleep phases, learning budgets, skill statistics,
 * narrative continuity, value-revision history and influence attribution.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- LifelongDevelopmentSystem ---------------------------------------------
{
  const l = new LifelongDevelopmentSystem();
  l.restore({ version: 1, phase: 'bogus', cycleCount: -1, totalSleepMs: NaN, replayCycles: -1, reconsolidations: NaN, dormantMemories: -1, reactivatedMemories: NaN, dreamCount: -1, microDreamCount: NaN, deepDreamCount: -1, skillPromotions: NaN, skillDemotions: -1, projectResumptions: NaN, learningBudgetSpent: 9, learningBudgetLimit: -1, skills: [{ id: 's1', action: 5, context: 5, uses: -1, successes: NaN, failures: -1, successRate: 9, confidence: -1, cost01: NaN, status: 'bogus', lastUsedAt: -1, failureModes: ['f', 5], promotedAt: -1, demotedAt: NaN }, { action: 'x' }], dreams: [{ id: 'd1', seedIds: ['a', 5], question: 5, insight: 5, confidence: 9, kind: 'bogus', createdAt: -1 }, { question: 'x' }], sessions: [{ startedAt: -1, endedAt: NaN, phase: 'bogus', reason: 5, replayed: -1, dreams: NaN, skillsPromoted: -1, memoriesDormant: NaN }], lastSleepAt: -1, lastWakeAt: NaN, lastConsolidationAt: -1, lastMaintenanceAt: NaN, lastInsight: 5, lastInsightConfidence: 9 });
  const st = l.snapshot();
  assert.equal(st.phase, 'awake', 'lifelong unknown phase -> default');
  assert.equal(st.cycleCount, 0, 'lifelong negative cycleCount -> 0');
  assert.equal(st.totalSleepMs, 0, 'lifelong NaN totalSleepMs -> 0');
  assert.equal(st.replayCycles, 0, 'lifelong negative replayCycles -> 0');
  assert.equal(st.dreamCount, 0, 'lifelong negative dreamCount -> 0');
  assert.equal(st.learningBudgetSpent, 1, 'lifelong over-1 budget spent -> 1');
  assert.equal(st.learningBudgetLimit, 0, 'lifelong negative budget limit -> 0');
  assert.equal(st.skills.length, 1, 'lifelong drops skill without id');
  assert.equal(st.skills[0].uses, 0, 'lifelong negative uses -> 0');
  assert.equal(st.skills[0].successRate, 1, 'lifelong over-1 successRate -> 1');
  assert.equal(st.skills[0].confidence, 0, 'lifelong negative confidence -> 0');
  assert.equal(st.skills[0].cost01, 0, 'lifelong NaN cost -> 0');
  assert.equal(st.skills[0].status, 'candidate', 'lifelong unknown status -> candidate');
  assert.deepEqual(st.skills[0].failureModes, ['f'], 'lifelong drops non-string failure modes');
  assert.equal(st.skills[0].promotedAt, 0, 'lifelong negative promotedAt -> 0');
  assert.equal(st.skills[0].demotedAt, 0, 'lifelong NaN demotedAt -> 0');
  assert.equal(st.dreams.length, 1, 'lifelong drops dream without id');
  assert.equal(st.dreams[0].confidence, 1, 'lifelong over-1 dream confidence -> 1');
  assert.equal(st.dreams[0].kind, 'micro', 'lifelong unknown dream kind -> micro');
  assert.deepEqual(st.dreams[0].seedIds, ['a'], 'lifelong drops non-string seed ids');
  assert.equal(st.sessions.length, 1, 'lifelong keeps session');
  assert.equal(st.sessions[0].phase, 'awake', 'lifelong unknown session phase -> awake');
  assert.equal(st.sessions[0].startedAt, 0, 'lifelong negative session start -> 0');
  assert.equal(st.sessions[0].endedAt, 0, 'lifelong NaN session end -> 0');
  assert.equal(st.lastInsight, '', 'lifelong non-string insight -> default');
  assert.equal(st.lastInsightConfidence, 1, 'lifelong over-1 insight confidence -> 1');
  assert.doesNotThrow(() => l.restore(hostile('skills')));
  l.restore(defaultLifelongDevelopment());
  assert.deepEqual(l.snapshot(), defaultLifelongDevelopment(), 'lifelong default round-trips');
}

// --- AutobiographicalNarrativeEngine ---------------------------------------
{
  const n = new AutobiographicalNarrativeEngine();
  n.restore({ version: 2, chapters: [{ id: 'c1', title: 5, evidenceIds: ['e', 5, ''], createdAt: -1, lastUpdatedAt: NaN, salience: 9 }, { title: 'no-id' }], continuity: NaN, lastUpdatedAt: -1, lastEvidenceKey: 5 });
  const st = n.snapshot();
  assert.equal(st.version, 2, 'narrative version pinned');
  assert.equal(st.chapters.length, 1, 'narrative drops chapter without id');
  assert.equal(st.chapters[0].title, '', 'narrative non-string title -> empty');
  assert.deepEqual(st.chapters[0].evidenceIds, ['e'], 'narrative drops non-string evidence ids');
  assert.equal(st.chapters[0].createdAt, 0, 'narrative negative createdAt -> 0');
  assert.equal(st.chapters[0].salience, 1, 'narrative over-1 salience -> 1');
  assert.equal(st.continuity, .5, 'narrative NaN continuity -> default');
  assert.equal(st.lastUpdatedAt, 0, 'narrative negative lastUpdatedAt -> 0');
  assert.equal(st.lastEvidenceKey, '', 'narrative non-string key -> default');
  assert.doesNotThrow(() => n.restore(hostile('chapters')));
  n.restore(defaultNarrative());
  assert.deepEqual(n.snapshot(), defaultNarrative(), 'narrative default round-trips');
}

// --- ValueEvolutionEngine ---------------------------------------------------
{
  const v = new ValueEvolutionEngine();
  v.restore({ version: 1, revisions: [{ id: 'r1', value: 'truth', before: 9, after: -1, delta: NaN, success: 9, surprise: -1, at: -1 }, { id: 'r2', value: 'bogus' }, { value: 'truth' }], evidenceStreaks: { truth: 9, x: NaN }, tentativePressure: { truth: -1, y: NaN }, protectedFloor: { truth: 9, autonomy: -1, bogus: 5 }, totalRevisionMagnitude: NaN, lastRevisionAt: -1 });
  const st = v.snapshot();
  assert.equal(st.revisions.length, 1, 'value-evolution drops invalid revisions');
  assert.equal(st.revisions[0].value, 'truth', 'value-evolution keeps valid value');
  assert.equal(st.revisions[0].before, 1, 'value-evolution over-1 before -> 1');
  assert.equal(st.revisions[0].after, 0, 'value-evolution negative after -> 0');
  assert.equal(st.revisions[0].delta, 0, 'value-evolution NaN delta -> 0');
  assert.equal(st.revisions[0].at, 0, 'value-evolution negative at -> 0');
  assert.equal(st.evidenceStreaks.truth, 9, 'value-evolution keeps finite streak');
  assert.equal(st.evidenceStreaks.x, undefined, 'value-evolution drops NaN streak');
  assert.equal(st.tentativePressure.y, undefined, 'value-evolution drops NaN pressure');
  assert.equal(st.protectedFloor.truth, 1, 'value-evolution over-1 floor -> 1');
  assert.equal(st.protectedFloor.autonomy, 0, 'value-evolution negative floor -> 0');
  assert.equal(st.protectedFloor.bogus, undefined, 'value-evolution drops unknown floor key');
  assert.equal(st.protectedFloor.care, .55, 'value-evolution preserves default floor');
  assert.equal(st.totalRevisionMagnitude, 0, 'value-evolution NaN magnitude -> 0');
  assert.equal(st.lastRevisionAt, 0, 'value-evolution negative lastRevisionAt -> 0');
  finite(st.protectedFloor.truth, 'value-evolution floor');
  assert.doesNotThrow(() => v.restore(hostile('revisions')));
  v.restore(defaultValueEvolution());
  assert.deepEqual(v.snapshot(), defaultValueEvolution(), 'value-evolution default round-trips');
}

// --- BehavioralInfluenceLedger ----------------------------------------------
{
  const b = new BehavioralInfluenceLedger();
  b.restore({ version: 1, observations: -1, positiveInfluences: NaN, meanInfluence01: 9, recent: [{ id: 'r1', sourceEventId: 5, sourceMemoryIds: ['m', 5], laterTick: -1, action: 5, baselineScore01: 9, observedScore01: -1, influence01: 9, evidence: 5, attribution01: -1, at: -1 }, { sourceEventId: 'x' }] });
  const st = b.snapshot();
  assert.equal(st.observations, 0, 'influence negative observations -> 0');
  assert.equal(st.positiveInfluences, 0, 'influence NaN positives -> 0');
  assert.equal(st.meanInfluence01, 1, 'influence over-1 mean -> 1');
  assert.equal(st.recent.length, 1, 'influence drops record without id');
  assert.equal(st.recent[0].sourceEventId, '', 'influence non-string sourceEventId -> empty');
  assert.deepEqual(st.recent[0].sourceMemoryIds, ['m'], 'influence drops non-string memory ids');
  assert.equal(st.recent[0].laterTick, 0, 'influence negative laterTick -> 0');
  assert.equal(st.recent[0].baselineScore01, 1, 'influence over-1 baseline -> 1');
  assert.equal(st.recent[0].observedScore01, 0, 'influence negative observed -> 0');
  assert.equal(st.recent[0].influence01, 1, 'influence over-1 influence -> 1');
  assert.equal(st.recent[0].attribution01, 0, 'influence negative attribution -> 0');
  assert.equal(st.recent[0].at, 0, 'influence negative at -> 0');
  assert.doesNotThrow(() => b.restore(hostile('recent')));
}

console.log('WORKPASS72_LIFELONG_NARRATIVE_VALUE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['LifelongDevelopmentSystem', 'AutobiographicalNarrativeEngine', 'ValueEvolutionEngine', 'BehavioralInfluenceLedger'] }));
