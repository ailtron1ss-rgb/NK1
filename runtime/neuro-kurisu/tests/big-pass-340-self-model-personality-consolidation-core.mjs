import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir=await mkdtemp(path.join(tmpdir(),'nk-b340-core-'));
try {
 const r=new OrganismRuntime({stateFile:path.join(dir,'s.json'),worldStateFile:path.join(dir,'w.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
 await r.init();
 const before=r.core.personalitySummary().causalUpdates ?? 0;
 for(let i=0;i<10;i++) await r.step();
 const after=r.core.personalitySummary();
 const diag=r.core.causalPersonalityDevelopmentSnapshot?.() ?? r.core.developmentalCausalSnapshot?.();
 assert.ok((after.causalUpdates ?? 0)>before,'live runtime should update personality hypotheses');
 assert.ok((after.trajectorySamples ?? 0)>0,'live runtime should append personality trajectory evidence');
 assert.ok(diag,'core should expose developmental/personality diagnostics');
 console.log(`B340_CORE_SELF_MODEL_PERSONALITY_CONSOLIDATION=PASS ticks=10 causalUpdates=${after.causalUpdates} trajectory=${after.trajectorySamples}`);
 await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
