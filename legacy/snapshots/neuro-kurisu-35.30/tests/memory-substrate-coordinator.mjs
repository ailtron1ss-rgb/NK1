import assert from 'node:assert/strict';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
const c=new MemorySubstrateCoordinator();
const os={items:[{id:'m1',content:'hello world',kind:'episodic',confidence:.8,epistemicStatus:'fact',dormant:false,retentionClass:'normal'}],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0,version:2};
const continuum=[{id:'c1',summary:'hello world',evidence:[],timescale:'episodic',retrievalCount:0,lastRetrievedAt:0,confidence:.5,sourceEventIds:[],createdAt:0,salience:.5,novelty:.2,predictionError:.1,emotionalValence:0,causalDepth:0}];
const r=c.inspect(os,continuum);assert.equal(r.canonicalAuthority,'memoryOS2');assert.equal(r.strongMatches,1);assert.equal(r.compatibilityOnlyContinuumItems,0);assert.equal(r.recommendation,'consolidate-reads');assert.equal(c.lightweightCanonicalItems(os,1)[0].id,'m1');const projected = c.projectCompatibilityRecords(os, 12);
assert.ok(projected.length <= 12);
assert.ok(projected.every(row => row.id && row.summary));
console.log(`MEMORY_SUBSTRATE=PASS projected=${projected.length}`);
