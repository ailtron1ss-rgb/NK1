import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const currentVersion = (() => { try { return JSON.parse(fs.readFileSync(path.join(root,'VERSION.json'),'utf8')); } catch { return {}; } })();
const skipDirs=new Set(['legacy-original','node_modules','state','.git']);
const historyPrefixes=['docs/history/','research/history/','tests/history/','scripts/history/'];
const generatedAuditFiles=new Set(['ARCHIVE_MANIFEST_174.json','PARAMETERIZED_FUNCTION_PROBE.json','SEMANTIC_DYNAMIC_EVIDENCE.json','FUNCTION_LIVENESS_AUDIT.json','FUNCTION_REALITY_STATUS_174.json','FUNCTION_REALITY_STATUS_175.json','SEMANTIC_COVERAGE_AUDIT.json','SEMANTIC_VERIFICATION_BACKLOG_175.json','BIG_PASS_174_REGRESSION_RESULT.json','BIG_PASS_175_REGRESSION_RESULT.json','BIG_PASS_180_TEST_EVIDENCE.json','SEMANTIC_COVERAGE_AUDIT_179.json','SEMANTIC_COVERAGE_AUDIT_180.json','FUNCTION_REALITY_STATUS_179.json','FUNCTION_REALITY_STATUS_180.json','BIG_PASS_180_FUNCTION_REALITY_EVIDENCE.json','RELEASE_FREEZE_180.json']);
const rel=p=>path.relative(root,p).replace(/\\/g,'/');
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skipDirs.has(ent.name)) continue; const p=path.join(dir,ent.name); if(ent.isDirectory()) walk(p); else files.push(p)}}
walk(root);
const active=files.filter(p=>!historyPrefixes.some(h=>rel(p).startsWith(h)) && rel(p)!=='RELEASE_ARCHIVE_MANIFEST.json' && !generatedAuditFiles.has(rel(p)));
const problems=[];
const empty=active.filter(p=>fs.statSync(p).size===0).map(rel);
if(empty.length) problems.push(`empty-files:${empty.join(',')}`);
const contentHashes=new Map();
for(const f of active){const h=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const a=contentHashes.get(h)||[]; a.push(rel(f)); contentHashes.set(h,a)}
for(const group of contentHashes.values()) if(group.length>1) problems.push(`duplicate-content:${group.join('|')}`);
const nameGroups=new Map();
for(const f of active){const name=path.basename(f).toLowerCase(); const a=nameGroups.get(name)||[]; a.push(rel(f)); nameGroups.set(name,a)}
for(const group of nameGroups.values()){
  if(group.length<2) continue;
  if(group.every(p=>path.basename(p).toLowerCase()==='index.ts')) continue;
  const researchNotesOnly=group.length>1 && group.every(p=>path.basename(p).toLowerCase()==='research_notes.md' && /^research\/\d{4}-\d{2}-\d{2}\//.test(p));
  if (researchNotesOnly) continue;
  problems.push(`duplicate-name:${group.join('|')}`);
}
for(const f of active){
  const r=rel(f); if(r==='scripts/audit-forensics.mjs'||r==='scripts/audit-integrity.mjs') continue;
  if(!/\.(ts|tsx|mjs|js|json|md|html|css|sh|txt)$/i.test(f)) continue;
  const s=fs.readFileSync(f,'utf8');
  if(/(?:^|[\s'\"`])\/mnt\/data\/|(?:^|[\s'\"`])\/home\/oai\/skills\/|(?:^|[\s'\"`])[A-Za-z]:\\/.test(s)) problems.push(`absolute-path:${r}`);
  const versionFiles=new Set(['VERSION.json','RELEASE_MANIFEST.json','ARCHITECTURE_MANIFEST.json','src/organism/system/ReleaseContract.ts']);
  if(r.startsWith('RELEASE_MANIFEST_') || r.startsWith('RELEASE_ARCHIVE_MANIFEST')) continue;
  const legacyVersionPattern=/(?:^|[^0-9])(?:99\.80\.3|99\.80\.2|99\.80\.1|3\.0\.0|2\.0\.0|1\.1\.0)(?:[^0-9]|$)|p5-release-audit/;
  if(!versionFiles.has(r) && legacyVersionPattern.test(s)) problems.push(`stale-version-marker:${r}`);
  const lines=s.split('\n');
  const longLineExempt = r==='docs/brain/SEMANTIC_COVERAGE_AUDIT_B291.json';
  for(let i=0;i<lines.length;i++){if(/[ \t]+$/.test(lines[i])) problems.push(`trailing-whitespace:${r}:${i+1}`); if(!longLineExempt && lines[i].length>800) problems.push(`very-long-line:${r}:${i+1}:${lines[i].length}`)}
}
for(const p of active.filter(p=>p.endsWith('.json'))){try{JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){problems.push(`invalid-json:${rel(p)}:${e.message}`)}}
if(problems.length){console.error(problems.join('\n')); process.exit(1)}
console.log(`FORENSICS=PASS activeFiles=${active.length} empty=0 duplicateContent=0 duplicateNames=0 pathMarkers=0 staleMarkers=0`);
