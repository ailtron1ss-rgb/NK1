import assert from 'node:assert/strict';
import { P2805StabilityPlasticityArbiter } from '../src/organism/cognition/P2805StabilityPlasticityArbiter.ts';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];

function directRun(stress=false){
  const c=new P2805StabilityPlasticityArbiter(48);
  const actionReadout=actions.map((_,a)=>Array.from({length:48},(_,n)=>Math.sin((a+1)*(n+1)*.013)*.03));
  const edgeWeights=Array.from({length:48},(_,n)=>Array.from({length:12},(_,q)=>Math.cos((n+1)*(q+1)*.017)*.04));
  c.bootstrapFromCurrent(actionReadout,edgeWeights);
  for(let t=0;t<260;t++){
    const shock=stress&&(t%13===0||t>180&&t%7===0);
    const o=c.beforeDecision({tick:t,contextId:t%8,novelty01:shock?.76:.12+(t%3)*.06,uncertainty01:shock?.72:.22+(t%2)*.05,predictionError01:shock?.78:.12+(t%4)*.045,forgetting01:shock?.68:.08+(t%5)*.04,replayPressure01:shock?.82:.10+(t%4)*.06,resource01:stress?.38:.84,contextMatch01:shock?.42:.84});
    for(let n=0;n<48;n+=2){
      const gate=c.gateNeuron(n,shock?.85:.2,t%2? .54:.84);
      c.observeNeuron(n,(shock?.08:.018)*(gate+.2),stress?.15:.10,.12+(n%7)*.02,t%2?.55:.84);
      if((t+n)%11===0)c.updateSlowEdge(n,n%12,.04*Math.sin(t*.11+n),o.teacherBlend01,.14);
      if((t+n)%17===0)c.updateSlowAction((t+n)%actions.length,n,.03*Math.cos(t*.07+n),o.teacherBlend01,.18);
      if((t+n)%19===0)c.shouldResetNeuron(n,o.resetThreshold01);
      if((t+n)%23===0)c.replayCompatibility(stress?.34:.82,stress?.35:.88,shock?.74:.12,stress?.42:.84);
    }
  }
  return c;
}

const ctl=directRun(false),stress=directRun(true),m=ctl.metrics(),sm=stress.metrics();
assert.ok(m.learningEvents>1000,'controller did not learn enough events');
assert.ok(m.consolidatedWeights>500,'slow consolidation stayed inert');
assert.ok(m.sparseUpdates>0 && m.protectedUpdates>0,'gate did not produce both sparse and protected updates');
assert.ok(sm.resetPressure01>=m.resetPressure01,'stress did not raise reset pressure');
assert.ok(sm.plasticity01!==m.plasticity01,'stress did not change plasticity state');
assert.ok(sm.stability01!==m.stability01,'stress did not change stability state');
assert.ok(sm.replayProtectedEvents>=m.replayProtectedEvents,'stress did not exercise replay protection');

function branchRun(enabled){
  const b=new NeuralExperienceBranch();b.setExperimentalLayerEnabled(true);b.setStabilityPlasticityEnabled(enabled);
  for(let t=0;t<24;t++){
    const ctx=t<8?0:t<16?1:2;
    const input=Array.from({length:64},(_,k)=>.28*Math.sin(k*.057+t*.021+ctx*.71)+.12*Math.cos(k*.041-t*.01));
    b.beforeDecision({tick:t,input,baseUtilities:Object.fromEntries(actions.map((a,i)=>[a,.36+i*.04])),predictionError01:.17+.03*ctx,novelty01:.18+.07*ctx,uncertainty01:.25+.04*ctx,homeostasis01:.48,identityGap01:.12,goalPressure01:.30+ctx*.04,reward01:.64,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.08+t*.01)+ctx*.1)});
    const action=ctx===2?'verify':ctx===1?'respond':'reflect';
    const reward=ctx===2?.88:ctx===1?.84:.82;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:.86,nextInput:input.map(x=>x*.99+.004),goalPressure01:.30+ctx*.04,identityGap01:.12});
  }
  return b.diagnostics();
}
const exp=branchRun(true),base=branchRun(false);
assert.ok(exp.stabilityPlasticity,'branch is missing P2805 state');
assert.ok(exp.stabilityPlasticity.learningEvents>0,'P2805 not connected to real neural updates');
const dm=Math.abs(exp.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0)-base.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0));
assert.ok(dm>.001,'P2805 integration did not alter neural trajectory');
const resumed=new NeuralExperienceBranch();resumed.restore(exp);assert.equal(resumed.diagnostics().stabilityPlasticity.learningEvents,exp.stabilityPlasticity.learningEvents);
console.log(`P2805_STABILITY_PLASTICITY=PASS directEvents=${m.learningEvents} consolidated=${m.consolidatedWeights} sparse=${m.sparseUpdates} protected=${m.protectedUpdates} resetPressure=${m.resetPressure01.toFixed(4)} stressResetPressure=${sm.resetPressure01.toFixed(4)} branchEvents=${exp.stabilityPlasticity.learningEvents} branchResets=${exp.stabilityPlasticity.selectiveResets} trajectoryDiff=${dm.toFixed(4)} restart=${resumed.diagnostics().stabilityPlasticity.learningEvents}`);
