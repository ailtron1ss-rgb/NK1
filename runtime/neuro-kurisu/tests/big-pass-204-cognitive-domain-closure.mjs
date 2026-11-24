import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const store=new MemoryStateStore();
const cfg={enableLanguage:false,checkpointMinIntervalMs:0,checkpointMaxDirtyCycles:1,cycleResultMode:'operational',performanceProfile:'mobile',enableWorldModel:true,enableSelfProjects:true,enableAgencyModel:true,enableLifelongLearning:true};
const core=new OrganismCore(store,cfg);
await core.init();

for(let i=0;i<18;i++){
  await core.observe({
    text:`closure experiment ${i}`,
    worldContext:{location:'closure-lab',objects:[{label:i%2?'lamp':'table',visible:true}],events:[{type:'pulse',importance:.6}]},
    novelty:.42+(i%4)*.07,
    reward:i%3===0?.82:.61,
    success:i%3===0?.78:.64,
    externalGoal:i===0?{title:'validate cross-domain closure',importance:.72,urgency:.55}:undefined,
    embodiment:{bodyEnergy01:.84,cognitiveCapacity01:.86,thermalStrain01:.18,sensoryFreshness01:.9,awake:true,battery01:.81,cpuLoad01:.23,ramPressure01:.22}
  });
  await core.feedback({success:i%3===0?.8:.65,reward:i%3===0?.84:.62,evidenceSource:'internal-observation'});
}

const closure=core.cognitiveDomainClosureSnapshot();
assert.ok(closure.totalCycles>=18,'closure cycles');
assert.ok(closure.recent.length>0,'closure recent records');
assert.ok(closure.persistenceReadyCycles>=closure.totalCycles,'every closure must be persistence-ready');
const last=closure.last;
assert.ok(last,'last closure exists');
assert.ok(last.links.learningToSelf,'learning must link to self update');
assert.ok(last.links.agencyToLearning,'agency must link to learning');
assert.ok(last.changedDomains.includes('memory'),'memory domain changed');
assert.ok(last.changedDomains.includes('learning'),'learning domain changed');

const before=JSON.stringify(closure);
const restored=new OrganismCore(store,cfg);
await restored.init();
const restoredClosure=restored.cognitiveDomainClosureSnapshot();
assert.equal(JSON.stringify(restoredClosure),before,'domain closure must survive restart');
const diag=restored.cognitiveDomainClosureSnapshot();
const complete=diag.completeCycles;
assert.ok(complete>=1,'at least one end-to-end closure must be complete');

console.log('BIG_PASS_204_COGNITIVE_DOMAIN_CLOSURE=PASS',JSON.stringify({cycles:closure.totalCycles,completeCycles:closure.completeCycles,incompleteCycles:closure.incompleteCycles,completionRate01:Number((closure.completeCycles/closure.totalCycles).toFixed(4)),meanContinuity01:Number(closure.meanContinuity01.toFixed(4)),persistenceReadyCycles:closure.persistenceReadyCycles,last:{tick:last.tick,changedDomains:last.changedDomains,continuity01:last.continuity01,links:last.links},restore:'PASS'}));
