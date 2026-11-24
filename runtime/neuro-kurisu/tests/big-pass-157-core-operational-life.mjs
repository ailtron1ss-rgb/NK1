import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const dir=await mkdtemp(join(tmpdir(),'nk157-')); const path=join(dir,'state.json');
const core=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'});
await core.init();
for(let i=0;i<4;i++){await core.observe({worldContext:{tick:i+1,location:'operational-lab',energy:.8,attention:.8,uncertainty:.35,facts:['runtime'],objects:['lab'],events:['neutral']},novelty:.45}); await core.feedback({success:.76,reward:.68,surprise:.12});}
const d=core.operationalLifeDiagnostics(); const a=core.operationalLifeSelfAudit();
assert.equal(a.pass,true); assert.ok(d.counts.decisions>=1); assert.ok(d.counts.outcomes>=1); assert.ok(d.counts.postconditions>=1); assert.ok(d.counts.perceptions>=4); assert.ok(d.counts.personality>=4); assert.ok(d.counts.social>=4); assert.ok(d.counts.embodiment>=4);
await core.flush();
const restored=new OrganismCore(new FileStateStore(path),{enableLanguage:false,performanceProfile:'mobile'}); await restored.init();
assert.equal(restored.operationalLifeSelfAudit().pass,true); assert.ok(restored.operationalLifeSnapshot().decisions.length>=d.counts.decisions);
console.log(`BIG_PASS_157_CORE=PASS cycles=${d.cycles} decisions=${d.counts.decisions} outcomes=${d.counts.outcomes} postconditions=${d.counts.postconditions} persisted=true`);
await restored.flush();
