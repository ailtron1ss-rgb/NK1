import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
function store(){ let value=null; return { async load(){return value?structuredClone(value):null;}, async save(v){value=structuredClone(v);}, metrics(){return {saves:0,bytesWritten:0,lastPayloadBytes:0,lastSaveMs:0,backupCopies:0,fsyncs:0,lastSavedAt:0};} }; }
const s=store(); const core=new OrganismCore(s,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<28;i++){
  await core.observe({novelty:i%6===0?.82:.25,surprise:i%4===0?.55:.12,text:i%3===0?`b263 event ${i}`:undefined},'operational');
  await core.feedback({success:i%3===0?.83:.31,reward:i%4===0?.79:.22,surprise:i%5===0?.61:.13});
}
const snap=core.snapshot(), c=snap.system.realActionCausalityB263;
assert.ok((c?.updates??0)>=20,'B263 must train from live core feedback');
assert.ok((c?.rows?.length??0)>=20); assert.ok(Number.isFinite(c?.causalGain01));
const before=Array.from({length:24},(_,i)=>Math.sin(i*.19));
const iv=core.b263Intervene(before,'verify');
const cmp=core.b263CompareActions(before);
const rep=core.b263Replay(12); const diag=core.b263CausalDiagnostics(); const ab=core.b263AblateAction('verify');
assert.equal(cmp.length,7); assert.ok(Number.isFinite(iv.causalEffect01)); assert.ok(rep.rows>0); assert.ok(Number.isFinite(diag.causalGain01)); assert.ok(Number.isFinite(ab.drop01));
const s2=store(); await s2.save(snap); const core2=new OrganismCore(s2,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.snapshot().system.realActionCausalityB263,c,'B263 state must survive core restart round-trip');
console.log(JSON.stringify({ok:true,updates:c?.updates,rows:c?.rows?.length,causalGain01:c?.causalGain01,conditionedError01:c?.conditionedError01,shuffledBaselineError01:c?.shuffledBaselineError01,behavioralGain01:c?.behavioralGain01,intervention:iv,replay:rep,diagnostics:diag,ablation:ab,restartPreserved:true}));
