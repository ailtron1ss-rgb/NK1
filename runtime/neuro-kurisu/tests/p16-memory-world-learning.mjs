import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{});
await core.init();
for(let i=0;i<18;i++){
  const text=i%2===0?'study world-model uncertainty and verification strategy':'continue the verification experiment with evidence';
  await core.observe({text, novelty:.42, surprise:i%3===0?.55:.18});
  const before={tick:i,location:'home',energy:.72,attention:.78,uncertainty:.34,facts:['communication active'],objects:[{id:'lab-kit',label:'experiment kit',location:'home',value:.7,visible:true,collected:i%2===0}],events:['tick']};
  const after={...before, tick:i+1, energy: i%3===0?.64:.76, attention:i%2===0?.7:.82, uncertainty:i%4===0?.46:.28, facts:['communication active','new evidence'], events:['tick','result']};
  await core.feedback({success:i%3===0?.78:.62,reward:i%3===0?.56:.24,surprise:i%4===0?.35:.12,notes:'p16-learning-feedback',worldTransition:{action:core.snapshot().state.lastAction, before, after, reward:i%3===0?.56:.24, surprise:i%4===0?.35:.12, at:Date.now()}});
}
const s=core.snapshot();
const mem=s.facets.advanced.memoryOS;
const policy=s.facets.learning.adaptivePolicy;
const world=s.facets.advanced.worldModel2;
assert.ok(mem.items.length>=2);
assert.ok(mem.semanticQueries>0);
assert.ok(mem.semanticHits>0);
assert.ok(mem.linkUpdates>0);
assert.ok(policy.updates>=10);
assert.ok(Object.keys(policy.values).length>0);
assert.ok(policy.rewardedUpdates>0);
assert.ok(world.learnedTransitions>=10);
assert.ok(world.transitionHypotheses && Object.keys(world.transitionHypotheses).length>0);
assert.ok(world.calibration.length>0);
assert.ok(s.schemaVersion>=19);
console.log(`P16_MEMORY_WORLD_LEARNING=PASS memories=${mem.items.length} semanticHits=${mem.semanticHits} links=${mem.linkUpdates} policyUpdates=${policy.updates} worldTransitions=${world.learnedTransitions}`);
