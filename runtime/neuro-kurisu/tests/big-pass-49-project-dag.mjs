import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';

const ex=new AutonomousProjectExecutor();
ex.restore({
  projectId:'dag-test',
  steps:[
    {id:'a',action:'explore',purpose:'root',requiredEvidence01:.5,expectedProgress01:.2,completed:true,attempts:1,successes:1,lastAt:1,blocked:false,maxAttempts:4,failureAttempts:0},
    {id:'b',action:'verify',purpose:'branch-b',requiredEvidence01:.5,expectedProgress01:.2,completed:false,attempts:0,successes:0,lastAt:0,blocked:false,maxAttempts:4,failureAttempts:0,dependsOn:['a']},
    {id:'c',action:'reflect',purpose:'branch-c',requiredEvidence01:.5,expectedProgress01:.2,completed:false,attempts:0,successes:0,lastAt:0,blocked:false,maxAttempts:4,failureAttempts:0,dependsOn:['a']},
    {id:'d',action:'respond',purpose:'join',requiredEvidence01:.5,expectedProgress01:.2,completed:false,attempts:0,successes:0,lastAt:0,blocked:false,maxAttempts:4,failureAttempts:0,dependsOn:['b','c']},
  ],
  cursor:1,
  cycles:0,
  completedSteps:1,
});
assert.equal(ex.readyStep(1)?.id,'b');
ex.observe({action:'verify',success01:1,evidence01:.8,relevant:true,tick:1});
assert.equal(ex.snapshot().steps.find(s=>s.id==='b').completed,true);
assert.equal(ex.readyStep(2)?.id,'c','executor should choose other ready branch rather than waiting for linear cursor');
ex.observe({action:'reflect',success01:1,evidence01:.8,relevant:true,tick:2});
assert.equal(ex.readyStep(3)?.id,'d','join node should become ready after both dependencies complete');
console.log('BIG_PASS_49_PROJECT_DAG=PASS', JSON.stringify({cursor:ex.snapshot().cursor,ready:ex.readyStep(3)?.id}));
