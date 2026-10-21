import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-wp168-compound-'));
const stateFile=path.join(dir,'organism.json');
const worldStateFile=path.join(dir,'world.json');
try {
  const runtime=new OrganismRuntime({stateFile,worldStateFile,enableLanguage:false});
  await runtime.init();
  runtime.core.registerActionTool({
    id:'test.compound.first',capability:'test.read',destructive:false,
    execute:async()=>({ok:true,value:'bound-output'}),
    verify:()=>({verified:true,basis:'tool-contract',confidence01:1,notes:'deterministic test contract'}),
  });
  runtime.core.registerActionTool({
    id:'test.compound.second',capability:'test.read',destructive:false,
    execute:async(input)=>({ok:input.received==='bound-output',received:input.received}),
    verify:({result})=>({verified:result.ok===true,basis:'tool-contract',confidence01:result.ok===true?1:0,notes:'binding assertion'}),
  });
  const skill=await runtime.compileCompoundSkill({
    projectId:'workpass168',name:'runtime-compound-binding',origin:'integration-test',
    steps:[
      {id:'first',action:'observe',toolId:'test.compound.first'},
      {id:'second',action:'verify',toolId:'test.compound.second',inputBindings:{received:'first.value'},requiredInputKeys:['received']},
    ],
  });
  assert.ok(skill);
  const result=await runtime.executeCompoundSkill(skill.id,{
    runId:'wp168-run-1',context:'runtime compound binding test',holdout:false,independent:true,autonomous:false,
  });
  assert.equal(result.ok,true);
  assert.equal(result.verified,true);
  assert.equal(result.outputs.second.received,'bound-output');
  assert.equal(runtime.proceduralSkillLibrarySnapshot().compoundSkills.find(x=>x.id===skill.id)?.uses,1);

  runtime.core.registerActionTool({
    id:'test.compound.primary-fails',capability:'test.read',destructive:false,
    execute:async()=>({ok:false,error:'simulated-primary-failure'}),
    verify:()=>({verified:false,basis:'tool-contract',confidence01:0,notes:'expected primary failure'}),
  });
  runtime.core.registerActionTool({
    id:'test.compound.fallback',capability:'test.read',destructive:false,
    execute:async()=>({ok:true,value:'repaired-output'}),
    verify:()=>({verified:true,basis:'tool-contract',confidence01:1,notes:'deterministic fallback contract'}),
  });
  runtime.core.registerActionTool({
    id:'test.compound.repair-second',capability:'test.read',destructive:false,
    execute:async(input)=>({ok:input.received==='repaired-output',received:input.received}),
    verify:({result})=>({verified:result.ok===true,basis:'tool-contract',confidence01:result.ok===true?1:0,notes:'repair binding assertion'}),
  });
  const repairSkill=await runtime.compileCompoundSkill({
    projectId:'workpass169',name:'runtime-repair-evidence',origin:'integration-test',
    steps:[
      {id:'first',action:'observe',toolId:'test.compound.primary-fails',fallbackToolIds:['test.compound.fallback']},
      {id:'second',action:'verify',toolId:'test.compound.repair-second',inputBindings:{received:'first.value'},requiredInputKeys:['received']},
    ],
  });
  assert.ok(repairSkill);
  const repaired=await runtime.executeCompoundSkill(repairSkill.id,{
    runId:'wp169-run-1',context:'runtime repair evidence test',holdout:false,independent:true,autonomous:false,
  });
  assert.equal(repaired.ok,true);
  const repairEvidence=runtime.compoundSkillRepairEvidence(repairSkill.id);
  assert.equal(repairEvidence.length,1);
  assert.equal(repairEvidence[0].failedTool,'test.compound.primary-fails');
  assert.equal(repairEvidence[0].selectedTool,'test.compound.fallback');
  assert.equal(repairEvidence[0].revisionEligible,true);
  const holdoutSkill=await runtime.compileCompoundSkill({
    projectId:'workpass169',name:'runtime-holdout-exclusion',origin:'integration-test',
    steps:[
      {id:'first',action:'observe',toolId:'test.compound.primary-fails',fallbackToolIds:['test.compound.fallback']},
      {id:'second',action:'verify',toolId:'test.compound.repair-second',inputBindings:{received:'first.value'},requiredInputKeys:['received']},
    ],
  });
  assert.ok(holdoutSkill);
  await runtime.executeCompoundSkill(holdoutSkill.id,{
    runId:'wp169-run-holdout',context:'holdout repair evidence test',holdout:true,independent:true,autonomous:false,
  });
  assert.equal(runtime.compoundSkillRepairEvidence(holdoutSkill.id).length,0,'holdout repair evidence must not be exposed to revision callers');
  await runtime.stop();

  const restarted=new OrganismRuntime({stateFile,worldStateFile,enableLanguage:false});
  await restarted.init();
  const restored=restarted.proceduralSkillLibrarySnapshot().compoundSkills.find(x=>x.id===skill.id);
  assert.ok(restored,'runtime-owned procedural skills must survive restart');
  assert.equal(restored.uses,1,'execution evidence must be durable before executeCompoundSkill returns');
  const restoredRepairEvidence=restarted.compoundSkillRepairEvidence(repairSkill.id);
  assert.equal(restoredRepairEvidence.length,1,'verified repair evidence must survive runtime restart');
  assert.equal(restoredRepairEvidence[0].selectedTool,'test.compound.fallback');
  await restarted.stop();
  console.log('WORKPASS168_RUNTIME_COMPOUND_SKILLS=PASS');
} finally {
  await rm(dir,{recursive:true,force:true});
}
