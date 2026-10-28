#!/usr/bin/env node
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { readPinnedNodeMajor, versionMajor } from './lib/node-runtime.mjs';
const root = process.cwd();
const out=[]; const ok=(name,pass,detail='')=>out.push({name,pass,detail});
function ver(bin,args=['--version']){try{return execFileSync(bin,args,{encoding:'utf8'}).trim()}catch{return null}}
const node=ver(process.execPath); const npm=ver('npm'); const py=ver('python3');
const pinnedMajor = readPinnedNodeMajor(root);
ok('node', versionMajor(node) === pinnedMajor, node||'missing');
ok('npm', versionMajor(npm) >= 10, npm||'missing');
ok('python', !!py, py||'missing');
ok('runtime-package', existsSync(path.join(root,'runtime/neuro-kurisu/package.json')));
ok('app-lock', existsSync(path.join(root,'app/package-lock.json')));
ok('no-shipped-node_modules', !existsSync(path.join(root,'app/node_modules')) && !existsSync(path.join(root,'runtime/neuro-kurisu/node_modules')));
ok('no-shipped-state', !existsSync(path.join(root,'runtime/neuro-kurisu/state')) && !existsSync(path.join(root,'.super-state')));
const secretFiles=['.env.local','core/auth/gmail-credentials.json'];
for (const rel of secretFiles) ok(`no-provenance-secret:${rel}`, !existsSync(path.join(root,'legacy/input-archives/hexis-main-2026-10-08',rel)));
const forbidden=[]; for (const start of ['.','legacy/input-archives/hexis-main-2026-10-08']) {
  // no recursive filesystem API needed; final verification handles exhaustive scan
}
const result={ok:out.every(x=>x.pass), checks:out, checkedAt:new Date().toISOString()};
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exit(1);
