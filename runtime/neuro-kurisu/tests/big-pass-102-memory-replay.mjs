import assert from 'node:assert/strict';
import { ExperienceContinuumFabric } from '../src/organism/memory/ExperienceContinuumFabric.ts';

const f=new ExperienceContinuumFabric({maxNodes:128,maxEdges:256,maxClusters:32});
const base={id:'m1',kind:'episodic',source:'test',content:'important causal repair event',createdAt:1,lastAccessAt:1,retrievalCount:0,salience:.82,identityRelevance:.7,goalRelevance:.75,predictionError:.8,emotionalWeight:.4,socialRelevance:.2,confidence:.8,semanticLinks:[],temporalLinks:[],causalLinks:[],epistemicStatus:'verified'};
f.observe(base,{tick:1,at:1,novelty01:.8,evidenceSupport01:.8});
const c=f.replayCandidates(4); assert.equal(c.length,1); assert.ok(c[0].replayPriority01>.5);
const r=f.reactivate('m1',1000); assert.ok(r); assert.equal(r.tier,'hot');
const summary=f.summary(); assert.equal(summary.version,6); assert.equal(summary.replay.reactivated,1);
console.log('BIG_PASS_102_MEMORY_REPLAY=PASS',JSON.stringify({version:summary.version,replayCandidates:c.length,reactivated:summary.replay.reactivated,priority:Number(c[0].replayPriority01.toFixed(3))}));
