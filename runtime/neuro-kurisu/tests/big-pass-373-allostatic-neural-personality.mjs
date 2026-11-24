import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions = ['respond','explore','verify','rest','reflect','wait','defer'];
const vector = (tick, stress=0.2, novelty=0.35) => Array.from({length:64}, (_,i) => {
  const wave = Math.sin((tick+i)*0.17)*0.35 + Math.cos((tick*0.07+i)*0.31)*0.18;
  if (i===0) return 0.45-stress*0.8;
  if (i===12) return novelty*2-1;
  if (i===42) return stress*0.8-0.2;
  return Math.max(-1, Math.min(1, wave));
});
const ctx = (bias=0) => Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:Math.max(0,Math.min(1,.50 + (i===1?bias:0))),worldConfidence01:.62,worldUncertainty01:.38,needRelief01:i===3?.70:.45,predictedCost01:i===1?.40:.35} ]));
const l1 = (a,b) => actions.reduce((s,x)=>s+Math.abs((a[x]??0)-(b[x]??0)),0);
const top = p => Object.entries(p).sort((a,b)=>b[1]-a[1])[0][0];

function run(core, ticks=1000, stress=0.2, verified=true) {
  let entropy=0, changes=0, last=null, accepted=0;
  const t0=performance.now();
  for(let tick=1; tick<=ticks; tick++) {
    const novelty = tick<180 ? .72 : tick<480 ? .18 : .46;
    const frame=core.step({tick,vector:vector(tick,stress,novelty),novelty01:novelty,uncertainty01: tick<180?.82:tick<480?.24:.58,goalPressure01: tick<220?.70:.38,autonomy01:.82,actionContext:ctx(tick<180?.14:0),learningEnabled:true});
    entropy+=frame.actionProbabilities ? -Object.values(frame.actionProbabilities).reduce((s,p)=>s+(p>1e-9?p*Math.log(p)/Math.log(actions.length):0),0) : 0;
    const k=top(frame.actionProbabilities); if(last && last!==k) changes++; last=k;
    const reward = k==='verify' ? .78 : k==='explore' ? .68 : k==='rest' ? .63 : .48;
    const before=core.snapshot();
    core.learnFromOutcome({tick,action:k,reward01:reward,predictionError01:Math.abs(.5-reward)*.7,verified01:verified?1:0,externalEvidence01:verified?1:0,novelty01:novelty,actualUtility01:reward,actualStateDelta01:Math.abs(.5-reward)});
    const after=core.snapshot();
    if(verified && after.allostatic.verifiedAdaptations>before.allostatic.verifiedAdaptations) accepted++;
  }
  const elapsed=performance.now()-t0;
  const d=core.diagnostics();
  return {elapsed,p50ms:elapsed/ticks,entropyMean:entropy/ticks,changes,accepted,diagnostics:d,top:d.lastAction};
}

const on = new B365UnifiedNeuroCausalCore();
const off = new B365UnifiedNeuroCausalCore();
off.setAllostaticDriveEnabled(false);

const onEarly = run(on, 260, 0.15, true);
const offEarly = run(off, 260, 0.15, true);
const onLong = run(on, 1000, 0.72, true);
const holdout = run(on, 260, 0.34, true);

const onDiag = on.allostaticDiagnostics();
const offDiag = off.allostaticDiagnostics();
assert.equal(onDiag.enabled, true);
assert.equal(offDiag.enabled, false);
assert(onDiag.verifiedAdaptations > 0, 'verified adaptation must occur');
assert(onDiag.drive01 !== .20 || onDiag.exploration01 !== .28, 'internal drives must move');
assert(l1(on.snapshot().lastActionProbabilities.reduce((a,v,i)=>{a[actions[i]]=v;return a;},{}), off.snapshot().lastActionProbabilities.reduce((a,v,i)=>{a[actions[i]]=v;return a;},{})) > .01, 'allostatic ON/OFF must causally diverge policy');
assert(onLong.diagnostics.cycles >= 1260, 'long horizon cycles must persist');
assert(onLong.diagnostics.replayBufferSize <= 128, 'bounded memory');
assert(onLong.diagnostics.activeSynapses > 0, 'neural substrate must remain active');
assert(onLong.elapsed < 15000, '1000 cycles should remain mobile-scale in host benchmark');

const persisted = on.snapshot();
const resumed = new B365UnifiedNeuroCausalCore();
resumed.restore(persisted);
const pBefore=resumed.diagnostics();
resumed.step({tick:pBefore.cycles+1,vector:vector(pBefore.cycles+1,.30,.40),novelty01:.40,uncertainty01:.40,goalPressure01:.45,autonomy01:.82,actionContext:ctx(),learningEnabled:false});
const pAfter=resumed.diagnostics();
assert.equal(resumed.allostaticDiagnostics().verifiedAdaptations, persisted.allostatic.verifiedAdaptations);
assert(pAfter.cycles === pBefore.cycles+1, 'restart must resume exactly one cycle');

const unverified = new B365UnifiedNeuroCausalCore();
const beforeU=unverified.allostaticDiagnostics();
for(let tick=1; tick<=120; tick++) {
  const f=unverified.step({tick,vector:vector(tick,.3,.5),novelty01:.5,uncertainty01:.5,goalPressure01:.45,autonomy01:.8,actionContext:ctx(),learningEnabled:true});
  unverified.learnFromOutcome({tick,action:f.selectedAction,reward01:.8,predictionError01:.2,verified01:0,externalEvidence01:0,novelty01:.5});
}
const afterU=unverified.allostaticDiagnostics();
assert.equal(afterU.verifiedAdaptations, beforeU.verifiedAdaptations, 'unverified events must not mutate developmental personality counters');
assert(afterU.rejectedAdaptations > 0, 'unverified adaptation must be rejected');
const base = new B365UnifiedNeuroCausalCore().snapshot();
const stressed = structuredClone(base); stressed.allostatic.levels.energy01=.08; stressed.allostatic.levels.thermal01=.88; stressed.allostatic.deficits.energy01=.94; stressed.allostatic.deficits.thermal01=.78; stressed.allostatic.preservation01=.86; stressed.allostatic.drive01=.74;
const uncertain = structuredClone(base); uncertain.allostatic.levels.energy01=.62; uncertain.allostatic.levels.thermal01=.28; uncertain.allostatic.levels.uncertainty01=.96; uncertain.allostatic.deficits.uncertainty01=.88; uncertain.allostatic.exploration01=.86; uncertain.allostatic.reflection01=.72;
const stressCore=new B365UnifiedNeuroCausalCore(); stressCore.restore(stressed); const stressFrame=stressCore.step({tick:1,vector:vector(1,.75,.18),novelty01:.18,uncertainty01:.22,goalPressure01:.52,autonomy01:.82,actionContext:ctx(),learningEnabled:false});
const uncertaintyCore=new B365UnifiedNeuroCausalCore(); uncertaintyCore.restore(uncertain); const uncertaintyFrame=uncertaintyCore.step({tick:1,vector:vector(1,.12,.90),novelty01:.90,uncertainty01:.92,goalPressure01:.52,autonomy01:.82,actionContext:ctx(),learningEnabled:false});
assert(stressFrame.actionProbabilities.rest > stressFrame.actionProbabilities.explore, 'allostatic preservation pressure must causally favour rest over exploration');
assert(uncertaintyFrame.actionProbabilities.explore > stressFrame.actionProbabilities.explore, 'novelty/uncertainty drive must causally increase exploration');

console.log(JSON.stringify({
  pass:true,
  causal:{policyDivergenceOnOff:l1(on.snapshot().lastActionProbabilities.reduce((a,v,i)=>{a[actions[i]]=v;return a;},{}),off.snapshot().lastActionProbabilities.reduce((a,v,i)=>{a[actions[i]]=v;return a;},{})),onVerifiedAdaptations:onDiag.verifiedAdaptations,offVerifiedAdaptations:offDiag.verifiedAdaptations},
  longHorizon:{elapsedMs:onLong.elapsed,cycles:onLong.diagnostics.cycles,entropyMean:onLong.entropyMean,actionSwitches:onLong.changes,activeSynapses:onLong.diagnostics.activeSynapses,replayBuffer:onLong.diagnostics.replayBufferSize},
  allostatic:{drive:onDiag.drive01,arousal:onDiag.arousal01,exploration:onDiag.exploration01,preservation:onDiag.preservation01,reflection:onDiag.reflection01,traits:onDiag.traits,setpoints:onDiag.setpoints},
  holdout:{cycles:holdout.diagnostics.cycles,drive:holdout.diagnostics.allostatic?.drive01 ?? null},
  persistence:{verifiedAdaptations:resumed.allostaticDiagnostics().verifiedAdaptations,cycles:pAfter.cycles},
  antiFake:{unverifiedAcceptedAfter:afterU.verifiedAdaptations,rejected:afterU.rejectedAdaptations}
}));
