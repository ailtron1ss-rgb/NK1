import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store = new MemoryStateStore();
const core = new OrganismCore(store, {checkpointMinIntervalMs: 60_000, checkpointMaxDirtyCycles: 32});
await core.init();
for (let i=0;i<80;i++) await core.observe({text: i % 5 === 0 ? `observation ${i}` : undefined, reward: i % 7 === 0 ? 0.7 : undefined, embodiment:{bodyEnergy01:.78-((i%13)/100),thermalStrain01:.18,cognitiveCapacity01:.82,awake:true,sensoryFreshness01:.82}});
await core.flush();
const a=core.p74Snapshot(), b=core.p75Snapshot(), c=core.p76Snapshot(), d=core.p77Snapshot(), e=core.p78Snapshot(), f=core.p79Snapshot();
assert.equal(a.ticks,80); assert.equal(b.cycles,80); assert.equal(c.samples,80); assert.equal(d.observations,80); assert.ok(e.samples>=80); assert.equal(f.samples,80);
assert.ok(a.integration01>=0 && a.integration01<=1); assert.ok(b.hotBudget>=16); assert.ok(c.conservation01>=0 && c.conservation01<=1); assert.ok(d.evidenceQuality01>0); assert.ok(e.narrativeCoherence01>0); assert.ok(f.grounding01>=0 && f.grounding01<=1);
const restored = new OrganismCore(store, {checkpointMinIntervalMs: 60_000, checkpointMaxDirtyCycles: 32});
await restored.init();
assert.equal(restored.p74Snapshot().ticks,80); assert.equal(restored.p75Snapshot().cycles,80); assert.equal(restored.p76Snapshot().samples,80); assert.equal(restored.p77Snapshot().observations,80); assert.ok(restored.p78Snapshot().samples>=80); assert.equal(restored.p79Snapshot().samples,80);
console.log('P74_P77_INTEGRATION=PASS');
