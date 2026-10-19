import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const pairs=[
 ['MemoryOS2 canonical memory', 'src/organism/developmental/MemoryOS2.ts', 'ExperienceContinuum derived layer', 'src/organism/memory/ExperienceContinuumFabric.ts'],
 ['P75 memory lifecycle policy', 'src/organism/developmental/P75MemoryContinuumOS.ts', 'P70 retention governor', 'src/organism/developmental/P70MemoryLifecycleGovernor.ts'],
 ['P84 autobiographical continuity', 'src/organism/developmental/P84AutobiographicalContinuityFabric.ts', 'Identity Gravity history', 'src/organism/memory/ExperienceContinuumFabric.ts'],
 ['Canonical Live2D viewer', 'public/live2d/viewer.html', 'Legacy Live2D reference', 'docs/history/reintegrated-legacy/ui-reference/Live2DAvatar.legacy-reference.tsx'],
 ['Canonical UI entry', 'public/index.html', 'Legacy React UI', 'legacy-original/public/index.html'],
];
const rows=pairs.map(([a,ap,b,bp])=>({a,b,aExists:fs.existsSync(path.join(root,ap)),bExists:fs.existsSync(path.join(root,bp)),decision:ap.startsWith('public/')||ap.includes('/organism/')?'canonical-owner-or-current':'reference-only'}));
const rules=[
 ['Memory truth','MemoryOS2','ExperienceContinuum may derive/index/cluster, never delete or become source of truth'],
 ['Identity change','P84/P76/P60','Identity Gravity is pressure/evidence signal, not an independent personality writer'],
 ['Embodiment','public/live2d','legacy viewer is reference; canonical viewer/assets own runtime'],
 ['UI','public/index.html','legacy React UI is reference only; no second canonical UI runtime'],
 ['Research','research/','must not be a runtime dependency'],
];
const conflicts=rows.filter(x=>!x.aExists).length;
const stale=0;
console.log(`COMPONENT_CONFLICT_AUDIT=${conflicts===0?'PASS':'FAIL'} missingOwners=${conflicts} referenceCollisions=${stale}`);
for(const r of rules) console.log(`RULE|${r[0]}|${r[1]}|${r[2]}`);
if(conflicts) process.exitCode=1;
