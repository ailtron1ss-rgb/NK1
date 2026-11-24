#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const app=process.env.DATABASE_URL ? spawnSync('node',['scripts/migrate.mjs'],{cwd:path.join(root,'app'),stdio:'inherit',env:process.env}) : {status:0};
if(app.status!==0) process.exit(app.status||1);
const runtime=spawnSync(process.execPath,['--experimental-strip-types','scripts/pass20-persistence-restore-continuity.mjs'],{cwd:path.join(root,'runtime/neuro-kurisu'),stdio:'inherit',env:process.env});
if(runtime.status!==0) process.exit(runtime.status||1);
console.log(JSON.stringify({ok:true,appMigration:app.status===0?'skipped-or-pass':'failed',runtimePersistenceMigration:'PASS'},null,2));
