import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const world=(tick,action,reward)=>({action,before:{tick,location:'b341-live',energy:.82,attention:.80,uncertainty:.44,facts:[`${action}-probe`],objects:[],events:[]},after:{tick:tick+1,location:'b341-live',energy:.79,attention:.77,uncertainty:reward>.55?.22:.80,facts:[`${action}-probe`,`reward-${reward}`],objects:[],events:['verified-transition']},reward,surprise:reward>.55?.05:.65,at:900000+tick});

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
const before=core.b299CausalPersonalityDiagnostics();
const beforeBias=Math.max(...['respond','explore','verify','rest','reflect','wait','defer'].map(a=>Math.abs(core.b299CausalPersonalityBias(a))));
for(let i=0;i<24;i++){
  const r=await core.observe({text:'b341 repeated self-authored experience'});
  await core.feedback({success:.92,reward:.90,surprise:.08,evidenceSource:'device',worldTransition:world(i,r.decision?.selected?.action??'reflect',.90)});
}
const trained=core.b299CausalPersonalityDiagnostics();
const slow=Math.abs(Number(trained.dominantPhenotype?.consolidatedPreference11??0));
const fast=Math.abs(Number(trained.dominantPhenotype?.preference11??0));
const afterBias=Math.max(...['respond','explore','verify','rest','reflect','wait','defer'].map(a=>Math.abs(core.b299CausalPersonalityBias(a))));
assert.ok(trained.learningUpdates>before.learningUpdates,'B341 live personality did not learn');
assert.ok(slow>.03,'B341 live slow personality weight did not consolidate');
assert.ok(fast>=slow,'B341 fast personality unexpectedly weaker than consolidated after positive training');
assert.ok(afterBias>beforeBias,'B341 consolidated personality did not reach decision bias surface');
console.log(JSON.stringify({pass:true,live:{learningUpdates:trained.learningUpdates,fast,slow,consolidationEvidence:trained.dominantPhenotype?.consolidationEvidence01??0,beforeBias,afterBias}}));
process.exit(0);
