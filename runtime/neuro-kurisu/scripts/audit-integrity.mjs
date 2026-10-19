import { readdir, readFile } from 'node:fs/promises';
import { RELEASE_CONTRACT } from '../src/organism/system/ReleaseContract.ts';
import path from 'node:path';
const root=process.cwd();
const forbidden=['/mnt/data/','/home/oai/skills/','Neuro_Kurisu_OrganismCore_FINAL','grokPatch'];
const skip=new Set(['scripts/audit-integrity.mjs','RELEASE_ARCHIVE_MANIFEST.json','PARAMETERIZED_FUNCTION_PROBE.json','SEMANTIC_DYNAMIC_EVIDENCE.json','FUNCTION_LIVENESS_AUDIT.json','FUNCTION_REALITY_STATUS_174.json','FUNCTION_REALITY_STATUS_175.json','SEMANTIC_COVERAGE_AUDIT.json','SEMANTIC_VERIFICATION_BACKLOG_175.json','BIG_PASS_174_REGRESSION_RESULT.json','BIG_PASS_175_REGRESSION_RESULT.json']);
const files=[];
async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const rel=path.relative(root,path.join(dir,ent.name)); if(rel==='legacy-original'||rel.startsWith('legacy-original'+path.sep)||rel.startsWith('state'+path.sep)||rel.startsWith('node_modules'+path.sep)||rel.startsWith('docs/history'+path.sep)) continue; if(ent.isDirectory()) await walk(path.join(dir,ent.name)); else if(!skip.has(rel)) files.push(rel)}}
await walk(root);
const hits=[]; for(const f of files){if(!/\.(ts|tsx|mjs|js|json|md|sh|html|css|txt)$/.test(f)) continue; const t=await readFile(path.join(root,f),'utf8'); for(const s of forbidden) if(t.includes(s)) hits.push(`${f}:${s}`);}
if(hits.length) {console.error(hits.join('\n')); process.exit(1)}
console.log(`CLEAN_INTEGRITY=PASS files=${files.length} release=${RELEASE_CONTRACT.application} core=${RELEASE_CONTRACT.organismCore} schema=${RELEASE_CONTRACT.stateSchema}`);
