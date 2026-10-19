import assert from 'node:assert/strict';
import { SelfProjectEngine } from '../src/organism/cognition/evolution/SelfProjectEngine.ts';
const e=new SelfProjectEngine();
e.restore({version:1,projects:[{id:'legacy',title:'legacy',origin:'intrinsic',status:'active',commitment:.5,priority:.5,identityRelevance:.5,progress:.2,setbacks:0,successes:1,evidenceCount:1,validatedEvidenceCount:0,replicatedEvidenceCount:0,skillGain01:0,milestones:[],nextMilestone:'x',createdAt:1,lastWorkedAt:1,updatedAt:1}],selectedProjectId:'legacy',completedProjects:0,abandonedProjects:0,ownProjectContinuity:.5,authorshipScore:.2,lastCreatedAt:1});
const p=e.activeProject(); assert(p); assert.equal(e.snapshot().version,2); assert.equal(p.planRevision,1); assert.equal(e.snapshot().projectEvents,0);
const before=e.snapshot(); e.restore(before); const after=e.snapshot(); assert.equal(after.version,2); assert.equal(after.projects[0].planRevision,1);
console.log(JSON.stringify({pass:175,status:'PASS',migration:'PASS',version:after.version,planRevision:after.projects[0].planRevision}));
