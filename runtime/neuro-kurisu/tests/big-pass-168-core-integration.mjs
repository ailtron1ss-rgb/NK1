import assert from 'node:assert/strict';
import os from 'node:os'; import path from 'node:path'; import {mkdtemp,rm} from 'node:fs/promises';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
const dir=await mkdtemp(path.join(os.tmpdir(),'nk168-')); const file=path.join(dir,'state.json');
try{
 const core=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core.init();
 await core.observe({text:'external experience: explore and verify a new fact',worldContext:{location:'lab',facts:['new fact'],tick:1,energy:.7,attention:.8,uncertainty:.4,objects:[],events:[]}},'operational');
 await core.feedback({success:.76,surprise:.24,evidenceSource:'user-observation'});
 const s=core.snapshot(); const graph=s.system.causalLifeGraph; assert.ok(graph?.nodes?.length>=3); assert.ok(s.system.emotionAppraisal?.feelings?.length>=1);
 await core.flush(); const core2=new OrganismCore(new FileStateStore(file),{enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,performanceProfile:'mobile'}); await core2.init(); const r=core2.snapshot(); assert.ok((r.system.causalLifeGraph?.nodes?.length??0)>=3); assert.ok((r.system.emotionAppraisal?.feelings?.length??0)>=1); await core2.flush();
 console.log(`BIG_PASS_168_CORE=PASS graphNodes=${r.system.causalLifeGraph?.nodes?.length??0} graphEdges=${r.system.causalLifeGraph?.edges?.length??0} feelings=${r.system.emotionAppraisal?.feelings?.length??0} restart=true`);
} finally { await rm(dir,{recursive:true,force:true}); }
