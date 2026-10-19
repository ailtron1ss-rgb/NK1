import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
await core.beginBatch();

core.b302LongHorizonSetEpoch('baseline',1);
const baselineRespond=core.b299CausalPersonalityBias('respond');
let full=0,micro=0,autonomousFull=0; const timings=[];

for(let i=0;i<88;i++){
  const phase=i<24?'exploration':i<48?'verification':i<72?'reflection':'mixed';
  const body={bodyEnergy01:.84-i*.001,cognitiveCapacity01:.84,thermalStrain01:.20,sensoryFreshness01:.86,awake:true,battery01:.80-i*.0008,cpuLoad01:.22,ramPressure01:.20};
  const prompt = phase==='exploration'
    ? 'Explore alternatives and keep the approach that proves useful.'
    : phase==='verification'
      ? 'Verify the previous belief against evidence and revise it when contradicted.'
      : phase==='reflection'
        ? 'Reflect on what changed and preserve useful experience without repeating failed patterns.'
        : 'Choose what to do next using current goals, evidence, and resource limits.';
  if(i===24) core.b302LongHorizonSetEpoch('verification',i+1);
  if(i===48) core.b302LongHorizonSetEpoch('reflection',i+1);
  if(i===72) core.b302LongHorizonSetEpoch('mixed',i+1);
  const input=i%4===0
    ? {text:prompt,novelty:i%9===0?.84:.36+(i%5)*.065,surprise:i%11===0?.78:.16+(i%6)*.075,embodiment:body}
    : {embodiment:body};
  const t=performance.now(); const result=await core.observeOperational(input); timings.push(performance.now()-t);
  if(result.workspace.content.temporalResolution==='micro') micro++; else full++;
  if(result.decision?.selected?.action && result.decision.selected.action!=='wait'){
    const reward=i<24?.76:i<48?(i%5===0?.30:.46):i<72?.64:(i%3===0?.78:.38);
    const verifiedWorld=i>=24 && i<48 && i%4===0 ? {
      action:result.decision.selected.action,
      before:{tick:i,location:'lab',energy:.82,attention:.74,uncertainty:.58,facts:[`belief-${i}`],objects:[{id:`obj-${i}`,label:'test-object',location:'lab',value:.64,visible:true,collected:false,confidence01:.62,evidenceKind:'observed'}],events:[`before-${i}`]},
      after:{tick:i+1,location:'lab',energy:.78,attention:.77,uncertainty:.34,facts:[`belief-${i}`,`verified-${i}`],objects:[{id:`obj-${i}`,label:'test-object',location:'lab',value:.72,visible:true,collected:true,confidence01:.88,evidenceKind:'observed'}],events:[`before-${i}`,`after-${i}`]},
      reward, surprise:input.surprise??.12, at:Date.now()
    } : undefined;
    await core.feedback({success:reward,reward,surprise:input.surprise??.12,evidenceSource:verifiedWorld?'external':(i%12===0?'external':'unknown'),worldTransition:verifiedWorld});
  }
}

core.b302LongHorizonSetEpoch('autonomous',89);
for(let i=88;i<96;i++){
  const t=performance.now();
  const result=await core.autonomousHeartbeat(); timings.push(performance.now()-t); full++; autonomousFull++;
  const action=result.decision?.selected?.action ?? 'wait';
  const reward=action==='verify'?.74:action==='explore'?.78:action==='rest'?.70:action==='reflect'?.64:action==='respond'?.56:(i%2===0?.72:.34);
  await core.feedback({success:reward,reward,surprise:i%6===0?.62:.22,evidenceSource:i%8===0?'external':'unknown'});
}

const beforeRestart=core.b302LongHorizonDiagnostics();
await core.endBatch();
const b296=core.b296NeuralPersonalityAgencyDiagnostics();
const b299=core.b299CausalPersonalityDiagnostics();
const b285=core.b285NeuralLifeDiagnostics();
const temporal=core.temporalResolutionSnapshot();
const snap=core.snapshot();
assert.equal(snap.state.tick,96,'long-horizon tick mismatch');
assert.ok(micro>=40,'temporal economy did not produce enough micro cycles');
assert.ok(full>=28,'not enough full cognitive pulses');
assert.ok(autonomousFull===8,'autonomous phase did not execute 40 full pulses');
assert.ok(b296.learningUpdates>=28,'B296 did not learn over long horizon');
assert.ok(b296.synapticUpdates>3500,'B296 synaptic plasticity did not remain active');
assert.ok(b299.learningUpdates>=28,'B299 did not learn over long horizon');
assert.ok(b285.consolidationCount>=3,'B285 longitudinal consolidation did not remain active');
assert.ok(beforeRestart.consolidationWindows>=1,'B302 did not record a long-horizon consolidation window');
assert.ok(beforeRestart.autonomousBehaviorFraction01>0,'B302 did not observe autonomous outcomes');
assert.ok(beforeRestart.verifiedUpdates>=4,'B302 did not observe verified world transitions');
assert.ok(beforeRestart.longHorizonReadiness01>0,'B302 readiness did not increase');
assert.ok(beforeRestart.behaviorShift01>0,'no measurable behavior/policy shift occurred');
assert.ok(Math.abs(core.b299CausalPersonalityBias('respond')-baselineRespond)>1e-5,'personality did not change from baseline');

const restoredCore=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:true,operationalPulseEvery:4,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await restoredCore.init();
await restoredCore.beginBatch();
const restored=restoredCore.b302LongHorizonDiagnostics();
assert.equal(restored.ticks,beforeRestart.ticks,'B302 tick state lost on restart');
assert.equal(restored.pulses,beforeRestart.pulses,'B302 pulse count lost on restart');
assert.equal(restored.consolidationWindows,beforeRestart.consolidationWindows,'B302 consolidation state lost on restart');
assert.equal(restoredCore.b296NeuralPersonalityAgencyDiagnostics().learningUpdates,b296.learningUpdates,'B296 learning state lost on restart');
assert.equal(restoredCore.b299CausalPersonalityDiagnostics().learningUpdates,b299.learningUpdates,'B299 learning state lost on restart');
await restoredCore.endBatch();

const avg=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
const report={
  pass:true,ticks:snap.state.tick,full,micro,autonomousFull,meanCycleMs:avg(timings),
  p95CycleMs:[...timings].sort((a,b)=>a-b)[Math.floor(timings.length*.95)],baselineRespond,
  finalRespondBias:core.b299CausalPersonalityBias('respond'),
  b296:{learningUpdates:b296.learningUpdates,synapticUpdates:b296.synapticUpdates,learningEligibleCycles:b296.learningEligibleCycles},
  b299:{learningUpdates:b299.learningUpdates,autonomousUpdates:b299.autonomousUpdates,personalityInfluence01:b299.personalityInfluence01,causalIntegrity01:b299.causalIntegrity01},
  b285:{learningUpdates:b285.learningUpdates,replayUpdates:b285.replayUpdates,consolidationCount:b285.consolidationCount,committedIdentityVersion:b285.committedIdentityVersion},
  b302:beforeRestart,temporal,restored:{ticks:restored.ticks,pulses:restored.pulses,consolidationWindows:restored.consolidationWindows}
};
console.log(JSON.stringify(report,null,2));
// The benchmark uses OrganismCore directly; its host harness intentionally keeps stdio sockets alive.
// End the standalone benchmark explicitly after all assertions so a passing evidence run is not reported as a timeout.
process.exit(0);
