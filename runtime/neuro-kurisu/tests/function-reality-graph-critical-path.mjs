import assert from 'node:assert/strict';
import fs from 'node:fs';
const graph=JSON.parse(fs.readFileSync('FUNCTION_REALITY_GRAPH.json','utf8'));
const nodes=graph.nodes;
const find=(file,name,cls)=>Object.values(nodes).find(n=>n.file===file&&n.name===name&&(cls?n.className===cls:true));
function has(from,toFile,toName,toClass){return (graph.edges[from.id]??[]).some(e=>{const t=nodes[e.to];return t&&t.file===toFile&&t.name===toName&&(!toClass||t.className===toClass);});}
const step=find('src/organism/core/OrganismRuntime.ts','stepInternal','OrganismRuntime');
const init=find('src/organism/core/OrganismRuntime.ts','init','OrganismRuntime');
const fabricStep=find('src/organism/system/ContinuousCognitiveFabric.ts','step','ContinuousCognitiveFabric');
const fabricRestore=find('src/organism/system/ContinuousCognitiveFabric.ts','restore','ContinuousCognitiveFabric');
assert(step && init && fabricStep && fabricRestore);
assert.equal(step.category,'RUNTIME_REACHABLE');
assert.equal(fabricStep.category,'RUNTIME_REACHABLE');
assert(has(step,'src/organism/system/ContinuousCognitiveFabric.ts','step','ContinuousCognitiveFabric'));
assert(has(init,'src/organism/system/ContinuousCognitiveFabric.ts','restore','ContinuousCognitiveFabric'));
for(const [file,name,cls] of [
 ['src/organism/cognition/B503ExperienceIntegrationLayer.ts','process','B503ExperienceIntegrationLayer'],
 ['src/organism/memory/AdaptiveExperienceConsolidator.ts','ingest','AdaptiveExperienceConsolidator'],
 ['src/organism/memory/AdaptiveExperienceConsolidator.ts','consolidate','AdaptiveExperienceConsolidator'],
 ['src/organism/cognition/B502ContinuousIdentityLifecycleEngine.ts','absorb','B502ContinuousIdentityLifecycleEngine'],
 ['src/organism/cognition/b504/DreamConsolidationLayer.ts','consolidate','DreamConsolidationLayer'],
 ['src/organism/cognition/b504/PersonalityConflictEngine.ts','analyze','PersonalityConflictEngine'],
 ['src/organism/cognition/b504/UnifiedCognitiveSpine.ts','integrate','UnifiedCognitiveSpine'],
]) assert(has(fabricStep,file,name,cls),`${name} is not in fabric runtime graph`);
console.log(JSON.stringify({pass:'FUNCTION_REALITY_GRAPH_CRITICAL_PATH',runtimeRoot:'OrganismRuntime',fabric:'ContinuousCognitiveFabric',criticalEdgesVerified:true},null,2));
