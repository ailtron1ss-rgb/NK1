import fs from 'node:fs';
import path from 'node:path';

const corePath=path.resolve('src/organism/core/OrganismCore.ts');
const core=fs.readFileSync(corePath,'utf8');
const owners=[
  'SelfSubsystemRuntime','GovernanceSubsystemRuntime','MemorySubsystemRuntime','WorldSubsystemRuntime',
  'EmbodimentSubsystemRuntime','AgencySubsystemRuntime','EvidenceResearchSubsystemRuntime',
];
let failures=[];
for(const owner of owners){
  const directNew=new RegExp(`new\\s+${owner}\\s*\\(`,'g');
  if(directNew.test(core)) failures.push(`core-direct-new:${owner}`);
}
const fabricPath=path.resolve('src/organism/core/OrganismSystemFabric.ts');
const fabric=fs.readFileSync(fabricPath,'utf8');
for(const owner of owners){
  if(!fabric.includes(`new ${owner}()`)) failures.push(`fabric-missing-new:${owner}`);
}
if(!core.includes('private readonly organismSystems = new OrganismSystemFabric()')) failures.push('core-missing-fabric');
if(!core.includes('this.organismSystems.restoreFromPersisted(this.persisted)')) failures.push('core-missing-fabric-restore');
if(core.split('\n').length >= 3482) failures.push('core-not-slimmed');
if(failures.length){ console.error('CORE_PHYSICAL_OWNERSHIP=FAIL',failures.join(',')); process.exit(1); }
console.log(`CORE_PHYSICAL_OWNERSHIP=PASS coreLines=${core.split('\n').length} owners=${owners.length}`);
