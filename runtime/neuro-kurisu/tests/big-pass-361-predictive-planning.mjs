import assert from 'node:assert/strict';
import { B283CompetingPredictiveHypotheses } from '../src/organism/cognition/B283CompetingPredictiveHypotheses.ts';

const mk=(seed)=>({tick:6000+seed,globalLatent:Array.from({length:16},(_,i)=>Math.sin((i+1)*(seed+1)*.19)),selfLatent:Array.from({length:16},(_,i)=>Math.cos((i+2)*(seed+1)*.11)),worldLatent:Array.from({length:16},(_,i)=>Math.sin((i+3)*(seed+2)*.07)),goalVector:Array.from({length:16},(_,i)=>Math.cos((i+1)*(seed+2)*.13)),memoryLatent:Array.from({length:16},(_,i)=>Math.sin((i+4)*(seed+1)*.09)),uncertainty01:.32,autonomy01:.68});
const rows=[];
for(let seed=0;seed<5;seed++){
  const b=new B283CompetingPredictiveHypotheses();
  const input=mk(seed);
  for(let t=0;t<24;t++) b.step({...input,tick:input.tick+t,reward01:.72,predictionError01:.18,learningEnabled:true});
  const p1=b.planThreeStep({...input,beamWidth:5});
  assert.equal(p1.steps,3);assert.equal(p1.sequence.length,3);assert(p1.return01>=0&&p1.return01<=1);
  const snapshot=b.snapshot(); const r=new B283CompetingPredictiveHypotheses();r.restore(snapshot);const pd=r.diagnostics();
  assert.deepEqual(pd.plannedSequence,p1.sequence);assert(Math.abs(pd.plannedReturn01-p1.return01)<1e-9);
  const h=pd.activeHypothesisId;

  const ablated=structuredClone(snapshot); const hh=ablated.hypotheses[h]; assert(hh);
  for(const row of hh.predictor) for(let i=0;i<row.length;i++) row[i]=0;
  hh.latent=hh.latent.map(()=>0);
  hh.actionTransition=hh.actionTransition.map(row=>row.map(()=>0));
  const lesion=new B283CompetingPredictiveHypotheses();lesion.restore(ablated);
  const p2=lesion.planThreeStep({...input,beamWidth:5});

  const shamState=structuredClone(snapshot); const sh=shamState.hypotheses[h]; assert(sh);
  for(const row of sh.predictor) for(let i=0;i<row.length;i++) row[i]*=.95;
  sh.latent=sh.latent.map(v=>v*.95); sh.actionTransition=sh.actionTransition.map(row=>row.map(v=>v*.95));
  const sham=new B283CompetingPredictiveHypotheses();sham.restore(shamState);
  const p3=sham.planThreeStep({...input,beamWidth:5});

  const lesionEffect=Math.abs(p1.return01-p2.return01); const shamEffect=Math.abs(p1.return01-p3.return01);
  assert(lesionEffect>0.002,`seed ${seed} predictive lesion effect too small: ${lesionEffect}`);
  assert(lesionEffect>Math.max(.001,shamEffect*2),`seed ${seed} lesion effect must exceed matched sham`);
  rows.push({seed:seed+1,hypothesisId:h,sequence:p1.sequence,return01:p1.return01,lesionSequence:p2.sequence,lesionReturn01:p2.return01,shamSequence:p3.sequence,shamReturn01:p3.return01,lesionEffect01:lesionEffect,shamEffect01:shamEffect});
}
console.log(JSON.stringify({pass:true,status:'THREE_STEP_PREDICTIVE_PLANNING_RESTART_LESION_SHAM_PASS',seeds:rows.length,rows},null,2));
