import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-switch-'));
try{const file=path.join(dir,'state.json');let core=new OrganismCore(new FileStateStore(file));await core.init();await core.recordLanguageBackend('gemini:test');await core.recordLanguageBackend('kobold');const before=core.snapshot();assert.equal(before.facets.advanced.modelSwitch.switches,2);core=new OrganismCore(new FileStateStore(file));await core.init();const after=core.snapshot();assert.equal(after.facets.advanced.modelSwitch.currentBackend,'kobold');assert.ok(after.facets.advanced.modelSwitch.continuityScore>=.98);console.log('MODEL_SWITCH_CONTINUITY=PASS');}finally{await rm(dir,{recursive:true,force:true});}
