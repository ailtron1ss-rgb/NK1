import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const runtime=new OrganismRuntime({stateFile:'/tmp/nk-p2559-runtime.json',stateStore:new MemoryStateStore(),enableLanguage:false,autoRun:false,intervalMs:30000,cycleResultMode:'full',performanceProfile:'mobile'});
await runtime.init();
for(let i=0;i<10;i++){
  const out=await runtime.autonomousStep();
  assert.ok(out.cycle.decision.selected,'missing selected action');
}
const d=runtime.core.neuralExperienceBranchDiagnostics();
assert.ok(d.embodiedBridge?.transitions>=10,'embodied transitions missing');
assert.ok(d.embodiedBridge?.predictionConsistency01>0,'embodied predictor inactive');
assert.ok(d.embodiedBridge?.activePerception01>0,'active perception inactive');
assert.ok(d.embodiedBridge?.causalSensitivity01>=0,'causal metric invalid');
const before=JSON.stringify({rules:d.causalPlanner.rules.length,transitions:d.embodiedBridge.transitions,transfer:d.embodiedBridge.transfer01});
const lesion=runtime.core.neuralExperienceBranchLesion(.25);
assert.ok(Number.isFinite(lesion.causalDrop01));
runtime.stop();
console.log('B2559_2566_RUNTIME_INTEGRATION_PASS');
console.log(JSON.stringify({summary:before,causalDrop01:lesion.causalDrop01,embodied:{transitions:d.embodiedBridge?.transitions,matchedAlternativeCount:d.embodiedBridge?.matchedAlternativeCount,matchedCausalGain01:d.embodiedBridge?.matchedCausalGain01,transfer01:d.embodiedBridge?.transfer01,predictionConsistency01:d.embodiedBridge?.predictionConsistency01,activePerception01:d.embodiedBridge?.activePerception01,computeCost01:d.embodiedBridge?.computeCost01}},null,2));
