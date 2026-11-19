import fs from 'node:fs';
import path from 'node:path';
import { ts } from './lib/resolve-typescript.mjs';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const skip=new Set(['legacy-original','node_modules','state','.git']);
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else files.push(p);}}
walk(root);
const js=files.filter(p=>/\.(mjs|js)$/i.test(p));
const sh=files.filter(p=>/\.sh$/i.test(p));
const json=files.filter(p=>p.endsWith('.json'));
const failures=[];
for(const f of js){try{const sf=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);if(sf.parseDiagnostics?.length){const d=sf.parseDiagnostics[0];failures.push(`js:${path.relative(root,f)}:${d.start??0}:${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}}catch(e){failures.push(`js:${path.relative(root,f)}:${String(e)}`)}}
for(const f of sh){try{const r=spawnSync('bash',['-n',f],{encoding:'utf8'});if(r.status!==0)failures.push(`sh:${path.relative(root,f)}:${r.stderr||r.stdout||r.status}`);}catch(e){failures.push(`sh:${path.relative(root,f)}:${String(e)}`)}}
for(const f of json){try{JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){failures.push(`json:${path.relative(root,f)}:${String(e)}`)}}
console.log(JSON.stringify({ok:failures.length===0,js:js.length,sh:sh.length,json:json.length,parser:'typescript',failures:failures.slice(0,100)},null,2));
if(failures.length)process.exit(1);
console.log(`SYNTAX_JSON=PASS js=${js.length} sh=${sh.length} json=${json.length} parser=typescript`);
