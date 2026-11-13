import assert from 'node:assert/strict';
import { B336ProjectCausalOwnershipGate, defaultB336State } from '../src/organism/system/B336ProjectCausalOwnershipGate.ts';
import { DevelopmentalForks, defaultDevelopmentalForks } from '../src/organism/developmental/DevelopmentalForks.ts';
import { CommitmentRepair, defaultCommitmentRepair } from '../src/organism/developmental/CommitmentRepair.ts';
import { RelationshipSelf, defaultRelationshipSelf } from '../src/organism/developmental/RelationshipSelf.ts';
import { LongTermSocialMind, defaultLongTermSocialMind } from '../src/organism/developmental/LongTermSocialMind.ts';
import { SocialWorldModel } from '../src/organism/cognition/SocialWorldModel.ts';
import { FutureSimulator, defaultFutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { ModelSwitchContinuity, defaultModelSwitchContinuity } from '../src/organism/developmental/ModelSwitchContinuity.ts';
import { TemporalMemoryCompressor, defaultTemporalMemoryCompression } from '../src/organism/developmental/TemporalMemoryCompressor.ts';
import { PredictionLedger } from '../src/organism/system/PredictionLedger.ts';

/**
 * WorkPass72 — developmental / social / system restore integrity. These owners
 * merged persisted snapshots with a bare spread (or cloned raw rows), so NaN,
 * negative counts, unknown enum members and malformed nested records reached
 * live social, developmental and prediction state.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = { get x() { throw new Error('hostile'); } };

// --- B336ProjectCausalOwnershipGate ----------------------------------------
{
  const g = new B336ProjectCausalOwnershipGate();
  g.restore({ observations: NaN, projectActiveCycles: -4, ablationComparisons: Infinity, changedTopAction: -1, meanProjectContribution01: 7, lastFullAction: 42, lastAblatedAction: null, eligible: true, reason: 9 });
  const st = g.snapshot();
  assert.equal(st.observations, 0, 'b336 NaN observations -> 0');
  assert.equal(st.projectActiveCycles, 0, 'b336 negative cycles -> 0');
  assert.equal(st.ablationComparisons, 0, 'b336 Infinity -> 0');
  assert.equal(st.changedTopAction, 0, 'b336 negative changed -> 0');
  assert.equal(st.meanProjectContribution01, 1, 'b336 over-1 mean -> 1');
  assert.equal(st.lastFullAction, null, 'b336 non-string action -> null');
  assert.equal(st.reason, 'insufficient-evidence', 'b336 non-string reason -> default');
  finite(st.meanProjectContribution01, 'b336 mean');
  assert.doesNotThrow(() => g.restore(hostile));
  const gDefault = defaultB336State();

  g.restore(gDefault);
  assert.deepEqual(g.snapshot(), gDefault, 'b336 default round-trips');
}

// --- DevelopmentalForks -----------------------------------------------------
{
  const f = new DevelopmentalForks();
  f.restore({ forks: [{ id: 'a', at: NaN, label: 1, counterfactual: null, expectedDifference: 'x' }, { at: 1 }, null, 'junk', { id: 'b', at: -5, label: 'ok', counterfactual: 'c', expectedDifference: 'd' }], version: 99 });
  const st = f.snapshot();
  assert.equal(st.version, 1, 'forks version pinned');
  assert.equal(st.forks.length, 2, 'forks drop malformed rows');
  assert.equal(st.forks[0].id, 'a', 'forks keep valid id');
  assert.equal(st.forks[0].at, 0, 'forks NaN at -> 0');
  assert.equal(st.forks[0].label, '', 'forks non-string label -> empty');
  assert.equal(st.forks[1].at, 0, 'forks negative at -> 0');
  assert.doesNotThrow(() => f.restore({ get forks() { throw new Error('hostile'); } }));
  const fDefault = defaultDevelopmentalForks();

  f.restore(fDefault);
  assert.deepEqual(f.snapshot(), fDefault, 'forks default round-trips');
}

// --- CommitmentRepair -------------------------------------------------------
{
  const r = new CommitmentRepair();
  r.restore({ records: [{ id: 'r1', at: NaN, commitment: 'x', stage: 'bogus', reason: 5 }, { id: 'r2', at: 3, commitment: 'y', stage: 'revise', reason: 'ok' }, { commitment: 'z' }] });
  const st = r.snapshot();
  assert.equal(st.records.length, 2, 'repair drops rows without id');
  assert.equal(st.records[0].stage, 'acknowledge', 'repair unknown stage -> acknowledge');
  assert.equal(st.records[0].at, 0, 'repair NaN at -> 0');
  assert.equal(st.records[0].reason, '', 'repair non-string reason -> empty');
  assert.equal(st.records[1].stage, 'revise', 'repair valid stage preserved');
  assert.doesNotThrow(() => r.restore({ get records() { throw new Error('hostile'); } }));
  const rDefault = defaultCommitmentRepair();

  r.restore(rDefault);
  assert.deepEqual(r.snapshot(), rDefault, 'repair default round-trips');
}

// --- RelationshipSelf -------------------------------------------------------
{
  const rs = new RelationshipSelf();
  rs.restore({ models: [{ person: 'a', trust: NaN, guardedness: 9, warmth: -1, predictability: Infinity, sharedProjects: ['x', 5], openCommitments: 'no', updatedAt: -2 }, { role: 'x' }, null] });
  const st = rs.snapshot();
  assert.equal(st.models.length, 1, 'relationship drops rows without person');
  const m = st.models[0];
  assert.equal(m.trust, .5, 'relationship NaN trust -> .5');
  assert.equal(m.guardedness, 1, 'relationship over-1 -> 1');
  assert.equal(m.warmth, 0, 'relationship negative -> 0');
  finite(m.predictability, 'relationship predictability');
  assert.equal(m.predictability, .5, 'relationship Infinity -> .5');
  assert.deepEqual(m.sharedProjects, ['x'], 'relationship drops non-string project');
  assert.deepEqual(m.openCommitments, [], 'relationship non-array commitments -> []');
  assert.equal(m.updatedAt, 0, 'relationship negative updatedAt -> 0');
  assert.doesNotThrow(() => rs.restore({ get models() { throw new Error('hostile'); } }));
  const rsDefault = defaultRelationshipSelf();

  rs.restore(rsDefault);
  assert.deepEqual(rs.snapshot(), rsDefault, 'relationship default round-trips');
}

// --- LongTermSocialMind -----------------------------------------------------
{
  const s = new LongTermSocialMind();
  s.restore({ relationships: { models: [{ person: 'p', trust: NaN }] }, predictions: [{ agent: 'p', predictedValence: 9, confidence: NaN, evidence: ['a', 3], updatedAt: -1 }, { predictedNeed: 'x' }], sharedProjects: { p: ['a', 'a', 4] }, openCommitments: { p: 'no' } });
  const st = s.snapshot();
  assert.equal(st.relationships.models.length, 1, 'social sanitizes nested relationships');
  assert.equal(st.relationships.models[0].trust, .5, 'social nested NaN trust -> .5');
  assert.equal(st.predictions.length, 1, 'social drops predictions without agent');
  assert.equal(st.predictions[0].predictedValence, 1, 'social over-1 valence -> 1');
  assert.equal(st.predictions[0].confidence, .5, 'social NaN confidence -> .5');
  assert.deepEqual(st.predictions[0].evidence, ['a'], 'social drops non-string evidence');
  assert.equal(st.predictions[0].updatedAt, 0, 'social negative updatedAt -> 0');
  assert.deepEqual(st.sharedProjects.p, ['a'], 'social dedups shared projects');
  assert.deepEqual(st.openCommitments, {}, 'social drops non-array commitments');
  assert.doesNotThrow(() => s.restore({ get predictions() { throw new Error('hostile'); } }));
  const sDefault = defaultLongTermSocialMind();

  s.restore(sDefault);
  assert.deepEqual(s.snapshot(), sDefault, 'social default round-trips');
}

// --- SocialWorldModel -------------------------------------------------------
{
  const sw = new SocialWorldModel();
  sw.restore([{ agent: 'a', predictedValence: 9, confidence: NaN, evidence: ['x', 2], updatedAt: -1 }, { predictedNeed: 'z' }, null]);
  const rows = sw.snapshot();
  assert.equal(rows.length, 1, 'socialworld drops rows without agent');
  assert.equal(rows[0].predictedValence, 1, 'socialworld over-1 valence -> 1');
  assert.equal(rows[0].confidence, .5, 'socialworld NaN confidence -> .5');
  assert.deepEqual(rows[0].evidence, ['x'], 'socialworld drops non-string evidence');
  assert.doesNotThrow(() => sw.restore([{ get agent() { throw new Error('hostile'); } }]));
  sw.restore(undefined);
  assert.deepEqual(sw.snapshot(), [], 'socialworld undefined -> empty');
}

// --- FutureSimulator --------------------------------------------------------
{
  const fs = new FutureSimulator();
  fs.restore({ runs: NaN, last: [{ action: 'a', reward: NaN }, { reward: 1 }, null], version: 5 });
  const st = fs.snapshot();
  assert.equal(st.runs, 0, 'simulator NaN runs -> 0');
  assert.equal(st.last.length, 2, 'simulator keeps object steps');
  assert.equal(st.last[0].reward, 0, 'simulator NaN reward -> 0');
  assert.equal(st.last[1].action, '', 'simulator missing action -> empty');
  assert.doesNotThrow(() => fs.restore({ get last() { throw new Error('hostile'); } }));
  const fsDefault = defaultFutureSimulator();

  fs.restore(fsDefault);
  assert.deepEqual(fs.snapshot(), fsDefault, 'simulator default round-trips');
}

// --- ModelSwitchContinuity --------------------------------------------------
{
  const mc = new ModelSwitchContinuity();
  mc.restore({ currentBackend: 7, switches: -3, continuityScore: 9, lastAt: NaN, history: ['a', 5, null], version: 2 });
  const st = mc.snapshot();
  assert.equal(st.currentBackend, 'local-fallback', 'switch non-string backend -> default');
  assert.equal(st.switches, 0, 'switch negative switches -> 0');
  assert.equal(st.continuityScore, 1, 'switch over-1 continuity -> 1');
  assert.equal(st.lastAt, 0, 'switch NaN lastAt -> 0');
  assert.deepEqual(st.history, ['a'], 'switch drops non-string history');
  assert.doesNotThrow(() => mc.restore({ get history() { throw new Error('hostile'); } }));
  const mcDefault = defaultModelSwitchContinuity();

  mc.restore(mcDefault);
  assert.deepEqual(mc.snapshot(), mcDefault, 'switch default round-trips');
}

// --- TemporalMemoryCompressor ----------------------------------------------
{
  const tc = new TemporalMemoryCompressor();
  tc.restore({ inputEvents: -1, capsulesCreated: NaN, rawCompactions: Infinity, lastCompactionAt: -9, hotWindowSize: 0, capsules: [{ id: 'c1', tier: 'bogus', eventCount: NaN, highlights: ['h', 2], provenanceClasses: 'no', correctionCount: -3, correctionLinks: [{ id: 'a', corrects: 'b' }, { id: 'x' }, 5], evidenceHashes: ['e'], sourceDiversity01: 9, startedAt: -1 }, { tier: 'daily' }, null] });
  const st = tc.snapshot();
  assert.equal(st.inputEvents, 0, 'compress negative input -> 0');
  assert.equal(st.capsulesCreated, 0, 'compress NaN created -> 0');
  assert.equal(st.rawCompactions, 0, 'compress Infinity -> 0');
  assert.equal(st.lastCompactionAt, 0, 'compress negative last -> 0');
  assert.equal(st.hotWindowSize, 1, 'compress hotWindowSize floor -> 1');
  assert.equal(st.capsules.length, 1, 'compress drops capsules without id');
  const cap = st.capsules[0];
  assert.equal(cap.tier, 'daily', 'compress unknown tier -> daily');
  assert.equal(cap.eventCount, 0, 'compress NaN eventCount -> 0');
  assert.deepEqual(cap.highlights, ['h'], 'compress drops non-string highlight');
  assert.deepEqual(cap.provenanceClasses, [], 'compress non-array provenance -> []');
  assert.equal(cap.correctionCount, 0, 'compress negative correctionCount -> 0');
  assert.equal(cap.correctionLinks.length, 1, 'compress keeps well-formed correction links');
  assert.equal(cap.sourceDiversity01, 1, 'compress over-1 diversity -> 1');
  assert.equal(cap.startedAt, 0, 'compress negative startedAt -> 0');
  assert.doesNotThrow(() => tc.restore({ get capsules() { throw new Error('hostile'); } }));
  const tcDefault = defaultTemporalMemoryCompression();

  tc.restore(tcDefault);
  assert.deepEqual(tc.snapshot(), tcDefault, 'compress default round-trips');
}

// --- PredictionLedger -------------------------------------------------------
{
  const pl = new PredictionLedger();
  pl.restore({ capacity: NaN, samples: -5, meanAbsoluteError01: 9, calibrationGap01: -1, lastResolvedAt: NaN, bestKindError01: { reward: NaN, self: 5, bogus: 1 }, pending: [{ id: 'p1', kind: 'bogus', predicted01: NaN, confidence01: 2, at: -1, tick: -2 }, { predicted01: 1 }], resolved: [{ id: 'r1', actual01: 9, error01: -1, resolvedAt: -1 }] });
  const st = pl.snapshot();
  assert.equal(st.capacity, 256, 'ledger NaN capacity -> default');
  assert.equal(st.samples, 0, 'ledger negative samples -> 0');
  assert.equal(st.meanAbsoluteError01, 1, 'ledger over-1 mae -> 1');
  assert.equal(st.calibrationGap01, 0, 'ledger negative gap -> 0');
  assert.equal(st.lastResolvedAt, 0, 'ledger NaN lastResolvedAt -> 0');
  assert.equal(st.pending.length, 1, 'ledger drops pending without id');
  assert.equal(st.pending[0].kind, 'reward', 'ledger unknown kind -> reward');
  assert.equal(st.pending[0].predicted01, .5, 'ledger NaN predicted -> .5');
  assert.equal(st.pending[0].confidence01, 1, 'ledger over-1 confidence -> 1');
  assert.equal(st.pending[0].at, 0, 'ledger negative at -> 0');
  assert.equal(st.pending[0].tick, 0, 'ledger negative tick -> 0');
  assert.equal(st.resolved[0].actual01, 1, 'ledger over-1 actual -> 1');
  assert.equal(st.resolved[0].error01, 0, 'ledger negative error -> 0');
  finite(st.bestKindError01.reward, 'ledger reward map');
  assert.equal(st.bestKindError01.reward, .5, 'ledger NaN kind map -> .5');
  assert.equal(st.bestKindError01.self, 1, 'ledger over-1 kind map -> 1');
  assert.ok(!('bogus' in st.bestKindError01), 'ledger drops unknown kind key');
  assert.doesNotThrow(() => pl.restore({ get pending() { throw new Error('hostile'); } }));
  const fresh = new PredictionLedger();
  pl.restore(fresh.snapshot());
  assert.deepEqual(pl.snapshot(), fresh.snapshot(), 'ledger default round-trips');
}

console.log('WORKPASS72_DEVELOPMENTAL_SOCIAL_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['B336ProjectCausalOwnershipGate', 'DevelopmentalForks', 'CommitmentRepair', 'RelationshipSelf', 'LongTermSocialMind', 'SocialWorldModel', 'FutureSimulator', 'ModelSwitchContinuity', 'TemporalMemoryCompressor', 'PredictionLedger'] }));
