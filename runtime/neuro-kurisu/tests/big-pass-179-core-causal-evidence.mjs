import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const opts={checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1};
const core=new OrganismCore(new MemoryStateStore(),opts);
await core.init();
const obs={text:'повторяющийся запрос для независимых событий',surprise:.2,novelty:.3,embodiment:{bodyEnergy01:.8,cognitiveCapacity01:.8,thermalStrain01:.15,sensoryFreshness01:.85,awake:true,battery01:.8,cpuLoad01:.2,ramPressure01:.2}};
await core.observe(obs); await core.feedback({success:.8,reward:.7,surprise:.1});
const a=core.p31Snapshot();
await core.observe(obs); await core.feedback({success:.75,reward:.65,surprise:.12});
const b=core.p31Snapshot();
const ev=b;
assert.ok(a.presentMomentId!==b.presentMomentId);
const persisted=core.snapshot();
assert.ok(persisted.facets.consciousness.consciousnessEvidence.indicators.some(x=>x.supportingObservations>=2));
const reloaded=new OrganismCore(new MemoryStateStore({initial:persisted}),opts); await reloaded.init();
assert.equal(reloaded.p31Snapshot().recentMomentIds.length,2);
console.log('BIG_PASS_179_CORE_CAUSAL_EVIDENCE=PASS',JSON.stringify({moments:reloaded.p31Snapshot().recentMomentIds.length, evidenceSupports:reloaded.snapshot().facets.consciousness.consciousnessEvidence.indicators[0].supportingObservations}));
