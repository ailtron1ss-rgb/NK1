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
const baselinePath=path.resolve('docs/audits/CORE_SLIMMING_BASELINE_R26.json');
const baseline=fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(baselinePath,'utf8')):{coreLines:core.split('\n').length,maxGrowthBeforeRebaseline:128};
const coreLines=core.split('\n').length;
const maxAllowed=Number(baseline.coreLines??coreLines)+Math.max(0,Number(baseline.maxGrowthBeforeRebaseline??128));
if(coreLines>maxAllowed) failures.push(`core-line-regression:${coreLines}>${maxAllowed}`);
if(failures.length){ console.error('CORE_PHYSICAL_OWNERSHIP=FAIL',failures.join(',')); process.exit(1); }
console.log(`CORE_PHYSICAL_OWNERSHIP=PASS coreLines=${coreLines} owners=${owners.length} regressionGuard=${maxAllowed} historicalTarget=${Number(baseline.historicalTargetLines??3482)}`);
