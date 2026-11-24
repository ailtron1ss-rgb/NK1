import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const dir=await mkdtemp(path.join(tmpdir(),'nk-p2868-'));
try {
  const r=new OrganismRuntime({stateFile:path.join(dir,'state.json'),worldStateFile:path.join(dir,'world.json'),enableLanguage:false,autoRun:false,checkpointMinIntervalMs:600000,checkpointMaxDirtyCycles:24,performanceProfile:'mobile',cycleResultMode:'summary'});
  await r.init(); const actions=[];
  for(let i=0;i<8;i++){const x=await r.autonomousStep(); actions.push(x.worldAction);}
  const d=r.core.neuralExperienceBranchDiagnostics();
  const s=r.core.operationalStatusSnapshot();
  console.log(JSON.stringify({actions,tick:s.tick,learningUpdates:Number(d.unifiedNeuroCausalCore?.learningUpdates??d.learningUpdates??0),replayAdaptation01:Number(d.autonomousContinual?.replayAdaptation01??0),grounded01:Number(d.unifiedCausalWorldLoop?.embodiedGrounding01??0)}));
  await r.stop();
} finally {await rm(dir,{recursive:true,force:true});}
