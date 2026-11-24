import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { rm } from 'node:fs/promises';
const dir='/tmp/neuro-kurisu-p39-integration'; await rm(dir,{recursive:true,force:true}); const stateFile=`${dir}/organism.json`; const worldStateFile=`${dir}/world.json`;
const store=new FileStateStore(stateFile); const runtime=new OrganismRuntime({stateFile,worldStateFile,stateStore:store,enableLanguage:false}); await runtime.init();
await runtime.core.observe({embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.8,thermalStrain01:.2,sensoryFreshness01:.9,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2}});
const before=runtime.core.p39Diagnostics(); const life=await runtime.core.p39RegisterHost('test-host'); assert.equal(life.host.current,'test-host'); assert.ok(before.lifeTicks>=1);
await runtime.core.flush(); const saved=await store.load(); assert.ok(saved?.facets?.learning?.p39); assert.equal(saved.facets.learning.p39.host.current,'test-host'); await rm(dir,{recursive:true,force:true}); console.log(`P39_INTEGRATION=PASS ticks=${saved.facets.learning.p39.lifeTicks} host=${saved.facets.learning.p39.host.current}`);
