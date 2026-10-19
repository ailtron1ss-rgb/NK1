import fs from 'node:fs';
const graph=JSON.parse(fs.readFileSync('FUNCTION_REALITY_GRAPH.json','utf8'));
const semantic=JSON.parse(fs.readFileSync('SEMANTIC_COVERAGE_AUDIT.json','utf8'));
const live=JSON.parse(fs.readFileSync('FUNCTION_LIVENESS_AUDIT.json','utf8'));
const param=JSON.parse(fs.readFileSync('PARAMETERIZED_FUNCTION_PROBE.json','utf8'));
const nodes=graph.nodes;
const find=(file,name,cls)=>Object.values(nodes).find(n=>n.file===file&&n.name===name&&(cls? n.className===cls:true));
const edge=(from,toName,toFile,toClass)=>{
  const es=graph.edges[from?.id]??[];
  return es.some(e=>{const t=nodes[e.to];return t&&t.file===toFile&&t.name===toName&&(!toClass||t.className===toClass);});
};
const runtimeStep=find('src/organism/core/OrganismRuntime.ts','stepInternal','OrganismRuntime');
const runtimeInit=find('src/organism/core/OrganismRuntime.ts','init','OrganismRuntime');
const runtimeDiag=find('src/organism/core/OrganismRuntime.ts','continuousCognitiveDiagnostics','OrganismRuntime');
const fabricStep=find('src/organism/system/ContinuousCognitiveFabric.ts','step','ContinuousCognitiveFabric');
const fabricRestore=find('src/organism/system/ContinuousCognitiveFabric.ts','restore','ContinuousCognitiveFabric');
const fabricDiag=find('src/organism/system/ContinuousCognitiveFabric.ts','diagnostics','ContinuousCognitiveFabric');
const fabricChecks=[
  ['integration.process','src/organism/cognition/B503ExperienceIntegrationLayer.ts','process','B503ExperienceIntegrationLayer'],
  ['memory.ingest','src/organism/memory/AdaptiveExperienceConsolidator.ts','ingest','AdaptiveExperienceConsolidator'],
  ['memory.consolidate','src/organism/memory/AdaptiveExperienceConsolidator.ts','consolidate','AdaptiveExperienceConsolidator'],
  ['identity.absorb','src/organism/cognition/B502ContinuousIdentityLifecycleEngine.ts','absorb','B502ContinuousIdentityLifecycleEngine'],
  ['identity.snapshot','src/organism/cognition/B502ContinuousIdentityLifecycleEngine.ts','snapshot','B502ContinuousIdentityLifecycleEngine'],
  ['dream.consolidate','src/organism/cognition/b504/DreamConsolidationLayer.ts','consolidate','DreamConsolidationLayer'],
  ['conflict.analyze','src/organism/cognition/b504/PersonalityConflictEngine.ts','analyze','PersonalityConflictEngine'],
  ['spine.integrate','src/organism/cognition/b504/UnifiedCognitiveSpine.ts','integrate','UnifiedCognitiveSpine'],
];
const checks=[];
checks.push({name:'runtime.stepInternal -> fabric.step',ok:Boolean(runtimeStep&&fabricStep&&edge(runtimeStep,'step','src/organism/system/ContinuousCognitiveFabric.ts','ContinuousCognitiveFabric'))});
checks.push({name:'runtime.init -> fabric.restore',ok:Boolean(runtimeInit&&fabricRestore&&edge(runtimeInit,'restore','src/organism/system/ContinuousCognitiveFabric.ts','ContinuousCognitiveFabric'))});
checks.push({name:'runtime diagnostics -> fabric.diagnostics',ok:Boolean(runtimeDiag&&fabricDiag&&edge(runtimeDiag,'diagnostics','src/organism/system/ContinuousCognitiveFabric.ts','ContinuousCognitiveFabric'))});
for(const [label,file,name,cls] of fabricChecks) checks.push({name:`fabric.step -> ${label}`,ok:Boolean(fabricStep&&find(file,name,cls)&&edge(fabricStep,name,file,cls))});
const statusCounts=semantic.byStatus??{};
const result={
  pass:190,
  generatedAt:new Date().toISOString(),
  gate:checks.every(x=>x.ok)&&param.failed===0,
  checks,
  runtimeReachableFunctions:graph.counts.RUNTIME_REACHABLE,
  testOnlyFunctions:graph.counts.TEST_ONLY,
  referencedNotRuntimeReachable:graph.counts.REFERENCED_NOT_RUNTIME_REACHABLE,
  orphanFunctions:graph.counts.ORPHAN,
  semanticVerified:statusCounts.VERIFIED??0,
  semanticUnverified:statusCounts.UNVERIFIED??0,
  parameterized:{attempted:param.attempted,passed:param.passed,failed:param.failed,skipped:param.skipped,lifecycleNeeded:param.lifecycleNeeded},
  liveness:{declarations:live.functionLikeDeclarations,withBody:live.withBody,zeroReference:live.zeroReference,oneOrLessReference:live.oneOrLessReference},
};
fs.writeFileSync('FUNCTION_REALITY_GATE.json',JSON.stringify(result,null,2));
fs.writeFileSync('FUNCTION_REALITY_GATE_RU.md',[
'# BIG PASS 190 — FUNCTION REALITY GATE','',
`Gate: **${result.gate?'PASS':'FAIL'}**`, '',
'## Critical runtime path', '',
...checks.map(c=>`- ${c.ok?'✅':'❌'} ${c.name}`),'',
'## Current evidence inventory','',
`- Runtime-reachable functions: **${result.runtimeReachableFunctions}**`,
`- Test-only functions: **${result.testOnlyFunctions}**`,
`- Referenced but not runtime-reachable: **${result.referencedNotRuntimeReachable}**`,
`- Orphan functions: **${result.orphanFunctions}**`,
`- Semantic VERIFIED: **${result.semanticVerified}**`,
`- Semantic UNVERIFIED: **${result.semanticUnverified}**`,
`- Parameterized: **${param.passed}/${param.attempted} PASS; ${param.failed} FAIL**`,
`- Zero-reference declarations: **${live.zeroReference}**`,'',
'### Rule', '',
'Runtime reachability is architectural evidence only. It never upgrades a function to behavioural VERIFIED.',''
].join('\n'));
console.log(JSON.stringify(result,null,2));
if(!result.gate) process.exit(2);
