import assert from 'node:assert/strict';
import { B283CompetingPredictiveHypotheses } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';

const mk=(seed)=>({tick:7000+seed,globalLatent:Array.from({length:16},(_,i)=>Math.sin((i+1)*(seed+1)*.17)),selfLatent:Array.from({length:16},(_,i)=>Math.cos((i+2)*(seed+1)*.09)),worldLatent:Array.from({length:16},(_,i)=>Math.sin((i+3)*(seed+2)*.071)),goalVector:Array.from({length:16},(_,i)=>Math.cos((i+1)*(seed+2)*.11)),memoryLatent:Array.from({length:16},(_,i)=>Math.sin((i+4)*(seed+1)*.083)),uncertainty01:.27,autonomy01:.72});
const rows=[];
for(let seed=0;seed<5;seed++){
  const b=new B283CompetingPredictiveHypotheses(); const input=mk(seed);
  for(let t=0;t<28;t++) b.step({...input,tick:input.tick+t,reward01:.74,predictionError01:.16,learningEnabled:true});
  const p1=b.planHorizon({...input,beamWidth:5,horizon:5});
  assert.equal(p1.steps,5); assert.equal(p1.sequence.length,5); assert(p1.return01>=0&&p1.return01<=1);
  const snapshot=b.snapshot(); const r=new B283CompetingPredictiveHypotheses(); r.restore(snapshot); const restored=r.diagnostics();
  assert.deepEqual(restored.plannedSequence,p1.sequence); assert(Math.abs(restored.plannedReturn01-p1.return01)<1e-9);
  const h=restored.activeHypothesisId;
  const ablated=structuredClone(snapshot); const hh=ablated.hypotheses[h]; assert(hh);
  for(const row of hh.predictor) for(let i=0;i<row.length;i++) row[i]=0;
  hh.latent=hh.latent.map(()=>0); hh.actionTransition=hh.actionTransition.map(row=>row.map(()=>0));
  const lesion=new B283CompetingPredictiveHypotheses(); lesion.restore(ablated);
  const p2=lesion.planHorizon({...input,beamWidth:5,horizon:5});
  const shamState=structuredClone(snapshot); const sh=shamState.hypotheses[h]; assert(sh);
  for(const row of sh.predictor) for(let i=0;i<row.length;i++) row[i]*=.95;
  sh.latent=sh.latent.map(v=>v*.95); sh.actionTransition=sh.actionTransition.map(row=>row.map(v=>v*.95));
  const sham=new B283CompetingPredictiveHypotheses(); sham.restore(shamState);
  const p3=sham.planHorizon({...input,beamWidth:5,horizon:5});
  const lesionEffect=Math.abs(p1.return01-p2.return01); const shamEffect=Math.abs(p1.return01-p3.return01);
  assert(lesionEffect>.01,`seed ${seed+1}: 5-step lesion effect too small ${lesionEffect}`);
  assert(lesionEffect>Math.max(.003,shamEffect*2),`seed ${seed+1}: 5-step lesion must exceed sham`);
  rows.push({seed:seed+1,sequence:p1.sequence,return01:p1.return01,lesionSequence:p2.sequence,lesionReturn01:p2.return01,shamSequence:p3.sequence,shamReturn01:p3.return01,lesionEffect01:lesionEffect,shamEffect01:shamEffect});
}
console.log(JSON.stringify({pass:true,status:'FIVE_STEP_PREDICTIVE_PLANNING_RESTART_LESION_SHAM_PASS',seeds:rows.length,rows},null,2));
