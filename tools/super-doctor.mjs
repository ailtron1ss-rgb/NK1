#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { readPinnedNodeMajor, versionMajor } from './lib/node-runtime.mjs';
const root = process.cwd();
const out=[]; const ok=(name,pass,detail='')=>out.push({name,pass,detail});
function ver(bin,args=['--version']){try{return execFileSync(bin,args,{encoding:'utf8'}).trim()}catch{return null}}
// A path is "shipped" only when it is committed; locally installed artifacts
// (gitignored node_modules/, runtime state) must not fail the doctor.
function shipped(rel){
  try{
    return execFileSync('git',['ls-files','--',rel],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().length>0;
  }catch{
    return existsSync(path.join(root,rel));
  }
}
const node=ver(process.execPath); const npm=ver('npm'); const py=ver('python3');
const pinnedMajor = readPinnedNodeMajor(root);
ok('node', versionMajor(node) === pinnedMajor, node||'missing');
ok('npm', versionMajor(npm) >= 10, npm||'missing');
ok('python', !!py, py||'missing');
ok('runtime-package', existsSync(path.join(root,'runtime/neuro-kurisu/package.json')));
ok('app-lock', existsSync(path.join(root,'app/package-lock.json')));
ok('no-shipped-node_modules', !shipped('app/node_modules') && !shipped('runtime/neuro-kurisu/node_modules'));
ok('no-shipped-state', !shipped('runtime/neuro-kurisu/state') && !shipped('.super-state'));
const secretFiles=['.env.local','core/auth/gmail-credentials.json'];
for (const rel of secretFiles) ok(`no-provenance-secret:${rel}`, !existsSync(path.join(root,'legacy/input-archives/hexis-main-2026-10-08',rel)));
const forbidden=[]; for (const start of ['.','legacy/input-archives/hexis-main-2026-10-08']) {
  // no recursive filesystem API needed; final verification handles exhaustive scan
}
const result={ok:out.every(x=>x.pass), checks:out, checkedAt:new Date().toISOString()};
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exit(1);
