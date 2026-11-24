import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.cwd();
const TESTS=path.join(ROOT,'tests');
const OUT=path.join(ROOT,'research','evidence');
const pkg=JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8'));
const entries=await readdir(TESTS,{withFileTypes:true});
const files=entries.filter(e=>e.isFile()).map(e=>e.name).filter(n=>/^p\d+[-_].+\.(mjs|ts|js)$/.test(n));
const scripts=Object.entries(pkg.scripts??{}).filter(([name])=>/^test:p\d+|^test:P\d+/.test(name));
const targets=new Set();
for(const [name,cmd] of scripts){
  const m=/node (?:--[^ ]+ )*([^ ]+)/.exec(cmd); if(m) targets.add(path.basename(m[1]));
}
const orphan=files.filter(f=>!targets.has(f));
const missing=[];
for(const [name,cmd] of scripts){
  const m=/node (?:--[^ ]+ )*([^ ]+)/.exec(cmd); if(!m) continue;
  const target=m[1]; if(target.startsWith('-')||path.isAbsolute(target)) continue;
  try{await stat(path.join(ROOT,target));}catch{missing.push({script:name,target});}
}
const phases=new Map();
for(const f of files){const m=f.match(/^p(\d+)/i);if(!m)continue;const n=Number(m[1]);const row=phases.get(n)||{tests:0,migration:0,integration:0,server:0,performance:0,truth:0,other:0};row.tests++;if(/migration/i.test(f))row.migration++;else if(/integration/i.test(f))row.integration++;else if(/server/i.test(f))row.server++;else if(/performance/i.test(f))row.performance++;else if(/truth|security|contract/i.test(f))row.truth++;else row.other++;phases.set(n,row);}
const report={version:1,generatedAt:new Date().toISOString(),testFiles:files.length,testScripts:scripts.length,orphanTestFiles:orphan,missingScriptTargets:missing,phases:[...phases.entries()].sort((a,b)=>a[0]-b[0]).map(([phase,v])=>({phase,...v}))};
await mkdir(OUT,{recursive:true});
await writeFile(path.join(OUT,'historical-shard-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:missing.length===0, testFiles:report.testFiles, testScripts:report.testScripts, phases:report.phases.length, orphanTestFiles:orphan.length, missingScriptTargets:missing.length, evidence:'research/evidence/historical-shard-audit.json'},null,2));
if(missing.length) process.exit(1);
