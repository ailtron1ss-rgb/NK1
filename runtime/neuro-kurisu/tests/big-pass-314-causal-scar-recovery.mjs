import assert from 'node:assert/strict';
import { B285NeuralLifeConsolidationCore } from '../src/organism/cognition/B285NeuralLifeConsolidationCore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=Array.from({length:24},(_,i)=>Math.sin(i*.31));

// 1) Canonical B285 owner: scar must grow from verified negative outcomes, then recover slowly.
const life=new B285NeuralLifeConsolidationCore();
const baseBias=life.actionBias('respond');
for(let i=0;i<12;i++){
  life.recordNegativeOutcome({tick:i,action:'respond',severity01:.92,evidence01:.95,verified:true,predictionError01:.82,importance01:.9});
}
const scar=life.diagnostics();
const scarBias=life.actionBias('respond');
assert.ok(scar.negativeScar01>.20,'B314 scar did not consolidate verified negative experience');
assert.ok(scar.negativeScarCount===12,'B314 negative scar count mismatch');
assert.ok(scarBias<baseBias-.005,'B314 scar did not suppress the affected action');
for(let i=0;i<16;i++){
  life.recordRecovery({tick:20+i,action:'respond',reward01:.95,correctiveEvidence01:.95,futureConsistency01:.92,verified:true});
}
const recovered=life.diagnostics();
assert.ok(recovered.recovery01>.05,'B314 recovery evidence did not accumulate');
assert.ok(recovered.negativeScar01<scar.negativeScar01,'B314 recovery did not reduce scar strength');
// lesion must block future scar/recovery influence without deleting stored history.
const beforeLesion=life.diagnostics();
life.lesionScar(true);
const lesionBias=life.actionBias('respond');
assert.ok(Math.abs(lesionBias-baseBias)<.01,'B314 lesion did not remove scar action influence');
const blocked=life.recordNegativeOutcome({tick:100,action:'respond',severity01:1,evidence01:1,verified:true,predictionError01:1,importance01:1});
assert.equal(blocked.applied,false);
assert.equal(blocked.blockedByLesion,true);
life.clearScarLesion();

// 2) Live OrganismCore path: verified negative feedback must enter canonical B285 scar state.
const obs={embodiment:{bodyEnergy01:.94,cognitiveCapacity01:.92,thermalStrain01:.10,sensoryFreshness01:.88,battery01:.93,cpuLoad01:.14,ramPressure01:.14,awake:true},novelty:.46,surprise:.14};
const world=(tick,action,reward)=>({action,before:{tick,location:'b314-scar',energy:.8,attention:.8,uncertainty:.44,facts:[`${action}-probe`],objects:[],events:[]},after:{tick:tick+1,location:'b314-scar',energy:.79,attention:.78,uncertainty:reward>.5?.28:.78,facts:[`${action}-probe`,reward>.5?'corrective-proof':'negative-proof'],objects:[],events:['verified-transition']},reward,surprise:reward>.5?.07:.66,at:200000+tick});
const make=async(initial)=>{const c=new OrganismCore(new MemoryStateStore(initial?{initial}:{}),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});await c.init();return c;};
const core=await make();
for(let i=0;i<16;i++){
  const r=await core.observe({text:'b314 negative verified experience',...obs});
  const action=r.decision?.selected?.action ?? 'respond';
  await core.feedback({success:.05,reward:.04,surprise:.66,evidenceSource:'device',worldTransition:world(i,action,.04)});
}
const neg=core.b314CausalScarDiagnostics();
assert.ok(neg.negativeScar01>.08,'B314 live core did not create negative scar');
assert.ok(neg.negativeScarCount>0,'B314 live core scar count stayed zero');
assert.ok(Object.values(neg.scarActionBiases).some(v=>v<-.001),'B314 live core produced no action-specific scar bias');
const snap=core.snapshot();
const restored=await make(snap);
const rd=restored.b314CausalScarDiagnostics();
assert.equal(rd.negativeScarCount,neg.negativeScarCount,'B314 scar count lost after restart');
assert.ok(Math.abs(rd.negativeScar01-neg.negativeScar01)<1e-9,'B314 scar strength lost after restart');

// Corrective phase: real verified positive outcomes should lower scar, but not erase it instantly.
for(let i=0;i<20;i++){
  const r=await restored.observe({text:'b314 corrective verified experience',...obs});
  const action=r.decision?.selected?.action ?? 'respond';
  await restored.feedback({success:.95,reward:.86,surprise:.07,evidenceSource:'device',worldTransition:world(100+i,action,.95)});
}
const rec=restored.b314CausalScarDiagnostics();
assert.ok(rec.recoveryCount>0,'B314 recovery count stayed zero');
assert.ok(rec.recovery01>0,'B314 recovery evidence stayed zero');
assert.ok(rec.negativeScar01<rd.negativeScar01,'B314 live recovery did not weaken scar');

// Counterfactual causal test: lesion should prevent future scar updates and remove scar contribution.
const before=restored.b314CausalScarDiagnostics();
restored.b314CausalScarLesion(true);
const lesionDiag=restored.b314CausalScarDiagnostics();
assert.equal(lesionDiag.scarLesioned,true);
for(let i=0;i<4;i++){
  const r=await restored.observe({text:'b314 lesion negative',...obs});
  const action=r.decision?.selected?.action ?? 'respond';
  await restored.feedback({success:.04,reward:.03,surprise:.67,evidenceSource:'device',worldTransition:world(200+i,action,.03)});
}
const afterLesion=restored.b314CausalScarDiagnostics();
assert.equal(afterLesion.negativeScarCount,before.negativeScarCount,'B314 lesion failed to stop scar updates');
assert.ok(afterLesion.scarLesioned,'B314 lesion state unexpectedly cleared');
restored.b314CausalScarClearLesion();

const report={
  pass:true,
  standalone:{baseBias,scar01:scar.negativeScar01,scarBias,recovery01:recovered.recovery01,recoveredScar01:recovered.negativeScar01,lesionBias,blocked},
  liveNegative:{cycles:neg.negativeScarCount,scar01:neg.negativeScar01,recovery01:neg.recovery01},
  restart:{negativeScarCount:rd.negativeScarCount,negativeScar01:rd.negativeScar01},
  liveRecovery:{negativeScar01:rec.negativeScar01,recovery01:rec.recovery01,recoveryCount:rec.recoveryCount},
  lesion:{beforeCount:before.negativeScarCount,afterCount:afterLesion.negativeScarCount,scarLesioned:afterLesion.scarLesioned},
};
console.log(JSON.stringify(report,null,2));
process.exit(0);
