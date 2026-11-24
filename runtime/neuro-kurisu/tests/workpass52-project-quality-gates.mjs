import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';

const envKeys=['NEURO_PROJECT_RESEARCH_URL','NEURO_PROJECT_RESEARCH_URL_2'];
const previous=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
for(const key of envKeys) delete process.env[key];
try {
  const executor=new AutonomousProjectExecutor();
  executor.ensure({id:'workpass52-qualified-project',origin:'intrinsic'});
  let step=executor.currentStep();
  assert.equal(step?.id,'explore');
  const weak=executor.completeToolStep({tick:1,tool:step.preferredTool,verified:true,evidence01:.2,executionId:'weak-explore',stepId:step.id});
  assert.equal(weak,null,'a verified tool call with insufficient project evidence must not count as a completed step');
  let state=executor.snapshot();
  step=state.steps.find(s=>s.id==='explore');
  assert.equal(state.completedSteps,0);
  assert.equal(step.successes,0,'weak evidence must not be counted as step success');
  assert.equal(step.qualifyingAttempts,0,'weak evidence must not satisfy the minimum qualifying-attempt count');
  assert.equal(step.failureAttempts,1);
  assert.equal(executor.completeToolStep({tick:2,tool:step.preferredTool,verified:true,evidence01:.99,executionId:'weak-explore',stepId:step.id}),null,'the exact same outcome cannot be replayed with a higher confidence label');
  assert.equal(executor.snapshot().completedSteps,0);
  assert.equal(executor.completeToolStep({tick:2,tool:step.preferredTool,verified:true,evidence01:.8,executionId:'good-explore',stepId:step.id})?.completed,true);
  assert.equal(executor.currentStep()?.id,'repeat');

  step=executor.currentStep();
  const pendingId='research-before-promotion';
  assert.equal(executor.completeToolStep({tick:3,tool:step.preferredTool,verified:true,evidence01:.95,externalResearchVerified:true,researchPromoted:false,executionId:pendingId,stepId:step.id}),null);
  assert.equal(executor.snapshot().processedOutcomeIds.includes(pendingId),false,'a receipt rejected by research gates is not consumed before reconciliation');
  assert.equal(executor.completeToolStep({tick:3,tool:step.preferredTool,verified:true,evidence01:.95,externalResearchVerified:true,researchPromoted:true,executionId:pendingId,stepId:step.id}),null,'first qualifying research run cannot satisfy a two-run promotion policy');
  assert.equal(executor.snapshot().steps.find(s=>s.id==='repeat')?.qualifyingAttempts,1);
  assert.equal(executor.completeToolStep({tick:4,tool:step.preferredTool,verified:true,evidence01:.92,externalResearchVerified:true,researchPromoted:true,executionId:'research-second-run',stepId:step.id})?.completed,true);
  assert.equal(executor.currentStep()?.id,'consolidate');

  step=executor.currentStep();
  assert.equal(executor.completeToolStep({tick:5,tool:step.preferredTool,verified:true,evidence01:.45,researchPromoted:true,executionId:'weak-consolidate',stepId:step.id}),null);
  assert.equal(executor.snapshot().steps.find(s=>s.id==='consolidate')?.qualifyingAttempts,0,'low evidence must not count toward minimum confirmation attempts');
  assert.equal(executor.completeToolStep({tick:6,tool:step.preferredTool,verified:true,evidence01:.9,researchPromoted:true,executionId:'consolidate-one',stepId:step.id}),null);
  const snapshot=executor.snapshot();
  assert.equal(snapshot.steps.find(s=>s.id==='consolidate')?.qualifyingAttempts,1);
  const restored=new AutonomousProjectExecutor(); restored.restore(snapshot);
  assert.equal(restored.snapshot().steps.find(s=>s.id==='consolidate')?.qualifyingAttempts,1,'qualified attempt count survives persistence restore');
  assert.equal(restored.completeToolStep({tick:7,tool:step.preferredTool,verified:true,evidence01:.91,researchPromoted:true,executionId:'consolidate-two',stepId:step.id})?.completed,true);
  assert.equal(restored.progress01(),1,'all DAG steps complete only after their explicit evidence gates');

  const internal=new AutonomousProjectExecutor();
  internal.ensure({id:'workpass52-unqualified-internal-outcome',origin:'unresolved'});
  const before=internal.snapshot();
  const beforeTick=before.lastTick;
  internal.planHealth(999);
  assert.equal(internal.snapshot().lastTick,beforeTick,'read-only health inspection must not mutate the durable executor clock');
  internal.observe({action:'verify',success01:.99,evidence01:.1,relevant:true,tick:1});
  const after=internal.snapshot();
  assert(after.executionScore01 < before.executionScore01,'weak internal outcomes must not inflate project-execution fitness');
  assert.equal(after.skillPromotionCandidate01,0,'weak internal outcomes must not raise skill-promotion readiness');
  assert.equal(after.steps[0].qualifyingAttempts,0,'unqualified world outcomes must not count as promotion attempts');
  console.log('WORKPASS52_PROJECT_QUALITY_GATES=PASS scenarios=18');
} finally {
  for(const [key,value] of Object.entries(previous)){if(value===undefined) delete process.env[key]; else process.env[key]=value;}
}
