import {B2518PersistentSelfWorldModel} from '../src/organism/cognition/B2518PersistentSelfWorldModel.ts';
import {B2519LongHorizonCounterfactualPlanner} from '../src/organism/cognition/B2519LongHorizonCounterfactualPlanner.ts';
import {B2520SensorimotorImagination} from '../src/organism/cognition/B2520SensorimotorImagination.ts';
const A=['respond','explore','verify','rest','reflect','wait','defer']; const U=Object.fromEntries(A.map(a=>[a,.5]));
const m=new B2518PersistentSelfWorldModel(),p=new B2519LongHorizonCounterfactualPlanner(),s=new B2520SensorimotorImagination();
for(let t=1;t<=180;t++){
 const latent=Array.from({length:64},(_,i)=>((i*13+t*7)%101)/100);
 m.beforeDecision({tick:t,latent,baseUtilities:U,uncertainty01:.45,predictionError01:.25});
 p.beforeDecision({tick:t,baseUtilities:U,uncertainty01:.45,predictionError01:.25,goalPressure01:.7,modelConfidence01:.75,computeBudget01:.8});
 s.beforeDecision({tick:t,bodyEnergy01:.75,thermal01:.2,sensoryFreshness01:.85,uncertainty01:.45,baseUtilities:U,planningBias:p.diagnostics().actionBias});
 const a=A[t%7],reward=a==='verify'?.82:.44,error=a==='verify'?.12:.3,verified=a==='verify'?1:0;
 m.afterOutcome({tick:t,latent,nextLatent:latent.map(x=>Math.min(1,x+.01)),action:a,reward01:reward,predictionError01:error,verified01:verified,selfContinuity01:.88,worldStability01:.86});
 p.afterOutcome({tick:t,action:a,reward01:reward,predictionError01:.25,verified01:verified});
 s.afterOutcome({tick:t,reward01:.55,predictionError01:.2,verified01:1});
}
const md=m.diagnostics(),pd=p.diagnostics(),sd=s.diagnostics(),ml=m.lesion(.5),pl=p.lesion(.5),sl=s.lesion(.5);
if(md.learningUpdates<100||md.transitions<100||pd.rollouts<4000||pd.learningUpdates<100||sd.imaginations<1000)throw Error('insufficient learning');
if(ml.causalDrop01<=0||pl.causalDrop01<=0||sl.causalDrop01<=0)throw Error('no causal effect');
console.log('B2518_2520_UNIFIED_SELF_WORLD_PASS',JSON.stringify({m:{learning:md.learningUpdates,transitions:md.transitions,confidence:md.confidence01},p:{rollouts:pd.rollouts,learning:pd.learningUpdates,confidence:pd.planningConfidence01,horizon:pd.horizon},s:{imaginations:sd.imaginations,learning:sd.learningUpdates,reliability:sd.sensorimotorReliability01},lesions:{m:ml.causalDrop01,p:pl.causalDrop01,s:sl.causalDrop01}}));
