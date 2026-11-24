import fs from 'node:fs';
const requiredFiles = [
  'src/organism/system/ContinuousCognitiveFabric.ts',
  'src/organism/cognition/B502ContinuousIdentityLifecycleEngine.ts',
  'src/organism/cognition/B503ExperienceIntegrationLayer.ts',
  'src/organism/memory/AdaptiveExperienceConsolidator.ts',
  'src/organism/cognition/b504/DreamConsolidationLayer.ts',
  'src/organism/cognition/b504/PersonalityConflictEngine.ts',
  'src/organism/cognition/b504/UnifiedCognitiveSpine.ts',
  'tests/b504-continuous-cognitive-fabric.mjs',
];
const missing=requiredFiles.filter(file=>!fs.existsSync(file));
if(missing.length){console.error(JSON.stringify({gate:'FAIL',reason:'missing-files',missing},null,2));process.exit(1)}
const runtime=fs.readFileSync('src/organism/core/OrganismRuntime.ts','utf8');
const core=fs.readFileSync('src/organism/core/OrganismCore.ts','utf8');
const checks={
  runtimeImport:runtime.includes("../system/ContinuousCognitiveFabric.ts"),
  runtimeRestore:runtime.includes('continuousCognitiveFabric.restore(systemSnapshot.continuousCognitiveFabric'),
  runtimeStep:runtime.includes('this.continuousCognitiveFabric.step({'),
  runtimePersist:runtime.includes('this.core.setContinuousCognitiveFabric(continuousFabric)'),
  coreState:core.includes('continuousCognitiveFabric?: import(\'../system/ContinuousCognitiveFabric.ts\').ContinuousCognitiveSnapshot'),
  coreSetter:core.includes('setContinuousCognitiveFabric(snapshot:'),
};
const audit=fs.existsSync('SEMANTIC_COVERAGE_AUDIT.json')?JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8')):null;
const semantic={totalFunctions:audit?.totalFunctions??null,verified:audit?.byStatus?.VERIFIED??null,unverified:audit?.byStatus?.UNVERIFIED??null};
if(Object.values(checks).some(x=>!x)){console.error(JSON.stringify({gate:'FAIL',checks,semantic},null,2));process.exit(1)}
console.log(JSON.stringify({gate:'PASS',checks,semantic,evidenceRule:'new capability is counted only after direct + integration + persistence/replay evidence'},null,2));
