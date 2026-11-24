import { B284NeuralAutobiographicalIdentityCore } from '../src/organism/cognition/B284NeuralAutobiographicalIdentityCore.ts';

const clamp=(x)=>Math.max(0,Math.min(1,x));
const core=new B284NeuralAutobiographicalIdentityCore();
const self=Array.from({length:24},(_,i)=>Math.sin(i*.37));
const world=Array.from({length:16},(_,i)=>Math.cos(i*.21));
const goal=Array.from({length:8},(_,i)=>Math.sin(i*.51+.3));
const memory=Array.from({length:16},(_,i)=>Math.cos(i*.31+.5));
const personality=Array.from({length:16},(_,i)=>((i%5)/5)-.4);
for(let tick=1;tick<=260;tick++){
  const reward=clamp(.5+.22*Math.sin(tick*.11)+(tick%37===0?.18:0));
  core.step({tick,selfLatent:self,worldLatent:world,goalVector:goal,memoryLatent:memory,personalityVector:personality,relationshipVector:self,reward01:reward,predictionError01:Math.abs(.5-reward)*.8,agency01:.72,learningEnabled:true,personalityLedgerEnabled:true});
}
const d=core.diagnostics();
const ctx=Array.from({length:24},(_,i)=>Math.sin(i*.27+1.1));
const recallWithLedger=core.symbolicLedgerFreeRecall(ctx);
const snapshot=core.snapshot();
const noLedger=new B284NeuralAutobiographicalIdentityCore();
noLedger.restore(snapshot);
const recallAfterRestart=noLedger.symbolicLedgerFreeRecall(ctx);
const ablation=core.ablateIdentityContext(ctx);
if(d.learningUpdates<240) throw new Error(`learning updates too low: ${d.learningUpdates}`);
if(d.autobiographicalContinuity01<0.55) throw new Error(`continuity too low: ${d.autobiographicalContinuity01}`);
if(d.identityStability01<0.55) throw new Error(`identity stability too low: ${d.identityStability01}`);
if(d.traitSpread01<0.002) throw new Error(`traits did not differentiate: ${d.traitSpread01}`);
if(Math.abs(recallWithLedger-recallAfterRestart)>1e-9) throw new Error('restart mismatch');
if(ablation<=0.01) throw new Error(`identity ablation too weak: ${ablation}`);
console.log(JSON.stringify({ok:true,d,recallWithLedger,recallAfterRestart,ablation}));
