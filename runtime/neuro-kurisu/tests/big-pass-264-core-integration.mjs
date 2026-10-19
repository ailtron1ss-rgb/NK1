import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
function store(){let value=null;return {async load(){return value?structuredClone(value):null;},async save(v){value=structuredClone(v);},metrics(){return {saves:0,bytesWritten:0,lastPayloadBytes:0,lastSaveMs:0,backupCopies:0,fsyncs:0,lastSavedAt:0};}};}
const s=store(); const core=new OrganismCore(s,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<34;i++){
  await core.observe({novelty:i%7===0?.86:.28,surprise:i%5===0?.62:.14,text:i%4===0?`b264 policy event ${i}`:undefined},'operational');
  await core.feedback({success:i%3===0?.84:.32,reward:i%4===0?.81:.23,surprise:i%6===0?.65:.12});
}
const snap=core.snapshot(); const b= snap.system.causalPolicyLearningB264;
assert.ok((b?.decisions??0)>20); assert.ok((b?.policyUpdates??0)>10); assert.ok(Number.isFinite(b?.policyGain01));
const before=Array.from({length:24},(_,i)=>Math.sin(i*.11));
const r=core.b264CausalPolicyReplay(10); const d=core.b264CausalPolicyDiagnostics(); assert.ok(r.rows>0); assert.ok(Number.isFinite(d.causalReliance01));
const s2=store(); await s2.save(core.snapshot()); const core2=new OrganismCore(s2,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.snapshot().system.causalPolicyLearningB264,core.snapshot().system.causalPolicyLearningB264);
console.log(JSON.stringify({ok:true,diagnostics:d,replay:r,restartPreserved:true}));
