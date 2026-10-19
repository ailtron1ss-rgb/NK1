import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const dir=await mkdtemp(join(tmpdir(),'nk157r-')); const path=join(dir,'state.json');
const core=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await core.init();
for(let i=0;i<3;i++){await core.observe({worldContext:{tick:i+1,location:'restart-lab',energy:.8,attention:.8,uncertainty:.35,facts:['restart'],objects:['lab'],events:['neutral']},novelty:.4}); await core.feedback({success:.74,reward:.66,surprise:.1});}
const before=core.operationalLifeSnapshot(); await core.flush();
const core2=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await core2.init();
const after=core2.operationalLifeSnapshot(); assert.ok(after.cycles>=before.cycles); assert.ok(after.decisions.length>=before.decisions.length); assert.equal(core2.operationalLifeSelfAudit().pass,true);
console.log(`BIG_PASS_157_RESTART=PASS restoredCycles=${after.cycles} decisions=${after.decisions.length}`); await core2.flush();
