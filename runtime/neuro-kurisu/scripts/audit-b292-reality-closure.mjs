import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const semanticPath=path.join(root,'docs/brain/SEMANTIC_COVERAGE_AUDIT_B291.json');
const d=JSON.parse(fs.readFileSync(semanticPath,'utf8'));
const contracts=Array.isArray(d.contracts)?d.contracts:[];
const bucket={verified:0,safeUnverified:0,unsafe:0,integration:0};
const samples=[];
for(const c of contracts){
  if(c.status==='VERIFIED') bucket.verified++;
  else if(c.status==='UNSAFE_TO_AUTO_RUN') bucket.unsafe++;
  else if(c.status==='INTEGRATION_ONLY') bucket.integration++;
  else if(c.status==='UNVERIFIED' && c.safety!=='external-side-effect') { bucket.safeUnverified++; if(samples.length<64) samples.push({id:c.id,name:c.name,file:c.file,domain:c.domain,paramCount:c.paramCount,criticality:c.criticality}); }
}
const out={pass:true,sourceTotal:d.totalFunctions,sampledSafeUnverified:samples.length,buckets:bucket,policy:'B292 does not promote functions without direct behavioral evidence; it only produces a bounded safe-candidate backlog.',samples,generatedAt:new Date().toISOString()};
fs.writeFileSync(path.join(root,'docs/brain/B292_REALITY_CLOSURE_SAMPLE.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out));
