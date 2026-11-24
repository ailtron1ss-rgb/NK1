import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const runtime = new OrganismRuntime({stateFile:'/tmp/nk-canonical-live.json', worldStateFile:'/tmp/nk-canonical-live-world.json', enableLanguage:false, autoRun:false, stateStore:new MemoryStateStore(), worldStateStore:new MemoryStateStore(), performanceProfile:'mobile'});
await runtime.init();
for(let i=0;i<4;i++) await runtime.autonomousStep({novelty:.18+.04*i, uncertainty:.34+.03*i, reward:i%2?.76:.44, embodiment:{bodyEnergy01:.76,cognitiveCapacity01:.84,thermalStrain01:.12,sensoryFreshness01:.9,awake:true,battery01:.82,cpuLoad01:.18,ramPressure01:.18}});
const frame=runtime.core.canonicalActionPolicyDiagnostics();
assert(frame);
const rows=Object.values(frame);
assert.equal(rows.length,7);
assert.ok(rows.every(r=>r.sourceCount===3));
assert.ok(rows.some(r=>Math.abs(r.sourceContributions01['contextual-p2855']??0)>0));
assert.ok(rows.some(r=>Math.abs(r.contribution01)>0));
const authority=runtime.core.policyAuthorityDiagnostics();
assert.equal(authority.pass,true);
assert.equal(authority.duplicateSourcePairs,0);
runtime.stop();
console.log('CANONICAL_POLICY_LIVE_PASS',JSON.stringify({actions:rows.length,p2855Contributing:rows.filter(r=>Math.abs(r.sourceContributions01['contextual-p2855']??0)>0).length,meanConfidence01:rows.reduce((s,r)=>s+r.confidence01,0)/rows.length}));
