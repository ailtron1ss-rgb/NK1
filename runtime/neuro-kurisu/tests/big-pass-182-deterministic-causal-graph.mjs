import assert from 'node:assert/strict';
import { CausalAccountabilityGraph } from '../src/organism/system/CausalAccountabilityGraph.ts';

const g=new CausalAccountabilityGraph();
const a=g.recordActionChain({tick:1,tool:'test',ok:true,verified:true,confidence01:.9,executionId:'e1',predictionId:'p1',decisionId:'d1',goalId:'g1',observationId:'o1'});
assert(a.actionId && a.outcomeId);
const snap=g.snapshot();
assert.equal(snap.updatedAt,snap.lastAt);
const r=new CausalAccountabilityGraph(); r.restore(snap);
assert.deepEqual(r.snapshot(),snap,'restore(snapshot) must be byte-stable at the semantic object level');
const snap2=g.snapshot();
assert.deepEqual(snap2,snap,'repeated snapshot without mutation must be deterministic');
console.log(JSON.stringify({pass:182,updatedAt:snap.updatedAt,lastAt:snap.lastAt,nodes:snap.nodes.length,edges:snap.edges.length,deterministic:true},null,2));
