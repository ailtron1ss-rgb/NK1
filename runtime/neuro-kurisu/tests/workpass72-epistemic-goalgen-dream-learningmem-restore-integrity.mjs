import assert from 'node:assert/strict';
import { P65EpistemicLedger, defaultP65 } from '../src/organism/memory/P65EpistemicLedger.ts';
import { P67AutonomousGoalGenesis, defaultP67 } from '../src/organism/developmental/P67AutonomousGoalGenesis.ts';
import { MicroDreamEngine, defaultMicroDream } from '../src/organism/developmental/MicroDreamEngine.ts';
import { AutonomousLearningMemoryGovernor, defaultAutonomousLearningMemory } from '../src/organism/system/AutonomousLearningMemoryGovernor.ts';

/**
 * WorkPass72 — epistemic ledger / goal genesis / micro-dream / learning-memory
 * governor restore integrity. Each owner merged a persisted snapshot with a
 * bare spread or verbatim clone, letting NaN reach claim confidence, proposal
 * urgency, dream confidence and learning-memory utility.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- P65EpistemicLedger -----------------------------------------------------
{
  const p = new P65EpistemicLedger();
  p.restore({ version: 2, claims: -1, observations: NaN, inferences: -1, beliefs: NaN, predictions: -1, counterfactuals: NaN, resolvedPredictions: -1, meanConfidence01: 9, meanPredictionError01: -1, unresolved: NaN, claimsData: [{ id: 'c1', tick: -1, at: -1, kind: 'bogus', content: 5, confidence01: 9, source: 5, resolved: 'yes', parentIds: ['p', 5], predicted01: NaN, actual01: -1, error01: 9, lastSupportedAt: -1, supportCount: -1, status: 'bogus', provenance: { sourceId: 's', sourceKind: 'k', capturedAt: 1, evidenceClass: 'direct-observation', contentFingerprint: 'a'.repeat(64) } }, { content: 'no-id' }], recentIds: ['a', 5, ''], beliefHalfLifeMs: -1, expiredBeliefs: -1, staleBeliefs: NaN });
  const st = p.snapshot();
  assert.equal(st.claimsData.length, 1, 'p65 drops claim without id');
  assert.equal(st.claimsData[0].kind, 'observation', 'p65 unknown kind -> observation');
  assert.equal(st.claimsData[0].confidence01, 1, 'p65 over-1 confidence -> 1');
  assert.equal(st.claimsData[0].resolved, false, 'p65 non-boolean resolved -> false');
  assert.deepEqual(st.claimsData[0].parentIds, ['p'], 'p65 drops non-string parents');
  assert.equal(st.claimsData[0].predicted01, 0, 'p65 NaN predicted -> 0');
  assert.equal(st.claimsData[0].actual01, 0, 'p65 negative actual -> 0');
  assert.equal(st.claimsData[0].error01, 1, 'p65 over-1 error -> 1');
  assert.equal(st.claimsData[0].at, 0, 'p65 negative at -> 0');
  assert.equal(st.claimsData[0].lastSupportedAt, 0, 'p65 negative lastSupportedAt -> 0');
  assert.equal(st.claimsData[0].supportCount, 0, 'p65 negative supportCount -> 0');
  assert.equal(st.claimsData[0].status, 'active', 'p65 unknown status -> active');
  assert.equal(st.claimsData[0].provenance.sourceId, 's', 'p65 keeps valid provenance');
  assert.deepEqual(st.recentIds, ['a'], 'p65 drops non-string/empty ids');
  assert.equal(st.meanConfidence01, 1, 'p65 over-1 mean confidence -> 1');
  assert.equal(st.meanPredictionError01, 0, 'p65 negative mean error -> 0');
  assert.equal(st.beliefHalfLifeMs, 1, 'p65 non-positive half life -> 1');
  assert.doesNotThrow(() => p.restore(hostile('claimsData')));
  p.restore(defaultP65());
  assert.deepEqual(p.snapshot(), defaultP65(), 'p65 default round-trips');
}

// --- P67AutonomousGoalGenesis -----------------------------------------------
{
  const p = new P67AutonomousGoalGenesis();
  p.restore({ version: 1, cycles: -1, proposals: NaN, promoted: -1, rejected: NaN, cooldowns: -1, lastGeneratedAt: -1, generatedIds: ['g', 5], history: [{ id: 'h1', tick: -1, at: -1, title: 5, reason: 5, source: 'bogus', importance: 9, urgency: -1, confidence: NaN, parentId: 5, valueFocus: 5, valueAlignment01: 9 }, { title: 'no-id' }] });
  const st = p.snapshot();
  assert.equal(st.cycles, 0, 'p67 negative cycles -> 0');
  assert.equal(st.proposals, 0, 'p67 NaN proposals -> 0');
  assert.equal(st.lastGeneratedAt, 0, 'p67 negative lastGeneratedAt -> 0');
  assert.deepEqual(st.generatedIds, ['g'], 'p67 drops non-string ids');
  assert.equal(st.history.length, 1, 'p67 drops candidate without id');
  assert.equal(st.history[0].source, 'intrinsic', 'p67 unknown source -> intrinsic');
  assert.equal(st.history[0].importance, 1, 'p67 over-1 importance -> 1');
  assert.equal(st.history[0].urgency, 0, 'p67 negative urgency -> 0');
  assert.equal(st.history[0].confidence, .5, 'p67 NaN confidence -> .5');
  assert.equal(st.history[0].parentId, undefined, 'p67 drops non-string parentId');
  assert.equal(st.history[0].valueFocus, undefined, 'p67 drops non-string valueFocus');
  assert.equal(st.history[0].valueAlignment01, 1, 'p67 over-1 value alignment -> 1');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  p.restore(defaultP67());
  assert.deepEqual(p.snapshot(), defaultP67(), 'p67 default round-trips');
}

// --- MicroDreamEngine -------------------------------------------------------
{
  const m = new MicroDreamEngine();
  m.restore({ version: 2, cycles: -1, dreams: [{ id: 'd1', at: -1, question: 5, simulation: 5, confidence: 9, kind: 'association', sourceMemoryIds: ['a', 5], sharedTerms: ['t', 5], validationStatus: 'bogus' }, { question: 'no-id' }, null], associationCandidates: -1, deduplicatedAssociations: NaN, lastAssociativeSweepAt: -1 });
  const st = m.snapshot();
  assert.equal(st.dreams.length, 1, 'dream drops entry without id');
  assert.equal(st.dreams[0].at, 0, 'dream negative at -> 0');
  assert.equal(st.dreams[0].question, '', 'dream non-string question -> empty');
  assert.equal(st.dreams[0].simulation, '', 'dream non-string simulation -> empty');
  assert.equal(st.dreams[0].confidence, 1, 'dream over-1 confidence -> 1');
  assert.equal(st.dreams[0].kind, 'association', 'dream keeps association kind');
  assert.deepEqual(st.dreams[0].sourceMemoryIds, ['a'], 'dream drops non-string memory ids');
  assert.deepEqual(st.dreams[0].sharedTerms, ['t'], 'dream drops non-string terms');
  assert.equal(st.dreams[0].validationStatus, 'candidate', 'dream unknown status -> candidate');
  assert.equal(st.associationCandidates, 0, 'dream negative candidates -> 0');
  assert.equal(st.deduplicatedAssociations, 0, 'dream NaN dedup -> 0');
  assert.equal(st.lastAssociativeSweepAt, 0, 'dream negative sweep -> 0');
  assert.doesNotThrow(() => m.restore(hostile('dreams')));
  m.restore(defaultMicroDream());
  assert.deepEqual(m.snapshot(), defaultMicroDream(), 'dream default round-trips');
}

// --- AutonomousLearningMemoryGovernor ---------------------------------------
{
  const g = new AutonomousLearningMemoryGovernor();
  g.restore({ version: 1, cycles: -1, stored: NaN, retrieved: -1, pruned: NaN, consolidated: -1, meanUtility01: 9, meanRetention01: -1, learningPressure01: NaN, items: [{ id: 'i1', value: 9, utility01: 9, relevance01: -1, uncertainty01: NaN, lastAt: -1, uses: -1, source: 5 }, { value: 1 }] });
  const st = g.snapshot();
  assert.equal(st.cycles, 0, 'almg negative cycles -> 0');
  assert.equal(st.stored, 0, 'almg NaN stored -> 0');
  assert.equal(st.meanUtility01, 1, 'almg over-1 utility -> 1');
  assert.equal(st.meanRetention01, 0, 'almg negative retention -> 0');
  assert.equal(st.learningPressure01, .32, 'almg NaN pressure -> default');
  assert.equal(st.items.length, 1, 'almg drops item without id');
  assert.equal(st.items[0].value, 9, 'almg preserves finite raw value');
  assert.equal(st.items[0].utility01, 1, 'almg over-1 item utility -> 1');
  assert.equal(st.items[0].relevance01, 0, 'almg negative relevance -> 0');
  assert.equal(st.items[0].uncertainty01, 0, 'almg NaN uncertainty -> 0');
  assert.equal(st.items[0].lastAt, 0, 'almg negative lastAt -> 0');
  assert.equal(st.items[0].uses, 0, 'almg negative uses -> 0');
  assert.equal(st.items[0].source, '', 'almg non-string source -> empty');
  assert.doesNotThrow(() => g.restore(hostile('items')));
  g.restore(defaultAutonomousLearningMemory());
  assert.deepEqual(g.snapshot(), defaultAutonomousLearningMemory(), 'almg default round-trips');
}

console.log('WORKPASS72_EPISTEMIC_GOALGEN_DREAM_LEARNINGMEM_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P65EpistemicLedger', 'P67AutonomousGoalGenesis', 'MicroDreamEngine', 'AutonomousLearningMemoryGovernor'] }));
