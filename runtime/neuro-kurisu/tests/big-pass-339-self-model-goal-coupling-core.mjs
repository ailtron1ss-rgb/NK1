import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
const dir=await mkdtemp(path.join(tmpdir(),'nk-b339-core-'));
try {
 const baseline={goalAlignmentEMA01:.5,preferredStrategies:[]};
 const r=new OrganismRuntime({stateFile:path.join(dir,'s.json'),worldStateFile:path.join(dir,'w.json'),enableLanguage:false,stateStore:new MemoryStateStore(),worldStateStore:new MemoryStateStore(),journal:new BoundedOperationalJournal()});
 await r.init();
 for(let i=0;i<8;i++) await r.step();
 const sm=r.core.recoveryAutobiographicalSnapshot().selfModel;
 const bias=r.core.selfModelDecisionBiasDiagnostics();
 assert.ok(Math.abs(sm.goalAlignmentEMA01-baseline.goalAlignmentEMA01)>1e-4,'real runtime must update self-model goal alignment, regardless of sign');
 assert.ok(sm.preferredStrategies.length>=1,'self-model should retain runtime strategy traces');
 assert.ok(Object.values(bias).some(v=>Math.abs(v)>0),'self-model must expose a non-zero decision influence after runtime learning');
 console.log(`B339_CORE_SELF_MODEL_GOAL_COUPLING=PASS ticks=8 goalEMA=${sm.goalAlignmentEMA01.toFixed(3)} strategies=${sm.preferredStrategies.length} agency=${sm.agencyBelief.toFixed(3)} maxBias=${Math.max(...Object.values(bias).map(Number)).toFixed(4)}`);
 await r.stop();
} finally { await rm(dir,{recursive:true,force:true}); }
