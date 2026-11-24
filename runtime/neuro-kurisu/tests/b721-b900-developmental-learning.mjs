import { B721B900DevelopmentalLearningFabric } from '../src/organism/system/B721B900DevelopmentalLearningFabric.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map(a=>[a,.5]));
const ctx=(i,shift=0)=>Array.from({length:8},(_,j)=>Math.max(0,Math.min(1,.15+((i*17+j*11)%71)/100+shift)));
const c=new B721B900DevelopmentalLearningFabric();
function decision(i,pe=.2,nov=.2,conf=.8,shift=0){return c.beforeDecision({tick:i,context01:ctx(i,shift),baseUtilities:base,uncertainty01:pe,predictionError01:pe,novelty01:nov,confidence01:conf,goalVector:ctx(i+3,shift)});}
let pre=[];
for(let i=1;i<=500;i++){const d=decision(i,.12,.18,.82,0); const a=actions[i%actions.length]; const good=(i%7<4); c.afterOutcome({tick:i,action:a,context01:ctx(i),nextContext01:ctx(i+1),reward01:good?.82:.18,predictionError01:good?.12:.72,verified01:good?1:.25,success01:good?1:0,phase:d.phase}); pre.push(d);}
let reversal=[];
for(let i=501;i<=1000;i++){const pe=i%6<3?.78:.30; const d=decision(i,pe,.75,.45,.12); const a= i%2?'respond':'verify'; const good=(i%2===0); c.afterOutcome({tick:i,action:a,context01:ctx(i,.12),nextContext01:ctx(i+1,.12),reward01:good?.76:.22,predictionError01:good?.68:.18,verified01:good?.35:.9,success01:good?1:0,phase:d.phase}); reversal.push(d);}
const diag=c.diagnostics();
const restart=c.snapshot(); const d2=new B721B900DevelopmentalLearningFabric(); d2.restore(restart); const restartOk=JSON.stringify(d2.snapshot())===JSON.stringify(restart);
const lesion=c.evaluate({tick:2001,context01:ctx(2001,.2),baseUtilities:base,uncertainty01:.72,predictionError01:.66,novelty01:.8,confidence01:.42}, {'subgoal-planner':true});
const avg=x=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);
console.log('B721_B900_CORE_PASS');
console.log('decisions',diag.decisions,'updates',diag.updates,'replays',diag.replays,'treeUpdates',diag.treeUpdates,'modelUpdates',diag.modelUpdates,'plans',diag.plans,'verifications',diag.verifications,'experiments',diag.experiments,'neuralUpdates',diag.neuralUpdates);
console.log('preConfidence',avg(pre.map(x=>x.confidence01)),'reversalConfidence',avg(reversal.map(x=>x.confidence01)));
console.log('lastOOD',diag.lastOOD01,'lastReversal',diag.lastReversal01,'lastPlanning',diag.lastPlanning01,'lastVerifier',diag.lastVerifier01,'lastPlasticity',diag.lastPlasticity01,'latencyMs',diag.lastLatencyMs.toFixed(4));
console.log('restartPersistence',restartOk,'subgoalLesionEffect',lesion.effect01.toFixed(6));
