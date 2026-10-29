import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto';
import { ts } from './lib/resolve-typescript.mjs';
const root=process.cwd(), ignored=new Set(['node_modules','legacy-original','.git','state','history']), files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.(ts|tsx|mjs)$/.test(ent.name))files.push(p);}}
walk(path.join(root,'src')); for(const r of ['tests','research','scripts'])if(fs.existsSync(path.join(root,r)))walk(path.join(root,r));
const srcFiles=files.filter(f=>f.includes(`${path.sep}src${path.sep}`)),testFiles=files.filter(f=>f.includes(`${path.sep}tests${path.sep}`));
const texts=new Map(files.map(f=>[f,fs.readFileSync(f,'utf8')])),decls=[];
function visitFile(file){const text=texts.get(file),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function v(n){
  if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isConstructorDeclaration(n)){
    if(n.name?.getText(sf)||ts.isConstructorDeclaration(n)){const name=n.name?.getText(sf)??'constructor',lc=sf.getLineAndCharacterOfPosition(n.getStart(sf));decls.push({file,name,line:lc.line+1,kind:ts.isMethodDeclaration(n)?'method':ts.isFunctionDeclaration(n)?'function':ts.isConstructorDeclaration(n)?'constructor':'accessor',paramCount:n.parameters?.length??0,exported:Boolean(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)),start:n.getStart(sf),end:n.getEnd(),body:Boolean(n.body)});}}
  ts.forEachChild(n,v);} ts.forEachChild(sf,v);}
for(const f of srcFiles)visitFile(f);
const contracts=[];
// BIG PASS 170 performance/indexed semantic audit: build one identifier-frequency index per file.
// The previous implementation rescanned every source/test file for every
// declaration (O(functions × files)). This keeps the same conservative
// evidence semantics while making the audit roughly O(total source size + declarations).
const identifiersByFile=new Map();
const identifierIndex= text => { const m=new Map(); const rx=/\b[A-Za-z_$][\w$]*\b/g; let x; while((x=rx.exec(text))) m.set(x[0],(m.get(x[0])??0)+1); return m; };
for(const f of srcFiles) identifiersByFile.set(f, identifierIndex(texts.get(f)||''));
const identifiersByTestFile=new Map(); for(const f of testFiles) identifiersByTestFile.set(f, identifierIndex(texts.get(f)||''));
const tokenCount=(index,name)=>index?.get(name)??0;
for(const d of decls){
  let refs=0,testRefs=0;
  for(const f of srcFiles) refs+=tokenCount(identifiersByFile.get(f),d.name);
  // Remove every token occurrence inside this declaration's own source range.
  const ownText=(texts.get(d.file)||'').slice(d.start,d.end);
  const ownCount=tokenCount(identifierIndex(ownText),d.name);
  refs=Math.max(0,refs-ownCount);
  for(const f of testFiles) testRefs+=tokenCount(identifiersByTestFile.get(f),d.name);
  const name=d.name.toLowerCase(), rel=path.relative(root,d.file), bodyText=(texts.get(d.file)||'').slice(Math.max(0,d.start-200),Math.min((texts.get(d.file)||'').length,d.end+200)).toLowerCase();
  let safety='unknown';
  if(/delete|destroy|purge|wipe|terminate|shutdown|resetall|rollbacklearning|restorebestpolicygene/.test(name))safety='destructive';
  else if(/fetch\(|http|https|network|camera|microphone|sensor|socket|spawn\(|exec\(|writefile|appendfile|unlink|rename|mkdir|rmdir/.test(name+' '+bodyText))safety='external-side-effect';
  else if(/save|persist|checkpoint|flush|restore|rollback|apply|mutate|update|set|record|ingest|append|observe|tick|integrate|learn|train|promote|consolidate/.test(name))safety='stateful';
  const expected=[];
  if(/snapshot|summary|manifest|status|health|metrics|graph/.test(name))expected.push('returns coherent observable state');
  if(/observe|ingest|tick|integrate|update|learn|record|append/.test(name))expected.push('changes intended state and affects later behaviour');
  if(/save|persist|checkpoint|flush/.test(name))expected.push('survives restart/readback');
  if(!expected.length)expected.push('executes without invariant violation');
  contracts.push({id:`${rel}:${d.line}:${d.name}`,file:rel,name:d.name,kind:d.kind,line:d.line,paramCount:d.paramCount,exported:d.exported,safety,contract:`${d.name} requires observable evidence; static presence is insufficient.`,expectedEffects:expected,evidence:[{kind:'static',ok:true,at:Date.now(),source:'BIG_PASS_176_static',details:`refs=${refs}; testRefs=${testRefs}`}],status:'UNVERIFIED',staticReferences:refs,testReferences:testRefs});
}
let dynamic={}; try{dynamic=JSON.parse(fs.readFileSync('SEMANTIC_DYNAMIC_EVIDENCE.json','utf8'));}catch{}
let zeroArg={}; try{zeroArg=JSON.parse(fs.readFileSync('SEMANTIC_ZERO_ARG_EVIDENCE.json','utf8'));}catch{}
let explicit={}; try{explicit=JSON.parse(fs.readFileSync('SEMANTIC_EXPLICIT_EVIDENCE.json','utf8'));}catch{}
const indexEvidence=(bucket)=>{const out=new Map();for(const [k,v] of Object.entries(bucket)){out.set(k,v);const marker=':explicit:';const mi=k.indexOf(marker);if(mi>=0){out.set(`${k.slice(0,mi)}:${k.slice(mi+marker.length)}`,v);continue;}const last=k.lastIndexOf(':');const prev=k.lastIndexOf(':',last-1);if(prev>0){out.set(`${k.slice(0,prev)}${k.slice(prev,last)}${k.slice(last)}`,v);}}return out;};
const dynamicIndex=indexEvidence(dynamic); const zeroIndex=indexEvidence(zeroArg); const explicitIndex=indexEvidence(explicit);
const shaCache=new Map(); const sha256=file=>{ if(shaCache.has(file)) return shaCache.get(file); try{const h=createHash('sha256').update(fs.readFileSync(file)).digest('hex');shaCache.set(file,h);return h;}catch{return null} };
const attach=(c,index)=>{const direct=index.get(c.id)||index.get(`${c.file}:${c.name}`);if(direct)c.evidence.push(...(direct.evidence||[]));};
for(const c of contracts){
  attach(c,dynamicIndex); attach(c,zeroIndex);
  const d=explicitIndex.get(c.id)||explicitIndex.get(`${c.file}:${c.name}`);
  if(d){
    const sourceHash=d?.evidence?.[0]?.sourceHash;
    const testHash=d?.evidence?.[0]?.testHash;
    const sourceFile=path.join(root,c.file);
    const sourceOk=sourceHash && sha256(sourceFile)===sourceHash;
    const testFile=path.join(root,'tests/b504-continuous-cognitive-fabric.mjs');
    const testOk=!testHash || (fs.existsSync(testFile) && sha256(testFile)===testHash);
    if(sourceOk && testOk) c.evidence.push(...(d?.evidence||[]));
  }
  const safeEvidence=c.evidence.filter(e=>e.ok);
  const kinds=new Set(safeEvidence.map(e=>e.kind));
  if(c.safety==='destructive'||c.safety==='external-side-effect') c.status='UNSAFE_TO_AUTO_RUN';
  else if(kinds.has('direct')&&(kinds.has('regression')||kinds.has('integration'))&&(kinds.has('persistence')||kinds.has('replay'))) c.status='VERIFIED';
  else if(kinds.has('direct')||kinds.has('integration')) c.status='INTEGRATION_ONLY';
  else c.status='UNVERIFIED';
}
const counts={VERIFIED:0,INTEGRATION_ONLY:0,UNSAFE_TO_AUTO_RUN:0,UNVERIFIED:0};for(const c of contracts)counts[c.status]++;
const verifiedRate=contracts.length?Number((counts.VERIFIED/contracts.length).toFixed(4)):0;
const evidenceCoverage=contracts.length?Number(((counts.VERIFIED+counts.INTEGRATION_ONLY*.25)/contracts.length).toFixed(4)):0;
const domainOf = (file,name) => { const x=(file+' '+name).toLowerCase(); if(/memory|retention|reconsolid|recall/.test(x)) return 'memory'; if(/emotion|feeling|affect|interocept/.test(x)) return 'emotion'; if(/world|causal|prediction|counterfactual/.test(x)) return 'world'; if(/identity|self|personhood|personality|value/.test(x)) return 'self'; if(/agency|goal|plan|project|action/.test(x)) return 'agency'; if(/learn|skill|plastic|curriculum|training/.test(x)) return 'learning'; if(/perception|sensor|camera|audio|vision|embod/.test(x)) return 'perception'; if(/conscious|workspace|awareness|metacog/.test(x)) return 'consciousness'; return 'infrastructure'; }; for(const c of contracts) c.domain=domainOf(c.file,c.name);
for(const c of contracts) c.criticality = c.domain==='memory'||c.domain==='self'||c.domain==='world'||c.domain==='learning'?0.9:c.domain==='emotion'||c.domain==='agency'||c.domain==='consciousness'?0.8:c.domain==='perception'?0.75:0.5;
const report={pass:190,generatedAt:new Date().toISOString(),sourceFiles:srcFiles.length,totalFunctions:contracts.length,byStatus:counts,verifiedRate01:verifiedRate,evidenceCoverage01:evidenceCoverage,contracts};
fs.writeFileSync('SEMANTIC_COVERAGE_AUDIT.json',JSON.stringify(report,null,2));
const brain=contracts.filter(c=>['/cognition/','/memory/','/learning/','/developmental/','/body/','/core/'].some(x=>c.file.includes(x))||/(consciousness|memory|learning|agency|world|self|emotion|motivation|perception|attention|goal)/i.test(c.name));
const priorityUnverified = contracts
  .filter(c=>c.status==='UNVERIFIED'&&c.safety==='stateful')
  .sort((a,b)=>(b.criticality-a.criticality)||(a.staticReferences-b.staticReferences)||(b.testReferences-a.testReferences))
  .slice(0,220)
  .map(c=>`- ${c.id} (refs=${c.staticReferences}, tests=${c.testReferences})`);
const excluded = contracts.filter(c=>c.status==='UNSAFE_TO_AUTO_RUN').slice(0,200).map(c=>`- ${c.id}`);
const domainBacklog = Object.fromEntries(['memory','emotion','world','self','agency','learning','perception','consciousness','infrastructure'].map(d=>[d,{unverified:contracts.filter(c=>c.domain===d&&c.status==='UNVERIFIED').length,integration:contracts.filter(c=>c.domain===d&&c.status==='INTEGRATION_ONLY').length,verified:contracts.filter(c=>c.domain===d&&c.status==='VERIFIED').length}]));
report.domainBacklog=domainBacklog;
fs.writeFileSync('SEMANTIC_VERIFICATION_BACKLOG_190.json',JSON.stringify({generatedAt:report.generatedAt,pass:190,totalFunctions:report.totalFunctions,domains:domainBacklog,priority:priorityUnverified,unsafe:excluded},null,2));
const md=[
  '# BIG PASS 190 — Semantic Coverage Audit','',
  `Functions: **${report.totalFunctions}**`,'',
  '| Status | Count |','|---|---:|',
  ...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',
  `Strict VERIFIED rate: **${(verifiedRate*100).toFixed(2)}%**`,'',
  `Evidence coverage (VERIFIED + 25% integration credit): **${(evidenceCoverage*100).toFixed(2)}%**`,'',
  '> Static presence and a test name reference do not count as behavioural proof.','',
  '## Cognitive branch','',
  `Functions: **${brain.length}**`,'',
  '| Status | Count |','|---|---:|',
  ...Object.keys(counts).map(k=>`| ${k} | ${brain.filter(c=>c.status===k).length} |`),'',
  '## Critical domain backlog','',
  '| Domain | Unverified | Integration | Verified |','|---|---:|---:|---:|',
  ...['memory','emotion','world','self','agency','learning','perception','consciousness','infrastructure'].map(d=>`| ${d} | ${contracts.filter(c=>c.domain===d&&c.status==='UNVERIFIED').length} | ${contracts.filter(c=>c.domain===d&&c.status==='INTEGRATION_ONLY').length} | ${contracts.filter(c=>c.domain===d&&c.status==='VERIFIED').length} |`),'',
  '## Automatic execution exclusions','',...excluded,'',
  '## Priority UNVERIFIED stateful functions','',...priorityUnverified
].join('\n');
fs.writeFileSync('SEMANTIC_COVERAGE_AUDIT_RU.md',md);
console.log(JSON.stringify({pass:190,sourceFiles:srcFiles.length,totalFunctions:contracts.length,byStatus:counts,verifiedRate01:verifiedRate,evidenceCoverage01:evidenceCoverage},null,2));
