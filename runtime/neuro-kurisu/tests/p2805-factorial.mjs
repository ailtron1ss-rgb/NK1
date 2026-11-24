import assert from 'node:assert/strict';
import { P2805StabilityPlasticityArbiter } from '../src/organism/cognition/P2805StabilityPlasticityArbiter.ts';

function run(mode){
  const c=new P2805StabilityPlasticityArbiter(64);
  const actions=7, ar=Array.from({length:actions},()=>new Array(64).fill(.01)), ew=Array.from({length:64},()=>new Array(12).fill(.02));
  c.bootstrapFromCurrent(ar,ew);
  for(let t=0;t<320;t++){
    const shock=t%23===0||t>220&&t%17===0;
    const o=c.beforeDecision({tick:t,contextId:(t/40|0)%8,novelty01:shock?.72:.16,uncertainty01:shock?.64:.24,predictionError01:shock?.75:.11,forgetting01:shock?.68:.09,replayPressure01:shock?.76:.14,resource01:shock?.42:.82,contextMatch01:shock?.45:.84});
    for(let n=0;n<64;n+=4){
      const gate=mode==='control'?1:c.gateNeuron(n,shock?.82:.18,shock?.48:.82,.12+(n%9)*.015);
      c.observeNeuron(n,(shock?.07:.015)*(gate+.25),.1,.12+(n%9)*.015,shock?.48:.82);
      if(mode!=='gate'&&t%3===0)c.updateSlowEdge(n,n%12,.03*Math.sin(t*.05+n),o.teacherBlend01,.16);
      if(mode==='full'&&t%29===0)c.shouldResetNeuron(n,o.resetThreshold01);
      if(mode!=='control'&&t%5===0)c.updateSlowAction(t%actions,n,.025*Math.cos(t*.03+n),o.teacherBlend01,.17);
    }
  }
  const m=c.metrics();
  const retained=1-(m.weightDrift01*.45+m.conflict01*.35+(1-m.stability01)*.20);
  return {m,retained};
}

const control=run('control'),gate=run('gate'),teacher=run('teacher'),full=run('full');
assert.ok(full.m.learningEvents>1000);
assert.ok(full.m.consolidatedWeights>1000);
assert.ok(full.m.sparseUpdates>0 && full.m.protectedUpdates>0);
assert.ok(full.m.replayProtectedEvents>=0);

assert.ok(full.m.stability01>=Math.min(control.m.stability01,teacher.m.stability01)-.12);
console.log(`P2805_FACTORIAL=PASS controlRetained=${control.retained.toFixed(4)} gateRetained=${gate.retained.toFixed(4)} teacherRetained=${teacher.retained.toFixed(4)} fullRetained=${full.retained.toFixed(4)} stability=${full.m.stability01.toFixed(4)} plasticity=${full.m.plasticity01.toFixed(4)} drift=${full.m.weightDrift01.toFixed(4)} protected=${full.m.replayProtectedEvents}`);
