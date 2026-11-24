import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
function store(){ let value=null; return { async load(){return value?structuredClone(value):null;}, async save(v){value=structuredClone(v);}, metrics(){return {saves:0,bytesWritten:0,lastPayloadBytes:0,lastSaveMs:0,backupCopies:0,fsyncs:0,lastSavedAt:0};} }; }
const s=store(); const core=new OrganismCore(s,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<20;i++){
  await core.observe({novelty:i%5===0?.8:.2,surprise:i%4===0?.55:.1,text:i%3===0?`b262 event ${i}`:undefined},'operational');
  await core.feedback({success:i%2===0?.82:.22,reward:i%3===0?.74:.18,surprise:i%5===0?.65:.12});
}
const snap=core.snapshot(), wm=snap.system.multiTimescaleWorldModelB262;
assert.ok((wm?.updates??0)>=18,'B262 must train in live core feedback');
assert.ok((wm?.transitionSamples??0)>=18); assert.ok((wm?.episodes?.length??0)>=18);
const before=Array.from({length:24},(_,i)=>Math.sin(i*.17));
const replay=core.b262WorldModelReplay(8); const diag=core.b262WorldModelDiagnostics(); const plan=core.b262WorldModelPlan(before,3); const compare=core.b262WorldModelCompareActions(before); const cf=core.b262WorldModelCounterfactual(before,'respond','verify');
assert.ok(replay.episodes>0); assert.equal(plan.steps.length,3); assert.equal(compare.length,7); assert.ok(Number.isFinite(cf.rewardDelta01));
const hold=core.b262WorldModelHoldout([{before,action:'respond',after:before.map(v=>Math.tanh(v*.6)),reward01:.65}]);
const s2=store(); await s2.save(snap); const core2=new OrganismCore(s2,{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core2.init();
assert.deepEqual(core2.snapshot().system.multiTimescaleWorldModelB262,wm,'B262 state must survive core restart round-trip');
console.log(JSON.stringify({ok:true,updates:wm?.updates,episodes:wm?.episodes?.length,replayRuns:wm?.replayRuns,replayedEpisodes:wm?.replayedEpisodes,shortError01:wm?.shortError01,midError01:wm?.midError01,longError01:wm?.longError01,horizonGain01:wm?.horizonGain01,planningScore:plan.score,counterfactualRewardDelta01:cf.rewardDelta01,replayEpisodes:replay.episodes,replayGain01:replay.gain01,holdout:hold,compareActions:compare.length,restartPreserved:true,diagnostics:diag}));
