import assert from 'node:assert/strict';
import { ExternalEvidenceTrustEngine, defaultExternalEvidenceTrust } from '../src/organism/system/ExternalEvidenceTrust.ts';
import { LongHorizonPredictionBenchmark, defaultLongHorizonPrediction } from '../src/organism/system/LongHorizonPredictionBenchmark.ts';
import { P77RealityExperimentOS, defaultP77 } from '../src/organism/system/P77RealityExperimentOS.ts';
import { P82RealityProgressController, defaultP82 } from '../src/organism/system/P82RealityProgressController.ts';

/**
 * WorkPass72 — external evidence / long-horizon prediction / reality-grounded
 * progress restore integrity. Each owner merged a persisted snapshot with a
 * bare spread, letting NaN reach trust scores, corroboration counts, horizon
 * error maps, capability gains and progress trends.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);
const hostile = (k) => ({ get [k]() { throw new Error('hostile'); } });

// --- ExternalEvidenceTrustEngine --------------------------------------------
{
  const e = new ExternalEvidenceTrustEngine();
  e.restore({ version: 1, records: [{ id: 'r1', claimKey: 5, source: 5, sourceClass: 'bogus', independenceKey: 5, confidence01: 9, trust01: NaN, corroborations: -1, independentSources: NaN, contradictions: -1, status: 'bogus', firstSeenAt: -1, lastSeenAt: Date.now(), evidenceIds: ['e', 5, '', 'x'.repeat(200)] }, { claimKey: 'no-id' }], acceptedCount: -1, contestedCount: NaN, expiredCount: -1, meanTrust01: 9 });
  const st = e.snapshot();
  assert.equal(st.records.length, 1, 'evidence drops record without id');
  assert.equal(st.records[0].claimKey, '', 'evidence non-string claimKey -> empty');
  assert.equal(st.records[0].sourceClass, 'unknown', 'evidence unknown sourceClass -> unknown');
  assert.equal(st.records[0].confidence01, 1, 'evidence over-1 confidence -> 1');
  assert.equal(st.records[0].trust01, .4, 'evidence NaN trust -> unknown-source base');
  assert.equal(st.records[0].corroborations, 0, 'evidence negative corroborations -> 0');
  assert.equal(st.records[0].contradictions, 0, 'evidence negative contradictions -> 0');
  assert.equal(st.records[0].status, 'candidate', 'evidence unknown status -> candidate');
  assert.equal(st.records[0].firstSeenAt, 0, 'evidence negative firstSeenAt -> 0');
  assert.ok(st.records[0].lastSeenAt > 0, 'evidence recent lastSeenAt preserved');
  assert.equal(st.records[0].evidenceIds.length, 1, 'evidence drops non-string/oversize ids');
  finite(st.meanTrust01, 'evidence meanTrust');
  assert.doesNotThrow(() => e.restore(hostile('records')));
  const eDefault = defaultExternalEvidenceTrust();

  e.restore(eDefault);
  assert.deepEqual(e.snapshot(), eDefault, 'evidence default round-trips');
}

// --- LongHorizonPredictionBenchmark -----------------------------------------
{
  const l = new LongHorizonPredictionBenchmark();
  l.restore({ version: 2, samples: -1, resolved: NaN, meanErrorByHorizon: { '1': 9, '4': -1, '12': NaN, bogus: 5 }, baselineErrorByHorizon: { '1': NaN }, improvementByHorizon: { '1': 9 }, pending: [{ id: 'p1', createdTick: -1, horizon: 0, predicted01: 9, actual01: -1, error01: NaN, resolvedAt: -1 }, { createdTick: 1 }], recent: [{ id: 'r1', createdTick: -1, horizon: -1, predicted01: NaN }], lastAt: -1 });
  const st = l.snapshot();
  assert.equal(st.samples, 0, 'horizon negative samples -> 0');
  assert.equal(st.resolved, 0, 'horizon NaN resolved -> 0');
  assert.equal(st.meanErrorByHorizon['1'], 1, 'horizon over-1 mean error -> 1');
  assert.equal(st.meanErrorByHorizon['4'], 0, 'horizon negative mean error -> 0');
  assert.equal(st.meanErrorByHorizon['12'], .5, 'horizon NaN mean error -> default');
  assert.equal(st.meanErrorByHorizon.bogus, undefined, 'horizon drops unknown key');
  assert.equal(st.baselineErrorByHorizon['1'], .5, 'horizon NaN baseline -> default');
  assert.equal(st.improvementByHorizon['1'], 1, 'horizon over-1 improvement -> 1');
  assert.equal(st.pending.length, 1, 'horizon drops sample without id');
  assert.equal(st.pending[0].createdTick, 0, 'horizon negative createdTick -> 0');
  assert.equal(st.pending[0].horizon, 1, 'horizon zero horizon -> 1');
  assert.equal(st.pending[0].predicted01, 1, 'horizon over-1 prediction -> 1');
  assert.equal(st.pending[0].actual01, 0, 'horizon negative actual -> 0');
  assert.equal(st.pending[0].error01, 0, 'horizon NaN error -> 0');
  assert.equal(st.pending[0].resolvedAt, 0, 'horizon negative resolvedAt -> 0');
  assert.equal(st.recent[0].predicted01, 0, 'horizon NaN prediction -> 0');
  assert.equal(st.lastAt, 0, 'horizon negative lastAt -> 0');
  assert.doesNotThrow(() => l.restore(hostile('pending')));
  const lDefault = defaultLongHorizonPrediction();

  l.restore(lDefault);
  assert.deepEqual(l.snapshot(), lDefault, 'horizon default round-trips');
}

// --- P77RealityExperimentOS -------------------------------------------------
{
  const p = new P77RealityExperimentOS();
  p.restore({ version: 1, observations: -1, experiments: NaN, realOutcomes: -1, accepted: NaN, rejected: -1, unresolved: NaN, capability01: 9, realityGap01: -1, evidenceQuality01: NaN, complexity01: 9, history: [{ tick: -1, capabilityId: 'c1', delta01: 9, evidence: 'bogus' }, { tick: 1, capabilityId: 'c2', delta01: -9, evidence: 'device' }, { tick: 1 }] });
  const st = p.snapshot();
  assert.equal(st.observations, 0, 'p77 negative observations -> 0');
  assert.equal(st.experiments, 0, 'p77 NaN experiments -> 0');
  assert.equal(st.capability01, 1, 'p77 over-1 capability -> 1');
  assert.equal(st.realityGap01, 0, 'p77 negative realityGap -> 0');
  assert.equal(st.evidenceQuality01, 0, 'p77 NaN evidenceQuality -> 0');
  assert.equal(st.complexity01, 1, 'p77 over-1 complexity -> 1');
  assert.equal(st.history.length, 2, 'p77 drops history entry without capabilityId');
  assert.equal(st.history[0].tick, 0, 'p77 negative tick -> 0');
  assert.equal(st.history[0].delta01, 1, 'p77 over-1 delta -> 1');
  assert.equal(st.history[0].evidence, 'none', 'p77 unknown evidence -> none');
  assert.equal(st.history[1].delta01, -1, 'p77 negative delta preserved to -1');
  assert.doesNotThrow(() => p.restore(hostile('history')));
  const pDefault = defaultP77();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p77 default round-trips');
}

// --- P82RealityProgressController -------------------------------------------
{
  const p = new P82RealityProgressController();
  p.restore({ version: 1, observations: -1, evidenceCount: NaN, capability01: 9, complexity01: -1, evidenceQuality01: NaN, complexityAdjustedProgress01: 9, realityGap01: -1, progressTrend01: NaN, lastExternalTick: -1, recentProgress: [9, -1, NaN, .5] });
  const st = p.snapshot();
  assert.equal(st.observations, 0, 'p82 negative observations -> 0');
  assert.equal(st.evidenceCount, 0, 'p82 NaN evidenceCount -> 0');
  assert.equal(st.capability01, 1, 'p82 over-1 capability -> 1');
  assert.equal(st.complexity01, 0, 'p82 negative complexity -> 0');
  assert.equal(st.evidenceQuality01, 0, 'p82 NaN evidenceQuality -> 0');
  assert.equal(st.complexityAdjustedProgress01, 1, 'p82 over-1 adjusted progress -> 1');
  assert.equal(st.realityGap01, 0, 'p82 negative realityGap -> 0');
  assert.equal(st.progressTrend01, .5, 'p82 NaN trend -> default');
  assert.equal(st.lastExternalTick, 0, 'p82 negative lastExternalTick -> 0');
  assert.deepEqual(st.recentProgress, [1, 0, 0, .5], 'p82 clamps progress history');
  assert.doesNotThrow(() => p.restore(hostile('recentProgress')));
  const pDefault = defaultP82();

  p.restore(pDefault);
  assert.deepEqual(p.snapshot(), pDefault, 'p82 default round-trips');
}

console.log('WORKPASS72_EVIDENCE_HORIZON_PROGRESS_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['ExternalEvidenceTrustEngine', 'LongHorizonPredictionBenchmark', 'P77RealityExperimentOS', 'P82RealityProgressController'] }));
