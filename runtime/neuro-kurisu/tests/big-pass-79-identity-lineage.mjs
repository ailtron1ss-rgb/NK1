import assert from 'node:assert/strict';
import { IdentityCausalityGraphEngine } from '../src/organism/system/IdentityCausalityGraph.ts';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';

const g=new IdentityCausalityGraphEngine();
g.observe({tick:1,identityLabel:'Kurisu',causeKind:'belief',causeLabel:'goal:learn',strength01:.74,reason:'supported by verified outcome',relation:'supports',evidence01:.82,source:'test'});
g.link({tick:2,fromKind:'person',fromLabel:'user',toKind:'identity',toLabel:'Kurisu',strength01:.62,reason:'relationship continuity',relation:'involves',evidence01:.7,source:'test'});
g.link({tick:3,fromKind:'observation',fromLabel:'obs-1:world',toKind:'memory',toLabel:'m-1',strength01:.66,reason:'observation encoded in life history',relation:'evidences',evidence01:.9,source:'test'});
const gs=g.summary();
assert.equal(gs.version,2); assert.ok(gs.kinds.belief>=1 && gs.kinds.person>=1 && gs.kinds.observation>=1); assert.ok(gs.relations.supports>=1 && gs.relations.involves>=1);
assert.ok(g.neighborhood('Kurisu').nodes.length>=2);

const p84=new P84AutobiographicalContinuityFabric(32);
let s=p84.ingest({tick:1,at:1000,action:'respond',outcome01:.7,realityHash:'a',realityRevision:1,realityConfidence01:.8,beliefIds:['b1'],personIds:['user'],predictionIds:['p1'],observationIds:['o1'],memoryIds:['m1'],evidenceIds:['e1'],activeGoalIds:['g1'],identity01:.9,authorship01:.8,p78Continuity01:.82,p78Coherence01:.81,narrativeContinuity01:.8,causalLinks01:.86,evidenceQuality01:.88,significance01:.7});
assert.equal(s.moments[0].beliefIds[0],'b1'); assert.equal(s.moments[0].personIds[0],'user'); assert.ok(s.moments[0].evidenceQuality01>.8);
s=p84.ingest({tick:2,at:2000,action:'verify',outcome01:.1,realityHash:'b',realityRevision:2,realityConfidence01:.75,beliefIds:['b1','b2'],personIds:['user'],predictionIds:['p2'],observationIds:['o2'],memoryIds:['m2'],evidenceIds:['e2'],activeGoalIds:['g2'],identity01:.65,authorship01:.7,p78Continuity01:.78,p78Coherence01:.74,narrativeContinuity01:.76,causalLinks01:.9,evidenceQuality01:.84,counterEvidence01:.5,significance01:.84});
const m=s.moments.at(-1); assert.ok(m.boundary01>=.5); assert.ok(s.identityChangeCount>=1); assert.ok(s.beliefContinuity01>.5 && s.socialBinding01>.5);
const restored=new P84AutobiographicalContinuityFabric(32); restored.restore(s); assert.equal(restored.summary().version,5); assert.equal(restored.recent(1)[0].beliefIds[0],'b1');
console.log(`BIG_PASS_79_IDENTITY_LINEAGE=PASS nodes=${gs.nodes} edges=${gs.edges} p84Revision=${s.revision} boundary=${m.boundary01.toFixed(3)}`);
