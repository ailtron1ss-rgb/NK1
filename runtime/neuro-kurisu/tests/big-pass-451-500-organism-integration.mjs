import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<24;i++){
 await core.observe({text:i%5===0?'investigate a surprising pattern':'verify and refine the current hypothesis',novelty:.20+(i%9)*.08,uncertainty:.22+(i%8)*.08,reward:i%7===0?.15:.74,success:i%7===0?.20:.82,surprise:i%5===0?.74:.16,embodiment:{awake:true,bodyEnergy01:.86-(i%10)*.02,cognitiveCapacity01:.74,thermalStrain01:.12+(i%6)*.025,sensoryFreshness01:.78,battery01:.82-(i%11)*.01,cpuLoad01:.24,ramPressure01:.21}},'operational');
 await core.feedback({reward:i%7===0?.15:.74,success:i%7===0?.20:.82,surprise:i%5===0?.74:.16});
}
const d=core.b451B500Diagnostics(); assert(d.decisions>5); assert(d.updates>0); assert(d.skills>0); assert(d.abstractions>0); assert(d.bestStrategy);
const lesion=core.b451B500Lesion({tick:999,context01:[.91,.14,.82,.22,.76,.31,.88,.71],baseUtilities:{respond:.48,explore:.76,verify:.71,rest:.43,reflect:.58,wait:.41,defer:.45},b421Predictive:{respond:.48,explore:.71,verify:.69,rest:.46,reflect:.61,wait:.42,defer:.44},b421Bias:{respond:0,explore:.02,verify:.03,rest:0,reflect:.01,wait:0,defer:0},confidence01:.49,uncertainty01:.68,predictionError01:.45,novelty01:.74,surprise01:.61,goalVector:[.76,.68,.61,.40,.83,.34,.43,.49],selfVector:[.73,.64,.60,.45,.78,.39,.45,.52],memoryStrength01:.6,motivation01:.62,complexity01:.74},{'meta-controller':true,'memory-abstraction':true,'skill-library':true,'world-ensemble':true}); assert(lesion.delta01>0.0001);
const snap=core.snapshot(); const restored=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init(); const rd=restored.b451B500Diagnostics(); assert.equal(rd.decisions,d.decisions); assert.equal(rd.updates,d.updates); assert(rd.skills>0);
console.log(JSON.stringify({pass:true,status:'B451_B500_ORGANISM_INTEGRATION_PASS',decisions:d.decisions,updates:d.updates,skills:d.skills,abstractions:d.abstractions,guardEvents:d.guardEvents,bestStrategy:d.bestStrategy,developmentalGain01:d.developmentalGain01,causalLesion01:lesion.delta01,restartPersistence:true},null,2));
