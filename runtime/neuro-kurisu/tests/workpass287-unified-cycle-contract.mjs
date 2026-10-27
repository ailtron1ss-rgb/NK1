import assert from 'node:assert/strict';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const stages={
  observation:'obs-1',
  prediction:'pred-1',
  action:'act-1',
  outcome:'out-1',
  learning:'learn-1',
  'self-update':'self-1',
};

const cycle=new UnifiedCognitiveCycle();
const complete=cycle.evaluate({tick:1,stageIds:stages,parentIntegrity01:0.9});
assert.equal(complete.complete,true);
assert.equal(complete.stageCoverage01,1);
assert.deepEqual(complete.missingStages,[]);
const duplicateIds=cycle.evaluate({tick:2,stageIds:{...stages,prediction:stages.observation},parentIntegrity01:1});
assert.equal(duplicateIds.complete,false);
assert.ok(duplicateIds.missingStages.includes('observation'));
assert.ok(duplicateIds.missingStages.includes('prediction'));
assert.throws(()=>cycle.evaluate({tick:1,stageIds:stages,parentIntegrity01:0.9}),/strictly increase/);

const invalidId=cycle.evaluate({tick:3,stageIds:{...stages,action:'  '},parentIntegrity01:0.9});
assert.equal(invalidId.complete,false);
assert.ok(invalidId.missingStages.includes('action'));

assert.throws(()=>cycle.evaluate({tick:NaN,stageIds:stages,parentIntegrity01:1}),/tick/);
assert.throws(()=>cycle.evaluate({tick:0,stageIds:stages,parentIntegrity01:1}),/strictly increase/);
assert.throws(()=>cycle.evaluate({tick:4,stageIds:stages,parentIntegrity01:Infinity}),/parentIntegrity01/);
const unsafeId=cycle.evaluate({tick:5,stageIds:{...stages,action:'act\n1'},parentIntegrity01:1});
assert.equal(unsafeId.complete,false);
assert.ok(unsafeId.missingStages.includes('action'));

const restored=new UnifiedCognitiveCycle();
restored.restore({
  cycles:NaN,
  completeCycles:999,
  incompleteCycles:-8,
  brokenLineages:Infinity,
  meanStageCoverage01:NaN,
  meanCausalContinuity01:2,
  lastTick:Infinity,
  lastComplete:true,
  lastMissingStages:['action','not-a-stage',null],
});
const snapshot=restored.snapshot();
assert.equal(snapshot.cycles,0);
assert.equal(snapshot.completeCycles,0);
assert.equal(snapshot.incompleteCycles,0);
assert.equal(snapshot.brokenLineages,0);
assert.equal(snapshot.meanStageCoverage01,0);
assert.equal(snapshot.meanCausalContinuity01,1);
assert.equal(snapshot.lastTick,-1);
assert.equal(snapshot.lastComplete,false);
assert.deepEqual(snapshot.lastMissingStages,['observation','prediction','action','outcome','learning','self-update'], 'malformed restored stage lists fail closed');

const inconsistentRestore=new UnifiedCognitiveCycle();
inconsistentRestore.restore({
  cycles:10,
  completeCycles:8,
  incompleteCycles:8,
  brokenLineages:7,
  lastTick:4,
  lastComplete:true,
  lastMissingStages:[],
});
const reconciled=inconsistentRestore.snapshot();
assert.equal(reconciled.completeCycles,8);
assert.equal(reconciled.incompleteCycles,2);
assert.equal(reconciled.brokenLineages,2);
assert.equal(reconciled.completeCycles+reconciled.incompleteCycles,reconciled.cycles);
assert.equal(reconciled.lastComplete,false);


const undercountRestore=new UnifiedCognitiveCycle();
undercountRestore.restore({cycles:10,completeCycles:3,incompleteCycles:1,brokenLineages:99,lastTick:8,lastComplete:false,lastMissingStages:['action']});
const undercounted=undercountRestore.snapshot();
assert.equal(undercounted.completeCycles+undercounted.incompleteCycles,undercounted.cycles);
assert.equal(undercounted.incompleteCycles,7,'unaccounted restored cycles must fail closed as incomplete');
assert.equal(undercounted.brokenLineages,7,'broken lineage count cannot exceed conservative incomplete count');

const emptyRestore=new UnifiedCognitiveCycle();
emptyRestore.restore({cycles:0,lastTick:-1,lastComplete:true,lastMissingStages:[]});
assert.equal(emptyRestore.snapshot().lastComplete,false);
assert.deepEqual(emptyRestore.snapshot().lastMissingStages,['observation','prediction','action','outcome','learning','self-update']);

const leaked=cycle.snapshot();
leaked.lastMissingStages.push('goal');
assert.equal(cycle.snapshot().lastMissingStages.includes('goal'),false);


const missingCountRestore=new UnifiedCognitiveCycle();
missingCountRestore.restore({cycles:10,completeCycles:3,incompleteCycles:1,brokenLineages:9,lastTick:9,lastComplete:false,lastMissingStages:['action']});
const countPartition=missingCountRestore.snapshot();
assert.equal(countPartition.completeCycles+countPartition.incompleteCycles,countPartition.cycles);
assert.equal(countPartition.incompleteCycles,7);
assert.equal(countPartition.brokenLineages,7);

const malformedHistory=new UnifiedCognitiveCycle();
malformedHistory.restore({cycles:4,completeCycles:2,incompleteCycles:2,brokenLineages:0,lastTick:4,lastComplete:true,lastMissingStages:['not-a-stage']});
assert.equal(malformedHistory.snapshot().lastComplete,false);
assert.deepEqual(malformedHistory.snapshot().lastMissingStages,['observation','prediction','action','outcome','learning','self-update']);

const countContradiction=new UnifiedCognitiveCycle();
countContradiction.restore({cycles:4,completeCycles:0,incompleteCycles:4,brokenLineages:0,lastTick:4,lastComplete:true,lastMissingStages:[]});
assert.equal(countContradiction.snapshot().lastComplete,false);

const unsupportedVersion=new UnifiedCognitiveCycle();
assert.throws(()=>unsupportedVersion.restore({version:2}),/version/);
assert.equal(unsupportedVersion.snapshot().cycles,0);

assert.throws(()=>cycle.evaluate(null),/input must be an object/);
assert.throws(()=>cycle.evaluate({tick:6,stageIds:null,parentIntegrity01:1}),/stageIds/);
const inheritedIds=Object.assign(Object.create({observation:'obs-from-prototype'}),{
  prediction:'pred-6',action:'act-6',outcome:'out-6',learning:'learn-6','self-update':'self-6',
});
const inheritedResult=cycle.evaluate({tick:6,stageIds:inheritedIds,parentIntegrity01:1});
assert.equal(inheritedResult.complete,false);
assert.ok(inheritedResult.missingStages.includes('observation'));

const saturated=new UnifiedCognitiveCycle();
saturated.restore({cycles:Number.MAX_SAFE_INTEGER,completeCycles:Number.MAX_SAFE_INTEGER,incompleteCycles:0,brokenLineages:0,lastTick:0,lastComplete:true,lastMissingStages:[]});
assert.throws(()=>saturated.evaluate({tick:1,stageIds:stages,parentIntegrity01:1}),/safe integer limit/);

console.log('WorkPass287 unified cognitive-cycle contract: PASS');
