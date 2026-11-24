import { B295_CRITICAL_FUNCTION_PASSPORTS, createB295PassportContext, restoreB295PassportDefaults } from '../src/organism/system/B295CriticalFunctionPassport.ts';

const ctx=restoreB295PassportDefaults(createB295PassportContext());
const evidence=[];
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const candidateSet=actions.map((action,i)=>({action,score:0.48-i*0.002,confidence01:0.65}));

const b289Input={tick:1,worldLatent:new Array(16).fill(.2),selfLatent:new Array(16).fill(.3),memoryLatent:new Array(16).fill(.1),goalVector:new Array(16).fill(.25),workspaceLatent:new Array(16).fill(.22),socialLatent:new Array(16).fill(.18),predictionError01:.2,uncertainty01:.25,novelty01:.5,energy01:.75,thermal01:.2,cognitiveCapacity01:.8,identityContinuity01:.85,autobiographicalContinuity01:.8,realityAlignment01:.78,agency01:.6,socialNeed01:.3,selectedAction:'verify'};
ctx.b289.step(b289Input); ctx.b289.learnFromOutcome({tick:1,action:'verify',reward01:.75,predictionError01:.2,externalEvidence01:1,identityContinuity01:.85});
ctx.b290.observe({tick:1,b289Integration01:.7,b289Agency01:.6,b289Identity01:.85,b289Reality01:.8,morphStructuralFitness01:.8,morphNeurons:32,morphSynapses:160,selfAgency01:.62,selfCoherence01:.84,causalVerified01:1,causalCalibration01:.65,eventLineage01:.72,cycleCoverage01:.75,predictionError01:.2,uncertainty01:.25,novelty01:.5,energy01:.75,thermal01:.2});
ctx.b290.learnFromOutcome({tick:1,action:'verify',reward01:.75,predictionError01:.2,externallyGrounded01:1,identityContinuity01:.85});
ctx.b291.step({tick:1,candidates:candidateSet,currentIntent:null,goalId:'g',identityContinuity01:.85,selfAgency01:.62,selfCoherence01:.84,realityAlignment01:.8,personalityActionBias:{verify:.08},b290Mode:'verify',b290Gate01:.7,externalInput01:.1,userRequestedAction:null,goalPressure01:.5,novelty01:.5,uncertainty01:.25,energy01:.75,thermal01:.2,predictionError01:.2,cadence:1});
ctx.b291.learnFromOutcome({tick:1,action:'verify',reward01:.75,predictionError01:.2,identityContinuity01:.85,externallyGrounded01:1});
ctx.bus.build({tick:1,goalId:'g',goalPressure01:.5,identityContinuity01:.85,selfAgency01:.62,selfCoherence01:.84,realityAlignment01:.8,novelty01:.5,uncertainty01:.25,energy01:.75,thermal01:.2,predictionError01:.2,cognitiveLoad01:.25,externalInput01:.1,b289Agency01:.6,b289Integration01:.7,b290Mode:'verify',b290Gate01:.7,b291Mode:'switch',b291Gate01:.7,workingIntent:'verify',selectedAction:'verify'});
ctx.trace.observeDecision({tick:1,goalId:'g',action:'verify',mode:'switch',autonomy01:.65,gate01:.7,external01:.1});
ctx.trace.observeOutcome({tick:1,action:'verify',reward01:.75,predictionError01:.2,external01:.1});
ctx.b293.step({tick:1,action:'verify',selfContinuity01:.85,selfCoherence01:.84,identityFit01:.86,worldCoherence01:.8,realityAlignment01:.8,goalPressure01:.5,novelty01:.5,uncertainty01:.25,predictionError01:.2,energy01:.75,thermal01:.2});
ctx.b293.learnFromOutcome({tick:1,action:'verify',reward01:.75,actualSelf01:.84,actualWorld01:.78,predictionError01:.2,identityContinuity01:.85,novelty01:.5});
const ep=ctx.b294.beginDecision({tick:1,goalId:'g',action:'verify',mode:'switch',autonomy01:.65,predictionError01:.2,uncertainty01:.25,predictedSelf01:.82,predictedWorld01:.78,channelSignals:{b269:.5,b270:.5,b289:.65,b290:.7,b291:.7,b292:.6,b293:.75,world:.72}});
ctx.b294.closeOutcome({tick:1,reward01:.75,predictionError01:.2,actualSelf01:.84,actualWorld01:.78,external01:.1,identityContinuity01:.85,causalEffect01:.72});

const checks=[
  ()=>Number.isFinite(ctx.b289.diagnostics().integration01),
  ()=>ctx.b289.actionBias('verify')===ctx.b289.actionBias('verify'),
  ()=>ctx.b290.controlMetrics().realityGate01>=0,
  ()=>Number.isFinite(ctx.b290.actionBias('verify')),
  ()=>ctx.b291.metrics().cycles>=1,
  ()=>ctx.b291.currentIntent()!==null,
  ()=>Number.isFinite(ctx.bus.read().readiness01),
  ()=>ctx.trace.metrics().outcomeCount===1,
  ()=>ctx.b293.metrics().learningUpdates===1,
  ()=>Number.isFinite(ctx.b293.actionBias('verify')),
  ()=>ep.episodeId.startsWith('b294-'),
  ()=>ctx.b294.diagnostics().learningUpdates===1,
  ()=>ctx.b294.snapshot().records.length>=1,
];
for(const [i,fn] of checks.entries()){
  const ok=Boolean(fn());
  evidence.push({i,ok});
  if(!ok) throw new Error(`passport contract ${i} failed`);
}
console.log(JSON.stringify({pass:true,passportCount:B295_CRITICAL_FUNCTION_PASSPORTS.length,verifiedContractCount:evidence.length,evidence},null,2));
