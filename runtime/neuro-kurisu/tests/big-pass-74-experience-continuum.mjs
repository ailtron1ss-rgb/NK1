import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';

const make=(content,overrides={})=>({
  id:overrides.id??content.replace(/\W+/g,'-').slice(0,24), content,
  kind:overrides.kind??'episodic', source:overrides.source??'user',
  createdAt:overrides.createdAt??Date.now(), lastAccessAt:overrides.lastAccessAt??Date.now(),
  salience:overrides.salience??.7, emotionalWeight:overrides.emotionalWeight??.5, identityRelevance:overrides.identityRelevance??.7,
  goalRelevance:overrides.goalRelevance??.6, socialRelevance:overrides.socialRelevance??.4, predictionError:overrides.predictionError??.3,
  confidence:overrides.confidence??.8, epistemicStatus:overrides.epistemicStatus??'hypothesis', source:overrides.source??'user',
  entities:[], semanticLinks:overrides.semanticLinks??[], temporalLinks:overrides.temporalLinks??[], causalLinks:overrides.causalLinks??[],
  revisionHistory:[], dormant:false, retrievalCount:overrides.retrievalCount??0, semanticVector:[]
});

const fabric=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
const now=Date.now();
const a=make('космос и научный эксперимент изменили моё решение',{id:'m1',identityRelevance:.95,predictionError:.7,semanticLinks:['m2']});
const b=make('космос эксперимент повторился и дал новый результат',{id:'m2',identityRelevance:.65,predictionError:.5,createdAt:now-10*24*3600*1000,lastAccessAt:now-10*24*3600*1000});
const c=make('обычное наблюдение без долгой значимости',{id:'m3',identityRelevance:.15,salience:.2,goalRelevance:.1,createdAt:now-30*24*3600*1000,lastAccessAt:now-30*24*3600*1000,confidence:.9});

fabric.observe(a,{tick:1,at:now,novelty01:.8,identityContinuity01:.9,valueStability01:.85,activeGoalIds:['g1'],evidenceSupport01:.75});
fabric.observe(b,{tick:2,at:now,novelty01:.5,identityContinuity01:.9,valueStability01:.85,activeGoalIds:['g1'],evidenceSupport01:.8});
fabric.observe(c,{tick:3,at:now-30*24*3600*1000,novelty01:.1,identityContinuity01:.9,valueStability01:.85,activeGoalIds:[],evidenceSupport01:.9});
let summary=fabric.summary();
assert.equal(summary.graphNodes,3);
assert.ok(summary.graphEdges>=2,'semantic/goal/identity graph edges should exist');
assert.ok(summary.hotCount>=1,'high-significance recent experience should be hot');
assert.ok(summary.identityGravity.tension01>=0);

fabric.tick({tick:32,at:now+31*24*3600*1000,pressure01:.72,identityContinuity01:.9,valueStability01:.85,evidenceSupport01:.8});
summary=fabric.summary();
assert.ok(summary.coldCount>=1,'old low-significance experience should become cold');
assert.ok(summary.clusters>=0);

const restored=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
restored.restore(fabric.snapshot());
assert.deepEqual(restored.summary().graphNodes,summary.graphNodes);
assert.deepEqual(restored.summary().clusters,summary.clusters);

const oldMemory=new MemoryOS2();
oldMemory.restore({version:2,items:[],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0});
assert.equal(oldMemory.size(),0);

const highRisk=make('unsupported identity claim',{id:'risk',identityRelevance:.92,confidence:.3,source:'unknown'});
const risk=fabric.observe(highRisk,{tick:40,at:now,identityContinuity01:.85,valueStability01:.9,evidenceSupport01:.3});
assert.ok(risk.integrity.flags.includes('identity-critical-low-confidence'));
assert.ok(risk.integrity.flags.includes('unknown-source'));
assert.ok(risk.identityGravity.proposedChangeMagnitude01>=0);

// No automatic identity rewrite: this layer only measures pressure and proposes magnitude.
assert.equal(typeof risk.identityGravity.proposedChangeMagnitude01,'number');

console.log(JSON.stringify({ok:true,summary:fabric.summary()},null,2));
