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
assert.equal(cycle.evaluate({tick:1,stageIds:stages,parentIntegrity01:0.9}).complete,true);
const baseline=cycle.snapshot();

// Top-level getters on every consumed input field are rejected before invocation.
for(const accessorField of ['tick','stageIds','parentIntegrity01']) {
  let getterCalls=0;
  const input={tick:2,stageIds:stages,parentIntegrity01:0.9};
  Object.defineProperty(input,accessorField,{
    configurable:true,
    enumerable:true,
    get(){getterCalls+=1;return accessorField==='tick'?2:accessorField==='stageIds'?stages:0.9;},
  });
  assert.throws(()=>cycle.evaluate(input),/accessor-not-allowed/);
  assert.equal(getterCalls,0,accessorField+' getter must not execute');
  assert.deepEqual(cycle.snapshot(),baseline,'invalid envelope must not mutate cognitive state');
}

// Stage evidence is read from own data descriptors rather than invoking getters.
let stageGetterCalls=0;
const accessorStageIds={...stages};
Object.defineProperty(accessorStageIds,'observation',{
  configurable:true,
  enumerable:true,
  get(){stageGetterCalls+=1;return 'forged-observation';},
});
assert.throws(()=>cycle.evaluate({tick:2,stageIds:accessorStageIds,parentIntegrity01:1}),/accessor-not-allowed/);
assert.equal(stageGetterCalls,0);
assert.deepEqual(cycle.snapshot(),baseline);

// A proxy descriptor failure is converted into a closed rejection, without a write.
const trappedInput=new Proxy({tick:2,stageIds:stages,parentIntegrity01:1},{
  getOwnPropertyDescriptor(target,key){
    if(key==='tick')throw new Error('injected-descriptor-trap');
    return Reflect.getOwnPropertyDescriptor(target,key);
  },
});
assert.throws(()=>cycle.evaluate(trappedInput),/unreadable-cognitive-cycle-input-field:tick/);
assert.deepEqual(cycle.snapshot(),baseline);

// A rejected snapshot getter is never evaluated and leaves the live state intact.
const restoreGetterState={cycles:3,completeCycles:3,incompleteCycles:0,brokenLineages:0,lastTick:3,lastComplete:true,lastMissingStages:[]};
Object.defineProperty(restoreGetterState,'cycles',{enumerable:true,configurable:true,get(){throw new Error('getter-executed');}});
assert.throws(()=>cycle.restore(restoreGetterState),/accessor-not-allowed/);
assert.deepEqual(cycle.snapshot(),baseline);

// Accessor-backed array slots are rejected without reading them.
let arrayGetterCalls=0;
const accessorMissing=['action'];
Object.defineProperty(accessorMissing,'0',{enumerable:true,configurable:true,get(){arrayGetterCalls+=1;return 'action';}});
const beforeArrayRestore=cycle.snapshot();
assert.throws(()=>cycle.restore({cycles:1,completeCycles:0,incompleteCycles:1,brokenLineages:0,lastTick:1,lastComplete:false,lastMissingStages:accessorMissing}),/accessor-not-allowed/);
assert.equal(arrayGetterCalls,0);
assert.deepEqual(cycle.snapshot(),beforeArrayRestore);

// Sparse persisted history is malformed evidence, not an empty missing-stage list.
const sparseMissing=new Array(1);
const sparseRestore=new UnifiedCognitiveCycle();
sparseRestore.restore({cycles:1,completeCycles:1,incompleteCycles:0,brokenLineages:0,lastTick:1,lastComplete:true,lastMissingStages:sparseMissing});
assert.equal(sparseRestore.snapshot().lastComplete,false);
assert.deepEqual(sparseRestore.snapshot().lastMissingStages,['observation','prediction','action','outcome','learning','self-update']);

// Oversized or wrong-shaped history cannot be promoted to a complete cycle.
const invalidRestore=new UnifiedCognitiveCycle();
invalidRestore.restore({cycles:1,completeCycles:1,incompleteCycles:0,brokenLineages:0,lastTick:1,lastComplete:true,lastMissingStages:'not-an-array'});
assert.equal(invalidRestore.snapshot().lastComplete,false);
assert.deepEqual(invalidRestore.snapshot().lastMissingStages,['observation','prediction','action','outcome','learning','self-update']);

// The normal path and prior completeness contract remain intact.
const normal=new UnifiedCognitiveCycle();
const result=normal.evaluate({tick:4,stageIds:stages,parentIntegrity01:0.9});
assert.equal(result.complete,true);
assert.equal(result.stageCoverage01,1);
assert.deepEqual(result.missingStages,[]);
console.log('WorkPass370 unified cognitive-cycle data integrity: PASS');
