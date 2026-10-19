import { B291UnifiedSelfAgencyGate, defaultB291State } from '../src/organism/system/B291UnifiedSelfAgencyGate.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const gate=new B291UnifiedSelfAgencyGate();
gate.restore(defaultB291State());
let seen=new Set();
for(let tick=1;tick<=600;tick++){
  const external=tick%11===0?1:0;
  const userRequested=external?'respond':null;
  const candidates=actions.map((action,i)=>({action,score:.45+(i===tick%actions.length?.08:0)+(tick%19===0&&action==='verify'?.08:0),confidence01:.65,predictedUtility:.5,personalityBias01:action==='reflect'?.07:0}));
  const r=gate.step({tick,candidates,currentIntent:gate.diagnostics().workingIntent,goalId:'goal-291',identityContinuity01:.78,selfAgency01:.74,selfCoherence01:.81,realityAlignment01:.79,personalityActionBias:Object.fromEntries(actions.map(a=>[a,a==='reflect'?.07:a==='explore'?.03:-.01])),b290Mode:tick%17===0?'verify':'consolidate',b290Gate01:.82,externalInput01:external,userRequestedAction:userRequested,goalPressure01:.64,novelty01:tick%23===0?.85:.35,uncertainty01:tick%29===0?.72:.25,energy01:tick%37===0?.18:.74,thermal01:tick%41===0?.75:.22,predictionError01:tick%17===0?.62:.22,cadence:4});
  seen.add(r.mode);
  gate.learnFromOutcome({tick,action:r.selectedAction,reward01:tick%13===0?.32:.72,predictionError01:tick%17===0?.58:.2,identityContinuity01:.78,externallyGrounded01:external?1:.5});
}
const before=gate.diagnostics();
const intent=gate.currentIntent()??before.selectedAction??'wait';
const baselineBias=gate.actionBias(intent);
const lesioned=gate.lesion(.75);
const lesionedBias=gate.actionBias(intent);
const causalDelta=Math.abs(baselineBias-lesionedBias);
gate.clearLesion();
const snap=gate.snapshot(); const restoredGate=new B291UnifiedSelfAgencyGate(); restoredGate.restore(snap); const restored=restoredGate.diagnostics();
const pass = before.cycles>0 && before.learningUpdates>0 && seen.has('maintain') && seen.has('switch') && seen.has('external') && seen.has('protect') && lesioned.lesions01===.75 && causalDelta>0 && restored.workingIntent===before.workingIntent;
if(!pass) throw new Error('B291 unified self-agency gate verification failed');
console.log(JSON.stringify({pass,cycles:before.cycles,learningUpdates:before.learningUpdates,modes:[...seen],workingIntent:before.workingIntent,autonomyShare01:before.autonomyShare01,gate01:before.gate01,baselineBias,lesionedBias,causalDelta},null,2));
