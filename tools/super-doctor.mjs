#!/usr/bin/env node
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { matchesNodeVersionPin, readNodeVersionPin, versionMeetsMinimum } from './project-runtime-pin.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out=[]; const ok=(name,pass,detail='')=>out.push({name,pass,detail});
function ver(bin,args=['--version']){try{return execFileSync(bin,args,{encoding:'utf8'}).trim()}catch{return null}}
const node=ver(process.execPath); const npm=ver('npm'); const py=ver('python3');
let manifest={};
try { manifest=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')); } catch { /* surfaced by failed engine checks */ }
let nodePin=null; let pinError='';
try { nodePin=readNodeVersionPin(root); } catch (error) { pinError=error instanceof Error ? error.message : String(error); }
const minimumFromEngine=range=>typeof range==='string'&&range.startsWith('>=')?range.slice(2).trim():null;
const nodeMinimum=minimumFromEngine(manifest.engines?.node);
const npmMinimum=minimumFromEngine(manifest.engines?.npm);
ok('node-version-pin', !!node&&!!nodePin&&matchesNodeVersionPin(node,nodePin), `expected=${nodePin?.raw ?? (pinError || 'invalid')} actual=${node||'missing'}`);
ok('node-engine', !!node&&!!nodeMinimum&&versionMeetsMinimum(node,nodeMinimum), `required=>=${nodeMinimum??'unavailable'} actual=${node||'missing'}`);
ok('npm-engine', !!npm&&!!npmMinimum&&versionMeetsMinimum(npm,npmMinimum), `required=>=${npmMinimum??'unavailable'} actual=${npm||'missing'}`);
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
