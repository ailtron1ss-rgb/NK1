import assert from 'node:assert/strict';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { ActionGateway } from '../src/organism/system/ActionGateway.ts';

const lib=new ProceduralSkillLibrary();
const compiled=lib.compileCompoundSkill({projectId:'p98',name:'safe-investigation',origin:'intrinsic',steps:[
  {id:'inspect',action:'explore',toolId:'tool.inspect',input:{}},
  {id:'verify',action:'verify',toolId:'tool.verify',input:{mode:'independent'}},
  {id:'summarize',action:'reflect',toolId:'tool.summarize',input:{compact:true}},
]});
assert.ok(compiled);
assert.equal(compiled.steps.length,3);
for(let i=0;i<5;i++){
  const r=lib.recordCompoundExecution(compiled.id,{success01:1,verified:true,independent:true,context:i===0?'network check':`network diagnostics varied ${i}`});
  assert.ok(r);
}
const reusable=lib.findReusableCompoundSkill('network diagnostics varied 4');
assert.ok(reusable && reusable.status==='reusable','validated independent compound skill must become reusable');

const ex=new AutonomousProjectExecutor();
ex.ensure({id:'p98-project',origin:'intrinsic'});
let step=ex.currentStep();
assert.equal(step?.id,'explore');
ex.completeToolStep({tick:1,tool:step.preferredTool,verified:true,evidence01:.9});
step=ex.currentStep();
assert.equal(step?.id,'repeat');
assert.equal(ex.completeToolStep({tick:2,tool:step.preferredTool,verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true}),null,'research stage requires two qualifying executions');
assert.equal(ex.currentStep()?.id,'repeat');
assert.equal(ex.completeToolStep({tick:3,tool:step.preferredTool,verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true})?.completed,true);
step=ex.currentStep();
assert.equal(step?.id,'consolidate');
assert.equal(ex.completeToolStep({tick:4,tool:step.preferredTool,verified:true,evidence01:.9,researchPromoted:true}),null,'consolidation requires two qualifying executions');
assert.equal(ex.currentStep()?.id,'consolidate');
assert.equal(ex.completeToolStep({tick:5,tool:step.preferredTool,verified:true,evidence01:.9,researchPromoted:true})?.completed,true);
assert.equal(ex.progress01(),1,'verified project tool steps should complete the DAG only after its attempt/evidence gates');

const gateway=new ActionGateway({live:false});
const events=[];
for(const id of ['tool.inspect','tool.verify','tool.summarize']){
  gateway.registerTool({id,capability:'safe.test',destructive:false,projectAllowed:true,execute:async(input)=>{events.push({id,input});return {ok:true,value:id};},verify:async()=>({verified:true,basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'test'})});
}
for(const s of compiled.steps){ const r=await gateway.executeTool(s.toolId,s.input,'p98-test'); assert.equal(r.ok,true); assert.equal(r.verified,true); }
assert.equal(events.length,3);

const { OrganismCore }=await import('../src/organism/core/OrganismCore.ts');
const { MemoryStateStore }=await import('../src/organism/persistence/MemoryStateStore.ts');
const core=new OrganismCore(new MemoryStateStore(),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:2,cycleResultMode:'operational'});
await core.init();
for(const id of ['tool.inspect','tool.verify','tool.summarize']){
  core.registerActionTool({id,capability:'safe.test',destructive:false,projectAllowed:false,execute:async(input)=>({ok:true,verified:true,id,input}),verify:async()=>({verified:true,basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'p98-core'})});
}
const coreSkill=core.compileCompoundSkill({projectId:'p98-core',name:'core-safe-routine',origin:'intrinsic',steps:compiled.steps});
assert.ok(coreSkill);
for(let i=0;i<5;i++) core.recordCompoundSkillExecution(coreSkill.id,{success01:1,verified:true,independent:true,context:`core context ${i}`});
const coreReusable=core.reusableCompoundSkill('core context 4');
assert.ok(coreReusable?.status==='reusable');
const execution=await core.executeReusableSkill(coreReusable.id,{contextKey:'core context 5',independentEvidence:true},'p98-core-run');
assert.equal(execution.ok,true); assert.equal(execution.verified,true); assert.equal(execution.results.length,3);
assert.ok(core.actionToolsSnapshot().some(t=>t.id==='organism.device.status'),'built-in device read capability should be registered');
const outcomeRecords=core.outcomeVerificationSnapshot().records;
assert.ok(outcomeRecords.length>=3,'reusable skill must project every step into outcome cognition');
const eventRecords=core.snapshot().facets.memory.eventLog;
const causalEvents=eventRecords.filter(event=>event.type==='compound-skill-step-verified'||event.type==='compound-skill-execution');
assert.ok(causalEvents.length>=1,'compound skill execution must be observable in causal memory');
await core.flush();


const bindingSkill=lib.compileCompoundSkill({projectId:'p98-binding',name:'bound-routine',origin:'intrinsic',steps:[
  {id:'produce',action:'explore',toolId:'tool.produce',input:{seed:'x'},expectedOutputKeys:['value']},
  {id:'consume',action:'verify',toolId:'tool.consume',inputBindings:{value:'$step:produce.value'},expectedOutputKeys:['accepted']},
]});
assert.ok(bindingSkill);
const boundGateway=new ActionGateway({live:false});
const boundEvents=[];
boundGateway.registerTool({id:'tool.produce',capability:'safe.test',destructive:false,projectAllowed:true,execute:async(input)=>{boundEvents.push(input);return {ok:true,value:'artifact-42'};},verify:async()=>({verified:true,basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'produce-ok'})});
boundGateway.registerTool({id:'tool.consume',capability:'safe.test',destructive:false,projectAllowed:true,execute:async(input)=>{boundEvents.push(input);return {ok:true,accepted:input.value==='artifact-42'};},verify:async({result})=>({verified:Boolean(result?.accepted),basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'consume-bound'})});
const boundRun=[];
for(const step of bindingSkill.steps){
  const prior=boundRun.at(-1)?.result??{};
  const stepInput={...(step.input??{})};
  for(const [k,expr] of Object.entries(step.inputBindings??{})){
    const m=/^\$step:([^\.]+)\.(.+)$/.exec(expr); assert.ok(m);
    stepInput[k]=prior[m[2]];
  }
  const r=await boundGateway.executeTool(step.toolId,stepInput,'p98-binding');
  boundRun.push({stepId:step.id,result:r.result,verified:r.verified});
  assert.equal(r.ok,true); assert.equal(r.verified,true);
}
assert.equal(boundEvents[1].value,'artifact-42','step output must cross the compound-skill binding boundary');

const failGateway=new ActionGateway({live:false});
let failCalls=0;
failGateway.registerTool({id:'tool.failfirst',capability:'safe.test',destructive:false,projectAllowed:true,execute:async()=>{failCalls++;return {ok:true,value:'untrusted'};},verify:async()=>({verified:false,basis:'none',confidence01:.2,externalObservation:false,notes:'unverified'})});
failGateway.registerTool({id:'tool.shouldnot',capability:'safe.test',destructive:false,projectAllowed:true,execute:async()=>{failCalls++;return {ok:true};},verify:async()=>({verified:true,basis:'tool-contract',confidence01:.9,externalObservation:false,notes:'should-not-run'})});
const guardSkill=lib.compileCompoundSkill({projectId:'p98-guard',name:'verified-gate',origin:'intrinsic',steps:[
  {id:'first',action:'explore',toolId:'tool.failfirst'},
  {id:'second',action:'verify',toolId:'tool.shouldnot'},
]});
assert.ok(guardSkill);
const first=await failGateway.executeTool('tool.failfirst',{},'p98-guard');
assert.equal(first.ok,true); assert.equal(first.verified,false);
assert.equal(failCalls,1,'unverified first step must not automatically authorize continuation');


const coreBinding=new OrganismCore(new MemoryStateStore(),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:2,cycleResultMode:'operational'});
await coreBinding.init();
let coreBoundSecondCalls=0;
coreBinding.registerActionTool({id:'tool.bound.produce',capability:'safe.test',destructive:false,projectAllowed:false,execute:async()=>({ok:true,value:'core-artifact'}),verify:async()=>({verified:true,basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'core-produce'})});
coreBinding.registerActionTool({id:'tool.bound.consume',capability:'safe.test',destructive:false,projectAllowed:false,execute:async(input)=>({ok:input.value==='core-artifact',accepted:input.value==='core-artifact'}),verify:async({result})=>({verified:Boolean(result?.accepted),basis:'tool-contract',confidence01:.95,externalObservation:false,notes:'core-consume'})});
const cskill=coreBinding.compileCompoundSkill({projectId:'core-bind',name:'core-binding',origin:'intrinsic',steps:[
  {id:'produce',action:'explore',toolId:'tool.bound.produce',expectedOutputKeys:['value']},
  {id:'consume',action:'verify',toolId:'tool.bound.consume',inputBindings:{value:'$step:produce.value'},expectedOutputKeys:['accepted']},
]});
assert.ok(cskill);
for(let i=0;i<5;i++) coreBinding.recordCompoundSkillExecution(cskill.id,{success01:1,verified:true,independent:true,context:`core bind ${i}`});
const cReusable=coreBinding.reusableCompoundSkill('core bind 4'); assert.ok(cReusable);
const crun=await coreBinding.executeReusableSkill(cReusable.id,{contextKey:'core bind 5',independentEvidence:true},'core-binding');
assert.equal(crun.ok,true); assert.equal(crun.results.length,2); assert.equal(crun.results[1].stepId,'consume');

const coreGuard=new OrganismCore(new MemoryStateStore(),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:2,cycleResultMode:'operational'});
await coreGuard.init();
let guardSecondCalls=0;
coreGuard.registerActionTool({id:'tool.guard.first',capability:'safe.test',destructive:false,projectAllowed:false,execute:async()=>({ok:true,value:'unverified'}),verify:async()=>({verified:false,basis:'none',confidence01:.2,externalObservation:false,notes:'intentionally-unverified'})});
coreGuard.registerActionTool({id:'tool.guard.second',capability:'safe.test',destructive:false,projectAllowed:false,execute:async()=>{guardSecondCalls++;return {ok:true,accepted:true};},verify:async()=>({verified:true,basis:'tool-contract',confidence01:.9,externalObservation:false,notes:'must-not-run'})});
const gskill=coreGuard.compileCompoundSkill({projectId:'core-guard',name:'guarded-routine',origin:'intrinsic',steps:[
  {id:'first',action:'explore',toolId:'tool.guard.first'},
  {id:'second',action:'verify',toolId:'tool.guard.second'},
]});
assert.ok(gskill);
for(let i=0;i<5;i++) coreGuard.recordCompoundSkillExecution(gskill.id,{success01:1,verified:true,independent:true,context:`guard ${i}`});
const greusable=coreGuard.reusableCompoundSkill('guard 4'); assert.ok(greusable);
const grun=await coreGuard.executeReusableSkill(greusable.id,{contextKey:'guard 5',independentEvidence:true},'guard-test');
assert.equal(grun.ok,false); assert.equal(grun.verified,false); assert.equal(grun.results.length,1); assert.equal(guardSecondCalls,0,'reusable skills must fail closed after an unverified step');

console.log('BIG_PASS_98_COMPOUND_DEVICE_AGENCY=PASS',JSON.stringify({reusable:reusable.id,steps:reusable.steps.length,projectProgress:ex.progress01(),toolEvents:events.length}));
