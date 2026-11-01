import assert from 'node:assert/strict';
import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(action=>[action,.5]));
const branch=new NeuralExperienceBranch();
branch.beforeDecision({
  tick:1,
  input:Array.from({length:64},(_,index)=>Math.sin(index*.13)*.35),
  baseUtilities:utilities,
  predictionError01:.22,
  novelty01:.42,
  uncertainty01:.31,
  homeostasis01:.18,
  identityGap01:.12,
  goalPressure01:.27,
  reward01:.63,
});
branch.commitAction('explore',utilities);
branch.afterOutcome({
  tick:1,action:'explore',reward01:.71,predictionError01:.19,verified01:1,
  nextInput:Array.from({length:64},(_,index)=>Math.sin(index*.13+.08)*.35),
  holdout01:0,identityGap01:.12,goalPressure01:.27,
});
const valid=branch.snapshot();
const expected=branch.diagnostics();
const restored=new NeuralExperienceBranch();
assert.doesNotThrow(()=>restored.restore(valid),'canonical neural branch snapshots must restore');
assert.equal(restored.diagnostics().cycles,expected.cycles);
assert.equal(restored.diagnostics().learningUpdates,expected.learningUpdates);
assert.deepEqual(restored.snapshot().persistentPersonality,valid.persistentPersonality);
assert.deepEqual(restored.snapshot().globalWorkspaceConvergence,valid.globalWorkspaceConvergence);

let getterCalls=0;
const accessorRoot={};
Object.defineProperty(accessorRoot,'tick',{
  enumerable:true,get(){getterCalls++;throw new Error('root getter invoked');},
});
const rootGuard=new NeuralExperienceBranch();
assert.doesNotThrow(()=>rootGuard.restore(accessorRoot));
assert.equal(getterCalls,0,'outer restore boundary must never execute root getters');
assert.equal(rootGuard.diagnostics().cycles,0,'malformed root snapshot must reset the branch');

const nestedAccessor=branch.snapshot();
Object.defineProperty(nestedAccessor.persistentPersonality,'tick',{
  enumerable:true,configurable:true,
  get(){getterCalls++;throw new Error('nested personality getter invoked');},
});
const nestedGuard=new NeuralExperienceBranch();
assert.doesNotThrow(()=>nestedGuard.restore(nestedAccessor));
assert.equal(getterCalls,0,'outer restore must reject nested personality getters before delegation');
assert.equal(nestedGuard.diagnostics().cycles,0,'nested accessor snapshot must fail closed');

const hostile=new Proxy({},{
  getPrototypeOf(){throw new Error('hostile prototype trap');},
});
assert.doesNotThrow(()=>new NeuralExperienceBranch().restore(hostile),'hostile Proxy reflection must fail closed');

const revoked=Proxy.revocable({},{});revoked.revoke();
assert.doesNotThrow(()=>new NeuralExperienceBranch().restore(revoked.proxy),'revoked root Proxy must fail closed');

const sparse=branch.snapshot();
sparse.state=new Array(sparse.state.length);
const sparseGuard=new NeuralExperienceBranch();
assert.doesNotThrow(()=>sparseGuard.restore(sparse));
assert.equal(sparseGuard.diagnostics().cycles,0,'sparse nested vectors must reject the complete snapshot');

const inherited=Object.create({tick:999});
inherited.version=32;
assert.doesNotThrow(()=>new NeuralExperienceBranch().restore(inherited),'inherited root data must fail closed');

console.log(JSON.stringify({
  pass:613,
  status:'PASS',
  restoredCycles:expected.cycles,
  restoredLearningUpdates:expected.learningUpdates,
  assertions:[
    'canonical-roundtrip-through-owned-subsystems',
    'root-accessor-not-invoked',
    'nested-personality-accessor-rejected-before-subrestore',
    'hostile-proxy-fail-closed',
    'revoked-proxy-fail-closed',
    'sparse-neural-vector-rejected',
    'inherited-root-rejected',
  ],
},null,2));
