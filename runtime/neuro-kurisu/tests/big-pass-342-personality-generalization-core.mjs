import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',enableTemporalResolutionGovernor:false,operationalPulseEvery:1,checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
core.b299CausalPersonalitySetContext({social:1,epistemic:0,autonomy:0,maintenance:0});
const before=core.b299CausalPersonalityBias('verify');
let verifyCount=0;
for(let i=0;i<120 && verifyCount<20;i++){
  core.b299CausalPersonalitySetContext({social:0,epistemic:1,autonomy:0,maintenance:0});
  const r=await core.observe({text:'verify epistemic truth evidence, inspect facts and validate hypothesis'});
  const selected=r.decision?.selected?.action ?? 'wait';
  if(selected!=='verify') continue;
  verifyCount++;
  await core.feedback({success:.92,reward:.90,surprise:.08,evidenceSource:'device',worldTransition:{action:selected,before:{tick:i,location:'b342',energy:.82,attention:.8,uncertainty:.4,facts:[],objects:[],events:[]},after:{tick:i+1,location:'b342',energy:.78,attention:.78,uncertainty:.2,facts:['verified'],objects:[],events:['transition']},reward:.90,surprise:.08,at:910000+i}});
}
core.b299CausalPersonalitySetContext({social:1,epistemic:0,autonomy:0,maintenance:0});
const after=core.b299CausalPersonalityBias('verify');
const d=core.b299CausalPersonalityDiagnostics();
assert.ok(verifyCount>=8,`could not obtain enough real verify experiences; got ${verifyCount}`);
assert.ok(after>before+.001,`live Core did not generalize personality to new context: ${before} -> ${after}`);
assert.ok(Number(d.traitSlow11?.['truth-seeking']??0)>0,'truth-seeking slow trait did not consolidate');
core.b299CausalPersonalityLesion(1);
const lesioned=core.b299CausalPersonalityBias('verify');
assert.ok(Math.abs(lesioned)<Math.abs(after)*.2,'live lesion did not remove generalized personality influence');
console.log(JSON.stringify({pass:true,before,after,delta:after-before,lesioned,verifyCount,traitSlow:d.traitSlow11?.['truth-seeking'],traitEvidence:d.traitEvidence01?.['truth-seeking'],learningUpdates:d.learningUpdates}));
