import assert from 'node:assert/strict';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';

const needs = { energy:.72,cognitiveLoad:.24,uncertainty:.42,socialNeed:.32,novelty:.45,identityCoherence:.86,goalPressure:.22 };
const state = tick => ({ version:26,tick,at:tick,needs,predictionError:.2,attentionBudget:.8,lastAction:'wait',lastActionSuccess:null,autonomyScore:.2,selfPredictionError:.1,predictedNextAction:'reflect',lastPredictionConfidence:.6,worldContextVersion:1 });
const traces = Array.from({length:12},(_,i)=>{
  const tick=i+1, action=['respond','verify','explore'][i%3];
  const selected={id:`candidate-${tick}`,goalId:undefined,action,score:.72,predictedUtility:.65,predictedNeedRelief:.5,predictedCost:.2,confidence:.7,generatedAt:tick};
  return {id:`trace-${tick}`,tick,createdAt:tick,candidates:[selected],selected,stateBefore:state(tick),reasoningSignals:{},userRequestedAction:null,autonomousOverride:false,predictedOutcomes:[],outcome:{success:.8,reward:.8,surprise:i/12,at:tick+1}};
});
const learning = new P23LearningEngine();
const policy = new AdaptivePolicyEngine();
for (const trace of traces) learning.recordExperience(trace,state(trace.tick+1),{success:.8,reward:.8,surprise:trace.outcome.surprise},policy);
learning.configureReplaySelection({maxBatchSize:8,recentQuota:4});
const replayCount = learning.replayPending(traces,policy);
assert.ok(replayCount > 0 && replayCount <= 8,
  'runtime must honor the configured replay upper bound while allowing eligibility and diversity filters to down-select');
const replayed = new Set(learning.snapshot().replayedTraceIds);
for (const tick of [9,10,11,12]) assert.ok(replayed.has(`trace-${tick}`), `recent quota should include trace-${tick}`);
assert.ok([...replayed].some(id=>Number(id.slice(6))<9),'historical samples should fill the non-recent budget');
const defaultLearning = new P23LearningEngine();
for (const trace of traces) defaultLearning.recordExperience(trace,state(trace.tick+1),{success:.8,reward:.8,surprise:trace.outcome.surprise},policy);
assert.equal(defaultLearning.replayPending(traces,policy),12,'default config must preserve full replay for batches below the 64-item cap');
const oversized = new P23LearningEngine();
oversized.configureReplaySelection({maxBatchSize:999,recentQuota:999});
assert.equal(oversized.snapshot().experiences.length,0);
console.log('P23_REPLAY_RUNTIME_CONFIG=PASS');
