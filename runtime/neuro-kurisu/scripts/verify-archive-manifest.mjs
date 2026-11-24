import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(); const file=path.join(root,'RELEASE_ARCHIVE_MANIFEST.json');
const m=JSON.parse(fs.readFileSync(file,'utf8')); const missing=[], extra=[], mismatch=[]; const expected=new Map(m.files.map(x=>[x.path,x]));
for(const [rel,e] of expected){const p=path.join(root,rel); if(!fs.existsSync(p)){missing.push(rel);continue;} const b=fs.readFileSync(p); const h=crypto.createHash('sha256').update(b).digest('hex'); if(b.length!==e.bytes||h!==e.sha256)mismatch.push(rel);}
const actual=[]; const skip=new Set(['node_modules','state','.git']); function walk(d){for(const ent of fs.readdirSync(d,{withFileTypes:true})){if(skip.has(ent.name))continue; const p=path.join(d,ent.name); if(ent.isDirectory()) walk(p); else {const r=path.relative(root,p).replaceAll(path.sep,'/'); if(r!==path.basename(file))actual.push(r);}}} walk(root); for(const rel of actual)if(!expected.has(rel))extra.push(rel);
console.log(JSON.stringify({ok:!missing.length&&!mismatch.length&&!extra.length,manifestFiles:expected.size,missing,hashMismatches:mismatch,extra},null,2)); process.exit(missing.length||mismatch.length||extra.length?1:0);
