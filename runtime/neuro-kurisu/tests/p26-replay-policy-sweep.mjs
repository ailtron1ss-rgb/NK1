import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

// Multi-seed synthetic diagnostic. It compares retention/plasticity, not generalization.
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const seeds=[3,17,41];
const epochs=6;
const count=120;
const clamp01=x=>Math.max(0,Math.min(1,x));
const makeState=(seed,i,context)=>{
  const energy=.2+(((i*37+seed*13)%61)/100);
  const novelty=context===0?(((i*19+seed*7)%30)/100):(.7+(((i*19+seed*7)%30)/100));
  return {
    version:29,tick:i,at:0,
    needs:{energy,cognitiveLoad:.25,uncertainty:.2+(((i*11+seed)%40)/100),socialNeed:.2,novelty,identityCoherence:.8,goalPressure:.35},
    predictionError:.15,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
    selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
  };
};
const target=(state,action,task)=> {
  const desired=task===0
    ? (state.needs.energy<.5?'rest':'respond')
    : (state.needs.energy<.5?'respond':'rest');
  return action===desired?.92:.08;
};
const examples=(seed,task)=>Array.from({length:count},(_,i)=>{
  const state=makeState(seed,i,task);
  return {state,action:task===0?(state.needs.energy<.5?'rest':'respond'):(state.needs.energy<.5?'respond':'rest'),
    reward:target(state,task===0?(state.needs.energy<.5?'rest':'respond'):(state.needs.energy<.5?'respond':'rest'),task),
    nextState:makeState(seed,i+1,task),surprise:.25+(((i*7+seed)%60)/100)};
});
const allActions=(rows,task)=>rows.flatMap(row=>actions.map(action=>({...row,action,reward:target(row.state,action,task)})));
function fit(engine,rows,task,rate=.18){
  const batch=allActions(rows,task);
  for(let epoch=0;epoch<epochs;epoch++)for(const row of batch){
    engine.learner.train({state:row.state,action:row.action,target01:row.reward,learningRate01:rate});
  }
}
function accuracy(engine,seed,task){
  let correct=0;
  for(let i=0;i<100;i++){
    const state=makeState(seed+5,i,task);
    const expected=task===0?(state.needs.energy<.5?'rest':'respond'):(state.needs.energy<.5?'respond':'rest');
    if(engine.predict(state).slice().sort((a,b)=>b.value-a.value)[0]?.action===expected)correct++;
  }
  return correct/100;
}

// A requested 1:1 cadence is bounded to the default one replay per four current updates.
const cadenceProbe = new P26TrueLearningEngine().trainInterleaved([], [], { replayEveryNCurrent: 1 });
assert.equal(cadenceProbe.effectiveReplayEveryNCurrent, 4);
assert.equal(cadenceProbe.maxReplayFraction01, .25);
const replaySample = { state: makeState(1, 0, 0), action: 'respond', reward: .5, nextState: makeState(1, 1, 0) };
const disabledReplayProbe = new P26TrueLearningEngine().trainInterleaved([replaySample], [replaySample], {
  replayEveryNCurrent: 1, maxReplayFraction01: 0,
});
assert.equal(disabledReplayProbe.effectiveReplayEveryNCurrent, Number.MAX_SAFE_INTEGER);
assert.equal(disabledReplayProbe.onlineUpdates, 1);
assert.equal(disabledReplayProbe.replayUpdates, 0, 'maxReplayFraction01=0 must disable historical updates');
assert.throws(() => new P26TrueLearningEngine().trainInterleaved([], [], { maxReplayFraction01: 1.1 }), /max-replay-fraction-out-of-range/);

const strategies=[
  {name:'online-only',stride:0},
  {name:'interleave-8',stride:8},
  {name:'interleave-4',stride:4},
  {name:'interleave-1',stride:1},
];
const records=[];
for(const seed of seeds){
  for(const strategy of strategies){
    const engine=new P26TrueLearningEngine();
    const taskA=examples(seed,0),taskB=examples(seed,1);
    fit(engine,taskA,0);
    const oldBefore=accuracy(engine,seed,0);
    const oldReplay=allActions(taskA,0);
    const fresh=allActions(taskB,1);
    let replayUpdates=0,blockedReplayRows=0,eligibleReplayRows=0,conflictComparisons=0,effectiveReplayEveryNCurrent=strategy.stride,maxReplayFraction01=.25;
    if(strategy.stride===0){
      for(let epoch=0;epoch<epochs;epoch++)for(const row of fresh)
        engine.learner.train({state:row.state,action:row.action,target01:row.reward,learningRate01:.18});
    }else{
      for(let epoch=0;epoch<epochs;epoch++){
        const result=engine.trainInterleaved(fresh,oldReplay,{
          replayEveryNCurrent:strategy.stride,maxReplayUpdates:2000,targetMode:'reward',
          currentLearningRate01:.18,replayLearningRate01:.06,conflictCandidateCap:32,
        });
        replayUpdates+=result.replayUpdates;
        blockedReplayRows+=result.blockedReplayRows;
        eligibleReplayRows=result.eligibleReplayRows;
        conflictComparisons+=result.conflictComparisons;
        effectiveReplayEveryNCurrent=result.effectiveReplayEveryNCurrent;
        maxReplayFraction01=result.maxReplayFraction01;
        assert.ok(result.effectiveReplayEveryNCurrent>=strategy.stride,'effective replay cadence must honor the requested minimum interval');
        assert.ok(result.effectiveReplayEveryNCurrent>=4,'default replay ceiling must keep at least three current updates between replay updates');
        assert.ok(result.conflictComparisons<=oldReplay.length*32,'bounded candidate comparisons');
      }
    }
    const oldAfter=accuracy(engine,seed,0),newAfter=accuracy(engine,seed,1);
    for(const [key,value] of Object.entries({oldBefore,oldAfter,newAfter})){
      assert.ok(Number.isFinite(value)&&value>=0&&value<=1, strategy.name+'.'+key+' must be valid');
    }
    assert.ok(newAfter>.60,'each policy must retain useful new-task performance: '+JSON.stringify({seed,strategy:strategy.name,newAfter,oldAfter,blockedReplayRows,eligibleReplayRows,conflictComparisons}));
    if(strategy.stride>0)assert.equal(blockedReplayRows,0,'well-separated contexts must not be misclassified as same-context conflict');
    records.push({seed,strategy:strategy.name,requestedReplayEveryNCurrent:strategy.stride,effectiveReplayEveryNCurrent,maxReplayFraction01,oldBefore,oldAfter,newAfter,retentionDelta:oldAfter-oldBefore,
      replayUpdates,blockedReplayRows,eligibleReplayRows,conflictComparisons});
  }
}
const summary=strategies.map(strategy=>{
  const group=records.filter(row=>row.strategy===strategy.name);
  const mean=key=>group.reduce((sum,row)=>sum+row[key],0)/group.length;
  return {strategy:strategy.name,seeds:group.length,meanOldTaskBefore:mean('oldBefore'),meanOldTaskAfter:mean('oldAfter'),
    meanNewTask:mean('newAfter'),meanRetentionDelta:mean('retentionDelta'),meanReplayUpdates:mean('replayUpdates'),meanEffectiveReplayEveryNCurrent:mean('effectiveReplayEveryNCurrent'),
    meanConflictComparisons:mean('conflictComparisons')};
});
assert.equal(records.length,seeds.length*strategies.length);
assert.ok(summary.every(row=>row.seeds===seeds.length));
console.log('P26_REPLAY_POLICY_SWEEP=PASS');
console.log(JSON.stringify({seedCount:seeds.length,epochs,summary,records,
  evidenceGrade:'synthetic multi-seed diagnostic only; not independent holdout or real-world task evidence'},null,2));
