import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.30+i*.045]));
const vec=(task,t)=>Array.from({length:64},(_,k)=>{
  const phase=[.00,.71,1.43,2.31][task%4];
  return .34*Math.sin((k+1)*.071+t*.013+phase)+.21*Math.cos((k+3)*.047-t*.009-phase)+.05*task;
});

function run(experimental=true){
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(experimental);
  for(let t=0;t<240;t++){
    const task=t<48?0:t<96?1:t<144?2:t<192?3:((t/12)|0)%4;
    const low=t%29===0;
    b.beforeDecision({
      tick:t,input:vec(task,t),baseUtilities:utilities,
      predictionError01:.18+.06*(task%3),novelty01:task===3?.72:.24+.08*(task%2),
      uncertainty01:task===2?.52:low?.60:.29,homeostasis01:.45,identityGap01:.14+task*.025,
      goalPressure01:.32+task*.045,reward01:.56,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.09+t*.01)+task*.2),
      embodied:{cpuLoad01:low?.94:.32,ramPressure01:low?.92:.26,battery01:low?.16:.85,sensorFreshness01:.95}
    });
    const action=task===2?'verify':task===3?'explore':task===1?'respond':'reflect';
    const reward=(task===0&&action==='reflect')?.84:(task===1&&action==='respond')?.86:(task===2&&action==='verify')?.91:(task===3&&action==='explore')?.82:.63;
    b.afterOutcome({tick:t+1,action,reward01:reward,predictionError01:1-reward,verified01:reward>.79?1:.6,nextInput:vec(task,t+1),holdout01:t%7===0?1:0,goalPressure01:.32+task*.045,identityGap01:.14+task*.025,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.09+(t+1)*.01)+task*.2)});
  }
  const d=b.diagnostics();
  return {b,d};
}

const exp=run(true),ctl=run(false);
const a=exp.d.autonomousContinual;
assert.equal(exp.d.version,25);
assert.ok(a.contextCounts.filter(x=>x>0).length>=3,'context allocator did not separate A/B/C-like regimes');
assert.ok(a.contextActionModel.flat().reduce((s,m)=>s+m.samples,0)>100,'context-conditioned action models remained inert');
assert.ok(a.latentActionModel.reduce((s,m)=>s+m.samples,0)>100,'latent transition model remained inert');
assert.ok(a.latentActionModel.some(m=>m.confidence01>.25),'latent transition confidence stayed near prior');
assert.equal(a.replay.length,a.replayCapacity);
assert.ok(a.replayPolicyEntropy01>.70,'replay policy collapsed to a single strategy');
assert.ok(a.replayPolicyMix01.every(x=>x>.01),'replay mixture lost a strategy entirely');
assert.ok(a.replayUsed>0,'adaptive replay not consumed');
assert.ok(a.planning.rollouts>0 && a.planning.adaptiveHorizon01>=.25);
const expMass=exp.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
const ctlMass=ctl.d.edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0);
assert.ok(Math.abs(expMass-ctlMass)>.01,'context/model replay layer did not alter neural trajectory');
const snap=exp.b.diagnostics();const resumed=new NeuralExperienceBranch();resumed.restore(snap);const rd=resumed.diagnostics();
assert.equal(rd.version,25);assert.equal(rd.autonomousContinual.outcomes,a.outcomes);assert.ok(rd.autonomousContinual.replayPolicyMix01.every((x,i)=>Math.abs(x-a.replayPolicyMix01[i])<1e-12));

console.log(`P2726_CONTEXT_MODEL_REPLAY=PASS outcomes=${a.outcomes} contexts=${a.contextCounts.filter(x=>x>0).length} `+
`ctxModelSamples=${a.contextActionModel.flat().reduce((s,m)=>s+m.samples,0)} latentSamples=${a.latentActionModel.reduce((s,m)=>s+m.samples,0)} `+
`latentConf=${a.latentActionModel.reduce((s,m)=>s+m.confidence01,0)/a.latentActionModel.length} `+
`replay=${a.replay.length}/${a.replaySeen} replayUsed=${a.replayUsed} `+
`mix=${a.replayPolicyMix01.map(x=>x.toFixed(3)).join(',')} entropy=${a.replayPolicyEntropy01.toFixed(4)} `+
`planDepth=${a.planning.depth} rollouts=${a.planning.rollouts} trajectoryDiff=${Math.abs(expMass-ctlMass).toFixed(4)} restartOutcomes=${rd.autonomousContinual.outcomes}`);
