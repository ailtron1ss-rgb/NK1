import assert from 'node:assert/strict';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
const c=new MemorySubstrateCoordinator();
const os={items:[{id:'m1',content:'hello world',kind:'episodic',confidence:.8,epistemicStatus:'fact',dormant:false,retentionClass:'normal'}],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0,version:2};
const continuum=[{id:'c1',summary:'hello world',evidence:[],timescale:'episodic',retrievalCount:0,lastRetrievedAt:0,confidence:.5,sourceEventIds:[],createdAt:0,salience:.5,novelty:.2,predictionError:.1,emotionalValence:0,causalDepth:0}];
const r=c.inspect(os,continuum);assert.equal(r.canonicalAuthority,'memoryOS2');assert.equal(r.strongMatches,1);assert.equal(r.compatibilityOnlyContinuumItems,0);assert.equal(r.recommendation,'consolidate-reads');assert.equal(c.lightweightCanonicalItems(os,1)[0].id,'m1');const projected = c.projectCompatibilityRecords(os, 12);
assert.ok(projected.length <= 12);
assert.ok(projected.every(row => row.id && row.summary));
console.log(`MEMORY_SUBSTRATE=PASS projected=${projected.length}`);


// The indexed inspector must preserve the previous brute-force Jaccard semantics.
const corpus = [
  { id:'a', content:'red fox crosses quiet forest path' },
  { id:'b', content:'blue bicycle near the old station' },
  { id:'c', content:'red fox returns to the forest' },
  { id:'d', content:'!!!' },
];
const corpusContinuum = [
  { ...continuum[0], id:'x1', summary:'red fox crosses quiet forest path', evidence:[] },
  { ...continuum[0], id:'x2', summary:'red fox appears in forest', evidence:['quiet path'] },
  { ...continuum[0], id:'x3', summary:'blue bicycle at station', evidence:['old station'] },
  { ...continuum[0], id:'x4', summary:'unrelated quantum observatory', evidence:[] },
  { ...continuum[0], id:'x5', summary:'!!!', evidence:[] },
];
const expandedState = { ...os, items:corpus.map(row=>({ ...os.items[0], ...row })) };
const indexed = c.inspect(expandedState, corpusContinuum);
const normalise = value => String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim().slice(0,240);
const terms = value => new Set(normalise(value).split(/[^\p{L}\p{N}_-]+/u).filter(token=>token.length>2).slice(0,48));
const referenceSimilarity = (a,b) => {
  const left=terms(a),right=terms(b); if(!left.size||!right.size)return 0;
  let common=0; for(const token of left)if(right.has(token))common++;
  return common/Math.max(1,left.size+right.size-common);
};
let expectedWeighted=0,expectedOverlap=0,expectedStrong=0;
for(const row of corpusContinuum){
  const content=normalise(`${row.summary} ${row.evidence.join(' ')}`);let best=0;
  for(const item of corpus){const canonical=normalise(item.content);best=Math.max(best,canonical===content?1:referenceSimilarity(content,canonical));}
  expectedWeighted+=best;if(best>=.42){expectedOverlap++;if(best>=.62)expectedStrong++;}
}
assert.equal(indexed.strongMatches,expectedStrong);
assert.equal(indexed.compatibilityOnlyContinuumItems,corpusContinuum.length-expectedOverlap);
assert.ok(Math.abs(indexed.semanticOverlap01-expectedWeighted/corpusContinuum.length)<1e-12);
console.log('MEMORY_SUBSTRATE_INDEX_EQUIVALENCE=PASS indexed candidates preserve brute-force results');
