import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const core=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0});
await core.init();
const state=core.snapshot().state;
const h=core.p36Propose();
assert.ok(h);
const preview=core.p36RunExperiment(h.id,13);
assert.equal(preview?.evidenceGate,'sandbox-preview');
assert.equal(core.p36Snapshot().acceptedChanges,0);
for(const [context,holdout,delay] of [['r1',false,1000],['r2',false,2000],['r3',true,3000],['r4',true,4000],['r5',true,5000],['r6',true,6000]]){
  core.p36RecordExternalEvidence({hypothesisId:h.id,contextKey:context,control01:.5,treatment01:.59,independentVerified:true,holdout,delayMs:delay,evaluatorVersion:'observer-v1',evidenceSource:'external-evaluator',protocolId:'dev-protocol-core',sessionId:'dev-session-core',at:100+delay});
}
const after=core.p36Snapshot();
assert.equal(after.acceptedChanges,1);
assert.equal(after.hypotheses.find(x=>x.id===h.id)?.evidenceGate,'replicated');
await core.flush();
const core2=new OrganismCore(store,{enableLanguage:false,checkpointMinIntervalMs:0});
await core2.init();
const restored=core2.p36Snapshot();
assert.equal(restored.acceptedChanges,1);
assert.equal(restored.externalEvidence.length,6);
assert.equal(restored.hypotheses.find(x=>x.id===h.id)?.evidenceGate,'replicated');
console.log('BIG_PASS_109_CORE_DEVELOPMENT=PASS',JSON.stringify({acceptedChanges:restored.acceptedChanges,evidence:restored.externalEvidence.length,gate:restored.hypotheses.find(x=>x.id===h.id)?.evidenceGate,schema:core2.snapshot().state.version}));
