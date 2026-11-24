import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const include=(p)=>/^(src\/organism\/|scripts\/audit-function-reality-180\.mjs$|scripts\/build-release-freeze-180\.mjs$|tests\/big-pass-180-[^/]+\.mjs$|package\.json$|package-lock\.json$)/.test(p);
const files=[];
function walk(dir){for(const ent of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.posix.join(dir,ent.name);if(ent.isDirectory()){if(!rel.startsWith('node_modules')&&!rel.startsWith('.git'))walk(rel);}else if(include(rel))files.push(rel);}}
walk('src'); walk('scripts'); walk('tests'); for(const p of ['package.json','package-lock.json']) if(fs.existsSync(path.join(root,p))) files.push(p);
files.sort();
const manifest=files.map(rel=>{const b=fs.readFileSync(path.join(root,rel));return {path:rel,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
const digest=crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const result={pass:180,createdAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,sourceFiles:manifest.length,sourceManifestDigest:digest,files:manifest.slice(0,4000)};
fs.writeFileSync('RELEASE_FREEZE_180.json',JSON.stringify(result,null,2));
fs.writeFileSync('RELEASE_FREEZE_180_RU.md',['# BIG PASS 180 — Release Freeze','','Deterministic source manifest files: **'+manifest.length+'**',`Manifest SHA-256: **${digest}**`,`Node: **${process.version}**`,`Platform: **${process.platform}/${process.arch}**`,'','Freeze включает canonical source, verification scripts/tests, package manifests. Runtime outputs не являются частью deterministic source digest.'].join('\n'));
console.log(JSON.stringify({pass:180,sourceFiles:manifest.length,digest},null,2));
