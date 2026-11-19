import assert from 'node:assert/strict';
import { types } from 'node:util';
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
source.inferFeeling(episode, {
  energy01: .91, cognitiveLoad01: .14, uncertainty01: .38, selfFocus01: .7,
});
source.recordOutcome({ action: 'rest', success01: .9, surprise01: .1, regulationCost01: .2 });

const canonical = source.snapshot();
assert.ok(canonical.history.length > 0, 'fixture must contain a canonical emotion episode');
assert.ok(canonical.feelings.length > 0, 'fixture must contain a linked feeling episode');
assert.ok(types.isProxy(new Proxy({}, {})), 'runtime must expose Node proxy detection');

function restore(raw) {
  const engine = new EmotionAppraisalEngine();
  engine.restore(raw);
  return engine.snapshot();
}

const neutral = new EmotionAppraisalEngine().snapshot();

// A benign Proxy is still executable user-controlled behavior, even when it has no traps.
assert.deepEqual(
  restore(new Proxy(structuredClone(canonical), {})),
  neutral,
  'proxy-backed root snapshots must fail closed to neutral state',
);

// A proxied history array must not be enumerated or admitted into restored state.
const proxyHistory = new Proxy(structuredClone(canonical.history), {});
const historyResult = restore({ ...canonical, history: proxyHistory });
assert.equal(historyResult.history.length, 0);
assert.equal(historyResult.feelings.length, 0);

// Nested proxies are rejected at the exact trust boundary, not only at the root.
const proxyEpisode = new Proxy(structuredClone(canonical.history[0]), {});
const episodeResult = restore({ ...canonical, history: [proxyEpisode] });
assert.equal(episodeResult.history.length, 0);

const proxyAppraisal = new Proxy(structuredClone(canonical.history[0].appraisal), {});
const appraisalResult = restore({
  ...canonical,
  history: [{ ...canonical.history[0], appraisal: proxyAppraisal }],
});
assert.equal(appraisalResult.history.length, 0);

const proxyFeeling = new Proxy(structuredClone(canonical.feelings[0]), {});
const feelingResult = restore({ ...canonical, feelings: [proxyFeeling] });
assert.equal(feelingResult.feelings.length, 0);

// Proxy-backed interoception must restore to the known safe default.
const interoceptionResult = restore({
  ...canonical,
  interoception: new Proxy(structuredClone(canonical.interoception), {}),
});
assert.deepEqual(interoceptionResult.interoception, neutral.interoception);

// Proxy-backed calibration must not survive as trusted outcome evidence.
const outcomesResult = restore({
  ...canonical,
  outcomes: new Proxy(structuredClone(canonical.outcomes), {}),
});
assert.deepEqual(outcomesResult.outcomes, {});

// Ordinary v2 snapshots retain their full continuity contract.
assert.deepEqual(restore(canonical), canonical);

console.log(JSON.stringify({
  status: 'PASS',
  suite: 'emotion-appraisal-restore-integrity',
  proxyRootRejected: true,
  proxyArraysRejected: true,
  proxyNestedRecordsRejected: true,
  proxyInteroceptionRejected: true,
  proxyOutcomeCalibrationRejected: true,
  validSnapshotRoundTrip: true,
}));
