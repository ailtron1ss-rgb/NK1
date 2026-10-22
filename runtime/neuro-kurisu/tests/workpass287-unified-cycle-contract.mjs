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

const invalidId=cycle.evaluate({tick:2,stageIds:{...stages,action:'  '},parentIntegrity01:0.9});
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
assert.deepEqual(snapshot.lastMissingStages,['action']);

const leaked=cycle.snapshot();
leaked.lastMissingStages.push('goal');
assert.equal(cycle.snapshot().lastMissingStages.includes('goal'),false);

console.log('WorkPass287 unified cognitive-cycle contract: PASS');
