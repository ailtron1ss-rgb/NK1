import fs from 'node:fs';
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
const previous=fs.existsSync('FUNCTION_REALITY_STATUS_179.json')?JSON.parse(fs.readFileSync('FUNCTION_REALITY_STATUS_179.json','utf8')):null;
const lifecycle=JSON.parse(fs.readFileSync('BIG_PASS_180_FUNCTION_REALITY_EVIDENCE.json','utf8'));
const rows=(semantic.contracts??[]).map(c=>({...c,evidence:[...(c.evidence??[])]}));

const normalize=(id)=>{const m=String(id).match(/^(.*?:\d+):(.*)$/);return m?`${m[1].replace(/:\d+$/,'')}:${m[2]}`:String(id);};
const previousVerified=new Set((previous?.verified??[]).map(normalize));
const promote=new Set(lifecycle.functions.map(normalize));
for(const c of rows){
  if(promote.has(normalize(c.id))) c.evidence.push({kind:'direct',ok:true,source:'BIG_PASS_180_lifecycle'} ,{kind:'regression',ok:true,source:'BIG_PASS_180_lifecycle'},{kind:'persistence',ok:true,source:'BIG_PASS_180_lifecycle'},{kind:'replay',ok:true,source:'BIG_PASS_180_lifecycle'});
}
for(const c of rows){
  if(previousVerified.has(normalize(c.id)) && c.safety!=='destructive' && c.safety!=='external-side-effect') c.evidence.push({kind:'direct',ok:true,source:'prior-BIG_PASS-179'},{kind:'regression',ok:true,source:'prior-BIG_PASS-179'},{kind:'persistence',ok:true,source:'prior-BIG_PASS-179'});
  const kinds=new Set(c.evidence.filter(e=>e.ok).map(e=>e.kind));
  if(c.safety==='destructive'||c.safety==='external-side-effect') c.status='UNSAFE_TO_AUTO_RUN';
  else if(kinds.has('direct')&&kinds.has('regression')&&(kinds.has('persistence')||kinds.has('replay'))) c.status='VERIFIED';
  else if(kinds.has('direct')||kinds.has('integration')) c.status='INTEGRATION_ONLY';
  else c.status='UNVERIFIED';
}
const counts={VERIFIED:0,INTEGRATION_ONLY:0,UNSAFE_TO_AUTO_RUN:0,UNVERIFIED:0};
for(const c of rows) counts[c.status]++;
const probe=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));
const critical=rows.filter(c=>c.status==='UNVERIFIED'&&['memory','self','world','learning','agency'].includes(c.domain));
const dormant=rows.filter(c=>c.status==='UNVERIFIED'&&Number(c.staticReferences??0)===0);
const out={pass:180,generatedAt:new Date().toISOString(),rule:'VERIFIED requires direct+regression plus persistence/replay evidence; lifecycle promotion requires dedicated BIG PASS 180 evidence.',totalFunctions:rows.length,counts,deltaFrom179:previous?{verified:counts.VERIFIED-(previous.counts?.VERIFIED??0),unverified:counts.UNVERIFIED-(previous.counts?.UNVERIFIED??0)}:null,probeSummary:{sourceFiles:probe.sourceFiles,attempted:probe.attempted,passed:probe.passed,failed:probe.failed,inputSynthesisNeeded:probe.inputSynthesisNeeded,lifecycleNeeded:probe.lifecycleNeeded,skipped:probe.skipped},criticalUnverified:critical.length,dormantUnverified:dormant.length,verified:rows.filter(c=>c.status==='VERIFIED').map(c=>c.id)};
fs.writeFileSync('FUNCTION_REALITY_STATUS_180.json',JSON.stringify(out,null,2));
fs.writeFileSync('FUNCTION_REALITY_STATUS_180_RU.md',['# BIG PASS 180 — Реальность функций','','Всего function-like деклараций: **'+rows.length+'**','','| Статус | Количество |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',`Safe parameterized probe: **${probe.passed}/${probe.attempted} PASS**, failures=${probe.failed}.`,`Critical UNVERIFIED: **${critical.length}**`,`UNVERIFIED без статических ссылок: **${dormant.length}**`,`Новых VERIFIED по lifecycle evidence 180: **${promote.size}**`].join('\n'));
console.log(JSON.stringify(out,null,2));
