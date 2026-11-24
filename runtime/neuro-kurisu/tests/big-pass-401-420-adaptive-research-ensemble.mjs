import assert from 'node:assert/strict';
import { B401B420AdaptiveCognitiveResearchCore } from '../src/organism/system/B401B420AdaptiveCognitiveResearchCore.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const base=(i)=>({tick:i,context01:Array.from({length:8},(_,j)=>.10+((i*29+j*13)%82)/100),baseProbabilities:Object.fromEntries(actions.map((a,j)=>[a,j===1?.30:j===2?.19:.102])),baseUtilities:Object.fromEntries(actions.map((a,j)=>[a,j===1?.78:j===2?.72:.43+j*.012])),reward01:i%9===0?.16:.82,surprise01:i%11===0?.78:.14,novelty01:.42+(i%7)*.06,uncertainty01:.34+(i%5)*.07,predictionError01:i%9===0?.66:.12,goalVector:[.75,.68,.58,.44,.82,.36,.41,.52],selfVector:[.70,.65,.60,.46,.78,.39,.45,.50],retrievedMemoryStrength01:.52,motivation01:.61});
const c=new B401B420AdaptiveCognitiveResearchCore();
for(let i=1;i<=240;i++){
  const input=base(i); const out=c.beforeDecision(input); assert.equal(Object.keys(out.actionBias).length,7); assert.ok(out.confidence01>=0&&out.confidence01<=1);
  if(i%2===0)c.afterOutcome({tick:i,action:i%5===0?'verify':(i%3===0?'reflect':'explore'),context01:input.context01,nextContext01:input.context01.map((x,j)=>Math.max(0,Math.min(1,x+(j===0?-.03:.015)))),reward01:input.reward01,surprise01:input.surprise01,verified01:1,salience01:.68,predictionError01:input.predictionError01});
}
const d=c.diagnostics();
assert.ok(d.diagnostics.decisions>=240);assert.ok(d.diagnostics.updates>=120);assert.ok(d.prototypes.length>=100);assert.ok(Object.values(d.weights).reduce((a,b)=>a+b,0)>.99);
assert.ok(d.diagnostics.bestVariant);assert.ok(d.diagnostics.lastEnsembleDiversity01>=0);
const holdout=base(999);holdout.context01=[.94,.08,.87,.21,.79,.35,.91,.72];
const memory=c.evaluateLesion(holdout,{memory:true}); const latent=c.evaluateLesion(holdout,{latent:true}); const stateSpace=c.evaluateLesion(holdout,{stateSpace:true}); const controller=c.evaluateLesion(holdout,{controller:true});
assert.ok(memory.delta01>.0001);assert.ok(latent.delta01>.00001);assert.ok(stateSpace.delta01>.00001);
c.markHoldout(.74);
const snap=c.snapshot(); const r=new B401B420AdaptiveCognitiveResearchCore();r.restore(snap);r.markRestart();
assert.deepEqual(r.diagnostics().weights,d.weights);assert.equal(r.diagnostics().prototypes.length,d.prototypes.length);assert.equal(r.diagnostics().diagnostics.decisions,d.diagnostics.decisions);assert.equal(r.diagnostics().diagnostics.restartCount,1);
console.log(JSON.stringify({pass:true,status:'B401_B420_ADAPTIVE_RESEARCH_ENSEMBLE_PASS',decisions:d.diagnostics.decisions,updates:d.diagnostics.updates,prototypes:d.prototypes.length,retrievals:d.diagnostics.retrievals,bestVariant:d.diagnostics.bestVariant,weights:d.weights,diversity01:d.diagnostics.lastEnsembleDiversity01,uncertainty01:d.diagnostics.lastUncertainty01,memoryLesion01:memory.delta01,latentLesion01:latent.delta01,stateSpaceLesion01:stateSpace.delta01,controllerLesion01:controller.delta01,restart:1,developmentalGain01:d.diagnostics.developmentalGain01},null,2));
