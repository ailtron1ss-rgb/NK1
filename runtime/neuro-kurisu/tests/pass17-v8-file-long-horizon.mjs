import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { verifyDecisionSemanticEvidence } from '../src/organism/system/DecisionSemanticEvidence.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-pass17-r19-'));
const path=join(dir,'organism-core.json');
const cfg={performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:64,checkpointMinIntervalMs:60000,enableLanguage:false};
try {
  const store=new FileStateStore(path,{encoding:'v8',backupEverySaves:99,directoryFsyncEverySaves:99});
  const core=new OrganismCore(store,cfg); await core.init();
  const times=[];
  for(let i=0;i<256;i++){
    const t=performance.now();
    await core.observe({text:i%32===0?`v8 long horizon checkpoint ${i}`:undefined,reward:i%17===0?.65:undefined,surprise:i%13===0?.24:.04,novelty:.35+(i%7)*.03,embodiment:{bodyEnergy01:.8-(i%19)*.006,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.88,awake:true,battery01:.78,cpuLoad01:.2,ramPressure01:.22}},'operational');
    times.push(performance.now()-t);
  }
  await core.flush();
  const restoredStore=new FileStateStore(path,{encoding:'v8'});
  const snap=await restoredStore.load();
  assert.ok(snap); assert.equal(snap.state.tick,256);
  assert.ok(snap.traces.every(t=>verifyDecisionSemanticEvidence(t).pass));
  const restored=new OrganismCore(restoredStore,cfg); await restored.init();
  await restored.observe({novelty:.42,embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.82,thermalStrain01:.16,sensoryFreshness01:.9,awake:true,battery01:.77,cpuLoad01:.21,ramPressure01:.22}},'operational');
  assert.ok(restored.operationalStatusSnapshot().tick>=257);
  const first=times.slice(0,32).reduce((a,b)=>a+b,0)/32;
  const last=times.slice(-32).reduce((a,b)=>a+b,0)/32;
  console.log(JSON.stringify({pass:true,cycles:256,restartedTick:restored.operationalStatusSnapshot().tick,firstMs:first,lastMs:last,ratio:last/Math.max(first,.001),payloadBytes:store.metrics().lastPayloadBytes,saveMs:store.metrics().lastSaveMs}));
} finally { await rm(dir,{recursive:true,force:true}); }
