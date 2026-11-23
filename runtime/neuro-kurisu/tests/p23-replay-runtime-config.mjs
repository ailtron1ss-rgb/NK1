import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';
import { adaptiveReplayOptions } from '../src/organism/learning/MultiSourceLearningMechanisms.ts';

const needs = { energy:.72,cognitiveLoad:.24,uncertainty:.42,socialNeed:.32,novelty:.45,identityCoherence:.86,goalPressure:.22 };
const state = tick => ({ version:26,tick,at:tick,needs,predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.2,selfPredictionError:.1,predictedNextAction:'reflect',lastPredictionConfidence:.6,worldContextVersion:1 });
const traces = Array.from({length:12},(_,i)=>{
  const tick=i+1, action=['respond','verify','explore'][i%3];
  const selected={id:`candidate-${tick}`,goalId:undefined,action,score:.72,predictedUtility:.65,predictedNeedRelief:.5,predictedCost:.2,confidence:.7,generatedAt:tick};
  return {id:`trace-${tick}`,tick,createdAt:tick,candidates:[selected],selected,stateBefore:state(tick),reasoningSignals:{},userRequestedAction:null,autonomousOverride:false,predictedOutcomes:[],outcome:{success:.8,reward:.8,surprise:i/12,at:tick+1}};
});
const learning = new P23LearningEngine();
const policy = new AdaptivePolicyEngine();
for (const trace of traces) learning.recordExperience(trace,{...state(trace.tick+1),lastAction:trace.selected.action,lastActionSuccess:.8},{success:.8,reward:.8,surprise:trace.outcome.surprise},policy);
learning.configureReplaySelection({maxBatchSize:8,recentQuota:4});
const beforeReplay = learning.snapshot();
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const expectedOptions = adaptiveReplayOptions({maxBatchSize:8,recentQuota:4}, {
  predictionError01:beforeReplay.metrics.predictionError01,
  recentPredictionError01:beforeReplay.metrics.recentPredictionError01,
  replayTdError01:beforeReplay.metrics.replayMeanAbsTdError01,
  evidenceDebt01:clamp01(beforeReplay.metrics.evidenceDebtOpen/16),
  memoryPressure01:clamp01(beforeReplay.experiences.length/1024),
  energy01:1,
}, traces.length);
const replayCount = learning.replayPending(traces,policy);
assert.ok(replayCount > 0 && replayCount <= 8,
  'runtime replay must treat maxBatchSize as a hard ceiling while adapting its work budget');
assert.equal(replayCount, expectedOptions.maxBatchSize,
  'runtime batch size must match the shared health-adaptive replay budget');
const replayed = new Set(learning.snapshot().replayedTraceIds);
for (let tick = 13-expectedOptions.recentQuota; tick <= 12; tick++) {
  assert.ok(replayed.has(`trace-${tick}`), `adaptive recent quota should include trace-${tick}`);
}
assert.ok([...replayed].some(id=>Number(id.slice(6)) < 13-expectedOptions.recentQuota),
  'historical samples should fill the non-recent budget when room remains');
const defaultLearning = new P23LearningEngine();
for (const trace of traces) defaultLearning.recordExperience(trace,state(trace.tick+1),{success:.8,reward:.8,surprise:trace.outcome.surprise},policy);
assert.equal(defaultLearning.replayPending(traces,policy),12,'default config must preserve full replay for batches below the 64-item cap');
const oversized = new P23LearningEngine();
oversized.configureReplaySelection({maxBatchSize:999,recentQuota:999});
assert.equal(oversized.snapshot().experiences.length,0);
console.log('P23_REPLAY_RUNTIME_CONFIG=PASS');
