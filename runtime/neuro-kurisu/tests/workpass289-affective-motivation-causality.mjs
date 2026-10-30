import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const baseAppraisal = {
  tick: 1, at: 1001, goalPressure01: .42, goalCongruence01: .64,
  controllability01: .72, novelty01: .52, selfRelevance01: .63,
  socialMeaning01: .34, uncertainty01: .31, predictionError01: .18,
  homeostaticPressure01: .22, energy01: .76, success01: .68,
};

const baselineEngine = new EmotionAppraisalEngine();
const baseline = baselineEngine.appraise(baseAppraisal);

assert.ok(Array.isArray(baseline.mixedAffect) && baseline.mixedAffect.length >= 2,
  'one appraisal must preserve multiple concurrent affective components');
assert.ok(Math.abs(baseline.mixedAffect.reduce((sum, item) => sum + item.intensity01, 0) - 1) < .002,
  'mixed affect intensities must form a normalized distribution');
assert.ok(baseline.mixedAffect.every(item => item.confidence01 >= 0 && item.confidence01 <= 1),
  'each affective component must expose bounded confidence');
assert.ok(Array.isArray(baseline.actionTendencies) && baseline.actionTendencies.length >= 1,
  'mixed affect must project into weighted action tendencies');
assert.ok(Math.abs(baseline.actionTendencies.reduce((sum, item) => sum + item.weight01, 0) - 1) < .002,
  'weighted action tendencies must preserve total influence');

const competingAffectEngine = new EmotionAppraisalEngine();
const competingAffect = competingAffectEngine.appraise({
  tick: 2, at: 2002, goalPressure01: .82, goalCongruence01: .28,
  controllability01: .31, novelty01: .94, selfRelevance01: .8,
  socialMeaning01: .24, uncertainty01: .82, predictionError01: .86,
  homeostaticPressure01: .18, energy01: .7, success01: .24,
});
const competingLabels = new Set(competingAffect.mixedAffect.map(item => item.label));
assert.ok(competingLabels.has('curiosity') && competingLabels.has('anxiety'),
  'high novelty and uncertainty with low controllability must retain curiosity and anxiety together');
assert.ok(competingLabels.size >= 3,
  'conflicting appraisal evidence must retain at least three concurrent components');
const mixedRestore = new EmotionAppraisalEngine();
mixedRestore.restore(competingAffectEngine.snapshot());
assert.deepEqual(mixedRestore.snapshot().history[0].mixedAffect, competingAffect.mixedAffect,
  'mixed affect distribution must survive checkpoint restore');
assert.deepEqual(mixedRestore.snapshot().history[0].actionTendencies, competingAffect.actionTendencies,
  'weighted action tendencies must survive checkpoint restore');

const malformedMixed = competingAffectEngine.snapshot();
malformedMixed.history[0].mixedAffect = [{ label: 'curiosity', intensity01: .2, confidence01: .8, evidence01: .7 }];
const malformedMixedRestore = new EmotionAppraisalEngine();
malformedMixedRestore.restore(malformedMixed);
assert.equal(malformedMixedRestore.snapshot().history.length, 0,
  'invalid non-normalized mixed-affect snapshots must be rejected instead of trusted');

const modulatedEngine = new EmotionAppraisalEngine();
const modulated = modulatedEngine.appraise({
  ...baseAppraisal,
  modulators: {
    personality: { curiosity01: .95, caution01: .72, care01: .82, persistence01: .88, confidence01: .95 },
    mood: { valence01: .78, arousal01: .68, confidence01: .8 },
    cognitive: { load01: .25, confidence01: .9 },
    social: { relevance01: .8, normConflict01: .15, confidence01: .7 },
  },
});
assert.ok(modulated.appraisal.novelty01 > baseline.appraisal.novelty01,
  'high-confidence curiosity trait should modestly increase novelty appraisal');
assert.ok(modulated.appraisal.socialMeaning01 > baseline.appraisal.socialMeaning01,
  'care/social relevance should influence social appraisal');
assert.ok(modulated.arousal01 > baseline.arousal01,
  'mood arousal should modulate appraisal without replacing its base signals');
assert.equal(modulated.modulators?.personality.confidence01, .95,
  'the appraisal must preserve its normalized influence provenance');

const noConfidenceEngine = new EmotionAppraisalEngine();
const noConfidence = noConfidenceEngine.appraise({
  ...baseAppraisal,
  modulators: {
    personality: { curiosity01: 1, caution01: 1, care01: 1, persistence01: 1, confidence01: 0 },
    mood: { valence01: 1, arousal01: 1, confidence01: 0 },
    cognitive: { load01: 1, confidence01: 0 },
    social: { relevance01: 1, normConflict01: 1, confidence01: 0 },
  },
});
assert.equal(noConfidence.appraisal.novelty01, baseline.appraisal.novelty01,
  'untrusted personality signals must not steer appraisal');
assert.equal(noConfidence.arousal01, baseline.arousal01,
  'untrusted mood signals must not steer appraisal');
const beforeInvalidModulator = noConfidenceEngine.snapshot();
assert.throws(() => noConfidenceEngine.appraise({
  ...baseAppraisal, tick: 2,
  modulators: { personality: { curiosity01: 1.4, confidence01: 1 } },
}), /emotion-appraisal-modulators-personality-invalid/);
assert.deepEqual(noConfidenceEngine.snapshot(), beforeInvalidModulator,
  'invalid modulators must not mutate appraisal state');

// A decision episode receives exactly one durable outcome credit. The same receipt
// can be replayed after a retry/restart, but it cannot be rebound or pay twice.
const receiptEngine = new EmotionAppraisalEngine();
const decision = receiptEngine.appraise({
  tick: 10, at: 10_010, novelty01: .8, uncertainty01: .55,
  predictionError01: .2, goalPressure01: .5, homeostaticPressure01: .2,
  success01: .7, controllability01: .7,
});
const firstCredit = receiptEngine.recordOutcome({
  emotionId: decision.id, outcomeId: 'receipt:tick-10:decision-1',
  action: 'explore', success01: .9, surprise01: .1, regulationCost01: .2,
});
assert.equal(firstCredit.attempts, 1);
const afterFirstCredit = receiptEngine.snapshot();
const replayCredit = receiptEngine.recordOutcome({
  emotionId: decision.id, outcomeId: 'receipt:tick-10:decision-1',
  action: 'explore', success01: .9, surprise01: .1, regulationCost01: .2,
});
assert.deepEqual(replayCredit, firstCredit);
assert.deepEqual(receiptEngine.snapshot(), afterFirstCredit,
  'a duplicate receipt must not increment global or contextual outcome calibration');
assert.throws(() => receiptEngine.recordOutcome({
  emotionId: decision.id, outcomeId: 'receipt:tick-10:decision-1',
  action: 'explore', success01: .1, surprise01: .9, regulationCost01: .9,
}), /emotion-outcome-replay-conflict/);
assert.deepEqual(receiptEngine.snapshot(), afterFirstCredit,
  'a conflicting duplicate receipt must not mutate the calibration');
assert.throws(() => receiptEngine.recordOutcome({
  emotionId: decision.id, outcomeId: 'receipt:tick-10:decision-2',
  action: 'explore', success01: .9, surprise01: .1, regulationCost01: .2,
}), /emotion-outcome-episode-already-credited/);
const receiptRestored = new EmotionAppraisalEngine();
receiptRestored.restore(afterFirstCredit);
assert.deepEqual(receiptRestored.snapshot(), afterFirstCredit,
  'outcome idempotency receipts must survive state restore');
receiptRestored.recordOutcome({
  emotionId: decision.id, outcomeId: 'receipt:tick-10:decision-1',
  action: 'explore', success01: .9, surprise01: .1, regulationCost01: .2,
});
assert.deepEqual(receiptRestored.snapshot(), afterFirstCredit,
  'a receipt replay after restart must remain a no-op');

// Affective state now changes internal drive values, not just diagnostic labels.
const motivationInput = {
  uncertainty: .4, predictionError: .3, novelty: .4, goalPressure: .4,
  socialNeed: .25, energy: .6, lastSuccess: .5, worldEvidenceQuality: .7,
  homeostaticPressure01: .7,
};
const motivation = new IntrinsicMotivationEngine();
const curiousDrive = motivation.update({
  ...motivationInput,
  affect: { emotionId: 'emo-curious', label: 'curiosity', valence01: .62, arousal01: .7, dominance01: .5, confidence01: 1 },
});
const anxiousDrive = motivation.update({
  ...motivationInput,
  affect: { emotionId: 'emo-anxious', label: 'anxiety', valence01: .25, arousal01: .85, dominance01: .2, confidence01: 1 },
});
assert.ok(curiousDrive.novelty > anxiousDrive.novelty,
  'curiosity should open exploration while anxiety shifts drive toward regulation');
assert.ok(anxiousDrive.homeostatic > curiousDrive.homeostatic,
  'anxiety and interoceptive pressure should increase restorative/homeostatic drive');
assert.equal(anxiousDrive.affectiveInfluence.emotionId, 'emo-anxious');
for (const key of ['epistemic', 'novelty', 'competence', 'coherence', 'social', 'homeostatic', 'overall']) {
  assert.ok(Number.isFinite(anxiousDrive[key]) && anxiousDrive[key] >= 0 && anxiousDrive[key] <= 1,
    `affective motivation ${key} must remain finite and bounded`);
}
const motivationRestore = new IntrinsicMotivationEngine();
motivationRestore.restore(anxiousDrive);
assert.deepEqual(motivationRestore.snapshot(), anxiousDrive,
  'affective influence diagnostics must survive intrinsic-drive restore');

// The six-channel drive profile must reach the existing endogenous goal vector,
// not stop at diagnostics or create a second planner.
const goalInput = {
  tick: 1,
  selfLatent: Array.from({length:16},(_,i)=>Math.sin(i*.31)),
  worldLatent: Array.from({length:16},(_,i)=>Math.cos(i*.27)),
  needs: { energy01:.7, uncertainty01:.35, novelty01:.45, goalPressure01:.4, socialNeed01:.25 },
  traits: { curiosity:.6, 'truth-seeking':.65, 'self-reflection':.6, 'self-preservation':.62, care:.55, 'social-attunement':.52, persistence:.68 },
  predictionError01:.2, autobiographicalContinuity01:.75, identityContinuity01:.78,
  intrinsicReward01:.5, lastAction:null, lastReward01:.5,
};
const neutralGoal = new B272EndogenousGoalGenesis().step({...goalInput});
const curiosityGoal = new B272EndogenousGoalGenesis().step({
  ...goalInput,
  intrinsicDrives: { epistemic:.9, novelty:.95, competence:.5, coherence:.5, social:.5, homeostatic:.2, confidence01:.95 },
});
const recoveryGoal = new B272EndogenousGoalGenesis().step({
  ...goalInput,
  intrinsicDrives: { epistemic:.25, novelty:.2, competence:.5, coherence:.5, social:.5, homeostatic:.95, confidence01:.95 },
});
assert.notDeepEqual(curiosityGoal.goalVector, neutralGoal.goalVector,
  'an evidence-weighted affective drive profile must change the endogenous goal vector');
assert.ok(curiosityGoal.goalVector[0] > recoveryGoal.goalVector[0],
  'curiosity/epistemic drives should bias the curiosity dimension above a recovery-dominant profile');
assert.ok(curiosityGoal.goalVector[7] < recoveryGoal.goalVector[7],
  'homeostatic pressure should bias the energy/recovery dimension');
const invalidGoalCore = new B272EndogenousGoalGenesis();
const invalidGoalBefore = invalidGoalCore.snapshot();
assert.throws(() => invalidGoalCore.step({
  ...goalInput,
  intrinsicDrives: { epistemic:1.5, novelty:.2, competence:.5, coherence:.5, social:.5, homeostatic:.5, confidence01:1 },
}), /B272 intrinsicDrives/);
assert.deepEqual(invalidGoalCore.snapshot(), invalidGoalBefore,
  'malformed intrinsic drive profiles must not mutate endogenous goal state');

// Persistent mood is slower than an emotion episode, time-decaying and restart-safe.
const moodEngine = new EmotionAppraisalEngine();
const moodOriginAt = 2_000_000;
const moodOrigin = moodEngine.appraise({
  tick: 40, at: moodOriginAt, goalPressure01: .9, goalCongruence01: .95,
  controllability01: .9, novelty01: .8, socialMeaning01: .25,
  uncertainty01: .8, predictionError01: .6, homeostaticPressure01: .12,
  energy01: .86, success01: .99, external: true,
});
const moodAtOrigin = moodEngine.moodSnapshot(moodOriginAt);
assert.ok(moodAtOrigin.valence01 > .5, 'a confident positive appraisal must shift the slow mood baseline');
assert.ok(moodAtOrigin.arousal01 > .22, 'a high-arousal episode must shift the mood arousal baseline');
assert.ok(moodAtOrigin.confidence01 > 0, 'mood confidence must be grounded in accepted episode evidence');

// Read projections must be pure; elapsed wall-clock time relaxes mood toward a neutral baseline.
const moodStateBeforeRead = moodEngine.snapshot().mood;
const moodAfter45m = moodEngine.moodSnapshot(moodOriginAt + 45 * 60 * 1000);
assert.deepEqual(moodEngine.snapshot().mood, moodStateBeforeRead,
  'moodSnapshot must not mutate the persisted engine state');
assert.ok(Math.abs(moodAfter45m.valence01 - .5) < Math.abs(moodAtOrigin.valence01 - .5),
  'valence mood must decay toward neutral rather than persist indefinitely');
assert.ok(Math.abs(moodAfter45m.arousal01 - .22) < Math.abs(moodAtOrigin.arousal01 - .22),
  'arousal mood must decay toward its resting baseline');
assert.ok(moodAfter45m.confidence01 < moodAtOrigin.confidence01,
  'mood confidence must decay as the supporting evidence becomes stale');

// A persistent mood estimate is canonical once established; a caller cannot double-count
// the last episode by passing it again as a fresh high-confidence mood modifier.
const moodFollowupAt = moodOriginAt + 5 * 60 * 1000;
const expectedFollowupMood = moodEngine.moodSnapshot(moodFollowupAt);
const moodFollowup = moodEngine.appraise({
  tick: 41, at: moodFollowupAt, goalPressure01: .3, goalCongruence01: .5,
  controllability01: .8, novelty01: .2, socialMeaning01: .1,
  uncertainty01: .2, predictionError01: .1, homeostaticPressure01: .1,
  energy01: .8, success01: .5,
  modulators: { mood: { valence01: .02, arousal01: .98, confidence01: 1 } },
});
assert.equal(moodFollowup.modulators?.mood.valence01, expectedFollowupMood.valence01,
  'the engine must use its time-decayed canonical mood instead of double-counting the prior episode');
assert.equal(moodFollowup.modulators?.mood.arousal01, expectedFollowupMood.arousal01);

// Out-of-order observations remain in episode history but cannot rewind the slow mood clock.
const moodBeforeStale = moodEngine.snapshot().mood;
moodEngine.appraise({
  tick: 42, at: moodFollowupAt - 60_000, goalPressure01: .3, goalCongruence01: .05,
  controllability01: .2, novelty01: .1, socialMeaning01: .1,
  uncertainty01: .9, predictionError01: .8, homeostaticPressure01: .7,
  energy01: .2, success01: .05, external: true,
});
const moodAfterStale = moodEngine.snapshot().mood;
assert.equal(moodAfterStale.lastUpdatedAt, moodBeforeStale.lastUpdatedAt,
  'an out-of-order appraisal must not rewind mood time');
assert.equal(moodAfterStale.valence01, moodBeforeStale.valence01,
  'an out-of-order appraisal must not overwrite newer mood evidence');
assert.equal(moodAfterStale.staleEpisodes, moodBeforeStale.staleEpisodes + 1,
  'out-of-order observations must be counted for diagnostics');

// Mood survives checkpoint restore; old snapshots without a mood field migrate from history.
const moodCheckpoint = moodEngine.snapshot();
const moodRestored = new EmotionAppraisalEngine();
moodRestored.restore(moodCheckpoint);
assert.deepEqual(moodRestored.snapshot().mood, moodCheckpoint.mood,
  'persistent mood must survive checkpoint restore exactly');
const legacyMoodCheckpoint = { ...moodCheckpoint };
delete legacyMoodCheckpoint.mood;
const moodMigrated = new EmotionAppraisalEngine();
moodMigrated.restore(legacyMoodCheckpoint);
assert.equal(moodMigrated.snapshot().mood.lastEpisodeId, moodCheckpoint.history[0]?.id,
  'legacy snapshots must initialize mood from their latest valid emotion episode');
assert.ok(Number.isFinite(moodMigrated.moodSnapshot(moodFollowupAt).valence01),
  'migrated mood must remain finite and bounded');

// Invalid mood query times are rejected without mutating state.
const moodBeforeInvalidRead = moodEngine.snapshot();
assert.throws(() => moodEngine.moodSnapshot(Number.NaN), /emotion-mood-timestamp-invalid/);
assert.deepEqual(moodEngine.snapshot(), moodBeforeInvalidRead);

// Verify the actual OrganismCore path: appraisal → motivation → action trace →
// outcome receipt. The post-outcome feeling must not steal credit from the
// pre-action episode that influenced the decision.
const core = new OrganismCore(new MemoryStateStore(), {
  enableLanguage: false,
  performanceProfile: 'mobile',
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
});
await core.init();
let decisionEmotionIdForReport = '';
let creditedReceiptsForReport = 0;
try {
  await core.observe({
    text: '',
    novelty: .76,
    surprise: .35,
    success: .62,
    embodiment: {
      bodyEnergy01: .72, cognitiveCapacity01: .84, thermalStrain01: .18,
      sensoryFreshness01: .94, awake: true, battery01: .78,
      cpuLoad01: .18, ramPressure01: .18,
    },
    worldContext: {
      location: 'lab', facts: ['stable battery', 'sensor calibration'],
      objects: ['sensor', 'power system'], events: ['calibration completed'],
      energy: .72, attention: .84, uncertainty: .35,
    },
  }, 'operational');
  const decisionSnapshot = core.emotionAppraisalSnapshot();
  const decisionEmotion = decisionSnapshot.history?.[0];
  assert.ok(decisionEmotion, 'the live OrganismCore cycle must create a decision appraisal');
  decisionEmotionIdForReport = decisionEmotion.id;
  const beforeFeedback = core.snapshot();
  const intrinsic = beforeFeedback.facets?.consciousness?.intrinsic;
  assert.ok(intrinsic?.affectiveInfluence,
    'live intrinsic motivation must expose its affective influence');
  assert.equal(intrinsic.affectiveInfluence.emotionId, decisionEmotion.id,
    'intrinsic drives must consume the exact canonical appraisal from this cycle');
  assert.equal(intrinsic.affectiveInfluence.label, decisionEmotion.label);

  await core.feedback({
    success: .86, reward: .62, surprise: .14, evidenceSource: 'internal',
  });
  const afterFeedback = core.emotionAppraisalSnapshot();
  const receipts = Object.entries(afterFeedback.outcomeReceipts ?? {});
  const linkedReceipts = receipts.filter(([, receipt]) => receipt.emotionId === decisionEmotion.id);
  creditedReceiptsForReport = linkedReceipts.length;
  assert.equal(linkedReceipts.length, 1,
    'the feedback outcome must credit the pre-action emotion episode exactly once');
  assert.ok(linkedReceipts[0][0].startsWith('affect:'),
    'the runtime must use a stable trace-derived idempotency key');
  assert.ok(afterFeedback.history.some(item => item.id === decisionEmotion.id),
    'the decision appraisal must remain available after the post-outcome appraisal');
  assert.notEqual(afterFeedback.history[0]?.id, decisionEmotion.id,
    'post-outcome appraisal must be a separate episode, not overwrite decision-time context');
  const persistedCore = core.snapshot();
  assert.ok(persistedCore.facets?.consciousness?.intrinsic?.affectiveInfluence?.emotionId === decisionEmotion.id,
    'the decision-time affect-to-drive provenance must survive the public core snapshot');
} finally {
  core.stop?.();
}

console.log(JSON.stringify({
  status: 'PASS',
  pass: 'workpass289-affective-motivation-causality',
  appraisal: {
    baselineNovelty: baseline.appraisal.novelty01,
    modulatedNovelty: modulated.appraisal.novelty01,
    baselineArousal: baseline.arousal01,
    modulatedArousal: modulated.arousal01,
  },
  receipts: {
    idempotentReplay: true,
    conflictingReplayRejected: true,
    episodeDoubleCreditRejected: true,
  },
  drives: {
    curiousNovelty: curiousDrive.novelty,
    anxiousNovelty: anxiousDrive.novelty,
    anxiousHomeostatic: anxiousDrive.homeostatic,
  },
  runtime: {
    decisionEmotionId: decisionEmotionIdForReport,
    creditedReceipts: creditedReceiptsForReport,
    affectiveDriveLinked: true,
  },
}, null, 2));
