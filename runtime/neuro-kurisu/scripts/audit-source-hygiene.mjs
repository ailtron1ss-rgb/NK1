import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const SKIP=new Set(['legacy-original','history','node_modules','.git']);
const TEXT=new Set(['.ts','.mjs','.js','.json','.md','.sh','.html','.css']);
const errors=[]; const warnings=[]; const seen=new Map(); let files=0;
const generatedAuditFiles=new Set(['ARCHIVE_MANIFEST_174.json','PARAMETERIZED_FUNCTION_PROBE.json','SEMANTIC_DYNAMIC_EVIDENCE.json','FUNCTION_LIVENESS_AUDIT.json','FUNCTION_REALITY_STATUS_174.json','FUNCTION_REALITY_STATUS_175.json','SEMANTIC_COVERAGE_AUDIT.json','SEMANTIC_VERIFICATION_BACKLOG_175.json','BIG_PASS_174_REGRESSION_RESULT.json','BIG_PASS_175_REGRESSION_RESULT.json']);
async function walk(dir){
  for(const ent of await readdir(dir,{withFileTypes:true})){
    if(SKIP.has(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()){ await walk(p); continue; }
    files++;
    const rel=p.slice(ROOT.length+1);
    const st=await stat(p);
    if(generatedAuditFiles.has(rel)) continue;
    if(st.size===0 && !rel.startsWith('state/')) warnings.push(`empty-file:${rel}`);
    const ext=path.extname(p);
    if(!TEXT.has(ext)) continue;
    let text; try{text=await readFile(p,'utf8')}catch{continue}
    if(/\r\n/.test(text)) warnings.push(`crlf:${rel}`);
    if(/[ \t]+$/m.test(text)) errors.push(`trailing-whitespace:${rel}`);
    if(/\n{4,}/.test(text)) warnings.push(`excessive-blank-lines:${rel}`);
    if(!rel.startsWith('scripts/audit-') && /\/mnt\/data\//.test(text)) errors.push(`absolute-build-path:${rel}`);
    if(/99\.80\.|P5_FINAL|P4_FINAL|clean-rebuild-3\.0\.0|6\.0\.0-research/.test(text) && !rel.startsWith('RELEASE_ARCHIVE_MANIFEST') && !rel.startsWith('RELEASE_MANIFEST_') && !rel.startsWith('scripts/audit-')) warnings.push(`historical-marker:${rel}`);
    const hash=createHash('sha256').update(text).digest('hex');
    if(seen.has(hash)) warnings.push(`duplicate-content:${rel} == ${seen.get(hash)}`); else seen.set(hash,rel);
  }
}
await walk(ROOT);
console.log(`SOURCE_HYGIENE files=${files} errors=${errors.length} warnings=${warnings.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
if(warnings.length) console.log(warnings.join('\n'));
