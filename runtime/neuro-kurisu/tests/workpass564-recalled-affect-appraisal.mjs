import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const base = {
  tick: 12,
  at: 12012,
  goalPressure01: .42,
  goalCongruence01: .63,
  controllability01: .71,
  novelty01: .38,
  selfRelevance01: .54,
  socialMeaning01: .25,
  uncertainty01: .31,
  predictionError01: .22,
  homeostaticPressure01: .18,
  energy01: .7,
  success01: .63,
};

const baselineEngine = new EmotionAppraisalEngine();
const withoutRecall = baselineEngine.appraise(base);
const recalledEngine = new EmotionAppraisalEngine();
const withRecall = recalledEngine.appraise({
  ...base,
  recalledAffect: { intensity01: .95, confidence01: .9, evidenceCount: 3 },
});

assert.equal(withoutRecall.appraisal.recalledAffect01, 0);
assert.equal(withoutRecall.appraisal.recalledMemoryCount, 0);
assert.ok(withRecall.appraisal.recalledAffect01 > .8, 'strong recalled affect should be represented explicitly');
assert.equal(withRecall.appraisal.recalledMemoryCount, 3);
assert.ok(withRecall.arousal01 > withoutRecall.arousal01, 'recalled emotional salience may modestly increase arousal');
assert.ok(
  Math.abs(withRecall.arousal01 - withoutRecall.arousal01) <= .08,
  'the recall influence must remain bounded',
);
assert.equal(withRecall.valence01, withoutRecall.valence01, 'emotional intensity alone must not invent positive/negative valence');
assert.equal(
  withRecall.interoceptiveDelta.stress01,
  withoutRecall.interoceptiveDelta.stress01,
  'emotional intensity alone must not label a recalled memory as present threat',
);
assert.ok(
  Math.abs(recalledEngine.arousalWithoutRecall01(withRecall) - withoutRecall.arousal01) < 1e-12,
  'reconsolidation must be able to remove exactly the recall-only arousal increment',
);
assert.ok(
  recalledEngine.actionBias('engage') > baselineEngine.actionBias('engage'),
  'recall-derived attention must enter the bounded action-selection bias',
);
assert.ok(
  Math.abs(recalledEngine.memorySalienceWithoutRecall01(withRecall) - withoutRecall.memorySalienceMultiplier01) < 1e-12,
  'memory reconsolidation must exclude the salience increment caused by recalling that same memory',
);
assert.ok(
  withRecall.memorySalienceMultiplier01 > withoutRecall.memorySalienceMultiplier01,
  'recall-driven arousal may increase current memory salience',
);

const noEvidence = new EmotionAppraisalEngine().appraise({
  ...base,
  recalledAffect: { intensity01: 1, confidence01: 1, evidenceCount: 0 },
});
assert.equal(noEvidence.appraisal.recalledAffect01, 0, 'a cue without retrieved-memory evidence must be ignored');
assert.equal(noEvidence.arousal01, withoutRecall.arousal01);

const restored = new EmotionAppraisalEngine();
restored.restore(recalledEngine.snapshot());
assert.deepEqual(
  restored.episodeById(withRecall.id)?.appraisal,
  withRecall.appraisal,
  'recalled-affect provenance must survive appraisal snapshot/restore',
);

console.log(JSON.stringify({
  status: 'PASS',
  test: 'workpass564-recalled-affect-appraisal',
  baseArousal: withoutRecall.arousal01,
  recalledArousal: withRecall.arousal01,
  recalledAffect01: withRecall.appraisal.recalledAffect01,
  valenceUnchanged: withRecall.valence01 === withoutRecall.valence01,
  threatInferenceUnchanged: withRecall.interoceptiveDelta.stress01 === withoutRecall.interoceptiveDelta.stress01,
  snapshotRestore: true,
}, null, 2));
