import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';

const dir=await mkdtemp(join(tmpdir(),'neuro-p69-p73-'));
const file=join(dir,'state.json');
try{
 const core=new OrganismCore(new FileStateStore(file),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
 await core.init();
 for(let i=0;i<10;i++){
   await core.observe({
     text:i%2===0?`Внешнее наблюдение ${i}`:undefined,
     success:i%2===0?.72:undefined,
     reward:i%2===0?.61:undefined,
     novelty:i%3===0?.78:.31,
     embodiment:{bodyEnergy01:i===7?.16:.76,cognitiveCapacity01:i===7?.26:.84,thermalStrain01:i===8?.86:.18,sensoryFreshness01:.9,awake:true,battery01:.68,cpuLoad01:.24,ramPressure01:.22}
   });
 }
 const snap=core.snapshot();
 assert.equal(snap.schemaVersion,RELEASE_CONTRACT.stateSchema);
 assert.ok(snap.facets.advanced.p69ConstitutionalArbiter.cycles>=10);
 assert.ok(snap.facets.advanced.p70MemoryLifecycleGovernor.cycles>=10);
 assert.ok(snap.facets.advanced.p71SelfConsistency.cycles>=10);
 assert.ok(snap.facets.advanced.p72LifeCycle.cycles>=10);
 assert.ok(snap.facets.advanced.p73CapabilityLedger.cycles>=10);
 assert.ok(snap.facets.advanced.p73CapabilityLedger.evidenceEvents>=1);
 assert.ok(['protect','respond','explore','verify','reflect','rest','observe'].includes(snap.facets.advanced.p69ConstitutionalArbiter.lastMode));
 const light=core.snapshotLight();
 assert.ok(Object.keys(light).length<=24);
 await core.flush();
 const core2=new OrganismCore(new FileStateStore(file),{checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,enableLanguage:false});
 await core2.init();
 const restored=core2.snapshot();
 assert.ok(restored.facets.advanced.p69ConstitutionalArbiter.cycles>=snap.facets.advanced.p69ConstitutionalArbiter.cycles);
 assert.ok(restored.facets.advanced.p70MemoryLifecycleGovernor.cycles>=snap.facets.advanced.p70MemoryLifecycleGovernor.cycles);
 assert.ok(restored.facets.advanced.p71SelfConsistency.cycles>=snap.facets.advanced.p71SelfConsistency.cycles);
 assert.ok(restored.facets.advanced.p72LifeCycle.cycles>=snap.facets.advanced.p72LifeCycle.cycles);
 assert.ok(restored.facets.advanced.p73CapabilityLedger.evidenceEvents>=snap.facets.advanced.p73CapabilityLedger.evidenceEvents);
 console.log('P69_P73_GIANT_RUNTIME_PERSISTENCE=PASS');
} finally { await rm(dir,{recursive:true,force:true}); }
