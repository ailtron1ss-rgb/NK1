import assert from 'node:assert/strict';
import { B279NeuralAttractorAssemblies } from '../src/organism/cognition/B279NeuralAttractorAssemblies.ts';

const net=new B279NeuralAttractorAssemblies();
const patterns=[
  [1,.9,.8,.2,-.4,-.3,.1,.2,.7,.5,-.2,.1,.4,-.6,.3,.2],
  [-.8,-.6,-.2,.8,.7,.5,-.1,-.2,.1,.3,.8,-.5,.2,.6,-.3,-.2],
  [.2,.1,-.7,-.8,.5,.8,.6,-.2,-.1,.4,-.4,.7,.9,.3,-.5,.1],
];
for(let epoch=0;epoch<110;epoch++){
  for(let p=0;p<patterns.length;p++){
    net.step({tick:epoch*3+p,vector:patterns[p],goalVector:patterns[p].slice(0,8),selfLatent:patterns[p].slice(0,8),worldLatent:patterns[p].slice(8),novelty01:.35,uncertainty01:.2,autonomy01:.7,action:['explore','verify','reflect'][p]});
    net.learnFromOutcome({tick:epoch*3+p,reward01:.78-.05*p,predictionError01:.18,action:['explore','verify','reflect'][p],externalEvidence01:.85});
  }
}
const refs=patterns.map((p,i)=>net.probe(p,['explore','verify','reflect'][i],8));
const r=patterns.map((p,i)=>net.recall(p,.18,8,refs[i]));
assert.ok(r.every(x=>x.converged),'attractor recall should converge from noisy cues');
assert.ok(r.reduce((s,x)=>s+x.similarity01,0)/r.length>.62,'mean recall must be > .62');
const lesion=net.lesion(.35);
assert.ok(lesion.causalDrop01>.01,'lesion must cause measurable causal disruption');
const before=net.snapshotAttractor();
const replay=net.replay(8);
assert.ok(replay.applied>0,'replay must modify recurrent weights');
const after=net.snapshotAttractor();
assert.ok(after.consolidationCount>=before.consolidationCount,'consolidation should not decrease');
assert.ok(after.learningUpdates>=before.learningUpdates,'learning should persist');
const diag=net.diagnostics();
assert.ok(diag.sparsity01>.35,'assembly must remain sparse');
assert.ok(diag.homeostaticError01<.2,'homeostasis must stay bounded');
const snap=net.snapshot(); const net2=new B279NeuralAttractorAssemblies(); net2.restore(snap); assert.deepEqual(net2.snapshot(),snap,'snapshot round-trip');
console.log(JSON.stringify({ok:true,meanRecall:r.reduce((s,x)=>s+x.similarity01,0)/r.length,lesion,diagnostics:net.diagnostics(),replay},null,2));
