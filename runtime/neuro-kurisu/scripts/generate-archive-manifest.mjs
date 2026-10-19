import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const skipDirs=new Set(['node_modules','state','.git']);
const self='RELEASE_ARCHIVE_MANIFEST.json';
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skipDirs.has(ent.name)) continue; const p=path.join(dir,ent.name); if(ent.isDirectory()) walk(p); else {const rel=path.relative(root,p).replaceAll(path.sep,'/'); if(rel!==self) files.push(rel);}}}
walk(root);
files.sort();
const entries=files.map(rel=>{const b=fs.readFileSync(path.join(root,rel)); return {path:rel,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
const v=JSON.parse(fs.readFileSync(path.join(root,'VERSION.json'),'utf8'));
const manifest={release:v.application,organismCore:v.organismCore,stateSchema:v.stateSchema,phase:v.phase,generatedAt:new Date().toISOString(),selfExcluded:true,fileCount:entries.length,files:entries};
fs.writeFileSync(path.join(root,self),JSON.stringify(manifest,null,2)+'\n');
console.log(`ARCHIVE_MANIFEST=PASS files=${entries.length}`);
