import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const dir=await mkdtemp(path.join(os.tmpdir(),'nk-p18-lab-'));
const stateStore=new MemoryStateStore();
const worldStore=new MemoryStateStore();
const rt=new OrganismRuntime({stateFile:path.join(dir,'organism.json'),worldStateFile:path.join(dir,'world.json'),autoRun:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:4,stateStore,worldStateStore:worldStore,journal:{write:async()=>{}}});
await rt.init();
const started=Date.now();
for(let i=0;i<64;i++){
  await rt.step(i%8===0?`Проведи проверку долгой задачи ${i}.`:undefined);
  if(i%16===15)await rt.sleepConsolidate();
}
const h=rt.longitudinalSnapshot();
const p=rt.core.persistenceMetrics();
console.log(JSON.stringify({phase:'P18',cycles:h.observedCycles,outcomes:h.completedOutcomes,replayUpdates:h.replayUpdates,sleepConsolidations:h.sleepConsolidations,causalEvidence01:h.causalEvidence01,predictionCalibration01:h.predictionCalibration01,resilience01:h.resilience01,behaviorEntropy01:h.behaviorEntropy01,continuity01:h.continuity01,anomalyCount:h.anomalyCount,recoveryCount:h.recoveryCount,elapsedMs:Date.now()-started,persistence:p},null,2));
await rm(dir,{recursive:true,force:true});
