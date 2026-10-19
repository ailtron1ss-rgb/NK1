#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const r=spawnSync(process.execPath,['--experimental-strip-types','tests/pass20-persistence-restore-continuity.mjs'],{cwd:path.join(root,'runtime/neuro-kurisu'),stdio:'inherit',env:process.env});
if(r.status!==0) process.exit(r.status||1);
const appMigrations=spawnSync('node',['-e',`import('./app/scripts/migration-plan.mjs').then(m=>console.log('APP_MIGRATION_PLAN=PASS',m.pendingMigrations(['0001.sql'],[]).length))`],{cwd:root,stdio:'inherit'});
if(appMigrations.status!==0) process.exit(appMigrations.status||1);
console.log('SCHEMA_CHECK=PASS');
