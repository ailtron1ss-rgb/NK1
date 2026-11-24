import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStateStore} from '../src/organism/persistence/FileStateStore.ts';
import {OrganismCore} from '../src/organism/core/OrganismCore.ts';
import {MemoryCausalEconomy} from '../src/organism/system/MemoryCausalEconomy.ts';

async function make(file){ const c=new OrganismCore(new FileStateStore(file),{enableSelfPrediction:true,enableWorldModel:true,enableValueEvolution:true}); await c.init(); return c; }
async function strengthenMemory(core, sourceSuffix){
  const snap=core.snapshot();
  const memoryId=snap.system.lastEncodedMemoryIds?.[0];
  assert(memoryId,'observation did not encode a memory');
  const engine=core.memoryCausalEconomy;
  const content=core.snapshot().memories?.find(m=>m.id===memoryId)?.content ?? 'controlled developmental claim';
  engine.observeMemory({memoryId,content,tick:snap.state.tick,at:snap.state.at+1,sourceClass:'device',sourceKey:'device',confidence01:.94,contradiction01:0});
  engine.observeMemory({memoryId,content,tick:snap.state.tick,at:snap.state.at+2,sourceClass:'external-api',sourceKey:'oracle',confidence01:.91,contradiction01:0});
  return memoryId;
}

const root=await mkdtemp(join(tmpdir(),'nk171-')); const aFile=join(root,'a.json'); const bFile=join(root,'b.json');
const a=await make(aFile), b=await make(bFile);
const base={worldContext:{location:'lab',facts:['developmental signal stable'],objects:[{id:'signal',label:'signal',location:'lab',value:.8,visible:true,collected:false}],events:['signal']},embodiment:{bodyEnergy01:.92,cognitiveCapacity01:.92,thermalStrain01:.1,sensoryFreshness01:.96,awake:true,battery01:.94,cpuLoad01:.12,ramPressure01:.16}};
for(let i=0;i<4;i++){
  await a.observe({...base,text:'verify and investigate evidence for the stable signal'});
  const mem=await strengthenMemory(a,`a-${i}`);
  await a.feedback({success:.92,reward:.9,surprise:.68,evidenceSource:'oracle'});
  const ass=a.memoryCausalEconomy.assessMemory(mem); assert(ass.independentSources>=3,'A memory lost independent-source evidence'); assert(!a.memoryCausalEconomy.shouldQuarantineMemory(mem),'A memory was incorrectly quarantined');
  await b.observe({...base,text:'verify and investigate evidence for the stable signal'});
  const memB=await strengthenMemory(b,`b-${i}`);
  await b.feedback({success:.18,reward:.1,surprise:.72,evidenceSource:'oracle'});
  const assB=b.memoryCausalEconomy.assessMemory(memB); assert(assB.independentSources>=3,'B memory lost independent-source evidence'); assert(!b.memoryCausalEconomy.shouldQuarantineMemory(memB),'B memory was incorrectly quarantined');
}
const da=a.developmentalCausalSnapshot(), db=b.developmentalCausalSnapshot();
assert(da.values.revisions.length>0,'high-outcome history did not produce a value revision');
assert(db.values.revisions.length>0,'low-outcome history did not produce a value revision');
const valueDivergence = Object.keys(da.values.protectedFloor).reduce((sum,k)=>sum+Math.abs((a.snapshot().facets.memory.adaptiveValues[k]??0)-(b.snapshot().facets.memory.adaptiveValues[k]??0)),0);
assert(valueDivergence>.0005,'A/B outcome histories did not diverge values');
assert(da.identity.samples>0 && db.identity.samples>0,'identity trajectory did not sample');
assert(da.identity.pathDependence01!==db.identity.pathDependence01 || da.identity.developmentalPressure01!==db.identity.developmentalPressure01,'identity trajectory ignored divergent value histories');
assert(da.personality.causalUpdates>0 && db.personality.causalUpdates>0,'personality did not receive causal developmental evidence');
const personalityDivergence = da.personality.strongest?.[0] && db.personality.strongest?.[0] ? Math.abs(da.personality.strongest[0].probability-db.personality.strongest[0].probability) : 0;
assert(personalityDivergence>.0001 || da.personality.trajectorySamples!==db.personality.trajectorySamples,'personality histories did not diverge or leave distinct trajectory evidence');
await a.endTemporalSession('big-pass-171-a',true); await b.endTemporalSession('big-pass-171-b',true);
const ar=await make(aFile), br=await make(bFile); const dar=ar.developmentalCausalSnapshot(), dbr=br.developmentalCausalSnapshot();
assert.equal(dar.values.revisions.length,da.values.revisions.length); assert.equal(dbr.values.revisions.length,db.values.revisions.length); assert.equal(dar.personality.causalUpdates,da.personality.causalUpdates); assert.equal(dbr.personality.causalUpdates,db.personality.causalUpdates);
const quarantine=new MemoryCausalEconomy();
quarantine.observeMemory({memoryId:'knockout',content:'claim: controlled fact',claimKey:'controlled-fact',tick:1,sourceClass:'user',sourceKey:'user',confidence01:.9,contradiction01:.7,at:1});
quarantine.observeMemory({memoryId:'knockout',content:'claim: controlled fact',claimKey:'controlled-fact',tick:2,sourceClass:'device',sourceKey:'device',confidence01:.9,contradiction01:.7,at:2});
assert.equal(quarantine.claim('controlled-fact').status,'quarantined','contradictory evidence was not quarantined');
quarantine.observeMemory({memoryId:'idempotent',content:'same',claimKey:'same',tick:1,sourceClass:'user',sourceKey:'user',confidence01:.8,at:10});
quarantine.observeMemory({memoryId:'idempotent',content:'same',claimKey:'same',tick:1,sourceClass:'user',sourceKey:'user',confidence01:.8,at:11});
assert.equal(quarantine.snapshot().observations.filter(x=>x.memoryId==='idempotent').length,1,'memory evidence was not idempotent across replay');
await ar.endTemporalSession('big-pass-171-restart-a',true); await br.endTemporalSession('big-pass-171-restart-b',true); await rm(root,{recursive:true,force:true});
console.log(JSON.stringify({ok:true, valueRevisionsA:da.values.revisions.length, valueRevisionsB:db.values.revisions.length, valueDivergence, identityPathA:da.identity.pathDependence01, identityPathB:db.identity.pathDependence01, personalityUpdatesA:da.personality.causalUpdates, personalityUpdatesB:db.personality.causalUpdates, personalityDivergence, quarantine:'PASS',idempotency:'PASS',restart:'PASS'}));
