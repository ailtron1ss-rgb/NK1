import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { computeManifestCounts } from './lib/manifest-counts.mjs';
const ROOT = process.cwd();
const v=JSON.parse(await readFile(path.join(ROOT,'VERSION.json'),'utf8'));
const { canonicalFiles, sourceSurfaceFiles } = await computeManifestCounts(ROOT);
const architecture={release:v.application,organismCore:v.organismCore,canonicalRoot:'src/organism',canonicalFiles,sourceSurfaceFiles,canonicalDomainRoots:['src/organism/core','src/organism/cognition','src/organism/memory','src/organism/world','src/organism/body','src/organism/language','src/organism/persistence','src/organism/system','src/organism/learning'],legacyIsolated:'legacy-original/',runtimeEntry:'src/server/server.mjs',uiEntry:'public/index.html',runtimeDependencies:0,researchEntry:'research/',stateSchema:v.stateSchema,dependencyRules:['canonical -> canonical only','canonical -> research forbidden','canonical -> legacy forbidden','UI -> runtime API only','LLM -> language realization only','system -> version/integrity contracts']};
await writeFile(path.join(ROOT,'ARCHITECTURE_MANIFEST.json'),JSON.stringify(architecture,null,2)+'\n');
const release={
  release:'neuro-kurisu-evolution', version:v.application, organismCore:v.organismCore, stateSchema:v.stateSchema, phase:v.phase,
  canonicalPath:'src/organism', legacyPath:'legacy-original', runtimeDependencies:0, buildDependencies:0,
  packageLock:'v3-zero-dependency-tree', researchReleaseSplit:true, deviceGate:'recommended-before-long-running-Android-use',
  stateModel:'domain-facets-memory-embodiment-learning-consciousness-evolution-plus-developmental-cognition',
  integrity:'sha256-state-hash-plus-invariant-engine', replay:'trace-signature-v1',
  transactionalPersistence:'batch-commit-with-device-aware-checkpoint-coalescing',
  persistenceProfiles:{
    serverDefault:process.env.NEURO_RUNTIME_MODE||'active',
    phoneCheckpointMinMs:Number(process.env.NEURO_CHECKPOINT_MIN_INTERVAL_MS||60000),
    phoneMaxDirtyCycles:Number(process.env.NEURO_CHECKPOINT_MAX_DIRTY_CYCLES||12),
    phoneWorldCheckpointMinMs:Number(process.env.NEURO_WORLD_CHECKPOINT_MIN_INTERVAL_MS||300000),
    phoneWorldMaxDirtyCycles:Number(process.env.NEURO_WORLD_CHECKPOINT_MAX_DIRTY_CYCLES||10),
    phoneBackupEverySaves:Number(process.env.NEURO_BACKUP_EVERY_SAVES||4),
  },
  autonomousRuntime:true,
};
await writeFile(path.join(ROOT,'RELEASE_MANIFEST.json'),JSON.stringify(release,null,2)+'\n');
console.log(`MANIFESTS_GENERATED canonical=${canonicalFiles} source=${sourceSurfaceFiles}`);
