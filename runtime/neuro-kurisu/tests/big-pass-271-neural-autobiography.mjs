import assert from 'node:assert/strict';
import { B271NeuralAutobiographicalCore } from '../src/organism/cognition/B271NeuralAutobiographicalCore.ts';

const net=new B271NeuralAutobiographicalCore();
const oneHot=i=>Array.from({length:16},(_,j)=>j===i?1:0);
const action='explore';
const states=[];
for(let epoch=0;epoch<80;epoch++){
  for(const idx of [1,5,9,13]){
    const r=net.step({tick:epoch*4+(idx===1?1:idx===5?2:idx===9?3:4),assembly:oneHot(idx),selfLatent:oneHot((idx+2)%16),vector:oneHot((idx+3)%16).map((x,j)=>x||Math.sin(epoch*.03+j*.09)*.08),predictionError01:.12+(idx%3)*.05,novelty01:.72,uncertainty01:.36,reward01:.72,currentAction:action,identityContinuity01:.84,autobiographicalContinuity01:.82,traits:{curiosity:.76,caution:.58,'truth-seeking':.71,persistence:.74},goalPressure01:.62});
    net.learnFromOutcome({tick:epoch*4+(idx===1?1:idx===5?2:idx===9?3:4),action,reward01:.72,predictionError01:.14,selfLatent:r.selfLatent,traits:r.traitValues,goal:r.proposedGoal});
    states.push({idx,output:r});
  }
}
const diag=net.diagnostics();
const recall=net.recallSequence(oneHot(1),3);
const target=oneHot(5);
const similarity=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s/(Math.sqrt(a.reduce((x,v)=>x+v*v,0))*Math.sqrt(b.reduce((x,v)=>x+v*v,0))+1e-9);};
const firstSim=similarity(recall[1],target);
assert.ok(diag.learningUpdates>=250,'insufficient neural autobiographical learning');
assert.ok(diag.sequenceDepth>0,'no internal sequence traces');
assert.ok(diag.meanStability>.35,'assemblies unstable');
assert.ok(diag.reconstruction01>.25,'reconstruction signal collapsed');
assert.ok(firstSim>.45,'internal sequence recall is not above chance');

const snap=net.snapshot();
const ablatedExternal=new B271NeuralAutobiographicalCore();
const noLedger={...snap,sequenceMemory:[]};
ablatedExternal.restore(noLedger);
const ablatedRecall=ablatedExternal.recallSequence(oneHot(1),3);
const ablatedSim=similarity(ablatedRecall[1],target);
assert.ok(ablatedSim>0.40,'recall depended entirely on auxiliary symbolic episode ledger');
assert.equal(ablatedExternal.snapshotAutobiography().sequenceDepth,0,'symbolic ledger was not actually ablated');

console.log(JSON.stringify({pass:true,diagnostics:diag,recallSimilarity01:firstSim,ablatedLedgerRecallSimilarity01:ablatedSim,internalOnlyRecall:true},null,2));
