import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<16;i++){
  await core.observe({
    text:i%3===0?'explore the unfamiliar hypothesis':'verify the previous result',
    novelty:.48+(i%6)*.06,uncertainty:.30+(i%5)*.08,
    reward:i%9===0?.12:.78,success:i%9===0?.25:.86,surprise:i%7===0?.72:.14,
    embodiment:{awake:true,bodyEnergy01:.82-(i%11)*.018,cognitiveCapacity01:.74,thermalStrain01:.14,sensoryFreshness01:.72,battery01:.81,cpuLoad01:.24,ramPressure01:.22}
  },'operational');
  await core.feedback({reward:i%9===0?.12:.78,success:i%9===0?.25:.86,surprise:i%7===0?.72:.14});
}
const d=core.b401B420Diagnostics();
assert(d.diagnostics.decisions>=5);
assert(d.diagnostics.updates>0);
assert(Object.keys(d.weights).length===7);
assert(d.prototypes.length>0);
assert(d.diagnostics.bestVariant);
const lesion=core.b401B420Lesion({tick:999,context01:[.92,.12,.87,.24,.80,.31,.91,.75],baseProbabilities:{respond:.14,explore:.28,verify:.18,rest:.10,reflect:.12,wait:.09,defer:.09},baseUtilities:{respond:.48,explore:.77,verify:.70,rest:.44,reflect:.57,wait:.42,defer:.46},reward01:.5,surprise01:.4,novelty01:.7,uncertainty01:.54,predictionError01:.21,goalVector:[.78,.69,.60,.43,.84,.35,.42,.50],selfVector:[.72,.65,.61,.46,.79,.40,.44,.53],retrievedMemoryStrength01:.6,motivation01:.63},{memory:true});
assert(lesion.delta01>0);
const snap=core.snapshot();
const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await restored.init();
const rd=restored.b401B420Diagnostics();
assert.equal(rd.diagnostics.decisions,d.diagnostics.decisions);
assert.equal(rd.prototypes.length,d.prototypes.length);
assert.deepEqual(rd.weights,d.weights);
console.log(JSON.stringify({pass:true,status:'B401_B420_ORGANISM_INTEGRATION_PASS',decisions:d.diagnostics.decisions,updates:d.diagnostics.updates,prototypes:d.prototypes.length,bestVariant:d.diagnostics.bestVariant,weights:d.weights,ensembleDiversity01:d.diagnostics.lastEnsembleDiversity01,uncertainty01:d.diagnostics.lastUncertainty01,memoryLesion01:lesion.delta01,restartPersistence:true},null,2));
