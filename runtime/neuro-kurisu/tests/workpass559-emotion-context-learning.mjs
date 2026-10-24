import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const emotion = new EmotionAppraisalEngine();
const curiosity = emotion.appraise({
  tick: 1, at: 2001, novelty01: .9, uncertainty01: .4,
  goalPressure01: .2, predictionError01: .1, homeostaticPressure01: .1,
  goalCongruence01: .8, controllability01: .8,
});
assert.equal(curiosity.label, 'curiosity');

for (let i = 0; i < 4; i++) {
  emotion.recordOutcome({
    emotionId: curiosity.id, action: 'explore',
    success01: .95, surprise01: .05, regulationCost01: .1,
  });
}

const anxiety = emotion.appraise({
  tick: 2, at: 2002, novelty01: .1, uncertainty01: .9,
  goalPressure01: .95, predictionError01: .9, homeostaticPressure01: .85,
  goalCongruence01: .1, controllability01: .1,
});
assert.equal(anxiety.label, 'anxiety');
const anxietyBiasBefore = emotion.actionBias('explore');

for (let i = 0; i < 3; i++) {
  emotion.recordOutcome({
    emotionId: anxiety.id, action: 'explore',
    success01: .05, surprise01: .95, regulationCost01: .9,
  });
}

const curiosityCalibration = emotion.outcomeCalibration('explore', curiosity.id);
const anxietyCalibration = emotion.outcomeCalibration('explore', anxiety.id);
assert.ok(curiosityCalibration && anxietyCalibration);
assert.equal(curiosityCalibration.attempts, 4);
assert.equal(anxietyCalibration.attempts, 3);
assert.ok(
  curiosityCalibration.meanBenefit01 > anxietyCalibration.meanBenefit01,
  'the same action must retain distinct outcomes for curiosity and anxiety',
);
assert.ok(
  emotion.actionBias('explore') < anxietyBiasBefore,
  'anxiety-context failures must reduce explore bias despite globally positive outcomes',
);
assert.equal(
  emotion.outcomeCalibration('explore', 'forged-emotion-id'),
  null,
  'unknown emotion IDs must not create or read contextual calibration',
);

emotion.recordOutcome({
  emotionId: 'forged-emotion-id', action: 'verify',
  success01: .8, surprise01: .2, regulationCost01: .1,
});
assert.equal(emotion.outcomeCalibration('verify', 'forged-emotion-id'), null);
assert.equal(emotion.outcomeCalibration('verify')?.attempts, 1, 'legacy action-wide calibration remains available');

const restored = new EmotionAppraisalEngine();
restored.restore(emotion.snapshot());
assert.deepEqual(
  restored.outcomeCalibration('explore', anxiety.id),
  anxietyCalibration,
  'emotion-conditioned calibration must survive snapshot/restore',
);
assert.equal(restored.actionBias('explore'), emotion.actionBias('explore'));

console.log(JSON.stringify({
  status: 'PASS',
  test: 'workpass559-emotion-context-learning',
  curiosityBenefit: curiosityCalibration.meanBenefit01,
  anxietyBenefit: anxietyCalibration.meanBenefit01,
  anxietyExploreBiasBefore: anxietyBiasBefore,
  anxietyExploreBiasAfter: emotion.actionBias('explore'),
  snapshotRestore: true,
}, null, 2));
