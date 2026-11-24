#!/usr/bin/env node
import { readdir, readFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd(); const errors=[]; const warnings=[];
async function exists(p){try{await access(p);return true}catch{return false}}
async function walk(dir){const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','.git','state','.super-state'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const files=await walk(root);
for(const p of files){const rel=path.relative(root,p); if(/(^|[\\/])__pycache__([\\/]|$)/.test(rel)||rel.endsWith('.pyc')) errors.push(`generated-python-artifact:${rel}`); if(rel.startsWith('backups'+path.sep)) continue; try{const s=await stat(p);if(s.size===0)warnings.push(`empty:${rel}`)}catch{}}
for(const rel of ['.env.local','legacy/input-archives/hexis-main-2026-10-08/.env.local','legacy/input-archives/hexis-main-2026-10-08/core/auth/gmail-credentials.json']) if(await exists(path.join(root,rel))) errors.push(`secret-file-present:${rel}`);
const route=spawnSync(process.execPath,['scripts/audit-ui-function-wiring.mjs'],{cwd:path.join(root,'runtime/neuro-kurisu'),encoding:'utf8',timeout:120000}); if(route.status!==0) errors.push(`ui-wiring:${route.stderr||route.stdout}`);
const arch=spawnSync(process.execPath,['scripts/audit-architecture.mjs'],{cwd:path.join(root,'runtime/neuro-kurisu'),encoding:'utf8',timeout:120000}); if(arch.status!==0) errors.push(`architecture:${arch.stderr||arch.stdout}`);
console.log(JSON.stringify({ok:errors.length===0,files:files.length,errors,warnings,checkedAt:new Date().toISOString()},null,2));
if(errors.length)process.exit(1);
