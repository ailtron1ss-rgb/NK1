import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const mkState=(energy=.42,novelty=.5,uncertainty=.4)=>({
  version:29,tick:1,at:0,
  needs:{energy,cognitiveLoad:.3,uncertainty,socialNeed:.2,novelty,identityCoherence:.8,goalPressure:.25},
  predictionError:.2,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
  selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
});
const makeRow=(overrides={})=>({state:mkState(),action:'verify',reward:.8,nextState:mkState(.5,.55,.35),surprise:.3,...overrides});

const engine=new P26TrueLearningEngine();
assert.equal(typeof engine.trainInterleaved,'function','P26 runtime must expose interleaved training');
assert.equal(typeof engine.recordVerifiedHoldout,'function','P26 runtime must expose verified-holdout admission');
assert.equal(engine.metrics().generalizationEvidence01,0);
const training=engine.trainInterleaved([makeRow()],[],{targetMode:'reward'});
assert.equal(training.onlineUpdates,1);
assert.equal(training.replayUpdates,0);
assert.ok(engine.metrics().trainingExposure01>0,'training exposure is separate from holdout evidence');
assert.equal(engine.metrics().generalizationEvidence01,0,'policy updates are not generalization evidence');

// The fresh task example must be the final gradient in an interleaved slot.
const orderingEngine=new P26TrueLearningEngine();
const updateTargets=[];
const originalOrderingTrain=orderingEngine.learner.train.bind(orderingEngine.learner);
orderingEngine.learner.train=(input)=>{updateTargets.push(input.target01);return originalOrderingTrain(input);};
orderingEngine.trainInterleaved(
  [makeRow({state:mkState(.82,.9,.2),reward:.8,nextState:mkState(.8,.9,.25)})],
  [makeRow({state:mkState(.18,.1,.8),reward:.1,nextState:mkState(.2,.1,.75)})],
  {targetMode:'reward',replayEveryNCurrent:1,maxReplayUpdates:1,currentLearningRate01:.1,replayLearningRate01:.01},
);
assert.deepEqual(updateTargets,[.1,.8],
  'scheduled replay must run before the fresh current-task gradient');

// Identical row ordering between current/replay batches must not turn the
// scheduler into a permanently paired old/new gradient contest.
const scheduleEngine=new P26TrueLearningEngine();
const scheduled=[];
const originalScheduleTrain=scheduleEngine.learner.train.bind(scheduleEngine.learner);
scheduleEngine.learner.train=(input)=>{scheduled.push({energy:input.state.needs.energy,target:input.target01});return originalScheduleTrain(input);};
const scheduleSize=12;
const currentSchedule=Array.from({length:scheduleSize},(_,i)=>makeRow({
  state:mkState(.1+i*.01,.88,.25),
  action:'verify',reward:.8,nextState:mkState(.11+i*.01,.9,.2),
}));
const replaySchedule=Array.from({length:scheduleSize},(_,i)=>makeRow({
  state:mkState(.8-i*.01,.12,.25),
  action:'verify',reward:.1,nextState:mkState(.79-i*.01,.1,.2),
}));
const scheduleOptions={targetMode:'reward',replayEveryNCurrent:1,maxReplayUpdates:scheduleSize,currentLearningRate01:.18,replayLearningRate01:.06,conflictCandidateCap:8};
scheduleEngine.trainInterleaved(currentSchedule,replaySchedule,scheduleOptions);
const firstSchedule=[...scheduled];
assert.equal(firstSchedule.length,scheduleSize*2);
for(let i=0;i<scheduleSize;i++){
  assert.equal(firstSchedule[i*2].target,.1,'each interleaving slot starts with a replay target');
  assert.equal(firstSchedule[i*2+1].target,.8,'each interleaving slot ends with a current target');
  assert.notEqual(firstSchedule[i*2].energy,firstSchedule[i*2+1].energy,
    'replay sample must not stay paired to the same current-row index');
}
scheduled.length=0;
scheduleEngine.trainInterleaved(currentSchedule,replaySchedule,scheduleOptions);
assert.notEqual(scheduled[0].energy,firstSchedule[0].energy,
  'the replay permutation must rotate between consecutive batches');

engine.recordHoldout(.4,.8);
assert.equal(engine.metrics().holdoutDelta01,.4);
assert.equal(engine.metrics().generalizationEvidence01,0,'diagnostic holdout must not certify generalization');
const validEvidence={evidenceId:'p26-contract:evidence-1',taskId:'p26-contract:task-a',protocolId:'frozen-protocol-v1',verifierId:'independent-verifier-a',sampleSetHash:'sample-set-hash-a',baseline01:.4,learned01:.8,verified:true,independent:true,at:1234};
const accepted=engine.recordVerifiedHoldout(validEvidence);
assert.equal(accepted.accepted,true);
assert.equal(accepted.independentHoldoutSamples,1);
assert.equal(accepted.generalizationEvidence01,.05);
const acceptedSnapshot=engine.snapshot();
assert.equal(engine.recordVerifiedHoldout(validEvidence).reason,'duplicate-holdout-evidence');
assert.deepEqual(engine.snapshot(),acceptedSnapshot,'duplicate evidence must not mutate persisted ledger');

for(const invalid of [
 {...validEvidence,evidenceId:'p26-contract:unverified',verified:false},
 {...validEvidence,evidenceId:'p26-contract:dependent',independent:false},
 {...validEvidence,evidenceId:'p26-contract:bad-score',learned01:1.01},
 {...validEvidence,evidenceId:' p26-contract:noncanonical'},
 {...validEvidence,evidenceId:'p26-contract:bad-time',at:-1},
]) {
 const before=engine.snapshot();
 const result=engine.recordVerifiedHoldout(invalid);
 assert.equal(result.accepted,false);
 assert.deepEqual(engine.snapshot(),before,'rejected evidence must leave state unchanged');
}

const restored=new P26TrueLearningEngine();
restored.restore(engine.snapshot());
assert.equal(restored.metrics().generalizationEvidence01,.05);
assert.equal(restored.metrics().independentHoldoutSamples,1);
assert.equal(restored.recordVerifiedHoldout(validEvidence).reason,'duplicate-holdout-evidence','duplicate protection survives restore');

const beforeBadBatch=restored.snapshot();
assert.throws(()=>restored.trainInterleaved([makeRow(),makeRow({reward:NaN})],[],{}),/current-reward-invalid:1/);
assert.deepEqual(restored.snapshot(),beforeBadBatch,'entire batch must preflight before a weight update');
const accessorRow=makeRow();
let getterExecuted=false;
Object.defineProperty(accessorRow,'reward',{enumerable:true,get(){getterExecuted=true;throw new Error('training row getter must not execute');}});
const beforeAccessor=restored.snapshot();
assert.throws(()=>restored.trainInterleaved([accessorRow],[],{}),/current-row-accessor:reward/);
assert.equal(getterExecuted,false);
assert.deepEqual(restored.snapshot(),beforeAccessor,'accessor-backed rows must not partially train');

const rollbackEngine=new P26TrueLearningEngine();
const beforeRollback=rollbackEngine.snapshot();
const originalTrain=rollbackEngine.learner.train.bind(rollbackEngine.learner);
let trainCalls=0;
rollbackEngine.learner.train=(input)=>{trainCalls++;if(trainCalls===2)throw new Error('injected-interleaved-training-failure');return originalTrain(input);};
assert.throws(()=>rollbackEngine.trainInterleaved([makeRow(),makeRow({state:mkState(.8,.1,.2)})],[],{}),/injected-interleaved-training-failure/);
rollbackEngine.learner.train=originalTrain;
assert.deepEqual(rollbackEngine.snapshot(),beforeRollback,'mid-batch failure must roll back weights and metrics');

console.log('P26_INTERLEAVED_RUNTIME_CONTRACT=PASS',JSON.stringify({trainingExposure01:restored.metrics().trainingExposure01,generalizationEvidence01:restored.metrics().generalizationEvidence01,independentHoldoutSamples:restored.metrics().independentHoldoutSamples,preflightAtomicity:'PASS',rollbackAtomicity:'PASS'}));
