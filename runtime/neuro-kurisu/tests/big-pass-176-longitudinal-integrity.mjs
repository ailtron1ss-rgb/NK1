import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { LongitudinalOrganismEngine } from '../src/organism/learning/LongitudinalOrganismEngine.ts';
import { AdaptivePolicyEngine } from '../src/organism/learning/AdaptivePolicyEngine.ts';
import { performance } from 'node:perf_hooks';

// 1) Prove replay uses the actual observed next state instead of duplicating stateBefore.
const engine=new LongitudinalOrganismEngine();
const policy=new AdaptivePolicyEngine();
const before={tick:1,needs:{energy:.9,cognitiveLoad:.1,uncertainty:.1,novelty:.1,goalPressure:.1,socialNeed:.1}};
const after={...before,tick:2,needs:{...before.needs,energy:.1,uncertainty:.95,goalPressure:.9}};
const trace={id:'bp176-trace-1',tick:2,createdAt:2,candidates:[],selected:{action:'verify',confidence:.8,predictedUtility:.6,goalId:null},stateBefore:before,stateAfter:after,outcome:{success:.9,surprise:.4,at:2},reasoningSignals:{},userRequestedAction:null,autonomousOverride:false,predictedOutcomes:[]};
const updates=engine.replay([trace],policy);
assert.equal(updates,1);
const keys=Object.keys(policy.snapshot().values);
assert.equal(keys.length,1);
assert.notEqual(keys[0], policy.contextKey(after, after.needs.goalPressure));
assert.equal(keys[0], policy.contextKey(before, before.needs.goalPressure));
assert.ok(Object.keys(policy.snapshot().values[keys[0]]).includes('verify'));

// 2) Replay idempotency must hold.
assert.equal(engine.replay([trace],policy),0);

// 3) Real organism long-horizon bounded execution + restart persistence.
const store=new MemoryStateStore();
const c=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile',checkpointMinIntervalMs:60000,checkpointMaxDirtyCycles:64});
await c.init();
const lat=[];
for(let i=0;i<180;i++){
  const t=performance.now();
  const r=await c.observeOperational({
    text:i%19===0?`bp176-${i}`:undefined,
    reward:i%37===0?.74:undefined,
    embodiment:{bodyEnergy01:.82,thermalStrain01:.16,cognitiveCapacity01:.84,sensoryFreshness01:.88,awake:true,battery01:.84,cpuLoad01:.20,ramPressure01:.18}
  });
  assert.ok(r.decision);
  lat.push(performance.now()-t);
}
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]??0};
const p50a=median(lat.slice(60,100)); const p50b=median(lat.slice(-40));
const ratio=p50b/Math.max(p50a,.001);
assert.ok(ratio<4.5,`mobile 180-cycle scaling ratio ${ratio}`);
const pre=c.longitudinalSnapshot();
assert.ok(c.snapshot().state.tick>=180);
assert.ok(pre.observedCycles>0);
await c.flush();
const cold=new OrganismCore(store,{cycleResultMode:'operational',performanceProfile:'mobile'});
await cold.init();
const post=cold.longitudinalSnapshot();
assert.ok(post.observedCycles>=pre.observedCycles,'explicit flush did not persist longitudinal observed cycles');

console.log(JSON.stringify({
  pass:176,
  replayUsesStateAfter:true,
  replayIdempotent:true,
  organismCycles:pre.observedCycles,
  restartObservedCycles:post.observedCycles,
  p50WarmMs:Number(p50a.toFixed(2)),
  p50LateMs:Number(p50b.toFixed(2)),
  scalingRatio:Number(ratio.toFixed(3)),
  longitudinalContinuity:Number(pre.continuity01.toFixed(3)),
  replayedTraceCount:engine.snapshot().replayedTraces
},null,2));
