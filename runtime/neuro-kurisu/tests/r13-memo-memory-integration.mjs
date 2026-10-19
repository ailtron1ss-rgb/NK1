import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { canonicalizeMemoryContent, deriveMemoryIdentity, memoContentHash, stableMemoryId } from '../src/organism/developmental/MemoInspiredMemoryPrimitives.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';

const base={
  kind:'episodic', content:'  First line\r\n\r\nSecond   line  ', salience:.7, emotionalWeight:.2,
  identityRelevance:.3, goalRelevance:.4, socialRelevance:.1, predictionError:.25,
  temperature01:0, confidence:.8, epistemicStatus:'belief', source:'r13-test',
  entities:[], semanticLinks:[], temporalLinks:[], causalLinks:[]
};

const canonical=canonicalizeMemoryContent(base.content);
const identity=deriveMemoryIdentity(base.content,base.kind,base.source);
assert.equal(identity.contentHash,memoContentHash(base.content));
assert.equal(identity.stableId,stableMemoryId(base.content,base.kind,base.source));

const a=new MemoryOS2();
const first=a.encode({...base,tags:['memo','episodic'],context:{project:'Neuro-Kurisu',branch:'r13'}});
const second=a.encode({...base,content:` ${canonical.replace(/\n/g,'\r\n')} `,tags:['memo','dedup'],context:{commit:'r13-test'}});
assert.equal(first.id,second.id,'canonical content must deduplicate');
assert.equal(second.contentHash,identity.contentHash,'content hash must remain stable');
const restored=a.snapshot();
assert.equal(restored.items[0].context?.project,'Neuro-Kurisu');
assert.equal(restored.items[0].context?.commit,'r13-test');
assert.deepEqual(restored.items[0].tags?.sort(),['dedup','episodic','memo'].sort());
assert.equal(restored.items[0].id,identity.stableId);

const legacy=new MemoryOS2();
legacy.restore({version:2,items:[{...first,contentHash:undefined}],forgetCount:0,reconsolidations:0,quarantined:0,lastMaintenanceAt:0,semanticQueries:0,semanticHits:0,linkUpdates:0});
assert.equal(legacy.snapshot().items[0].contentHash,memoContentHash(first.content),'legacy records receive derived content hashes');

const coordinator=new MemorySubstrateCoordinator();
const os=new MemoryOS2();
const row={id:'legacy-row',kind:'episode',summary:'Stable compatibility memory',evidence:['commit=r13'],timescale:'episodic',retrievalCount:0,lastRetrievedAt:0,confidence:.7,sourceEventIds:[],createdAt:1,salience:.6,novelty:.2,predictionError:.3,emotionalValence:0,causalDepth:0};
assert.equal(coordinator.consolidateCompatibility(os,[row,row],8),1,'identical compatibility rows should reconcile to one canonical memory');
assert.equal(os.size(),1,'canonical MemoryOS owner must deduplicate compatibility imports');
const item=os.snapshot().items[0];
assert.equal(item.context?.timescale,'episodic');
assert.equal(item.context?.originalId,'legacy-row');

const diagnostics=os.memoIdentityDiagnostics();
assert.equal(diagnostics.stableIds,1);
assert.equal(diagnostics.contentHashes,1);

console.log(JSON.stringify({
  pass:true,
  canonicalLength:canonical.length,
  stableId:first.id,
  contentHash:restored.items[0].contentHash,
  dedupReconciliations:a.statsLight().reconsolidations,
  compatibilityItems:os.size(),
  identityDiagnostics:diagnostics,
}));
