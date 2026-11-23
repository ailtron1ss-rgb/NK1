import assert from 'node:assert/strict';
import { WorldForge } from '../src/organism/developmental/WorldForge.ts';

const forge=new WorldForge({maxCasesPerBatch:64,maxActiveScenarios:128});
const focusKinds=['balanced','resource-shock','route-block','signal-noise','deadline-shift'];
for(let index=0;index<focusKinds.length;index++){
  const focus=focusKinds[index];
  const seed=51000+index;
  const rawCandidates=forge.generate({split:'train',seed,count:16,difficulty01:.9});
  assert.equal(rawCandidates.length,16);
  const batch=forge.generateAdversarialRuntimeScenarios({
    seed,count:4,difficulty01:.9,focus,candidateMultiplier:4,
  });
  assert.equal(batch.length,4,`focus ${focus} returns requested selection size`);
  assert.ok(batch.every(s=>s.split==='train'&&s.syntheticOnly===true));
  assert.ok(batch.every(s=>!('disturbances'in s)&&!('seedFingerprint'in s)&&!('adversarialScore'in s)));
  assert.equal(new Set(batch.map(s=>s.id)).size,4);
  const selected=new Set(batch.map(s=>s.id));
  for(const candidate of rawCandidates){
    if(selected.has(candidate.id)){
      const state=forge.startScenario(candidate);
      assert.ok(state,`selected ${focus} candidate must retain its private evaluator key`);
      const transition=forge.step(state,{action:'observe'});
      assert.equal(transition.accepted,true);
      assert.ok(transition.state);
    }else{
      assert.equal(forge.startScenario(candidate),null,'unselected oversampled candidates must be evicted from evaluator memory');
    }
  }
  const replay=forge.generateAdversarialRuntimeScenarios({seed,count:4,difficulty01:.9,focus,candidateMultiplier:4});
  assert.deepEqual(replay.map(s=>s.id),batch.map(s=>s.id),'same seed and focus must select the same adversarial curriculum');
}

let getterRan=false;
const malicious={seed:1,count:2,difficulty01:.8};
Object.defineProperty(malicious,'focus',{enumerable:true,get(){getterRan=true;return 'balanced';}});
assert.deepEqual(forge.generateAdversarialRuntimeScenarios(malicious),[]);
assert.equal(getterRan,false,'adversarial request normalization must not execute accessors');

assert.deepEqual(forge.generateAdversarialRuntimeScenarios({
 seed:1,count:99,difficulty01:.8,focus:'balanced',candidateMultiplier:4,
}),[],'oversized candidate selection request must fail closed');
assert.deepEqual(forge.generateAdversarialRuntimeScenarios({
 seed:1,count:2,difficulty01:.8,focus:'holdout',candidateMultiplier:2,
}),[],'unknown focus values must fail closed');
console.log('World Forge adversarial curriculum and candidate lifecycle passed');
