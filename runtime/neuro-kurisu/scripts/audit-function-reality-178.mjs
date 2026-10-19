import fs from 'node:fs';
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
let lifecycle={}; try{lifecycle=JSON.parse(fs.readFileSync('BIG_PASS_178_LIFECYCLE_EVIDENCE.json','utf8'));}catch{}
const rows=(semantic.contracts??[]).map(c=>({...c,evidence:[...(c.evidence??[])]}));
for(const c of rows){ const extra=lifecycle[c.id]; if(extra)c.evidence.push(...(extra.evidence??[])); }
const kinds=c=>new Set(c.evidence.filter(e=>e.ok).map(e=>e.kind));
for(const c of rows){const k=kinds(c);if(c.status!=='UNSAFE_TO_AUTO_RUN'&&k.has('direct')&&k.has('regression')&&k.has('persistence'))c.status='VERIFIED';}
const counts={VERIFIED:0,INTEGRATION_ONLY:0,UNSAFE_TO_AUTO_RUN:0,UNVERIFIED:0}; for(const c of rows)counts[c.status]++;
const critical=rows.filter(c=>c.status==='UNVERIFIED'&&['memory','self','world','learning','agency'].includes(c.domain)).sort((a,b)=>(b.criticality??0)-(a.criticality??0));
const dormant=rows.filter(c=>c.status==='UNVERIFIED'&&Number(c.staticReferences??0)===0);
let probe={};try{probe=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));}catch{}
const result={
  pass:178,
  generatedAt:new Date().toISOString(),
  rule:'VERIFIED requires direct+regression+persistence evidence; adversarial/research-only does not imply consciousness.',
  totalFunctions:rows.length,
  counts,
  probeSummary:{
    sourceFiles:probe.sourceFiles??0,
    attempted:probe.attempted??0,
    passed:probe.passed??0,
    failed:probe.failed??0,
    inputSynthesisNeeded:probe.inputSynthesisNeeded??0,
    lifecycleNeeded:probe.lifecycleNeeded??0,
    skipped:probe.skipped??0,
  },
  criticalUnverified:critical.slice(0,700).map(c=>({
    id:c.id,domain:c.domain,file:c.file,name:c.name,line:c.line,
    criticality:c.criticality,references:c.staticReferences,testReferences:c.testReferences,
  })),
  dormantUnverified:dormant.slice(0,500).map(c=>({
    id:c.id,domain:c.domain,file:c.file,name:c.name,line:c.line,
    criticality:c.criticality,references:c.staticReferences,testReferences:c.testReferences,
  })),
};
fs.writeFileSync('FUNCTION_REALITY_STATUS_178.json',JSON.stringify(result,null,2));
fs.writeFileSync('FUNCTION_REALITY_STATUS_178_RU.md',['# BIG PASS 178 — Реальный статус функций','',`Всего function-like деклараций: **${rows.length}**`,'','| Статус | Количество |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',`Safe parameterized probe: **${result.probeSummary.passed}/${result.probeSummary.attempted} PASS**, failures=${result.probeSummary.failed}.`,'',`Критический backlog (memory/self/world/learning/agency): **${critical.length}**.`,`UNVERIFIED без статических ссылок: **${dormant.length}**.`].join('\n'));
console.log(JSON.stringify({pass:178,totalFunctions:rows.length,counts,probe:result.probeSummary,criticalUnverified:critical.length,dormantUnverified:dormant.length},null,2));
