#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const p=path.join(root,'SUPER_VERSION.json'); const now=JSON.parse(await readFile(p,'utf8'));
const legacy=now.build || 'unknown';
now.version='20.0.0-super-final';
now.build='v20-WILL-LUMINA-HEXIS-FINAL2';
now.releaseStatus='release-candidate-hardened';
now.migratedFrom=legacy;
now.migratedAt=new Date().toISOString();
await writeFile(p,JSON.stringify(now,null,2)+'\n');
console.log(JSON.stringify({ok:true,from:legacy,to:now.version},null,2));
