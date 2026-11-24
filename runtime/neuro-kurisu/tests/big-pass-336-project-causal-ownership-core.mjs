import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const embodiment={bodyEnergy01:.72,cognitiveCapacity01:.82,thermalStrain01:.15,sensoryFreshness01:.92,awake:true,battery01:.78,cpuLoad01:.20,ramPressure01:.22};
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<4;i++) await core.observe({text:'',novelty:.62,surprise:.31,embodiment},'operational');
const d=core.b336ProjectCausalOwnershipDiagnostics();
assert.ok(d.observations>=4); assert.ok(d.projectActiveCycles>=0); assert.ok(d.ablationComparisons>=0);
console.log(JSON.stringify({pass:true,d},null,2));
