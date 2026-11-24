#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const files=['SUPER_VERSION.json','package.json','app/package-lock.json','runtime/neuro-kurisu/package.json','runtime/neuro-kurisu/VERSION.json','runtime/neuro-kurisu/RELEASE_MANIFEST.json'];
const entries=[];
for(const rel of files){const data=await readFile(path.join(root,rel));entries.push({path:rel,sha256:createHash('sha256').update(data).digest('hex')});}
const freeze={release:'20.0.0-super-final',frozenAt:new Date().toISOString(),node:process.version,files:entries,environment:{databaseConfigured:Boolean(process.env.DATABASE_URL),apiTokenConfigured:Boolean(process.env.NEURO_API_TOKEN)}};
await writeFile(path.join(root,'contracts','PRODUCTION_CONFIG_FREEZE.json'),JSON.stringify(freeze,null,2)+'\n');
console.log(JSON.stringify({ok:true,freeze},null,2));
