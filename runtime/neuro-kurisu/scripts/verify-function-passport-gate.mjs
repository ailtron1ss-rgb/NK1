import fs from 'node:fs';

const file='FUNCTION_PASSPORTS_203.json';
if(!fs.existsSync(file)) throw new Error(`Missing ${file}; run npm run audit:function-passports first`);
const report=JSON.parse(fs.readFileSync(file,'utf8'));
const required=['VERIFIED','INTEGRATION_ONLY','UNSAFE_TO_AUTO_RUN','UNVERIFIED'];
const verdicts=new Set(required);
const safetyClasses=new Set(['safe','stateful','external-side-effect','destructive','unknown']);
const proofTiers=new Set(['static','direct','integration','persistence','replay','regression','device','adversarial']);
const errors=[];
for(const s of required){
  if(!Number.isInteger(report.counts?.[s])) errors.push(`Malformed count for ${s}`);
}
const seen=new Set();
let verified=0;
for(const p of report.passports??[]){
  if(seen.has(p.id)) errors.push(`duplicate id ${p.id}`);
  seen.add(p.id);
  if(!p.id||!p.file||!p.name) errors.push(`missing identity fields: ${p.id||'<unknown>'}`);
  if(!verdicts.has(p.verdict)) errors.push(`invalid verdict ${p.id}: ${p.verdict}`);
  if(!safetyClasses.has(p.safety)) errors.push(`invalid safety ${p.id}: ${p.safety}`);
  if(!Number.isFinite(p.confidence01)||p.confidence01<0||p.confidence01>1) errors.push(`invalid confidence ${p.id}`);
  for(const key of ['preconditions','postconditions','invariants','expectedEffects','forbiddenEffects']){
    if(!Array.isArray(p.contract?.[key])) errors.push(`missing contract.${key}: ${p.id}`);
  }
  if(!Array.isArray(p.proofPlan)) errors.push(`missing proofPlan: ${p.id}`);
  if(!Array.isArray(p.evidence)) errors.push(`missing evidence: ${p.id}`);
  for(const req of p.proofPlan??[]){
    if(!proofTiers.has(req.tier)) errors.push(`invalid proof tier ${p.id}: ${req.tier}`);
    if(typeof req.required!=='boolean') errors.push(`invalid proof required flag ${p.id}: ${req.tier}`);
  }
  for(const e of p.evidence??[]){
    if(e.functionId!==p.id) errors.push(`evidence identity mismatch: ${p.id}`);
    if(!proofTiers.has(e.tier)) errors.push(`invalid evidence tier ${p.id}: ${e.tier}`);
    if(typeof e.ok!=='boolean') errors.push(`invalid evidence ok flag ${p.id}`);
  }
  const good=new Set((p.evidence??[]).filter(e=>e.ok).map(e=>e.tier));
  const missing=(p.proofPlan??[]).filter(x=>x.required&&!good.has(x.tier));
  const expectedBlockers=missing.map(x=>`${x.tier}: ${x.rationale}`);
  if(JSON.stringify(expectedBlockers)!==JSON.stringify(p.blockers??[])) errors.push(`blocker mismatch: ${p.id}`);
  if(p.verdict==='VERIFIED'){
    verified++;
    if(missing.length) errors.push(`VERIFIED without required proof: ${p.id}`);
  }
  if((p.safety==='destructive'||p.safety==='external-side-effect') && p.verdict!=='UNSAFE_TO_AUTO_RUN')
    errors.push(`unsafe function not blocked: ${p.id}`);
  if(p.verdict==='UNSAFE_TO_AUTO_RUN' && p.confidence01!==0)
    errors.push(`unsafe function has non-zero confidence: ${p.id}`);
}
if(report.totalFunctions!==report.passports.length) errors.push(`totalFunctions mismatch: declared=${report.totalFunctions} actual=${report.passports.length}`);
if(verified!==report.counts.VERIFIED) errors.push('verified count mismatch');
const actualCounts=Object.fromEntries(required.map(s=>[s,report.passports.filter(p=>p.verdict===s).length]));
for(const s of required) if(actualCounts[s]!==report.counts[s]) errors.push(`count mismatch ${s}: declared=${report.counts[s]} actual=${actualCounts[s]}`);
if(errors.length){
  console.error(JSON.stringify({pass:203,gate:'FAIL',errors:errors.slice(0,100),errorCount:errors.length},null,2));
  process.exit(1);
}
console.log(JSON.stringify({pass:203,gate:'PASS',totalFunctions:report.totalFunctions,counts:report.counts,verifiedIntegrity:true,schemaIntegrity:true},null,2));
