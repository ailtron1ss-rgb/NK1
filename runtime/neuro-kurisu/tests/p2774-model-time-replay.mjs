import assert from 'node:assert/strict';
import { P2774ModelTimeReplayConsolidator } from '../src/organism/cognition/P2774ModelTimeReplayConsolidator.ts';

const latent=(t,c=0)=>Array.from({length:8},(_,k)=>.34*Math.sin(k*.19+t*.017+c*.41)+.08*Math.cos(k*.13-t*.011));
const actions=['respond','explore','verify','rest','reflect','wait','defer'];

function run(mode){
  const c=new P2774ModelTimeReplayConsolidator();
  let due=0, replaySamples=0;
  for(let t=0;t<420;t++){
    const context=t<140?0:t<280?1:0;
    const shock=(t%37===0)||(mode==='stress'&&t%11===0);
    const error=shock?.72:(mode==='quiet'?.08:.18+.06*Math.sin(t*.07)**2);
    const novelty=shock?.68:(mode==='quiet'?.05:.14);
    const uncertainty=shock?.64:(mode==='quiet'?.09:.20);
    const verification=shock?.42:.86;
    const out=c.beforeDecision({tick:t,contextId:context,baseUtilities:Object.fromEntries(actions.map((a,i)=>[a,.45+i*.025])),predictionError01:error,novelty01:novelty,uncertainty01:uncertainty,verification01:verification,resource01:mode==='stress'?.34:.86});
    if(out.replayDue){due++;const plan=c.replayPlan(mode==='stress'?.34:.86);replaySamples+=plan.maxSamples;c.noteReplay(Math.min(plan.maxSamples,2));}
    c.observeOutcome({tick:t,contextId:context,action:actions[t%actions.length],latentBefore:latent(t,context),latentAfter:latent(t+1,context),reward01:shock?.22:.64,predictionError01:error,novelty01:novelty,verified01:verification,worldModelDelta01:error*.7,causalDelta01:shock?.65:.12});
  }
  const m=c.metrics();
  const snap=c.snapshot();
  const r=new P2774ModelTimeReplayConsolidator();r.restore(snap);
  assert.equal(r.metrics().outcomes,m.outcomes,'restart outcome mismatch');
  return {m,last:c.beforeDecision({tick:421,contextId:0,baseUtilities:Object.fromEntries(actions.map(a=>[a,.5])),predictionError01:.3,novelty01:.2,uncertainty01:.25,verification01:.8,resource01:mode==='stress'?.34:.86}),due,replaySamples};
}

const rich=run('rich');
const quiet=run('quiet');
const stress=run('stress');
assert.ok(rich.m.modelTimeTotal>quiet.m.modelTimeTotal,'model time did not track learning change');
assert.ok(stress.m.forgettingRisk01>quiet.m.forgettingRisk01,'stress did not raise forgetting risk');
assert.ok(stress.m.replayIntervalModelTime<=quiet.m.replayIntervalModelTime,'stress did not shorten model-time replay interval');
assert.ok(rich.m.episodicWrites===420,'episodic writes mismatch');
assert.ok(rich.m.episodicCompactions>0,'episodic compaction never engaged');
assert.ok(rich.m.consolidationEvents>0,'semantic consolidation never engaged');
assert.ok(rich.m.bridgeUpdates===rich.m.consolidationEvents,'bridge/consolidation accounting mismatch');
assert.ok(rich.m.contextSemanticConfidence.some(x=>x>.1),'semantic confidence did not increase');
assert.ok(rich.m.replaySamples>0,'replay samples never recorded');
assert.ok(rich.last.replayBudget>=0 && rich.last.replayBudget<=6,'invalid replay budget');
console.log(`P2774_MODEL_TIME_REPLAY=PASS modelTime=${rich.m.modelTimeTotal.toFixed(3)} stressRisk=${stress.m.forgettingRisk01.toFixed(4)} quietInterval=${quiet.m.replayIntervalModelTime.toFixed(3)} stressInterval=${stress.m.replayIntervalModelTime.toFixed(3)} compact=${rich.m.episodicCompactions} consolidate=${rich.m.consolidationEvents} replaySamples=${rich.m.replaySamples} restart=${rich.m.outcomes}`);
