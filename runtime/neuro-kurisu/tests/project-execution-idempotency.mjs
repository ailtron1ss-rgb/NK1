import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';

const saved=Object.fromEntries(['NEURO_PROJECT_RESEARCH_URL','NEURO_PROJECT_RESEARCH_URL_2'].map(k=>[k,process.env[k]]));
process.env.NEURO_PROJECT_RESEARCH_URL='https://alpha.example/research';
process.env.NEURO_PROJECT_RESEARCH_URL_2='https://beta.example/research';
try {
  const executor=new AutonomousProjectExecutor();
  executor.ensure({id:'idempotency-project',origin:'intrinsic'});
  const first=executor.currentStep();
  assert.equal(first.id,'explore');
  assert.equal(first.preferredTool,'organism.project.research');
  const completed=executor.completeToolStep({tick:1,tool:first.preferredTool,verified:true,evidence01:.9,executionId:'exec-once',stepId:first.id});
  assert.equal(completed?.completed,true);
  const repeat=executor.currentStep();
  assert.equal(repeat?.id,'repeat');
  assert.equal(repeat?.preferredTool,first.preferredTool,'same-tool consecutive steps reproduce the replay hazard');

  // Replaying the first receipt must not complete the next step, even if the caller
  // incorrectly supplies current research-gate booleans.
  assert.equal(executor.completeToolStep({tick:2,tool:repeat.preferredTool,verified:true,evidence01:.99,externalResearchVerified:true,researchPromoted:true,executionId:'exec-once',stepId:repeat.id}),null);
  assert.equal(executor.currentStep()?.id,'repeat');
  // A new receipt tied to the old step is stale and cannot advance the new step.
  assert.equal(executor.completeToolStep({tick:3,tool:repeat.preferredTool,verified:true,evidence01:.99,externalResearchVerified:true,researchPromoted:true,executionId:'exec-stale-step',stepId:first.id}),null);
  assert.equal(executor.currentStep()?.id,'repeat');

  const firstEvidence=executor.completeToolStep({tick:4,tool:repeat.preferredTool,verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true,executionId:'exec-second-source',stepId:repeat.id});
  assert.equal(firstEvidence,null,'the plan declares two attempts before promotion');
  assert.equal(executor.currentStep()?.id,'repeat');
  assert.equal(executor.snapshot().steps.find(s=>s.id==='repeat')?.successes,1);
  const valid=executor.completeToolStep({tick:5,tool:repeat.preferredTool,verified:true,evidence01:.9,externalResearchVerified:true,researchPromoted:true,executionId:'exec-third-source',stepId:repeat.id});
  assert.equal(valid?.completed,true);
  assert.equal(executor.currentStep()?.id,'consolidate');

  const serialized=executor.snapshot();
  assert(serialized.processedOutcomeIds.includes('exec-once'));
  assert(serialized.processedOutcomeIds.includes('exec-second-source'));
  assert(serialized.processedOutcomeIds.includes('exec-third-source'));
  const restored=new AutonomousProjectExecutor(); restored.restore(serialized);
  assert.equal(restored.snapshot().version,7);
  assert.equal(restored.completeToolStep({tick:6,tool:repeat.preferredTool,verified:true,evidence01:1,externalResearchVerified:true,researchPromoted:true,executionId:'exec-third-source',stepId:'consolidate'}),null,'receipt dedupe survives restart and cannot jump into another step');
  assert.equal(restored.currentStep()?.id,'consolidate');
} finally {
  for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
console.log('PROJECT_EXECUTION_IDEMPOTENCY=PASS scenarios=5');
