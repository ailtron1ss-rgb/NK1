import fs from 'node:fs';
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
const dynamic=JSON.parse(fs.readFileSync('SEMANTIC_DYNAMIC_EVIDENCE.json','utf8'));
const rows=(semantic.contracts??[]).map(c=>({...c,evidence:[...(c.evidence??[])]}));
for(const c of rows){for(const [k,v] of Object.entries(dynamic)){if(k===c.id||k===`${c.file}:${c.name}`||k.endsWith(`:${c.name}`)&&k.startsWith(`${c.file}:`)) c.evidence.push(...(v.evidence??[]));}}
for(const c of rows){const kinds=new Set(c.evidence.filter(e=>e.ok).map(e=>e.kind));if(c.safety==='destructive'||c.safety==='external-side-effect') c.status='UNSAFE_TO_AUTO_RUN';else if(kinds.has('direct')&&(kinds.has('regression')||kinds.has('integration'))&&(kinds.has('persistence')||kinds.has('replay'))) c.status='VERIFIED';else if(kinds.has('direct')||kinds.has('integration')) c.status='INTEGRATION_ONLY';else c.status='UNVERIFIED';}
const counts={VERIFIED:0,INTEGRATION_ONLY:0,UNSAFE_TO_AUTO_RUN:0,UNVERIFIED:0};for(const c of rows)counts[c.status]++;
const probe=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));
const critical=rows.filter(c=>c.status==='UNVERIFIED'&&['memory','self','world','learning','agency'].includes(c.domain));
const dormant=rows.filter(c=>c.status==='UNVERIFIED'&&Number(c.staticReferences??0)===0);
const out={pass:179,generatedAt:new Date().toISOString(),rule:'VERIFIED requires direct+regression plus persistence/replay evidence; no consciousness claim.',totalFunctions:rows.length,counts,probeSummary:{sourceFiles:probe.sourceFiles,attempted:probe.attempted,passed:probe.passed,failed:probe.failed,inputSynthesisNeeded:probe.inputSynthesisNeeded,lifecycleNeeded:probe.lifecycleNeeded,skipped:probe.skipped},criticalUnverified:critical.length,dormantUnverified:dormant.length,verified:rows.filter(c=>c.status==='VERIFIED').map(c=>c.id)};
fs.writeFileSync('FUNCTION_REALITY_STATUS_179.json',JSON.stringify(out,null,2));
fs.writeFileSync('FUNCTION_REALITY_STATUS_179_RU.md',['# BIG PASS 179 — Реальность функций','','Всего function-like деклараций: **'+rows.length+'**','','| Статус | Количество |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',`Safe parameterized probe: **${probe.passed}/${probe.attempted} PASS**, failures=${probe.failed}.`,`Critical UNVERIFIED: **${critical.length}**`,`UNVERIFIED без статических ссылок: **${dormant.length}**`].join('\n'));
console.log(JSON.stringify(out,null,2));
