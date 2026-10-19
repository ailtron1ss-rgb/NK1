import { SubjectContinuityFabric } from '../src/organism/cognition/SubjectContinuityFabric.ts';
const f=new SubjectContinuityFabric();
const calm=f.build({tick:1,at:1,identity01:.9,identityConservation01:.95,memoryContinuity01:.9,autobiographicalContinuity01:.85,causalContinuity01:.82,grounding01:.9,realityAlignment01:.9,workspace01:.85,crossModalAgreement01:.9,unresolved01:.05,epistemicIntegrity01:.9,agency01:.7,energy01:.85,cognitiveCapacity01:.88,predictionError01:.1,novelty01:.2,goalPressure01:.2,externalInput:false,activeModalities:['vision','world']});
if(calm.bottleneck01<.65||calm.nonConsciousnessClaim!==true) throw new Error('healthy convergence failed');
const confused=f.build({...calm,tick:2,identity01:.9,identityConservation01:.9,memoryContinuity01:.9,autobiographicalContinuity01:.8,causalContinuity01:.3,grounding01:.3,realityAlignment01:.25,workspace01:.3,crossModalAgreement01:.2,unresolved01:.8,epistemicIntegrity01:.35,predictionError01:.8,externalInput:true,goalPressure01:.8});
if(!['pulse','investigate'].includes(confused.resolution)||confused.bottleneck01>=calm.bottleneck01) throw new Error('bottleneck resolution failed');
console.log('PASS subject continuity');
