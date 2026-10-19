import assert from 'node:assert/strict';
import { B263RealActionCausality } from '../src/organism/cognition/B263RealActionCausality.ts';

const m=new B263RealActionCausality();
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const truth=(before,action,t)=>{
  const a=actions.indexOf(action);
  return before.map((v,i)=>Math.tanh(v*.56 + ((a===2?0.16:0)+(a===4?-0.12:0))*Math.sin((i+1)*.13) + Math.cos(t*.07+i*.11)*.02));
};
const samples=[];
for(let i=0;i<112;i++){
  const before=Array.from({length:24},(_,j)=>Math.sin(i*.09+j*.17));
  const action=actions[i%actions.length];
  const after=truth(before,action,i);
  const reward=action==='verify' ? .86 : action==='explore' ? .63 : .31 + (i%5)*.03;
  m.observe(before,action,after,reward,i,.1+(i%7)*.03);
  if(i%8===0) samples.push({before,action,after,reward01:reward});
}
const before=Array.from({length:24},(_,i)=>Math.cos(i*.21));
const intervention=m.intervene(before,'verify');
const compare=m.compareActions(before);
const hold=m.holdout(samples);
const replay=m.replay(20);
const ablation=m.ablateAction('verify');
const snap=m.snapshot(); const restored=new B263RealActionCausality(); restored.restore(snap);
const d=m.diagnostics();
assert.ok(d.updates>=112);
assert.equal(compare.length,7);
assert.ok(intervention.causalEffect01>=0 && intervention.causalEffect01<=1);
assert.ok(hold.samples===samples.length);
assert.ok(replay.rows>0);
assert.ok(hold.shuffled01>hold.conditioned01,'action-conditioned model must beat shuffled-action baseline');
assert.ok(d.causalGain01>0,'causal gain must become measurable');
assert.ok(ablation.samples>0);
assert.equal(restored.snapshot().updates,snap.updates);
console.log(JSON.stringify({ok:true,updates:d.updates,interventions:d.interventions,rows:d.rows,conditionedError01:d.conditionedError01,shuffledBaselineError01:d.shuffledBaselineError01,causalGain01:d.causalGain01,reproducibility01:d.reproducibility01,behavioralGain01:d.behavioralGain01,interventionConfidence01:d.interventionConfidence01,stableAction:d.stableAction,holdout:hold,replay,ablation,restorePreserved:true}));
