import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const lib = new ProceduralSkillLibrary();
const baseSteps = [
  { id:'inspect', action:'explore', toolId:'tool.inspect', input:{mode:'safe'}, expectedOutputKeys:['value'], maxAttempts:1, resourceCost01:.08 },
  { id:'verify', action:'verify', toolId:'tool.verify', inputBindings:{value:'$step:inspect.value'}, requiredInputKeys:['value'], expectedOutputKeys:['accepted'], fallbackToolIds:['tool.verify.fallback'], maxAttempts:1, resourceCost01:.12 },
];
const a = lib.compileCompoundSkill({projectId:'project-a',name:'same-shape',origin:'intrinsic',steps:baseSteps});
const b = lib.compileCompoundSkill({projectId:'project-b',name:'same-shape',origin:'intrinsic',steps:baseSteps});
assert.ok(a && b);
assert.notEqual(a.id,b.id,'compound skills from different projects must not collide');
assert.equal(a.policy.requireVerified,true);
assert.ok(a.policy.maxTotalAttempts>=2);
assert.ok(a.policy.maxTotalResourceCost01>.1);
assert.equal(a.steps[1].inputBindings.value,'$step:inspect.value');

for(let i=0;i<5;i++) lib.recordCompoundExecution(a.id,{success01:1,verified:true,independent:true,context:`compiler context ${i}`});
const reusable=lib.findReusableCompoundSkill('compiler context 4');
assert.ok(reusable?.status==='reusable');
const adapted=lib.adaptCompoundSkill(reusable.id,{stepId:'verify',fromTool:'tool.verify',toTool:'tool.verify.fallback',reason:'primary tool failed independently',verified:true,confidence01:.95});
assert.ok(adapted);
assert.equal(adapted.repairs,1);
assert.equal(adapted.mutations,1);
assert.ok(adapted.steps[1].fallbackToolIds?.includes('tool.verify.fallback'));

const restored = new ProceduralSkillLibrary();
restored.restore({version:4,compoundSkills:[{...a,policy:undefined,mutations:undefined,repairs:undefined,successfulFallbacks:undefined,adaptations:undefined}],skills:[],promotions:0,demotions:0,compoundPromotions:0});
assert.equal(restored.snapshot().version,8);
assert.ok(restored.snapshot().compoundSkills[0].policy);

const core = new OrganismCore(new MemoryStateStore(),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:2,cycleResultMode:'operational'});
await core.init();
let primaryCalls=0;
let fallbackCalls=0;
core.registerActionTool({id:'tool.compiler.inspect',capability:'safe.test',destructive:false,projectAllowed:false,execute:async()=>({ok:true,value:'payload-99'}),verify:async()=>({verified:true,basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'inspect'})});
core.registerActionTool({id:'tool.compiler.primary',capability:'safe.test',destructive:false,projectAllowed:false,execute:async()=>{primaryCalls++;return {ok:false,error:'primary-failure'};},verify:async()=>({verified:false,basis:'none',confidence01:.1,externalObservation:false,notes:'primary failed'})});
core.registerActionTool({id:'tool.compiler.fallback',capability:'safe.test',destructive:false,projectAllowed:false,execute:async(input)=>{fallbackCalls++;return {ok:input.value==='payload-99',accepted:input.value==='payload-99'};},verify:async({result})=>({verified:Boolean(result?.accepted),basis:'tool-contract',confidence01:.96,externalObservation:false,notes:'fallback verified'})});
const cs=core.compileCompoundSkill({projectId:'core-compiler',name:'adaptive-compile',origin:'intrinsic',steps:[
  {id:'inspect',action:'explore',toolId:'tool.compiler.inspect',expectedOutputKeys:['value'],maxAttempts:1,resourceCost01:.1},
  {id:'verify',action:'verify',toolId:'tool.compiler.primary',inputBindings:{value:'$step:inspect.value'},fallbackToolIds:['tool.compiler.fallback'],expectedOutputKeys:['accepted'],maxAttempts:1,resourceCost01:.15},
]});
assert.ok(cs);
for(let i=0;i<5;i++) core.recordCompoundSkillExecution(cs.id,{success01:1,verified:true,independent:true,context:`adaptive compiler ${i}`});
const rc=core.reusableCompoundSkill('adaptive compiler 4');
assert.ok(rc?.status==='reusable');
const run=await core.executeReusableSkill(rc.id,{contextKey:'adaptive compiler 5',independentEvidence:true},'pass99-fallback');
assert.equal(run.ok,true);
assert.equal(run.verified,true);
assert.equal(run.results.length,2);
assert.equal(primaryCalls,1);
assert.equal(fallbackCalls,1);
assert.ok(run.results[1].tool==="tool.compiler.fallback");
const latest=core.reusableCompoundSkill('adaptive compiler 5');
assert.ok(latest?.steps[1].fallbackToolIds?.includes('tool.compiler.fallback'));
assert.ok(latest?.repairs>=1);
assert.ok(latest?.successfulFallbacks>=1);
const run2=await core.executeReusableSkill(latest.id,{contextKey:'adaptive compiler 6',independentEvidence:true},'pass99-fallback-repeat');
assert.equal(run2.ok,true);
assert.equal(run2.verified,true);
assert.equal(primaryCalls,2);
assert.equal(fallbackCalls,2);
const mutated=core.reusableCompoundSkill('adaptive compiler 6');
assert.ok(mutated?.steps[1].toolId==='tool.compiler.fallback','verified repeated fallback should be promoted to preferred tool');
assert.ok((mutated?.mutations??0)>=3);
assert.ok((mutated?.lineageVersion??0)>=3);
assert.ok((mutated?.repairsLedger?.length??0)>=2);
const run3=await core.executeReusableSkill(mutated.id,{contextKey:'adaptive compiler 7',independentEvidence:true},'pass99-promoted');
assert.equal(run3.ok,true);
assert.equal(run3.verified,true);
assert.equal(primaryCalls,2,'promoted fallback should bypass failed primary on next execution');
assert.equal(fallbackCalls,3);
await core.flush();
console.log('BIG_PASS_99_SKILL_COMPILER=PASS',JSON.stringify({version:restored.snapshot().version,distinctIds:a.id!==b.id,repairs:latest?.repairs,mutations:mutated?.mutations,primaryCalls,fallbackCalls}));
