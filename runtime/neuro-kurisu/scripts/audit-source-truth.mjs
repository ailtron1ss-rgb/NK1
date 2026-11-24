import { readFile } from 'node:fs/promises';
const v=JSON.parse(await readFile('VERSION.json','utf8'));
const files=['README_RU.md','docs/00_MASTER_PERSONHOOD_CONSTITUTION_RU.md','docs/ARCHITECTURE_RU.md','docs/PROJECT_PROGRESS_RU.md','docs/MASTER_ROADMAP_5_STAGES_RU.md','docs/EVOLUTION_HANDOFF_RU.md','docs/SYSTEM_OF_RECORD_RU.md','docs/WORKING_PROMPT_RU.md'];
const bad=[];
for(const f of files){ try{ const s=await readFile(f,'utf8'); if(!s.includes(v.application)) bad.push(`${f}:missing-release`); }catch{ bad.push(`${f}:missing-file`); }}
const arch=JSON.parse(await readFile('ARCHITECTURE_MANIFEST.json','utf8'));
const rel=JSON.parse(await readFile('RELEASE_MANIFEST.json','utf8'));
if(arch.release!==v.application) bad.push('ARCHITECTURE_MANIFEST:release-drift');
if(rel.version!==v.application) bad.push('RELEASE_MANIFEST:release-drift');
if(arch.organismCore!==v.organismCore) bad.push('ARCHITECTURE_MANIFEST:core-drift');
if(rel.organismCore!==v.organismCore) bad.push('RELEASE_MANIFEST:core-drift');
console.log(bad.length?`SOURCE_TRUTH=FAIL\n${bad.join('\n')}`:'SOURCE_TRUTH=PASS');
if(bad.length) process.exit(1);
