import fs from 'node:fs';
import path from 'node:path';
import { computeManifestCounts } from './lib/manifest-counts.mjs';
const root=process.cwd();
const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const version=readJson('VERSION.json');
const arch=readJson('ARCHITECTURE_MANIFEST.json');
const required=['src/organism/core/OrganismCore.ts','src/organism/core/TemporalResolutionGovernor.ts','src/organism/memory/ExperienceContinuumFabric.ts','src/server/server.mjs','public/index.html','public/live2d/Kurisu/Kurisu.model3.json','public/live2d/Kurisu/Kurisu.moc3'];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
const forbidden=[];
function scan(dir){ if(!fs.existsSync(dir)) return; for(const ent of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,ent.name); if(ent.isDirectory()) scan(p); else if(/\.(ts|mts|mjs|tsx|js)$/.test(ent.name)){ const t=fs.readFileSync(p,'utf8'); if(t.match(/(?:from|import\(|require\(|fetch\()['\"`][^'\"`]*legacy-original/)) forbidden.push(path.relative(root,p)); } } }
scan(path.join(root,'src'));
const counts=await computeManifestCounts(root);
const countMismatches=[];
if(arch.canonicalFiles!==counts.canonicalFiles) countMismatches.push(`canonicalFiles declared=${arch.canonicalFiles} actual=${counts.canonicalFiles}`);
if(arch.sourceSurfaceFiles!==counts.sourceSurfaceFiles) countMismatches.push(`sourceSurfaceFiles declared=${arch.sourceSurfaceFiles} actual=${counts.sourceSurfaceFiles}`);
const ok=version.application===arch.release && version.stateSchema===arch.stateSchema && arch.canonicalRoot==='src/organism' && missing.length===0 && forbidden.length===0 && countMismatches.length===0;
console.log(`PROJECT_STATE_AUDIT=${ok?'PASS':'FAIL'} version=${version.application} schema=${version.stateSchema} missing=${missing.length} forbiddenCanonicalLegacyRefs=${forbidden.length} manifestCountMismatches=${countMismatches.length}`);
if(!ok){ if(missing.length) console.log('MISSING='+missing.join(',')); if(forbidden.length) console.log('LEGACY_REFS='+forbidden.join(',')); if(countMismatches.length) console.log('MANIFEST_COUNT_MISMATCH='+countMismatches.join('; ')+' (run: npm run manifests)'); process.exitCode=1; }
