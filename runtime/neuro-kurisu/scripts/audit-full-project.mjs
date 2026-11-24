import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['legacy-original','history','node_modules','.git','state']);
const TEXT = new Set(['.ts','.mjs','.js','.json','.md','.sh','.html','.css','.d.ts']);
const files = [];
const errors = [];
const warnings = [];

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes:true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else files.push(p);
  }
}
await walk(ROOT);

for (const p of files) {
  const rel = path.relative(ROOT, p);
  if (rel === 'RELEASE_ARCHIVE_MANIFEST.json' || rel.startsWith('RELEASE_MANIFEST_')) continue;
  const ext = path.extname(p);
  const s = await stat(p);
  if (s.size === 0) warnings.push(`empty:${rel}`);
  if (ext === '.json') {
    try { JSON.parse(await readFile(p,'utf8')); }
    catch (e) { errors.push(`json:${rel}:${e.message}`); }
  }
  if (!TEXT.has(ext)) continue;
  if (/^SEMANTIC_(?:COVERAGE_AUDIT|DYNAMIC_EVIDENCE).*\.json$/.test(rel)) continue;
  if (rel.startsWith('public/live2d/')) continue;
  if (rel === 'docs/brain/SEMANTIC_COVERAGE_AUDIT_B291.json') continue;
  let text = '';
  try { text = await readFile(p,'utf8'); } catch { continue; }
  const lines = text.split('\n');
  const maxLen = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (maxLen > 800) warnings.push(`very-long-line:${rel}:${maxLen}`);
  if (text.includes('\t')) warnings.push(`tab-character:${rel}`);
  if (/\/mnt\/data\//.test(text) && !rel.startsWith('scripts/audit-')) errors.push(`absolute-path:${rel}`);
  if (/99\.80\.|P5_FINAL|P4_FINAL|clean-rebuild-3\.0\.0|6\.0\.0-research|3\.0\.0_P5/.test(text) && !rel.startsWith('scripts/audit-') && !rel.startsWith('RELEASE_MANIFEST_')) errors.push(`stale-marker:${rel}`);
  if (rel.endsWith('.tmp') || rel.endsWith('.lock.tmp')) errors.push(`temporary-artifact:${rel}`);
}

const hashes = new Map();
for (const p of files) {
  const ext=path.extname(p); if(!TEXT.has(ext)) continue;
  const text=await readFile(p,'utf8'); const h=createHash('sha256').update(text).digest('hex');
  const arr=hashes.get(h)||[]; arr.push(path.relative(ROOT,p)); hashes.set(h,arr);
}
for (const arr of hashes.values()) if(arr.length>1) warnings.push(`duplicate-content:${arr.join(' == ')}`);

const pkg=JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8'));
for(const [name,cmd] of Object.entries(pkg.scripts||{})){
  const m=/node (?:--[^ ]+ )*([^ ]+)/.exec(cmd);
  if(m){const target=m[1]; if(!path.isAbsolute(target) && !target.startsWith('-') && !(await exists(path.join(ROOT,target)))) errors.push(`script-target:${name}:${target}`);}
}

const currentCount=files.length;
const canonical=files.filter(p=>p.startsWith(path.join(ROOT,'src','organism')+path.sep)).length;
let legacyCount=0; try { legacyCount=(await readdir(path.join(ROOT,'legacy-original'),{recursive:true})).length; } catch {}
console.log(JSON.stringify({ok:errors.length===0,files:currentCount,canonicalFiles:canonical,legacySnapshotEntries:legacyCount,errors,warnings},null,2));
if(errors.length) process.exit(1);

async function exists(p){try{await stat(p);return true}catch{return false}}
