import { B284NeuralAutobiographicalIdentityCore } from '../src/organism/cognition/B284NeuralAutobiographicalIdentityCore.ts';
const core=new B284NeuralAutobiographicalIdentityCore();
for(let t=1;t<=360;t++){
  const phase=t%60;
  const self=Array.from({length:24},(_,i)=>Math.sin(i*.19+phase*.08));
  const world=Array.from({length:16},(_,i)=>Math.cos(i*.17+phase*.03));
  const goal=Array.from({length:8},(_,i)=>Math.sin(i*.41+phase*.05));
  const memory=Array.from({length:16},(_,i)=>Math.cos(i*.23+phase*.06));
  core.step({tick:t,selfLatent:self,worldLatent:world,goalVector:goal,memoryLatent:memory,reward01:t%47===0?.78:.62,predictionError01:.12,agency01:.8,learningEnabled:true,personalityLedgerEnabled:false});
}
const d=core.diagnostics();
const context=Array.from({length:24},(_,i)=>Math.sin(i*.31+2.2));
const recall=core.symbolicLedgerFreeRecall(context);
const ablation=core.ablateIdentityContext(context);
if(d.steps!==360) throw new Error('wrong step count');
if(d.episodeCount!==192) throw new Error(`unexpected bounded episode count ${d.episodeCount}`);
core.reviseIdentity('new-value', 0.92);
const afterRevision=core.diagnostics();
if(afterRevision.identityRevision<1) throw new Error('identity never revised');
if(ablation<=0.01) throw new Error(`weak neural identity causal effect ${ablation}`);
console.log(JSON.stringify({ok:true,d,recall,ablation}));
