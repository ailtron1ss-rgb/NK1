import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.35+i*.05]));
const input=(tick,phase=0)=>Array.from({length:64},(_,k)=>Math.sin((tick+1)*(k+3)*.017+phase)*.35 + Math.cos(k*.11+phase)*.12);
const run=(profile='balanced',experimental=true,normalize=true,cycles=72)=>{
  const b=new NeuralExperienceBranch();
  b.setCreditDelayProfile(profile);
  b.setExperimentalLayerEnabled(experimental);
  b.setSelfNormalizationStrength(experimental&&normalize?.45:0);
  let last=null;
  for(let t=0;t<cycles;t++){
    const r=b.beforeDecision({tick:t+1,input:input(t),baseUtilities:utilities,predictionError01:.18+.42*(t%11===0),novelty01:.25+.55*(t%9===0),uncertainty01:.18+.5*(t%13===0),homeostasis01:.45,identityGap01:.2,goalPressure01:.35+(t%7===0?.3:0),reward01:t%5===0?.72:.44,identityVector:Array.from({length:16},(_,k)=>Math.sin(k+t*.03))});
    last=r.experience;
    b.afterOutcome({tick:t+1,action:actions[t%actions.length],reward01:t%6===0?.78:.42,predictionError01:t%10===0?.68:.16,verified01:t%4===0?1:.65,nextInput:input(t+1,.3),holdout01:t%3===0?1:0,goalPressure01:.4,identityGap01:.2});
  }
  return {b,last,m:b.continuityMetrics()};
};

const base=defaultNeuralExperienceBranch();
assert.equal(base. version,25);
assert.ok(base.deepLearningCoupler?.version===1);

const profiles=['short','balanced','long','ultra'];
const runs=profiles.map(p=>run(p,true,false,36));
const trajectories=runs.map(r=>r.b.diagnostics().edgeWeights.flat().reduce((s,x)=>s+Math.abs(x),0));
const sweepLong=runs.map(r=>r.b.diagnostics().longDelayCredit01);
const sweepTrace=runs.map(r=>r.b.diagnostics().deepLearningCoupler.delayProfile.slowWeight01);
assert.ok(new Set(sweepTrace.map(x=>x.toFixed(6))).size>=3,'delay sweep profiles did not remain distinct');

const exp=run('balanced',true);
const ctl=run('balanced',false);
const eDiag=exp.b.diagnostics();
const cDiag=ctl.b.diagnostics();
const diff=eDiag.edgeWeights.flat().reduce((s,x,i)=>s+Math.abs(x-(cDiag.edgeWeights.flat()[i]??0)),0);
assert.ok(diff>0.01,`experimental/control trajectory difference too small: ${diff}`);
const coupled=eDiag.deepLearningCoupler;
assert.ok(coupled.normalizationUpdates>0);
assert.ok(coupled.epistemicTeaching01>0);
assert.ok(coupled.causalTeaching01>0);
assert.ok(coupled.coupledCredit01>0);
assert.ok(coupled.couplingStability01>=0 && coupled.couplingStability01<=1);
const all=eDiag.edgeWeights.flat();
const mean=all.reduce((s,x)=>s+x,0)/all.length;
const rms=Math.sqrt(all.reduce((s,x)=>s+x*x,0)/all.length);
assert.ok(Math.abs(mean)<.02,`self-normalized mean too high: ${mean}`);
assert.ok(rms<.12,`weight RMS unstable: ${rms}`);

const started=performance.now();
run('balanced',true);
const elapsed=performance.now()-started;
assert.ok(elapsed<10000,`72-cycle neural coupling run too slow: ${elapsed.toFixed(1)}ms`);

console.log(`P2708_DEEP_LEARNING_COUPLING=PASS diff=${diff.toFixed(5)} mean=${mean.toFixed(5)} rms=${rms.toFixed(5)} coupled=${coupled.coupledCredit01.toFixed(4)} epistemic=${coupled.epistemicTeaching01.toFixed(4)} normUpdates=${coupled.normalizationUpdates} sweep=${trajectories.map(x=>x.toFixed(3)).join(',')} elapsedMs=${elapsed.toFixed(1)}`);
