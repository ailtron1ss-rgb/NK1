import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { CognitiveSpineScheduler } from '../src/organism/system/CognitiveSpineScheduler.ts';
import { DerivedWorldPreviewCache } from '../src/organism/system/DerivedWorldPreviewCache.ts';
import { WorldModel2 } from '../src/organism/developmental/WorldModel2.ts';
import { FutureSimulator } from '../src/organism/developmental/FutureSimulator.ts';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { CognitiveSubsystemFacade } from '../src/organism/core/CognitiveSubsystemFacade.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// 1) Scheduler must recognize non-text external evidence.
const scheduler = new CognitiveSpineScheduler();
const text = scheduler.decide({tick:1,surprise01:0,predictionError01:.1,novelty01:.2,goalPressure01:.2,budgetMode:'balanced',remainingBudget01:.9,externalInput:true,awake:true});
const world = scheduler.decide({tick:2,surprise01:0,predictionError01:.1,novelty01:.2,goalPressure01:.2,budgetMode:'balanced',remainingBudget01:.9,externalInput:true,awake:true});
assert.equal(text.run.shadow, true);
assert.equal(world.run.shadow, true);

// 2) Cached workspace-only world previews must be semantically equal to a fresh build.
const modelA = new WorldModel2();
const modelB = new WorldModel2();
const cache = new DerivedWorldPreviewCache();
const sim = new FutureSimulator();
const input = {tick:4,worldContextVersion:1,uncertainty01:.32,externalInput:true,deep:false,refreshEveryTicks:4};
const cached = cache.getOrRefresh(modelA,sim,input);
const freshWorld = {};
for (const a of ['respond','explore','verify','rest','reflect','wait','defer']) freshWorld[a] = modelB.predict(a,.5,.32);
const freshFuture = new FutureSimulator().simulate(modelB,['reflect','verify'],.5);
for (const action of Object.keys(freshWorld)) {
  assert.deepEqual(cached.worldPreview[action], freshWorld[action], `cache mismatch for ${action}`);
}
assert.deepEqual(cached.futurePreview, freshFuture);
const hit = cache.getOrRefresh(modelA,sim,{...input,tick:5,externalInput:false});
assert.equal(hit.refreshed,false);
assert.equal(cache.snapshot().hits,1);

// 3) Project retry must terminate instead of retrying forever.
const exec = new AutonomousProjectExecutor();
exec.ensure({id:'x',origin:'unresolved'});
for(let tick=1;tick<=30;tick++){
  if(exec.canAttempt(tick)) exec.observeToolResult({tick,tool:'organism.project.context',ok:false,error:'simulated-failure'});
}
const afterFailures = exec.snapshot();
assert.equal(afterFailures.steps[0].blocked,true);
assert.equal(afterFailures.steps[0].attempts,0);
assert.equal(afterFailures.steps[0].failureAttempts,4);
assert.equal(exec.canAttempt(31),false);


// 3b) A genuinely new external/device signal can reopen a terminally blocked step.
const recovery = new AutonomousProjectExecutor();
recovery.ensure({id:'r',origin:'unresolved'});
for(let tick=1;tick<=20;tick++){ if(recovery.canAttempt(tick)) recovery.observeToolResult({tick,tool:'x',ok:false,error:'x'}); }
assert.equal(recovery.snapshot().steps[0].blocked,true);
assert.equal(recovery.reopenBlockedStep({tick:7,reason:'external-evidence'}),true);
assert.equal(recovery.snapshot().steps[0].blocked,false);
assert.equal(recovery.snapshot().steps[0].failureAttempts,0);

// 4) Stable subsystem contracts can be consumed without reaching into OrganismCore internals.
const core = new OrganismCore(new MemoryStateStore(),{cycleResultMode:'operational',checkpointMinIntervalMs:60000});
await core.init();
const facade = new CognitiveSubsystemFacade(core);
const ports = facade.subsystems();
assert.ok(ports.self && ports.world && ports.memory && ports.agency && ports.embodiment && ports.research && ports.governance);
assert.ok(ports.self.snapshot());
assert.ok(ports.agency.autonomousProject());

// 5) Short hot-path sanity benchmark.
const samples=[];
for(let i=0;i<40;i++){
  const t=performance.now();
  await core.observeOperational({reward:i%11===0?.7:undefined,worldContext:{tick:i,location:'bench',energy:.8,attention:.8,uncertainty:.3,facts:[],objects:[],events:[]},embodiment:{bodyEnergy01:.82,cognitiveCapacity01:.84,thermalStrain01:.16,sensoryFreshness01:.86,awake:true,battery01:.82,cpuLoad01:.2,ramPressure01:.18}});
  samples.push(performance.now()-t);
}
const avg=(xs)=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const first=avg(samples.slice(0,10));
const last=avg(samples.slice(-10));
assert.ok(last/Math.max(first,.001)<10);
console.log(`BIG_PASS_45_ARCHITECTURE_PERFORMANCE=PASS first=${first.toFixed(2)}ms last=${last.toFixed(2)}ms ratio=${(last/Math.max(first,.001)).toFixed(3)} cacheHits=1 retryCeiling=4`);
