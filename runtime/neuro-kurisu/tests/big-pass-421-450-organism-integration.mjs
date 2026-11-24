import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
for(let i=0;i<20;i++){
 await core.observe({text:i%4===0?'explore a novel hypothesis':'verify the previous observation',novelty:.40+(i%7)*.07,uncertainty:.26+(i%6)*.09,reward:i%8===0?.18:.76,success:i%8===0?.22:.84,surprise:i%6===0?.78:.12,embodiment:{awake:true,bodyEnergy01:.84-(i%10)*.02,cognitiveCapacity01:.76,thermalStrain01:.12+(i%5)*.025,sensoryFreshness01:.74,battery01:.80-(i%9)*.01,cpuLoad01:.22,ramPressure01:.20}},'operational');
 await core.feedback({reward:i%8===0?.18:.76,success:i%8===0?.22:.84,surprise:i%6===0?.78:.12});
}
const d=core.b421B450Diagnostics();
assert(d.diagnostics.decisions>=5); assert(d.diagnostics.updates>0); assert(d.episodes.length>0); assert(d.procedures.length>0); assert(d.edges.length>0); assert(d.diagnostics.bestStrategy);
const lesion=core.b421B450Lesion({tick:999,context01:[.91,.14,.82,.22,.76,.31,.88,.71],baseUtilities:{respond:.48,explore:.76,verify:.71,rest:.43,reflect:.58,wait:.41,defer:.45},baseProbabilities:{respond:.14,explore:.28,verify:.18,rest:.10,reflect:.12,wait:.09,defer:.09},reward01:.5,surprise01:.6,novelty01:.72,uncertainty01:.66,predictionError01:.44,goalVector:[.76,.68,.61,.40,.83,.34,.43,.49],selfVector:[.73,.64,.60,.45,.78,.39,.45,.52],memoryStrength01:.6,motivation01:.62,complexity01:.74},{'procedural-refiner':true,'causal-graph':true,'hierarchical-world':true,'coordinated-rollout':true});
assert(lesion.delta01>0.0001);
const snap=core.snapshot();const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});await restored.init();const rd=restored.b421B450Diagnostics();
assert.equal(rd.diagnostics.decisions,d.diagnostics.decisions);assert.equal(rd.episodes.length,d.episodes.length);assert.deepEqual(rd.router,d.router);
console.log(JSON.stringify({pass:true,status:'B421_B450_ORGANISM_INTEGRATION_PASS',decisions:d.diagnostics.decisions,updates:d.diagnostics.updates,episodes:d.episodes.length,procedures:d.procedures.length,edges:d.edges.length,bestStrategy:d.diagnostics.bestStrategy,developmentalGain01:d.diagnostics.developmentalGain01,causalLesion01:lesion.delta01,restartPersistence:true},null,2));
