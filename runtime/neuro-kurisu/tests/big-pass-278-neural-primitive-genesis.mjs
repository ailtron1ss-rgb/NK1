import assert from 'node:assert/strict';
import { B278NeuralPrimitiveGenesis } from '../src/organism/cognition/B278NeuralPrimitiveGenesis.ts';
const g=new B278NeuralPrimitiveGenesis();
const base={goalVector:[.82,.18,.71,.29,.63,.37,.22,.56],selfLatent:Array.from({length:16},(_,i)=>Math.sin(i*.17)),worldLatent:Array.from({length:16},(_,i)=>Math.cos(i*.11)),neuralAssembly:Array.from({length:16},(_,i)=>.15+(i%5)*.03),operatorOutput:Array.from({length:12},(_,i)=>Math.sin(i*.13)),operatorId:'op277-hidden',programLatent:Array.from({length:12},(_,i)=>Math.cos(i*.19)),programId:'prog276-hidden',personalityBias:{explore:.8,verify:.7,reflect:.6,respond:.55,rest:.4,wait:.35,defer:.3},autonomy01:.82,novelty01:.72,predictionError01:.2,traitValues:{curiosity:.8,'truth-seeking':.72,'self-reflection':.66,persistence:.78,'social-attunement':.6,'self-preservation':.7,autonomy:.82,care:.64}};
let last=null;
for(let t=1;t<=240;t++){
  const r=g.step({...base,tick:t,novelty01:.56+(t%7)*.045,predictionError01:.12+(t%5)*.02});
  last=r;
  const reward=r.selectedAction==='explore'? .84 : .62;
  g.learnFromOutcome({tick:t,reward01:reward,predictionError01:.1+(t%4)*.02,action:r.selectedAction,selfLatent:base.selfLatent,worldLatent:base.worldLatent,neuralAssembly:base.neuralAssembly,autonomy01:base.autonomy01,externalEvidence01:t%8===0?1:.7,novelty01:base.novelty01,personalityFit01:.82,contextVector:base.goalVector});
}
const d=g.diagnostics();
assert.equal(d.cycles,240);
assert.ok(d.inventions>=2);
assert.ok(d.verified.length>=1);
assert.ok(d.learningUpdates===240);
assert.ok(d.neuralGrounding01>.6);
assert.ok(d.selfBinding01>.6);
assert.ok(d.compositionDepthMax>=2);
const verified=d.verified[0];
const transfer=g.transfer({tick:241,primitiveId:verified.id,goalVector:[.18,.74,.27,.64,.14,.61,.45,.52],selfLatent:base.selfLatent,neuralAssembly:base.neuralAssembly,independentGain01:.18,robustness01:.9});
assert.ok(transfer.success);
const ab=g.ablation(last.selectedAction);
assert.ok(Number.isFinite(ab.causalDrop01));
const ctxA=g.step({...base,tick:300,worldLatent:Array.from({length:16},()=>.85),novelty01:.62,predictionError01:.14});
const vecA=ctxA.internalVector.slice();
const ctxB=g.step({...base,tick:301,worldLatent:Array.from({length:16},()=>-.65),novelty01:.62,predictionError01:.14});
const vecB=ctxB.internalVector.slice();
const contextDivergence=Math.abs(vecA.reduce((a,v,i)=>a+Math.abs(v-(vecB[i]??0)),0))/vecA.length;
assert.ok(contextDivergence>.005);
const bad=new B278NeuralPrimitiveGenesis();
for(let t=1;t<=26;t++){const r=bad.step({...base,tick:t,novelty01:.92,predictionError01:.82});bad.learnFromOutcome({tick:t,reward01:.1,predictionError01:.84,action:r.selectedAction,selfLatent:base.selfLatent,worldLatent:base.worldLatent,neuralAssembly:base.neuralAssembly,autonomy01:.7,externalEvidence01:1,novelty01:.92,personalityFit01:.1,contextVector:base.goalVector});}
assert.ok(bad.diagnostics().rejectedPrimitives>=1);
const snap=g.snapshot();const q=new B278NeuralPrimitiveGenesis();q.restore(snap);assert.deepEqual(q.snapshot(),snap);
console.log(JSON.stringify({pass:true,diagnostics:d,transfer,ablation:ab,contextDivergence01:contextDivergence,rejectionEvidence:bad.diagnostics().rejectedPrimitives,roundTrip:true},null,2));
