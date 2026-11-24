import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const legacy=path.join(root,'legacy-original');
const manifestPath=path.join(legacy,'P3_ARCHIVE_MANIFEST.json');
if(!fs.existsSync(legacy)) { console.log('LEGACY_SNAPSHOT=SKIPPED_NOT_SHIPPED legacy-original directory is not part of this release'); process.exit(0); }
if(!fs.existsSync(manifestPath)) { console.error('LEGACY_SNAPSHOT=FAIL legacy-original exists but P3_ARCHIVE_MANIFEST.json is missing'); process.exit(1); }
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const expected=new Map(manifest.files.map(e=>[e.path,e]));
const missing=[], mismatch=[], extra=[];
for(const [rel,e] of expected){const p=path.join(legacy,rel); if(!fs.existsSync(p)){missing.push(rel); continue;} const b=fs.readFileSync(p); const h=crypto.createHash('sha256').update(b).digest('hex'); if(b.length!==e.bytes||h!==e.sha256)mismatch.push(rel);}
const actual=new Set();
function walk(d){for(const ent of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,ent.name); if(ent.isDirectory()) walk(p); else actual.add(path.relative(legacy,p).replaceAll(path.sep,'/'));}}
walk(legacy); actual.delete('P3_ARCHIVE_MANIFEST.json'); actual.delete('P2_ARCHIVE_MANIFEST.json');
for(const rel of actual) if(!expected.has(rel)) extra.push(rel);
const result={ok:missing.length===0&&mismatch.length===0&&extra.length===0,manifestFiles:expected.size,missing,hashMismatches:mismatch,extra};
console.log(JSON.stringify(result,null,2));
process.exit(result.ok?0:1);
