import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const source = new EmotionAppraisalEngine();
source.observeInteroception({
  energy01: .91, thermal01: .12, capacity01: .88, load01: .14, homeostaticPressure01: .1,
});
const episode = source.appraise({
  tick: 17, at: 17001, novelty01: .82, uncertainty01: .38, predictionError01: .12,
  homeostaticPressure01: .1, success01: .9, goalPressure01: .4, goalCongruence01: .88,
  controllability01: .76, selfRelevance01: .7,
});
const feeling = source.inferFeeling(episode, {
  energy01: .91, cognitiveLoad01: .14, uncertainty01: .38, selfFocus01: .7,
});
source.recordOutcome({ action: 'rest', success01: .9, surprise01: .1, regulationCost01: .2 });
const canonical = source.snapshot();
const validEpisode = canonical.history[0];
const validFeeling = canonical.feelings[0];

let accessorInvoked = false;
const accessorEpisode = {};
Object.defineProperty(accessorEpisode, 'id', {
  enumerable: true,
  get() {
    accessorInvoked = true;
    return validEpisode.id;
  },
});
const inheritedEpisode = Object.assign(
  Object.create({ trusted: true }),
  structuredClone(validEpisode),
);
const proxyEpisode = new Proxy(structuredClone(validEpisode), {});
const duplicateEpisode = { ...structuredClone(validEpisode), label: 'anger' };
const unknownLabelEpisode = { ...structuredClone(validEpisode), id: 'unknown-label', label: 'elated' };
const brokenAppraisalEpisode = {
  ...structuredClone(validEpisode),
  id: 'broken-appraisal',
  appraisal: { ...validEpisode.appraisal, novelty01: Number.NaN },
};
const sparseHistory = new Array(7);
sparseHistory[0] = structuredClone(validEpisode);
sparseHistory[1] = duplicateEpisode;
sparseHistory[2] = unknownLabelEpisode;
sparseHistory[3] = accessorEpisode;
sparseHistory[4] = inheritedEpisode;
sparseHistory[5] = proxyEpisode;
sparseHistory[6] = brokenAppraisalEpisode;

const corrupt = {
  ...structuredClone(canonical),
  version: 999,
  episodes: 'many',
  lastTick: '18',
  lastAt: Number.POSITIVE_INFINITY,
  lastLabel: 'invented',
  meanArousal01: Number.NaN,
  meanValence01: '0.99',
  meanStress01: Number.POSITIVE_INFINITY,
  meanAttentionCapture01: -0.4,
  history: sparseHistory,
  feelings: [
    structuredClone(validFeeling),
    { ...structuredClone(validFeeling), id: 'orphan-feeling', causeEmotionId: 'missing-emotion' },
    { ...structuredClone(validFeeling), id: 'invalid-intensity', intensity01: Number.NaN },
  ],
  interoception: {
    ...structuredClone(canonical.interoception),
    cycles: '12',
    meanMismatch01: Number.NaN,
    lastMismatch01: 1.4,
    regulationPressure01: -0.2,
    stability01: .81,
    recovery01: .73,
    predictionCalibration01: .66,
    lastObserved: {
      energy01: Number.POSITIVE_INFINITY,
      thermal01: '0.9',
      capacity01: -0.3,
      load01: .8,
    },
    predicted: {
      energy01: .7,
      thermal01: .4,
      capacity01: Number.NaN,
      load01: 1.2,
    },
  },
  outcomes: {
    rest: { attempts: 1.5, meanSuccess01: .8, meanSurprise01: .1, meanBenefit01: .9 },
    explore: { attempts: 2, meanSuccess01: '0.99', meanSurprise01: 1.2, meanBenefit01: .8 },
    broken: null,
  },
};

const restored = new EmotionAppraisalEngine();
restored.restore(corrupt);
const state = restored.snapshot();

assert.equal(state.version, 2, 'restore must pin the supported schema version');
assert.equal(state.episodes, 1, 'invalid counters must not be coerced from strings and must cover retained episodes');
assert.equal(state.history.length, 1, 'invalid, duplicate, accessor, inherited, proxied, and sparse rows must not enter history');
assert.equal(state.history[0].id, validEpisode.id);
assert.equal(state.lastTick, validEpisode.tick, 'latest episode is the canonical source for the last tick');
assert.equal(state.lastAt, validEpisode.at, 'latest episode is the canonical source for the last timestamp');
assert.equal(state.lastLabel, validEpisode.label, 'aggregate label must agree with the latest retained episode');
assert.equal(state.meanArousal01, .22, 'non-finite aggregates must use the documented neutral baseline');
assert.equal(state.meanValence01, .5, 'numeric strings must not be trusted as normalized measurements');
assert.equal(state.meanStress01, .2);
assert.equal(state.meanAttentionCapture01, 0);
assert.equal(state.feelings.length, 1, 'feelings without a retained source emotion or finite fields must be discarded');
assert.equal(state.feelings[0].causeEmotionId, validEpisode.id);
assert.equal(state.interoception.cycles, 0, 'numeric-string cycle counters must not be coerced');
assert.equal(state.interoception.meanMismatch01, .18);
assert.equal(state.interoception.lastMismatch01, 1);
assert.equal(state.interoception.regulationPressure01, 0);
assert.equal(state.interoception.lastObserved.energy01, .68);
assert.equal(state.interoception.lastObserved.thermal01, .2);
assert.equal(state.interoception.lastObserved.capacity01, 0);
assert.equal(state.interoception.lastObserved.load01, .8);
assert.equal(state.interoception.predicted.capacity01, .72);
assert.equal(state.interoception.predicted.load01, 1);
assert.deepEqual(Object.keys(state.outcomes), ['explore'], 'invalid outcome calibration rows must be dropped');
assert.equal(state.outcomes.explore.attempts, 2);
assert.equal(state.outcomes.explore.meanSuccess01, .5, 'numeric strings must not create trusted calibration');
assert.equal(state.outcomes.explore.meanSurprise01, 1);
assert.equal(state.outcomes.explore.meanBenefit01, .8);
assert.equal(accessorInvoked, false, 'restore must inspect own data descriptors without invoking getters');

// Oversized history is bounded without losing the newest valid entries.
const oversizedHistory = Array.from({ length: 140 }, (_, index) => ({
  ...structuredClone(validEpisode),
  id: `emo:bounded:${index}`,
  tick: index,
  at: 20_000 + index,
}));
const bounded = new EmotionAppraisalEngine();
bounded.restore({ ...structuredClone(canonical), episodes: 140, history: oversizedHistory });
assert.equal(bounded.snapshot().history.length, 128);
assert.equal(bounded.snapshot().history[0].id, 'emo:bounded:0');

// Non-record roots and proxies fail closed to a fresh neutral state.
for (const invalidRoot of [null, [], 'snapshot', 42, new Proxy({}, {})]) {
  const engine = new EmotionAppraisalEngine();
  engine.restore(invalidRoot);
  assert.deepEqual(engine.snapshot(), source.snapshot() && {
    version: 2, episodes: 0, lastTick: -1, lastAt: 0, lastLabel: 'calm',
    meanArousal01: .22, meanValence01: .5, meanStress01: .2, meanAttentionCapture01: .2,
    history: [], feelings: [],
    interoception: {
      cycles: 0, meanMismatch01: .18, lastMismatch01: .18, regulationPressure01: .18,
      stability01: .72, recovery01: .5, predictionCalibration01: .5,
      lastObserved: { energy01: .68, thermal01: .2, capacity01: .72, load01: .38 },
      predicted: { energy01: .68, thermal01: .2, capacity01: .72, load01: .38 },
    },
    outcomes: {},
  });
}

// A legitimate version-2 snapshot must retain its valid cognitive continuity.
const roundTrip = new EmotionAppraisalEngine();
roundTrip.restore(canonical);
assert.deepEqual(roundTrip.snapshot(), canonical, 'valid version-2 snapshots must round-trip unchanged');

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'emotion-appraisal-restore-integrity',
  retainedEpisodes: state.history.length,
  retainedFeelings: state.feelings.length,
  invalidRowsRejected: true,
  getterWasNotInvoked: !accessorInvoked,
  numericCoercionBlocked: true,
  aggregateConsistencyRestored: true,
  validSnapshotRoundTrip: true,
}));
