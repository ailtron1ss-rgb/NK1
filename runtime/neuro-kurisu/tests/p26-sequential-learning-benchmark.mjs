import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const mkState=(energy,novelty,uncertainty=.3)=>({
  version:29,tick:1,at:0,
  needs:{energy,cognitiveLoad:.25,uncertainty,socialNeed:.2,novelty,identityCoherence:.8,goalPressure:.35},
  predictionError:.15,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
  selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
});
const targetA=(s,a)=>s.needs.energy<.5?(a==='rest'?.92:.08):(a==='respond'?.92:.08);
const targetB=(s,a)=>s.needs.energy<.5?(a==='respond'?.92:.08):(a==='rest'?.92:.08);
const rows=(phase,n=360)=>Array.from({length:n},(_,i)=>{
  const energy=.2+((i*37+phase*13)%61)/100;
  const novelty=((i*19+phase*7)%100)/100;
  const state=mkState(energy,novelty);
  const action=phase===0?(energy<.5?'rest':'respond'):(energy<.5?'respond':'rest');
  return {state,action,reward:phase===0?targetA(state,action):targetB(state,action),nextState:mkState(Math.min(.99,energy+.03),novelty),surprise:.35+((i*11)%50)/100};
});
const evalTask=(engine,phase,n=160)=>{
  let correct=0;
  for(let i=0;i<n;i++){
    const energy=.22+((i*23+phase*5)%57)/100;
    const state=mkState(energy,((i*17)%100)/100);
    const expected=phase===0?(energy<.5?'rest':'respond'):(energy<.5?'respond':'rest');
    const predicted=engine.predict(state).slice().sort((a,b)=>b.value-a.value)[0]?.action;
    if(predicted===expected)correct++;
  }
  return correct/n;
};
function train(engine,data,phase){
  for(let epoch=0;epoch<8;epoch++) for(const row of data) for(const action of actions){
    engine.learner.train({state:row.state,action,target01:phase===0?targetA(row.state,action):targetB(row.state,action),learningRate01:.18});
  }
}

const contextRows=(phase,n=360)=>Array.from({length:n},(_,i)=>{
  const energy=.2+((i*37)%61)/100;
  const novelty=phase===0?((i*19)%30)/100:.7+((i*19)%30)/100;
  const state=mkState(energy,novelty);
  const action=phase===0?(energy<.5?'rest':'respond'):(energy<.5?'respond':'rest');
  return {state,action,reward:phase===0?targetA(state,action):targetB(state,action),nextState:mkState(Math.min(.99,energy+.03),novelty),surprise:.35+((i*11)%50)/100};
});
const evalContextTask=(engine,phase,n=160)=>{
  let correct=0;
  for(let i=0;i<n;i++){
    const energy=.22+((i*23)%57)/100;
    const novelty=phase===0?((i*17)%30)/100:.7+((i*17)%30)/100;
    const state=mkState(energy,novelty);
    const expected=phase===0?(energy<.5?'rest':'respond'):(energy<.5?'respond':'rest');
    const predicted=engine.predict(state).slice().sort((a,b)=>b.value-a.value)[0]?.action;
    if(predicted===expected)correct++;
  }
  return correct/n;
};
const makeContextAwareRun=()=>{
  const engine=new P26TrueLearningEngine();
  const taskA=contextRows(0),taskB=contextRows(1);
  train(engine,taskA,0);
  const taskABefore=evalContextTask(engine,0);
  const replayRows=taskA.flatMap(row=>actions.map(action=>({...row,action,reward:targetA(row.state,action)})));
  let replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,conflictCandidateCap=64;
  for(let epoch=0;epoch<8;epoch++){
    const fresh=taskB.flatMap(row=>actions.map(action=>({...row,action,reward:targetB(row.state,action)})));
    // This is the high-replay reference case: separate novelty ranges make old/new
      // contexts distinguishable, so deliberately allow 1:1 rehearsal to measure
      // the context-aware retention ceiling rather than the bounded default policy.
      const result=engine.trainInterleaved(fresh,replayRows,{replayEveryNCurrent:1,maxReplayUpdates:2520,targetMode:'reward',currentLearningRate01:.18,replayLearningRate01:.18,maxReplayFraction01:1});
    replayUpdates+=result.replayUpdates;blockedReplayRows+=result.blockedReplayRows;eligibleReplayRows+=result.eligibleReplayRows;conflictComparisons+=result.conflictComparisons;conflictCandidateCap=result.conflictCandidateCap;
  }
  return {taskABefore,taskAFinal:evalContextTask(engine,0),taskBFinal:evalContextTask(engine,1),replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap};
};
const makeRun=(strategy)=>{
  const engine=new P26TrueLearningEngine();
  const taskA=rows(0);
  train(engine,taskA,0);
  const taskABefore=evalTask(engine,0);
  const taskB=rows(1);
  const replayRows=taskA.flatMap(row=>actions.map(action=>({...row,action,reward:targetA(row.state,action)})));
  let replayUpdates=0,onlineUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,conflictCandidateCap=64;
  if(strategy==='interleaved'){
    // Same task-B stream, with bounded old-task rehearsal during learning.
    for(let epoch=0;epoch<8;epoch++){
      const fresh=taskB.flatMap(row=>actions.map(action=>({...row,action,reward:targetB(row.state,action)})));
      const result=engine.trainInterleaved(fresh,replayRows,{replayEveryNCurrent:16,maxReplayUpdates:160,targetMode:'reward',currentLearningRate01:.18});
      replayUpdates+=result.replayUpdates;onlineUpdates+=result.onlineUpdates;blockedReplayRows+=result.blockedReplayRows;eligibleReplayRows+=result.eligibleReplayRows;conflictComparisons+=result.conflictComparisons;conflictCandidateCap=result.conflictCandidateCap;
    }
  }else{
    train(engine,taskB,1);
    onlineUpdates=taskB.length*actions.length*8;
  }
  const taskAAfterInterference=evalTask(engine,0);
  if(strategy==='posthoc-replay'){
    // Repair-after-interference baseline; it is not mixed rehearsal.
    for(let epoch=0;epoch<3;epoch++) replayUpdates+=engine.replay(replayRows,{}).updates;
  }
  const taskAAfterReplay=evalTask(engine,0);
  const taskBFinal=evalTask(engine,1);
  return {strategy,taskABefore,taskAAfterInterference,taskAAfterReplay,taskBFinal,onlineUpdates,replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons,conflictCandidateCap,trainingExposure01:engine.metrics().trainingExposure01,generalizationEvidence01:engine.metrics().generalizationEvidence01};
};
const onlineOnly=makeRun('online-only');
const replay=makeRun('posthoc-replay');
const interleaved=makeRun('interleaved');
const contextAware=makeContextAwareRun();
for(const [name,result] of Object.entries({onlineOnly,replay,interleaved})){
  for(const metric of ['taskABefore','taskAAfterInterference','taskAAfterReplay','taskBFinal'])assert(Number.isFinite(result[metric])&&result[metric]>=0&&result[metric]<=1,name+'.'+metric+' out of range');
}
assert.equal(onlineOnly.replayUpdates,0);
assert.ok(replay.replayUpdates>0);
assert.ok(replay.taskAAfterReplay>replay.taskAAfterInterference,'post-hoc replay should recover at least some old-task performance');
assert.ok(replay.taskBFinal>.8,'post-hoc replay should not erase the recently learned task');
assert.ok(interleaved.onlineUpdates>0,'interleaving must update fresh experience');
assert.ok(interleaved.replayUpdates+interleaved.blockedReplayRows>0,'interleaving must either replay or explicitly block stale/conflicting records');
assert.ok(interleaved.blockedReplayRows>0,'near-identical states with contradictory outcomes should block stale replay');
assert.ok(interleaved.conflictCandidateCap>=8&&interleaved.conflictCandidateCap<=128,'conflict candidate cap must remain bounded');
assert.ok(interleaved.conflictComparisons<=(interleaved.blockedReplayRows+interleaved.eligibleReplayRows)*interleaved.conflictCandidateCap,'conflict screening must have a bounded comparison count');
assert.ok(contextAware.conflictComparisons<=(contextAware.blockedReplayRows+contextAware.eligibleReplayRows)*contextAware.conflictCandidateCap,'contextual conflict screening must remain bounded too');
assert.ok(interleaved.taskBFinal>.8,'conflict-gated replay should preserve plasticity for the latest outcome when no context signal distinguishes the tasks');
console.log('P26_INTERLEAVED_DIAGNOSTIC',JSON.stringify(interleaved));
// Contradictory labels on indistinguishable states require selective forgetting unless context is represented.
assert.ok(onlineOnly.taskABefore>.8,'benchmark must establish task A before measuring forgetting');
assert.ok(onlineOnly.taskBFinal>.8,'benchmark must establish task B before measuring retention');
assert.equal(replay.generalizationEvidence01,0,'synthetic task evaluation is not verifier-certified generalization evidence');
assert.ok(contextAware.taskABefore>.8,'contextual benchmark must establish old-task performance');
assert.ok(contextAware.taskAFinal>.8,'separable state contexts plus interaction features should preserve old-task skill');
assert.ok(contextAware.taskBFinal>.8,'separable state contexts plus interaction features should learn the new task');
assert.ok(contextAware.eligibleReplayRows>0&&contextAware.replayUpdates>0,'non-conflicting historical examples should remain eligible for rehearsal');
assert.equal(contextAware.blockedReplayRows,0,'separable task contexts should not be treated as contradictory same-context feedback');
console.log('P26_SEQUENTIAL_LEARNING_BENCHMARK=PASS',JSON.stringify({onlineOnly,replay,interleaved,contextAware,interpretation:'synthetic diagnostic only; not a production or external-task result'}));
