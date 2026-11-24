import { B294CausalNeuralEventSpine } from '../src/organism/system/B294CausalNeuralEventSpine.ts';
const assert=(x,m)=>{if(!x)throw new Error(m)};
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const channels=['b269','b270','b289','b290','b291','b292','b293','world'];
const c=new B294CausalNeuralEventSpine();
let maxTeaching=0;
for(let tick=1;tick<=1200;tick++){
  const action=actions[tick%actions.length];
  const ch=Object.fromEntries(channels.map((k,i)=>[k, .35 + (((tick+i*3)%19)/19)*.5]));
  const d=c.beginDecision({tick,goalId:`g-${tick%7}`,action,mode:tick%11===0?'switch':'maintain',autonomy01:.55+(tick%13)/80,predictionError01:tick%17===0?.62:.18,uncertainty01:tick%23===0?.58:.22,predictedSelf01:.72,predictedWorld01:.70,channelSignals:ch});
  assert(d.episodeId,'episode id');
  const o=c.closeOutcome({tick:tick+1,reward01:tick%17===0?.33:.76,predictionError01:tick%13===0?.61:.20,actualSelf01:tick%19===0?.48:.76,actualWorld01:tick%23===0?.46:.73,external01:tick%29===0?.7:0,identityContinuity01:.79,causalEffect01:tick%31===0?.72:.35});
  assert(o.updated,'outcome updated');maxTeaching=Math.max(maxTeaching,Math.abs(o.teaching01));
}
const pre=c.actionBias('explore');c.lesion(.7);const post=c.actionBias('explore');const delta=Math.abs(pre-post);c.clearLesion();
const snap=c.snapshot();const restored=new B294CausalNeuralEventSpine();restored.restore(snap);
const m=c.metrics();
assert(m.decisionCount===1200,'1200 decisions');assert(m.outcomeCount===1200,'1200 outcomes');assert(m.learningUpdates===1200,'1200 learning updates');assert(m.recordDepth<=192,'bounded records');assert(m.synapticUpdates>0,'synaptic updates');assert(m.spikeEvents>0,'spike events recorded');assert(delta>0,'lesion must alter action bias');assert(restored.metrics().outcomeCount===1200,'persistence outcomes');
console.log(JSON.stringify({pass:true,metrics:m,maxTeaching,lesionActionBiasDelta:delta,channels:c.diagnostics().channelCredit},null,2));
