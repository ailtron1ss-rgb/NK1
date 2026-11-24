import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
function store(){ let value=null; return { async load(){return value?structuredClone(value):null;}, async save(v){value=structuredClone(v);}, metrics(){return {saves:0,bytesWritten:0,lastPayloadBytes:0,lastSaveMs:0,backupCopies:0,fsyncs:0,lastSavedAt:0};} }; }
const s=store(); const core=new OrganismCore(s,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<12;i++){await core.observe({novelty:i%5===0?.8:.2,surprise:i%4===0?.55:.1,text:i%3===0?`b261 world event ${i}`:undefined},'operational'); await core.feedback({success:i%2===0?.8:.25,reward:i%3===0?.72:.2,surprise:i%5===0?.7:.12});}
const snap=core.snapshot(), wm=snap.system.unifiedWorldModelB261;
assert.ok((wm?.trainingUpdates??0)>=8,'B261 must train during real core feedback');
assert.ok((wm?.transitionSamples??0)>=8); assert.ok(core.b261WorldModelDiagnostics().episodeCount>=8);
assert.ok(Number.isFinite(wm?.onlineTransitionError01));
const d=core.b261WorldModelDiagnostics(); assert.equal(d.updates,wm.updates);
const s2=store(); await s2.save(snap); const core2=new OrganismCore(s2,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.snapshot().system.unifiedWorldModelB261,wm,'B261 system state must survive core restart round-trip');
const compare=core2.b261WorldModelCompareActions(Array.from({length:24},(_,i)=>Math.sin(i*.2))); assert.equal(compare.length,7);
console.log(JSON.stringify({ok:true,trainingUpdates:wm.trainingUpdates,transitionSamples:wm.transitionSamples,episodeCount:wm.episodeCount,onlineTransitionError01:wm.onlineTransitionError01,onlineRewardError01:wm.onlineRewardError01,holdoutDelta01:wm.holdoutDelta01,replayGain01:wm.replayGain01,actionSensitivity01:wm.actionSensitivity01,restartPreserved:true}));
