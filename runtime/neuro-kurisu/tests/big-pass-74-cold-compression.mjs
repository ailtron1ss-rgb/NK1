import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const fabric = new ExperienceContinuumFabric();
const base = Date.now() - 45*24*60*60*1000;
for (let i=0;i<6;i++) {
  fabric.observe({
    id:`cold-${i}`, kind:'episodic', content:`research insight memory cluster alpha evidence ${i}`,
    source:'test', createdAt:base+i, lastAccessAt:base+i,
    salience:.38, confidence:.92, identityRelevance:.12, goalRelevance:.11,
    socialRelevance:.04, predictionError:.06, retrievalCount:1, dormant:false,
    semanticLinks:[], vector:[], epistemicStatus:'accepted'
  }, {tick:i,at:base+i,novelty01:.2,identityContinuity01:.95,valueContinuity01:.9,activeGoals:['research'],evidenceSupport01:.9});
}
fabric.tick({tick:32,at:Date.now(),pressure01:.1,identityContinuity01:.9,valueStability01:.9,evidenceSupport01:.9});
const s=fabric.summary();
assert.ok(s.coldCount>=3);
assert.ok(s.clusters>=1,'expected cold consolidation cluster');
console.log(JSON.stringify({ok:true,coldCount:s.coldCount,clusters:s.clusters,compressedNodes:s.compressedNodes}));
