import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const dir=await mkdtemp(join(tmpdir(),'nk126-')); const path=join(dir,'state.json');
const world={tick:1,location:'trajectory-lab',energy:.74,attention:.8,uncertainty:.48,facts:['persistent-worldline'],objects:['lab'],events:['neutral']};
const core=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<8;i++){await core.observe({worldContext:{...world,tick:i+1},novelty:.52}); await core.feedback({success:i%3===0?.91:.71,reward:i%3===0?.84:.5,surprise:.12});}
const s=core.integratedLifeTrajectorySnapshot(); assert.ok(s.cycles>=1); assert.ok(s.forecasts.length>0); assert.ok(s.trajectoryCoherence01>0); await core.flush(); const raw=JSON.parse(await readFile(path,'utf8')); assert.ok(raw.facets.learning.integratedLifeTrajectory);
const restored=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await restored.init(); const r=restored.integratedLifeTrajectorySnapshot(); assert.equal(r.cycles,s.cycles); assert.equal(r.outcomes.length,s.outcomes.length); console.log(`BIG_PASS_126_CORE=PASS cycles=${s.cycles} forecasts=${s.forecasts.length} coherence=${s.trajectoryCoherence01.toFixed(3)} persisted=true`); await restored.flush();
