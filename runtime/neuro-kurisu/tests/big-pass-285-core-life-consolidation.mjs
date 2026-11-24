import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
const store=new MemoryStateStore(); const core=new OrganismCore(store,{performanceProfile:'mobile',cycleResultMode:'operational'}); await core.init();
for(let i=0;i<24;i++){
  await core.observe({text:i%6===0?'Запомни важный эпизод и подумай, кем ты становишься.':i%5===0?'Это событие связано с другим человеком и изменяет будущие планы.':'Продолжай и учитывай прошлый опыт.'});
  await core.feedback({success:i%7===0?.88:.67,surprise:i%6===0?.15:.18});
}
const d=core.b285NeuralLifeDiagnostics();
assert(d.steps>=24);
assert(d.learningUpdates>=24);
assert(d.relationshipCount>=1);
assert(d.chapterCount>=1 || d.consolidationCount>=1);
assert(d.futureConsistency01>.45);
assert(d.autobiographicalCompression01>.45);
await core.flush();
const durable=await store.load();
assert(durable?.system?.neuralLifeConsolidationB285,'durable B285 projection must exist');
const durableB285=durable.system.neuralLifeConsolidationB285;
const restored=new OrganismCore(new MemoryStateStore({initial:durable}),{performanceProfile:'mobile',cycleResultMode:'operational'}); await restored.init();
const restoredDiagnostics=restored.b285NeuralLifeDiagnostics();
assert.equal(restoredDiagnostics.episodeCount,durableB285.episodes.length,'restart must restore the durable B285 episode window');
assert.equal(restoredDiagnostics.steps,durable.system.neuralLifeConsolidationB285.steps,'restart must restore durable B285 steps');
assert(restoredDiagnostics.episodeCount<=d.episodeCount,'durable projection may compact bounded history, but restart must not exceed live history');
const future=restored.b285FutureSelfPredict(8); assert.equal(future.length,24);
const rel=restored.b285RelationshipSnapshot('life-general'); assert(rel===null || rel.latent.length===24);
const ablation=restored.b285FutureSelfAblation(future); assert(ablation>=0);
console.log(JSON.stringify({pass:true,steps:d.steps,learningUpdates:d.learningUpdates,replayUpdates:d.replayUpdates,consolidationCount:d.consolidationCount,relationshipCount:d.relationshipCount,futureConsistency01:d.futureConsistency01,autobiographicalCompression01:d.autobiographicalCompression01,identityStability01:d.identityStability01,ablationDrop01:ablation,liveEpisodeCount:d.episodeCount,durableEpisodeCount:restoredDiagnostics.episodeCount,restart:true}));

