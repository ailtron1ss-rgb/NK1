import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { SelfProjectEngine } from '../src/organism/cognition/evolution/SelfProjectEngine.ts';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';

const engine = new SelfProjectEngine();
const project = engine.propose({
  intrinsicOverall:.94, dominant:'competence', uncertainty:.86, predictionError:.72,
  identityDrift:.12, unresolvedExperiments:2, activeGoals:[],
});
assert(project, 'project must be proposed');
engine.ensureActiveProject();
for(let i=0;i<7;i++) engine.observeOutcome({projectId:project.id,success:.88,surprise:.08,actionWasRelevant:true,evidenceClass:'internal',externalEvidence01:0,skillGain01:.08});
let s=engine.snapshot().projects.find(p=>p.id===project.id);
assert(s?.milestones[0].completed, 'internal milestone did not complete');
engine.recordEvidence({projectId:project.id,evidenceClass:'external',externalEvidence01:.9,independentSource:true,at:100});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.92,independentSource:true,at:101});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.94,independentSource:true,at:102});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:103});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:104});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:105});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:106});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:107});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:108});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:109});
engine.recordEvidence({projectId:project.id,evidenceClass:'replicated',externalEvidence01:.95,independentSource:true,at:110});
s=engine.snapshot().projects.find(p=>p.id===project.id);
assert.equal(s?.status,'completed','replicated evidence should complete project');
assert(s?.progress===1,'completed project must reach progress 1');
assert.equal(engine.snapshot().completedProjects,1);

const exec = new AutonomousProjectExecutor();
exec.ensure({id:'life',origin:'intrinsic'});
exec.observeToolResult({tick:1,tool:'organism.project.context',ok:true});
exec.completeToolStep({tick:1,tool:'organism.project.context',verified:true,evidence01:.8});
assert.equal(exec.snapshot().completedSteps,1);
assert(exec.planHealth().planRevision>=2);
const persisted=exec.snapshot();
const restored=new AutonomousProjectExecutor(); restored.restore(persisted);
const rr=restored.snapshot(); assert.equal(rr.projectId,persisted.projectId); assert.equal(rr.completedSteps,persisted.completedSteps); assert.equal(rr.planRevision,persisted.planRevision); assert.equal(rr.lastOutcomeId,persisted.lastOutcomeId); assert.equal(rr.steps[0].completed,persisted.steps[0].completed); assert.equal(rr.steps[0].attempts,persisted.steps[0].attempts);

const root=await mkdtemp(join(tmpdir(),'nk175-')); const file=join(root,'state.json');
const core=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
await core.init();
const obs={
  text:'исследуй новую неизвестную область',
  worldContext:{location:'lab',facts:['unknown signal'],objects:[{id:'signal',label:'signal',location:'lab',value:.9,visible:true,collected:false}],events:['surprise']},
  embodiment:{bodyEnergy01:.94,cognitiveCapacity01:.92,thermalStrain01:.08,sensoryFreshness01:.98,awake:true,battery01:.95,cpuLoad01:.12,ramPressure01:.15},
};
let cycle=await core.observe(obs);
assert(cycle,'core observe must return cycle');
let life=core.autonomousProjectLifeSnapshot();
assert(life.projects.length>0,'core did not instantiate a self-project from intrinsic pressure');
const active=life.project;
assert(active,'active project must be selected');
assert(active.linkedGoalId,'self-project must link to a goal');
const beforeGoal=life.linkedGoal;
assert(beforeGoal,'linked goal must exist');
await core.executeNextProjectStep('big-pass-175');
life=core.autonomousProjectLifeSnapshot();
assert(life.executor.completed>=1,'project executor did not complete a verified project step');
assert(life.project.progress>0,'verified project-tool execution did not advance project progress');
assert(life.linkedGoal?.progress===life.project.progress,'linked goal progress diverged from project progress');
const eventTypes=core.snapshot().memories?.filter?.(()=>false);
await core.flush();
const resumed=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'});
await resumed.init();
const restoredLife=resumed.autonomousProjectLifeSnapshot();
assert.equal(restoredLife.project?.id,life.project.id,'project identity lost across restart');
assert.equal(restoredLife.executor.projectId,life.executor.projectId,'executor project lost across restart');
assert(restoredLife.project.progress>=life.project.progress,'project progress regressed across restart');
await rm(root,{recursive:true,force:true});

console.log(JSON.stringify({
  pass:175,
  status:'PASS',
  engineProject:'completed',
  executorCompleted:exec.snapshot().completedSteps,
  coreProjectId:life.project.id,
  coreProgress:life.project.progress,
  coreGoalProgress:life.linkedGoal?.progress ?? null,
  executorPlanRevision:life.executor.planRevision,
  restart:'PASS',
}));
