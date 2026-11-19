import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ts } from './lib/resolve-typescript.mjs';
const root=process.cwd();
const ignored=new Set(['node_modules','legacy-original','.git','state','history']);
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/\.ts$/.test(ent.name))files.push(p);}}
walk(path.join(root,'src'));
const tests=[]; function walkTests(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walkTests(p);else if(/\.(mjs|ts)$/.test(ent.name))tests.push(p);}}
if(fs.existsSync(path.join(root,'tests')))walkTests(path.join(root,'tests'));
const texts=new Map(files.map(f=>[f,fs.readFileSync(f,'utf8')]));
const testTexts=tests.map(f=>[f,fs.readFileSync(f,'utf8')]);
const decls=[];
function visit(file){
  const text=texts.get(file); const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function v(n){
    if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isGetAccessor(n)||ts.isSetAccessor(n)||ts.isConstructorDeclaration(n)){
      const name=n.name?.getText(sf)??'constructor'; const lc=sf.getLineAndCharacterOfPosition(n.getStart(sf));
      decls.push({file,name,line:lc.line+1,kind:ts.isMethodDeclaration(n)?'method':ts.isFunctionDeclaration(n)?'function':ts.isConstructorDeclaration(n)?'constructor':'accessor',paramCount:n.parameters?.length??0,exported:Boolean(n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)),start:n.getStart(sf),end:n.getEnd()});
    }
    ts.forEachChild(n,v);
  }
  ts.forEachChild(sf,v);
}
for(const f of files)visit(f);
let dynamic={}; try{dynamic=JSON.parse(fs.readFileSync('SEMANTIC_DYNAMIC_EVIDENCE.json','utf8'));}catch{}
let zero={}; try{zero=JSON.parse(fs.readFileSync('SEMANTIC_ZERO_ARG_EVIDENCE.json','utf8'));}catch{}
const legacyMap=new Map();
for(const source of [dynamic,zero]) for(const [id,obj] of Object.entries(source)){legacyMap.set(id,obj);}
const tokenRx=/\b[A-Za-z_$][\w$]*\b/g;
const tokenCount=text=>{const m=new Map();for(const x of text.matchAll(tokenRx))m.set(x[0],(m.get(x[0])??0)+1);return m;};
const srcIndexes=new Map(files.map(f=>[f,tokenCount(texts.get(f))]));
const testIndexes=new Map(testTexts.map(([f,t])=>[f,tokenCount(t)]));
const globalSourceIndex=tokenCount([...texts.values()].join('\n'));
const globalTestIndex=tokenCount(testTexts.map(([,t])=>t).join('\n'));
function domainOf(file,name){const x=(file+' '+name).toLowerCase(); if(/embod|device|camera|microphone|sensor|vision|audio/.test(x))return 'perception'; if(/memory|retention|reconsolid|recall|hippocamp/.test(x))return 'memory'; if(/emotion|feeling|affect|interocept/.test(x))return 'emotion'; if(/world|causal|prediction|counterfactual/.test(x))return 'world'; if(/identity|self|personhood|personality|value|authorship/.test(x))return 'self'; if(/agency|goal|plan|project|action/.test(x))return 'agency'; if(/learn|skill|plastic|curriculum|training|development/.test(x))return 'learning'; if(/conscious|workspace|awareness|metacog/.test(x))return 'consciousness'; return 'infrastructure';}
function safetyOf(name,body){const x=(name+' '+body).toLowerCase(); if(/delete|destroy|purge|wipe|terminate|shutdown|resetall|rollbacklearning|restorebestpolicygene/.test(name.toLowerCase()))return 'destructive'; if(/fetch\(|http|https|network|camera|microphone|sensor|socket|spawn\(|exec\(|writefile|appendfile|unlink|rename|mkdir|rmdir/.test(x))return 'external-side-effect'; if(/save|persist|checkpoint|flush|restore|rollback|apply|mutate|update|set\b|record|ingest|append|observe|tick|integrate|learn|train|promote|consolidate/.test(name.toLowerCase()))return 'stateful'; return 'safe';}
function contractOf(name,body){
  const n=name.toLowerCase();
  const b=body.toLowerCase();
  const post=[];
  const effects=[];
  const pre=[];
  const invariants=['must not violate declared subsystem invariants'];
  if(/snapshot|summary|status|health|metrics|diagnostic|inspect|manifest|graph/.test(n))
    post.push('returns a coherent observable representation of current subsystem state');
  if(/observe|ingest|tick|integrate|update|learn|record|append|promote|consolidate/.test(n)){
    post.push('changes only the intended owned state');
    effects.push('subsequent reads expose the intended state transition');
  }
  if(/save|persist|checkpoint|flush/.test(n)){
    post.push('committed state survives the documented restart/readback boundary');
    effects.push('persistence evidence exists at the project state boundary');
  }
  if(/restore|replay|rollback/.test(n)){
    post.push('result is reproducible from the documented source state/events');
    effects.push('replay/rollback semantics remain internally consistent');
  }
  if(/predict|score|evaluate|assess|explain|classif|select/.test(n))
    post.push('output satisfies documented shape and is numerically bounded where applicable');
  if(/camera|microphone|sensor|device|android/.test(b))
    pre.push('device provenance is available or the call is explicitly marked simulated');
  if(post.length===0) post.push('executes without throwing and preserves declared invariants');
  if(effects.length===0) effects.push('no undeclared externally visible side effect');
  return {
    preconditions:pre,
    postconditions:post,
    invariants,
    expectedEffects:effects,
    forbiddenEffects:[
      'no silent state corruption',
      'no provenance escalation from host/synthetic evidence to device evidence'
    ]
  };
}
function proofPlan(safety,contract,domain){
  const req=[
    {tier:'direct',required:true,rationale:'Exact function invocation must pass meaningful postcondition checks.'},
    {tier:'regression',required:true,rationale:'Observed behaviour must have a repeatable regression guard.'}
  ];
  if(safety==='stateful')
    req.push({tier:'persistence',required:true,rationale:'Stateful function needs restart/readback evidence.'});
  if(/replay|rollback|reproducible|event/i.test(contract.expectedEffects.join(' ')))
    req.push({tier:'replay',required:true,rationale:'Transition semantics require reproducibility evidence.'});
  if(domain==='perception')
    req.push({tier:'device',required:true,rationale:'Sensor/embodiment claims need physical-device provenance.'});
  if(domain==='self'||domain==='consciousness')
    req.push({tier:'adversarial',required:true,rationale:'High-level self/consciousness claims need intervention evidence.'});
  return req;
}
function evidenceFor(id){const obj=legacyMap.get(id);return (obj?.evidence??[]).map(e=>({...e,functionId:id,tier:e.tier??e.kind}));}
function verdict(safety,plan,evidence){if(safety==='destructive'||safety==='external-side-effect')return 'UNSAFE_TO_AUTO_RUN'; const good=new Set(evidence.filter(e=>e.ok).map(e=>e.tier)); if(plan.every(p=>!p.required||good.has(p.tier)))return 'VERIFIED'; if(good.has('direct')||good.has('integration'))return 'INTEGRATION_ONLY'; return 'UNVERIFIED';}
function confidence(safety,plan,evidence,criticality){if(safety==='destructive'||safety==='external-side-effect')return 0; const required=plan.filter(p=>p.required);const score=required.length?required.filter(p=>evidence.some(e=>e.ok&&e.tier===p.tier)).length/required.length:0;return Math.max(0,Math.min(1,score*(.85+.15*criticality)));}
const criticality={memory:.95,self:.95,world:.92,learning:.9,agency:.88,consciousness:.98,perception:.85,emotion:.82,infrastructure:.55};
const passports=[];
for(const d of decls){
  const rel=path.relative(root,d.file).replaceAll(path.sep,'/');
  const text=texts.get(d.file);
  const body=text.slice(d.start,Math.min(text.length,d.end));
  let refs=globalSourceIndex.get(d.name)??0;
  refs=Math.max(0,refs-(tokenCount(body).get(d.name)??0));
  const testRefs=globalTestIndex.get(d.name)??0;
  const domain=domainOf(rel,d.name);
  const safety=safetyOf(d.name,body);
  const contract=contractOf(d.name,body);
  const id=`${rel}:${d.line}:${d.name}`;
  const evidence=evidenceFor(id);
  const plan=proofPlan(safety,contract,domain);
  const c=criticality[domain];
  const v=verdict(safety,plan,evidence);
  const good=new Set(evidence.filter(e=>e.ok).map(e=>e.tier));
  const blockers=plan
    .filter(p=>p.required&&!good.has(p.tier))
    .map(p=>`${p.tier}: ${p.rationale}`);
  passports.push({
    schemaVersion:1,id,file:rel,line:d.line,name:d.name,kind:d.kind,domain,
    criticality:c,exported:d.exported,paramCount:d.paramCount,safety,contract,
    proofPlan:plan,evidence,verdict:v,
    confidence01:confidence(safety,plan,evidence,c),blockers,
    staticReferences:refs,testReferences:testRefs
  });
}
const counts=Object.fromEntries(['VERIFIED','INTEGRATION_ONLY','UNSAFE_TO_AUTO_RUN','UNVERIFIED'].map(s=>[s,passports.filter(p=>p.verdict===s).length]));
const domainStats=Object.fromEntries([...new Set(passports.map(p=>p.domain))].map(d=>[d,{total:passports.filter(p=>p.domain===d).length,verified:passports.filter(p=>p.domain===d&&p.verdict==='VERIFIED').length,integrationOnly:passports.filter(p=>p.domain===d&&p.verdict==='INTEGRATION_ONLY').length,unverified:passports.filter(p=>p.domain===d&&p.verdict==='UNVERIFIED').length,unsafe:passports.filter(p=>p.domain===d&&p.verdict==='UNSAFE_TO_AUTO_RUN').length,confidence01:Number((passports.filter(p=>p.domain===d).reduce((a,p)=>a+p.confidence01,0)/Math.max(1,passports.filter(p=>p.domain===d).length)).toFixed(4))}]));
const actionable=passports.filter(p=>p.verdict==='UNVERIFIED'&&p.safety==='safe').sort((a,b)=>(b.criticality-a.criticality)||(b.testReferences-a.testReferences)||(a.staticReferences-b.staticReferences)).slice(0,300);
const result={schemaVersion:1,pass:203,generatedAt:new Date().toISOString(),sourceFiles:files.length,totalFunctions:passports.length,counts,strictVerifiedRate01:passports.length?counts.VERIFIED/passports.length:0,domainStats,passports};
fs.writeFileSync('FUNCTION_PASSPORTS_203.json',JSON.stringify(result,null,2));
fs.writeFileSync('FUNCTION_PASSPORTS_PRIORITY_203.json',JSON.stringify({generatedAt:result.generatedAt,totalCandidates:actionable.length,candidates:actionable},null,2));
const md=[
  '# BIG PASS 203 — Function Passport / Semantic Proof','',
  `Functions: **${result.totalFunctions}**`,'',
  '| Verdict | Count |','|---|---:|',
  ...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'',
  `Strict VERIFIED rate: **${(result.strictVerifiedRate01*100).toFixed(2)}%**`,'',
  'The passport does not grant VERIFIED from source existence or a passing smoke probe. Every exact function has a behavioural contract and an explicit proof plan.','',
  '## Domain readiness','',
  '| Domain | Total | Verified | Integration | Unverified | Unsafe | Mean confidence |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...Object.entries(domainStats)
    .sort((a,b)=>b[1].total-a[1].total)
    .map(([d,s])=>`| ${d} | ${s.total} | ${s.verified} | ${s.integrationOnly} | ${s.unverified} | ${s.unsafe} | ${(s.confidence01*100).toFixed(1)}% |`),
  '',
  '## Highest-value safe candidates for the next verification pass','',
  ...actionable.slice(0,120)
    .map((p,i)=>`${i+1}. \`${p.id}\` — ${p.domain}; confidence ${(p.confidence01*100).toFixed(1)}%; missing: ${p.blockers.map(x=>x.split(':')[0]).join(', ')}`)
].join('\n');
fs.writeFileSync('FUNCTION_PASSPORTS_203_RU.md',md);
console.log(JSON.stringify({pass:203,totalFunctions:passports.length,counts,strictVerifiedRate01:result.strictVerifiedRate01,topCandidates:actionable.slice(0,12).map(p=>p.id)},null,2));
