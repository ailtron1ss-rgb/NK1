import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=Object.fromEntries(actions.map((a,i)=>[a,.22+i*.065]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>{
  const phase=[.1,.9,1.9,3.1,4.3,5.2,6.1,7.0][task%8];
  return .34*Math.sin((k+1)*.067+t*.019+phase)+.14*Math.cos((k+5)*.043-t*.013-phase)+.055*task+.025*Math.sin(t*.061);
});
function run(mode){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(true);
  if(mode==='p2742') b.setUnifiedCausalWorldLoopEnabled(false);
  if(mode==='control') b.setExperimentalLayerEnabled(false);
  for(let t=0;t<480;t++){
    const task=t<80?0:t<160?1:t<240?2:t<320?3:t<400?4:(t%64<32?5:6);
    const shift=task===5||task===6||t%53===0;
    b.beforeDecision({tick:t,input:vec(task,t),baseUtilities:base,
      predictionError01:shift?.67:(task===2?.46:.16+.03*(task%4)),
      novelty01:shift?.78:(task===3?.62:.18+.075*(task%5)),
      uncertainty01:shift?.74:(task===2?.53:.24+.045*(task%3)),homeostasis01:.45,
      identityGap01:.10+task*.02,goalPressure01:.29+task*.041,reward01:.52,
      identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.087+t*.009)+task*.11),
      embodied:{cpuLoad01:shift?.93:.30,ramPressure01:shift?.86:.25,battery01:shift?.17:.83,sensorFreshness01:.95}
    });
    let action=task===2?'verify':task===3?'explore':task===4?'reflect':(task===5?'verify':task===6?'explore':'respond');
    const reward=(task===0&&action==='respond')?.89:(task===1&&action==='respond')?.84:(task===2&&action==='verify')?.92:(task===3&&action==='explore')?.87:(task===4&&action==='reflect')?.90:(task>=5&&['verify','explore'].includes(action))?.83:.57;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.8?1:.72,nextInput:vec(task,t+1),holdout01:t%13===0?1:0,goalPressure01:.29+task*.041,identityGap01:.10+task*.02});
  }
  for(let t=480;t<600;t++) b.microTick({tick:t,input:vec(t%8,t),action:t%5===0?'verify':t%2?'explore':'respond',reward01:.74,predictionError01:.22,verified01:.92,novelty01:.36,uncertainty01:.31,goalPressure01:.45,identityGap01:.16,worldConfidence01:.77,selfContinuity01:.86});
  return {b,d:b.diagnostics()};
}

const full=run('full'), old=run('p2742'), ctl=run('control');
const m=full.d.unifiedCausalWorldLoop;
assert.ok(m.outcomes>=450,'P2750 did not observe enough outcomes');
assert.ok(m.contextVisits.filter(x=>x>0).length>=3,'P2750 context allocator collapsed');
assert.ok(m.contextSwitches>=2,'P2750 failed to detect regime shifts');
assert.ok(m.fast.writes>0&&m.medium.writes>0&&m.slow.writes>0,'multi-rate memory did not write');
assert.ok(m.memoryConsensus01>=0&&m.memoryConsensus01<=1,'invalid memory consensus');
assert.ok(m.actions.filter(a=>a.samples>0).length>=4,'too few action world models learned');
assert.ok(m.worldConfidence01>.06,'world confidence stayed inert');
assert.ok(m.causalStrength.flat().some(x=>x>.0001),'causal graph did not accumulate signal');
assert.ok(m.syntheticReplayUsed>=0,'synthetic replay metric invalid');
assert.ok(m.replayUtility01>=0&&m.replayUtility01<=1,'invalid replay utility');
assert.ok(m.planningDepth>=1&&m.planningDepth<=3,'invalid planning depth');
const mass=d=>d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
const fm=mass(full.d),om=mass(old.d),cm=mass(ctl.d);
assert.ok(Math.abs(fm-om)>.0001,'P2750 produced no neural trajectory separation from P2742');
assert.ok(Math.abs(fm-cm)>.01,'P2750 produced no separation from control');
assert.ok(full.d.selfOptimizingContinual.replayFeedbackCount>100,'replay chain did not remain active');
const snap=full.b.diagnostics(),resumed=new NeuralExperienceBranch();resumed.restore(snap);const rd=resumed.diagnostics();
assert.equal(rd.unifiedCausalWorldLoop.outcomes,m.outcomes);
assert.equal(rd.unifiedCausalWorldLoop.contextVisits.join(','),m.contextVisits.join(','));
assert.ok(Math.abs(rd.unifiedCausalWorldLoop.worldConfidence01-m.worldConfidence01)<1e-12);
console.log(`P2750_UNIFIED_CAUSAL_WORLD_LOOP=PASS outcomes=${m.outcomes} contexts=${m.contextVisits.filter(x=>x>0).length} switches=${m.contextSwitches} `+
`world=${m.worldConfidence01.toFixed(4)} transitionErr=${m.transitionError01.toFixed(4)} causal=${m.causalCredit01.toFixed(4)} memory=${m.memoryConsensus01.toFixed(4)} `+
`info=${m.informationValue01.toFixed(4)} replay=${m.replayUtility01.toFixed(4)} synth=${m.syntheticReplayUsed} h=${m.predictionHorizon} `+
`p2750Diff=${Math.abs(fm-om).toFixed(4)} ctlDiff=${Math.abs(fm-cm).toFixed(4)} restart=${rd.unifiedCausalWorldLoop.outcomes}`);
