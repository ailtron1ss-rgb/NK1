import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';
import { P66InteroceptiveHomeostasis } from '../src/organism/cognition/P66InteroceptiveHomeostasis.ts';

const e = new EmotionAppraisalEngine();
const calmBody = e.observeInteroception({energy01:.88,thermal01:.16,capacity01:.9,load01:.12,homeostaticPressure01:.08});
const first = e.appraise({tick:1,at:1001,novelty01:.8,uncertainty01:.5,predictionError01:.1,homeostaticPressure01:.08,success01:.92,goalPressure01:.25,goalCongruence01:.9,controllability01:.8});
assert.ok(calmBody.cycles===1 && calmBody.lastMismatch01<.25);
assert.equal(first.label,'curiosity');
assert.ok(first.valence01>.55,'successful episode should be positively valenced');

const beforeInvalidAppraisal = e.snapshot();
assert.throws(() => e.appraise({ tick: 2, novelty01: Infinity }), /emotion-appraisal-values-invalid/);
assert.deepEqual(e.snapshot(), beforeInvalidAppraisal, 'invalid appraisal must not mutate emotion history or internal state');
assert.throws(() => e.appraise({ tick: 2, socialMeaning01: '0.7' }), /emotion-appraisal-values-invalid/);
assert.throws(() => e.appraise({ tick: 2, external: 'false' }), /emotion-appraisal-values-invalid/);
const firstAgain = e.appraise({tick:1,at:1001,novelty01:.8,uncertainty01:.5,predictionError01:.1,homeostaticPressure01:.08,success01:.92,goalPressure01:.25,goalCongruence01:.9,controllability01:.8});
assert.notEqual(first.id, firstAgain.id,'episode IDs must be unique within one process even with same tick/time');

e.observeInteroception({energy01:.18,thermal01:.86,capacity01:.24,load01:.88,homeostaticPressure01:.9});
const stressed = e.appraise({tick:3,at:1003,novelty01:.2,uncertainty01:.9,predictionError01:.85,homeostaticPressure01:.9,success01:.12,goalPressure01:.9,goalCongruence01:.15,controllability01:.15});
assert.ok(['anxiety','frustration','protective'].includes(stressed.label));
const feeling = e.inferFeeling(stressed,{energy01:.18,cognitiveLoad01:.88,uncertainty01:.9,selfFocus01:.8});
assert.ok(feeling.interoceptiveMismatch01>.1 && feeling.bodilyFocus01>.5);
for(let i=0;i<4;i++) e.recordOutcome({action:'rest',success01:.9,surprise01:.1,regulationCost01:.2});
assert.ok((e.outcomeCalibration('rest')?.attempts??0)===4);
assert.ok(e.actionBias('rest')>e.actionBias('explore'),'high interoceptive pressure plus good rest outcomes should favor regulation');

// WorkPass452: action outcomes are bound to the emotion/pressure context that
// preceded them, not generalized indiscriminately across all affective states.
const contextBefore = e.snapshot();
const stressRestKey = Object.keys(contextBefore.contextualOutcomes).find(key => {
  const parsed = JSON.parse(key);
  return parsed[0] === 'rest' && parsed[1] === stressed.label;
});
assert.ok(stressRestKey, 'outcomes from the current stress episode must create a context-bound row');
assert.equal(contextBefore.contextualOutcomes[stressRestKey].attempts, 4);
const stressRestBiasBefore = e.actionBias('rest');
e.recordOutcome({emotionId:first.id,action:'rest',success01:.1,surprise01:.8,regulationCost01:.8});
const contextAfter = e.snapshot();
const curiosityRestKey = Object.keys(contextAfter.contextualOutcomes).find(key => {
  const parsed = JSON.parse(key);
  return parsed[0] === 'rest' && parsed[1] === first.label;
});
assert.ok(curiosityRestKey);
assert.equal(JSON.parse(curiosityRestKey)[2], 'low',
  'an old episode must retain its own appraisal-time pressure band rather than inherit the current stressed band');
assert.notEqual(curiosityRestKey, stressRestKey);
assert.equal(contextAfter.contextualOutcomes[stressRestKey].attempts, 4,
  'outcome attributed to an earlier emotion must not mutate the current stressed-context history');
assert.equal(contextAfter.contextualOutcomes[curiosityRestKey].attempts, 1);
assert.equal(e.actionBias('rest'), stressRestBiasBefore,
  'an outcome from another emotion context must not leak into the active action bias');
assert.throws(() => e.recordOutcome({
  emotionId:'emotion-does-not-exist',action:'rest',success01:.5,surprise01:.5,
}), /emotion-outcome-emotion-link-invalid/);
const es=e.snapshot(); const er=new EmotionAppraisalEngine(); er.restore(es); assert.deepEqual(er.snapshot(),es);

// WorkPass330: restored affect state must not accept invalid counters, timestamps or malformed episodes.
const corruptedEmotion = new EmotionAppraisalEngine();
corruptedEmotion.restore({
  episodes: Number.MAX_SAFE_INTEGER + 1,
  lastTick: Number.NaN,
  lastAt: Number.POSITIVE_INFINITY,
  lastLabel: 'not-an-emotion',
  meanArousal01: Number.NaN,
  meanValence01: 2,
  meanStress01: Number.NEGATIVE_INFINITY,
  meanAttentionCapture01: 'high',
  history: [{ id: 'broken-episode', tick: Number.NaN }],
  feelings: [{ id: 'broken-feeling' }],
  interoception: {
    cycles: Number.POSITIVE_INFINITY,
    meanMismatch01: Number.NaN,
    lastMismatch01: -5,
    regulationPressure01: Number.POSITIVE_INFINITY,
    stability01: 'stable',
    recovery01: Number.NaN,
    predictionCalibration01: 3,
    lastObserved: { energy01: Number.NaN, thermal01: 5 },
    predicted: { energy01: Number.POSITIVE_INFINITY },
  },
  outcomes: { rest: { attempts: Number.POSITIVE_INFINITY, meanSuccess01: Number.NaN } },
});
const recoveredEmotion = corruptedEmotion.snapshot();
assert.equal(recoveredEmotion.episodes, 0);
assert.equal(recoveredEmotion.lastTick, -1);
assert.equal(recoveredEmotion.lastAt, 0);
assert.equal(recoveredEmotion.lastLabel, 'calm');
assert.equal(recoveredEmotion.history.length, 0, 'malformed emotion episodes must not enter live history');
assert.equal(recoveredEmotion.feelings.length, 0, 'malformed feeling episodes must not enter live history');
assert.equal(recoveredEmotion.interoception.cycles, 0);
assert.equal(recoveredEmotion.interoception.lastMismatch01, 0);
assert.equal(recoveredEmotion.interoception.lastObserved.energy01, .68);
assert.equal(recoveredEmotion.interoception.lastObserved.thermal01, 1);
assert.deepEqual(recoveredEmotion.outcomes, {}, 'corrupt calibration rows must not bias action selection');
assert.doesNotThrow(() => corruptedEmotion.actionBias('rest'));
assert.throws(() => corruptedEmotion.appraise({ tick: Number.NaN }), /emotion-appraisal-tick/);
assert.throws(() => corruptedEmotion.appraise({ tick: 1, at: Number.POSITIVE_INFINITY }), /emotion-appraisal-timestamp/);
assert.equal(corruptedEmotion.appraise({ tick: 1, at: 1004, novelty01: .8, uncertainty01: .5 }).tick, 1);

let emotionGetterReads = 0;
const accessorEmotionState = { episodes: 99, lastAt: 9999 };
Object.defineProperty(accessorEmotionState, 'lastLabel', {
  configurable: true, enumerable: true,
  get() { emotionGetterReads += 1; return 'anger'; },
});
const accessorSafeEmotion = new EmotionAppraisalEngine();
accessorSafeEmotion.restore(accessorEmotionState);
assert.equal(emotionGetterReads, 0, 'emotion restore must not execute persisted getters');
assert.equal(accessorSafeEmotion.snapshot().episodes, 0);
assert.equal(accessorSafeEmotion.snapshot().lastLabel, 'calm');
assert.deepEqual(accessorSafeEmotion.snapshot().outcomes, {});

let appraisalGetterReads = 0;
const getterAppraisal = Object.defineProperty({}, 'tick', {
  enumerable: true,
  get() { appraisalGetterReads++; return 10; },
});
assert.throws(
  () => accessorSafeEmotion.appraise(getterAppraisal),
  /emotion-appraisal-input-must-be-plain-data/,
  'appraisal must reject accessor-backed live observations',
);
assert.equal(appraisalGetterReads, 0, 'appraisal must snapshot descriptors without executing getters');

let interoceptionGetterReads = 0;
const getterInteroception = Object.defineProperty({}, 'energy01', {
  enumerable: true,
  get() { interoceptionGetterReads++; return .99; },
});
assert.throws(
  () => accessorSafeEmotion.observeInteroception(getterInteroception),
  /emotion-interoception-input-must-be-plain-data/,
);
assert.equal(interoceptionGetterReads, 0, 'interoception ingress must not execute getters');

let outcomeActionCoercions = 0;
const coercibleAction = { toString() { outcomeActionCoercions++; return 'rest'; } };
assert.throws(
  () => accessorSafeEmotion.recordOutcome({ action: coercibleAction, success01: .9, surprise01: .1 }),
  /emotion-outcome-input-must-be-plain-data/,
  'outcome action metadata must not permit custom object coercion',
);
assert.equal(outcomeActionCoercions, 0, 'outcome ingestion must reject custom coercion before use');
const emotionPrototypeBefore = accessorSafeEmotion.snapshot();
assert.throws(() => accessorSafeEmotion.recordOutcome({
  action: 'constructor', success01: .9, surprise01: .1,
}), /emotion-outcome-action-invalid/,
'prototype property names cannot be treated as learned action outcomes');
assert.deepEqual(accessorSafeEmotion.snapshot(), emotionPrototypeBefore,
  'rejected prototype-like action names must not mutate emotion calibration');

const emotionOutcomeStateBeforeRangeFailure=accessorSafeEmotion.snapshot();
assert.throws(()=>accessorSafeEmotion.recordOutcome({
  action:'rest',success01:Number.NaN,surprise01:.1,regulationCost01:.2,
}),/emotion-outcome-values-invalid/,
'non-finite outcome evidence must not silently become a low calibration score');
assert.throws(()=>accessorSafeEmotion.recordOutcome({
  action:'rest',success01:.9,surprise01:.1,regulationCost01:1.01,
}),/emotion-outcome-values-invalid/,
'out-of-range homeostatic cost must be rejected instead of clamped');
assert.deepEqual(accessorSafeEmotion.snapshot(),emotionOutcomeStateBeforeRangeFailure,
  'invalid affect-outcome values must not change action calibration or affect state');
let lookupActionCoercions = 0;
const hostileLookupAction = { toString() { lookupActionCoercions++; return 'rest'; } };
assert.equal(accessorSafeEmotion.outcomeCalibration(hostileLookupAction), null);
assert.equal(accessorSafeEmotion.actionBias(hostileLookupAction), 0);
assert.equal(lookupActionCoercions, 0,
  'read-only emotion lookups must not coerce arbitrary caller objects');
const beforeInvalidEmotionInput = accessorSafeEmotion.snapshot();
const circularFeelingInput = { energy01: .7, cognitiveLoad01: .2, uncertainty01: .3 };
circularFeelingInput.self = circularFeelingInput;
assert.throws(
  () => accessorSafeEmotion.inferFeeling(first, circularFeelingInput),
  /emotion-feeling-input-must-be-plain-data/,
);
assert.deepEqual(accessorSafeEmotion.snapshot(), beforeInvalidEmotionInput,
  'rejected feeling input must not mutate the canonical affect state');

const beforeMalformedEpisode = accessorSafeEmotion.snapshot();
assert.throws(
  () => accessorSafeEmotion.inferFeeling({ ...first, interoceptiveDelta: null }, {
    energy01: .8, cognitiveLoad01: .2, uncertainty01: .3,
  }),
  /emotion-feeling-episode-invalid/,
  'a plain object still must satisfy the complete emotion-episode schema',
);
assert.deepEqual(accessorSafeEmotion.snapshot(), beforeMalformedEpisode,
  'malformed emotion episode must not append or modify feeling state');



// WorkPass509: invalid body telemetry must not silently clamp into plausible state.
const beforeInvalidInteroception = accessorSafeEmotion.snapshot();
for (const invalidBody of [
  { energy01: Number.NaN, thermal01: .2, capacity01: .8, load01: .1 },
  { energy01: .8, thermal01: .2, capacity01: .8, load01: 1.01 },
  { energy01: .8, thermal01: .2, capacity01: .8, load01: .1, homeostaticPressure01: 'high' },
]) {
  assert.throws(() => accessorSafeEmotion.observeInteroception(invalidBody), /emotion-interoception-values-invalid/);
  assert.deepEqual(accessorSafeEmotion.snapshot(), beforeInvalidInteroception,
    'rejected body telemetry must not alter affect or prediction state');
}

const h = new P66InteroceptiveHomeostasis();
const high = h.observe({tick:1,at:1,energy01:.2,thermal01:.9,capacity01:.25,load01:.9,awake:true,uncertainty01:.8,predictionError01:.8,novelty01:.2});
assert.equal(high.mode,'recover'); assert.ok(high.pressure01>.5);
for(let i=2;i<=10;i++) h.observe({tick:i,at:i,energy01:.84,thermal01:.2,capacity01:.86,load01:.2,awake:true,uncertainty01:.1,predictionError01:.08,novelty01:.1});
const hs=h.summary(); assert.ok(hs.recoveryDebt01<.45,'recovery debt should dissipate during sustained recovery');

// Hysteresis must commit the same effective mode to the return value, counters,
// bounded history and persisted state. A one-tick raw "engage" flip is suppressed.
const hysteresis = new P66InteroceptiveHomeostasis();
const noveltyHigh = {tick:1,at:1,energy01:.84,thermal01:.2,capacity01:.86,load01:.2,awake:true,uncertainty01:.1,predictionError01:.1,novelty01:.8};
const firstExplore = hysteresis.observe(noveltyHigh);
const heldExplore = hysteresis.observe({...noveltyHigh,tick:2,at:2,novelty01:.5});
assert.equal(firstExplore.mode,'explore');
assert.equal(heldExplore.mode,'explore','hysteresis should suppress a transient explore→engage flip');
const heldSummary = hysteresis.summary();
assert.equal(heldSummary.lastMode,heldExplore.mode,'persisted lastMode must match the selected mode');
assert.equal(heldSummary.modeCounts.explore,2,'mode counters must count the committed mode');
assert.equal(heldSummary.modeCounts.engage,0,'suppressed raw mode must not be counted');
assert.equal(hysteresis.snapshot().history[0].mode,heldExplore.mode,'history must record the committed mode');
const hysteresisRestore = new P66InteroceptiveHomeostasis();
hysteresisRestore.restore(hysteresis.snapshot());
assert.deepEqual(hysteresisRestore.snapshot(),hysteresis.snapshot(),'hysteresis state must round-trip');

const hr=new P66InteroceptiveHomeostasis(); hr.restore(h.snapshot()); assert.deepEqual(hr.snapshot(),h.snapshot());

async function runBody(file, low){
 const c=new OrganismCore(new FileStateStore(file),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1}); await c.init();
 for(let i=0;i<10;i++){
   const energy=low?.24:.86, capacity=low?.34:.88, load=low?.8:.18, uncertainty=low?.68:.16, novelty=i%3===0?.72:.25;
   await c.observe({text:`172-${low?'stressed':'stable'}-${i}`,novelty,success:low?.2:.9,embodiment:{bodyEnergy01:energy,cognitiveCapacity01:capacity,thermalStrain01:low?.72:.16,sensoryFreshness01:.9,awake:true,battery01:energy,cpuLoad01:load,ramPressure01:load},worldContext:{location:'lab',facts:[low?'resource-stress':'stable-body'],objects:['sensor'],events:[low?'strain':'stable'],energy,attention:capacity,uncertainty}});
   await c.feedback({success:low?.2:.9,reward:low?-.2:.6,surprise:low?.7:.1,evidenceSource:i%3===0?'device':'user'});
 }
 await c.flush(); return c;
}
const root=await mkdtemp(join(tmpdir(),'nk172-')); const stableFile=join(root,'stable.json'), stressFile=join(root,'stress.json');
const stable=await runBody(stableFile,false), stressCore=await runBody(stressFile,true);
const stableS=stable.emotionAppraisalSnapshot(), stressS=stressCore.emotionAppraisalSnapshot();
assert.ok(stableS.interoception.cycles>=10 && stressS.interoception.cycles>=10);
assert.ok(stressS.interoception.regulationPressure01>stableS.interoception.regulationPressure01,'body state must alter affective regulation pressure');
assert.ok(stressS.meanStress01>stableS.meanStress01,'sustained bodily stress must alter emotion state');
assert.ok(stressCore.p66Summary().recoveryDebt01>stable.p66Summary().recoveryDebt01,'homeostatic recovery debt must track persistent body strain');
const stressR=new OrganismCore(new FileStateStore(stressFile),{enableLanguage:false,performanceProfile:'mobile',checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1}); await stressR.init();
assert.equal(stressR.emotionAppraisalSnapshot().interoception.cycles,stressS.interoception.cycles);
assert.equal(stressR.p66Summary().recoveryDebt01,stressCore.p66Summary().recoveryDebt01);
stable.stop?.(); stressCore.stop?.(); stressR.stop?.(); await rm(root,{recursive:true,force:true});

console.log(JSON.stringify({pass:172,status:'PASS',direct:{episodeIdsUnique:true,positiveValence:first.valence01,stressLabel:stressed.label,feelingMismatch:feeling.interoceptiveMismatch01,restBias:e.actionBias('rest')},p66:{highMode:high.mode,highPressure:high.pressure01,recoveryDebtAfterRecovery:hs.recoveryDebt01},core:{stableInteroCycles:stableS.interoception.cycles,stressInteroCycles:stressS.interoception.cycles,stableRegulation:stableS.interoception.regulationPressure01,stressRegulation:stressS.interoception.regulationPressure01,stableMeanStress:stableS.meanStress01,stressMeanStress:stressS.meanStress01,stableRecoveryDebt:stable.p66Summary().recoveryDebt01,stressRecoveryDebt:stressCore.p66Summary().recoveryDebt01,restart:true}},null,2));
