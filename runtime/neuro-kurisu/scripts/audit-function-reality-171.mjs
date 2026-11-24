import fs from 'node:fs';
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
let live={}; try{live=JSON.parse(fs.readFileSync('FUNCTION_LIVENESS_AUDIT.json','utf8'));}catch{}
let probe={}; try{probe=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));}catch{}
let zero={}; try{zero=JSON.parse(fs.readFileSync('SEMANTIC_ZERO_ARG_EVIDENCE.json','utf8'));}catch{}
const probeMap=new Map((probe.outcomes??[]).filter(x=>x.status==='PASS').map(x=>[`${x.file}:${x.line??''}:${x.name??x.export}`,x]));
const zeroMap=zero||{};
const rows=(semantic.contracts??[]).map(c=>{
  const liveRefs=Number(c.staticReferences??0), testRefs=Number(c.testReferences??0);
  const direct=(c.evidence??[]).some(e=>e.kind==='direct'&&e.ok);
  const regression=(c.evidence??[]).some(e=>e.kind==='regression'&&e.ok);
  const persistence=(c.evidence??[]).some(e=>e.kind==='persistence'&&e.ok);
  const replay=(c.evidence??[]).some(e=>e.kind==='replay'&&e.ok);
  const reasons=[];
  if(c.status==='UNSAFE_TO_AUTO_RUN') reasons.push('unsafe-auto-run');
  if(liveRefs===0) reasons.push('zero-source-reference');
  if(liveRefs===0 && testRefs===0) reasons.push('no-observed-call-site');
  if(direct) reasons.push('direct-proof');
  if(regression) reasons.push('regression-proof');
  if(persistence) reasons.push('persistence-proof');
  if(replay) reasons.push('replay-proof');
  const proofLevel=c.status==='VERIFIED'?'VERIFIED':c.status==='INTEGRATION_ONLY'?'INTEGRATION_ONLY':c.status==='UNSAFE_TO_AUTO_RUN'?'UNSAFE_TO_AUTO_RUN':'UNVERIFIED';
  return {...c,proofLevel,references:liveRefs,testReferences:testRefs,reasons};
});
const counts={VERIFIED:0,INTEGRATION_ONLY:0,UNSAFE_TO_AUTO_RUN:0,UNVERIFIED:0}; for(const r of rows) counts[r.proofLevel]++;
const dormant=rows.filter(r=>r.references===0&&r.proofLevel==='UNVERIFIED').sort((a,b)=>b.criticality-a.criticality||a.file.localeCompare(b.file));
const critical=rows.filter(r=>r.proofLevel==='UNVERIFIED'&&['memory','self','world','learning'].includes(r.domain)).sort((a,b)=>b.criticality-a.criticality||a.references-b.references);
const result={
  pass:171,
  generatedAt:new Date().toISOString(),
  rule:'A function is not counted as implemented merely because its declaration exists or a test name mentions it. VERIFIED requires direct+regression plus persistence/replay evidence; destructive/external functions remain unsafe unless explicitly certified.',
  totalFunctions:rows.length,
  counts,
  probeSummary:{sourceFiles:probe.sourceFiles??0,attempted:probe.attempted??0,passed:probe.passed??0,failed:probe.failed??0,inputSynthesisNeeded:probe.inputSynthesisNeeded??0,lifecycleNeeded:probe.lifecycleNeeded??0,skipped:probe.skipped??0},
  dormantUnverified:dormant.slice(0,400).map(r=>({id:r.id,domain:r.domain,file:r.file,name:r.name,line:r.line,criticality:r.criticality,references:r.references,testReferences:r.testReferences})),
  criticalUnverified:critical.slice(0,600).map(r=>({id:r.id,domain:r.domain,file:r.file,name:r.name,line:r.line,criticality:r.criticality,references:r.references,testReferences:r.testReferences})),
};
fs.writeFileSync('FUNCTION_REALITY_STATUS_171.json',JSON.stringify(result,null,2));
fs.writeFileSync('FUNCTION_REALITY_STATUS_171_RU.md',[
'# BIG PASS 171 — Реальный статус функций','',`Всего function-like деклараций: **${rows.length}**`,'',
'| Статус | Количество |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',
`Safe parameterized probe: **${result.probeSummary.passed}/${result.probeSummary.attempted} PASS**, failures=${result.probeSummary.failed}.`,'',
'> UNVERIFIED не превращается в PASS из-за наличия кода. UNSAFE_TO_AUTO_RUN также не считается рабочим доказанно без специальной сертификации.','',
`Критический backlog (memory/self/world/learning): **${critical.length}**.`,'',
`UNVERIFIED без статических ссылок: **${dormant.length}**.`,`Из них в первые 400 входят наиболее критичные кандидаты.`,''].join('\n'));
console.log(JSON.stringify({pass:171,totalFunctions:rows.length,counts,probe:result.probeSummary,dormantUnverified:dormant.length,criticalUnverified:critical.length},null,2));
