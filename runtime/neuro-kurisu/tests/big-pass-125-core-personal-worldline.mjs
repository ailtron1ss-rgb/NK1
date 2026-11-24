import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const dir=await mkdtemp(join(tmpdir(),'nk125-')); const path=join(dir,'state.json');
const world={tick:1,location:'worldline-lab',energy:.72,attention:.8,uncertainty:.52,facts:['persistent-context'],objects:['lab'],events:['neutral']};
const core=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<8;i++){await core.observe({worldContext:{...world,tick:i+1},novelty:.45}); await core.feedback({success:i%3===0?.9:.72,reward:i%3===0?.8:.5,surprise:.15});}
const snap=core.personalWorldlineSnapshot(); assert.ok(snap.cycles>=1); assert.ok(snap.threads.length>=2); await core.flush(); const raw=JSON.parse(await readFile(path,'utf8')); assert.ok(raw.facets.learning.personalWorldline);
const restored=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await restored.init(); const rs=restored.personalWorldlineSnapshot(); assert.equal(rs.threads.length,snap.threads.length); assert.equal(rs.cycles,snap.cycles); console.log(`BIG_PASS_125_CORE=PASS cycles=${snap.cycles} threads=${snap.threads.length} focus=${snap.focusKind}:${snap.focusId} stability=${snap.worldlineStability01.toFixed(3)} learning=${snap.learningPressure01.toFixed(3)} persisted=true`); await restored.flush();
