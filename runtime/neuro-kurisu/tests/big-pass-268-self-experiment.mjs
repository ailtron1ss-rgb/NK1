import assert from 'node:assert/strict';
import { B268CausalSelfExperimentLab, mutateB264PolicySnapshot } from '../src/organism/cognition/B268CausalSelfExperimentLab.ts';
import { defaultB264CausalPolicyLearning } from '../src/organism/cognition/B264CausalPolicyLearning.ts';

const lab=new B268CausalSelfExperimentLab();
const base=[...Array(8)].map((_,i)=>({return01:.46+(i%2)*.01,robustness01:.81,delayedReward01:.42}));
const improved=[...Array(8)].map((_,i)=>({return01:.51+(i%3)*.01,robustness01:.80,delayedReward01:.48}));
const degraded=[...Array(8)].map((_,i)=>({return01:.39+(i%2)*.005,robustness01:.71,delayedReward01:.36}));
const spec={id:'b268-exp-001',hypothesis:'increase verify preference after regime shift',targetAction:'verify',biasDelta:.12,contextDelta:.04,minPairedGain01:.015,minWinRate01:.62,maxRobustnessDrop01:.03};
const r1=lab.evaluate(spec,base,improved,12);
assert.equal(r1.decision,'commit');
const r2=lab.evaluate({...spec,id:'b268-exp-002',hypothesis:'bad mutation'},base,degraded,20);
assert.equal(r2.decision,'revert');
const snap=lab.snapshot(); const restored=new B268CausalSelfExperimentLab(); restored.restore(snap); assert.deepEqual(restored.snapshot(),snap);
const p=defaultB264CausalPolicyLearning(); const mutated=mutateB264PolicySnapshot(p,spec); assert.ok(mutated.actionBias[2]>p.actionBias[2]);
console.log(JSON.stringify({pass:true,r1,r2,diagnostics:restored.diagnostics()},null,2));
