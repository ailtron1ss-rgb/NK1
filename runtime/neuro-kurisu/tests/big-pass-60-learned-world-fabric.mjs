import assert from 'node:assert/strict';
import { WorldSubsystemRuntime } from '../src/organism/core/WorldSubsystemRuntime.ts';

const world=(tick,location,uncertainty,objects,facts=[],events=[])=>({
  tick,location,energy:.8,attention:.75,uncertainty,facts,objects,events,
});

const ws=new WorldSubsystemRuntime();
const a=world(1,'lab',.65,[{id:'desk',label:'desk',location:'lab',value:.8,visible:true,collected:false,confidence01:.9,evidenceKind:'observed'}],['observed-evidence:desk'],[]);
const b=world(2,'lab',.25,[
  {id:'desk',label:'desk',location:'lab',value:.8,visible:true,collected:false,confidence01:.95,evidenceKind:'observed'},
  {id:'cup',label:'cup',location:'lab',value:.4,visible:true,collected:false,confidence01:.8,evidenceKind:'observed'},
],['observed-evidence:desk','observed-evidence:cup'],['cup-appeared']);
const c=world(3,'home',.35,[{id:'desk',label:'desk',location:'home',value:.8,visible:true,collected:false,confidence01:.9,evidenceKind:'observed'}],['observed-evidence:desk'],['location-changed']);

const r1=ws.observeGroundedContext(a);
assert.equal(r1.worldLatent.id, ws.worldModel2.snapshot().latentState.id);
const sameTickDifferentId={...a,tick:999};
ws.observeGroundedContext(sameTickDifferentId);
assert.equal(ws.worldLearningSnapshot().stats.passiveUpdates,0);
const r2=ws.observeGroundedContext(b);
assert.ok(r2.p27Latent.confidence01>0);
assert.ok(ws.p27NeuralWorld.snapshot().world.updates>=1);
assert.ok(ws.worldLearningSnapshot().stats.passiveUpdates>=1);

const pred=ws.predictIntegrated('verify',.55,.4);
assert.ok(Number.isFinite(pred.reward01));
assert.ok(pred.reward01>=0 && pred.reward01<=1);
assert.ok(pred.modelAgreement01>=0 && pred.modelAgreement01<=1);

const beforeUpdates=ws.p27NeuralWorld.snapshot().world.updates;
ws.observeActionOutcome({action:'explore',before:b,after:c,reward:.72,surprise:.21,at:Date.now()});
assert.equal(ws.worldLearningSnapshot().stats.actionUpdates,1);
assert.equal(ws.p27NeuralWorld.snapshot().world.updates,beforeUpdates+1);
assert.ok(ws.worldModel2.snapshot().learnedTransitions>=2);

const postPred=ws.predictIntegrated('verify',.55,.4);
const restored=ws.worldLearningSnapshot();
const ws2=new WorldSubsystemRuntime();
ws2.worldModel2.restore(ws.worldModel2.snapshot());
ws2.p27NeuralWorld.restore(ws.p27NeuralWorld.snapshot());
ws2.residualWorld.restore(ws.residualWorld.snapshot());
ws2.worldLearningRestore(restored);
const pred2=ws2.predictIntegrated('verify',.55,.4);
assert.ok(Math.abs(pred2.reward01-postPred.reward01)<1e-9);
console.log('BIG_PASS_60_LEARNED_WORLD_FABRIC=PASS');
console.log(JSON.stringify({passiveUpdates:restored.stats.passiveUpdates,actionUpdates:restored.stats.actionUpdates,learnedTransitions:ws.worldModel2.snapshot().learnedTransitions,modelAgreement01:pred.modelAgreement01},null,2));
