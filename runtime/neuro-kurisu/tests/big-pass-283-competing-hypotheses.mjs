import assert from 'node:assert/strict';
import { B283CompetingPredictiveHypotheses } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';
const w=new B283CompetingPredictiveHypotheses();
for(let t=0;t<260;t++){
  const g=Array.from({length:16},(_,i)=>Math.tanh(Math.sin((t+i)*.17)+(t%37===0?.6:0)));
  const self=Array.from({length:16},(_,i)=>.25*Math.sin(i+t*.03));
  const world=Array.from({length:16},(_,i)=>.35*Math.cos(i*.2+t*.05));
  const goal=Array.from({length:16},(_,i)=>.45*Math.sin(i*.31+t*.02));
  const mem=Array.from({length:16},(_,i)=>.2*Math.cos(i*.27+t*.07));
  w.step({tick:t,globalLatent:g,selfLatent:self,worldLatent:world,goalVector:goal,memoryLatent:mem,reward01:.78,predictionError01:.12,uncertainty01:.15,autonomy01:.85,personalityVector:Array(16).fill(.15),learningEnabled:true});
  if(t%5===0) w.learnFromOutcome({tick:t,reward01:.80,predictionError01:.10,action:'verify',independentEvidence01:.95});
}
const d=w.diagnostics(); assert(d.steps===260); assert(d.learningUpdates>200); assert(d.predictionUpdates>0); assert(d.hypotheses.length===4); assert(d.posteriorEntropy01>0); assert(d.diversity01>0); assert(d.hypothesisSwitches>0);
const commit=w.commitActive(261); assert.equal(commit.committed,true); const committed=commit.hypothesisId;
const rejectLab=new B283CompetingPredictiveHypotheses(); const rejectStep=rejectLab.step({tick:1,globalLatent:Array(16).fill(-.7),selfLatent:Array(16).fill(.4),worldLatent:Array(16).fill(-.2),goalVector:Array(16).fill(.9),memoryLatent:Array(16).fill(.1),reward01:.1,predictionError01:.9,uncertainty01:.8,autonomy01:.2,personalityVector:Array(16).fill(-.2),learningEnabled:false}); const reject=rejectLab.rejectActive(2); assert.equal(reject.rejected,true);
const lesion=w.lesionHypothesis(committed,.5); assert(lesion.causalDrop01>0);
const snap=w.snapshot(); const r=new B283CompetingPredictiveHypotheses(); r.restore(snap); assert.deepEqual(r.snapshot(),snap);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,predictionUpdates:d.predictionUpdates,hypothesisSwitches:d.hypothesisSwitches,posteriorEntropy01:d.posteriorEntropy01,diversity01:d.diversity01,active:d.activeHypothesis.id,commit,reject,lesionDrop01:lesion.causalDrop01,restart:true}));
