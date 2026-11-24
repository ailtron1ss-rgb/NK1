import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const makeVector=(seed,context=0)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,((((seed+1)*(i+3)+(context+2)*17)%29)/14)-1)));
const rows=[];
for(let seed=1;seed<=6;seed++){
  const net=new B365UnifiedNeuroCausalCore();
  for(let t=1;t<=144;t++){
    const context=t%4;
    const r=net.step({tick:t,vector:makeVector(seed,context),novelty01:context===2?.72:.24,uncertainty01:context===3?.66:.22,predictionError01:context%2?.31:.12,goalPressure01:.2+.1*context,autonomy01:.55,learningEnabled:true});
    const target=ACTIONS[(seed+context+t)%ACTIONS.length];
    const reward=target===r.selectedAction ? .86 : .34;
    net.learnFromOutcome({tick:t,action:target,reward01:reward,predictionError01:Math.abs(.5-reward),verified01:t%7===0?1:0,externalEvidence01:t%11===0?1:0,novelty01:context===2?.72:.24});
  }
  const before=net.snapshot();
  const probe=net.step({tick:145,vector:makeVector(seed,1),novelty01:.3,uncertainty01:.3,predictionError01:.15,learningEnabled:false});
  const lesion=net.lesionFraction(.5);
  const shamNet=new B365UnifiedNeuroCausalCore();
  const shamState=structuredClone(before);
  for(const s of shamState.synapses) s.weight*=.95;
  for(const row of shamState.actionReadout) for(let i=0;i<row.length;i++) row[i]*=.95;
  shamNet.restore(shamState);
  const sham=shamNet.step({tick:145,vector:makeVector(seed,1),novelty01:.3,uncertainty01:.3,predictionError01:.15,learningEnabled:false});
  const shamL1=ACTIONS.reduce((s,a,i)=>s+Math.abs((probe.actionProbabilities[a]??0)-(sham.actionProbabilities[a]??0)),0);
  assert.ok(lesion.l1>.006,`seed ${seed}: neural lesion effect too small ${lesion.l1}`);
  assert.ok(lesion.l1>shamL1*1.5+1e-5,`seed ${seed}: lesion/sham ratio weak lesion=${lesion.l1} sham=${shamL1}`);
  const restarted=new B365UnifiedNeuroCausalCore();
  restarted.restore(before);
  const rp=restarted.step({tick:145,vector:makeVector(seed,1),novelty01:.3,uncertainty01:.3,predictionError01:.15,learningEnabled:false});
  const restartL1=ACTIONS.reduce((s,a)=>s+Math.abs((probe.actionProbabilities[a]??0)-(rp.actionProbabilities[a]??0)),0);
  assert.ok(restartL1<1e-10,`seed ${seed}: restart drift ${restartL1}`);
  rows.push({seed,lesionL1:Number(lesion.l1.toFixed(6)),shamL1:Number(shamL1.toFixed(6)),ratio:Number((lesion.l1/Math.max(shamL1,1e-9)).toFixed(2)),selected:probe.selectedAction,learningUpdates:net.diagnostics().learningUpdates,activeSynapses:net.diagnostics().activeSynapses});
}
console.log(JSON.stringify({pass:true,status:'B365_UNIFIED_NEURO_CORE_CAUSAL_PASS',seeds:rows.length,minLesionL1:Math.min(...rows.map(x=>x.lesionL1)),minLesionShamRatio:Math.min(...rows.map(x=>x.ratio)),rows},null,2));
