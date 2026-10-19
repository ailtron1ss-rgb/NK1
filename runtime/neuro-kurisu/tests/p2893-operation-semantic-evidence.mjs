import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { verifyDecisionSemanticEvidence } from '../src/organism/system/DecisionSemanticEvidence.ts';

const embodiment={bodyEnergy01:.78,cognitiveCapacity01:.82,thermalStrain01:.12,sensoryFreshness01:.9,awake:true,battery01:.77,cpuLoad01:.18,ramPressure01:.2};
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational',checkpointMaxDirtyCycles:256,checkpointMinIntervalMs:600000});
await core.init();
for(let i=0;i<16;i++){ await core.observe({text:i%5===0?'inspect state':undefined,novelty:.45+(i%3)*.08,surprise:i%4===0?.18:.04,embodiment},'operational'); await core.feedback({reward:i%3===0?.62:.08,surprise:i%4===0?.18:.04}); }
const snap=core.snapshot();
const traces=snap.traces.slice(0,16);
assert.ok(traces.length>=12);
const checks=traces.map(verifyDecisionSemanticEvidence);
assert.equal(checks.filter(x=>!x.pass).length,0);
assert.ok(traces.every(t=>t.semanticEvidence?.stateBeforeHash));
const closed=traces.filter(t=>t.semanticEvidence?.closedAt);
assert.ok(closed.length>=1);
assert.ok(closed.every(t=>t.stateAfter && t.semanticEvidence?.stateAfterHash && t.semanticEvidence?.outcomeHash));
const invariants=checks.reduce((a,x)=>a+x.invariants01,0)/checks.length;
console.log(JSON.stringify({pass:true,traces:traces.length,meanInvariant01:invariants,latestAction:traces[0].selected?.action ?? null}));
