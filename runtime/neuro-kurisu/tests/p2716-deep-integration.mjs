import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { NeuralExperienceBranch, defaultNeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
import { P2716DeepIntegrationController } from '../src/organism/cognition/P2716DeepIntegrationController.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map((a,i)=>[a,.34+i*.045]));
const input=(task,t)=>Array.from({length:64},(_,k)=> task===0
  ? Math.sin((k+3)*.071+t*.021)*.42+Math.cos(k*.13)*.08
  : Math.cos((k+5)*.083+t*.017)*.40+Math.sin(k*.09)*.10);

const run=(experimental=true,cycles=144)=>{
  const b=new NeuralExperienceBranch();
  b.setExperimentalLayerEnabled(experimental);
  b.setSelfNormalizationStrength(experimental?.45:0);
  b.setCreditDelayProfile(experimental?'balanced':'short');
  for(let t=0;t<cycles;t++){
    const task=t<48?0:t<96?1:0;
    const shift=t===48||t===96;
    const r=b.beforeDecision({
      tick:t+1,input:input(task,t),baseUtilities:utilities,
      predictionError01:shift?.72:(task? .24:.18)+(t%17===0?.20:0),
      novelty01:shift?.84:(task?.54:.28), uncertainty01:shift?.76:(task?.38:.20),
      homeostasis01:.45,identityGap01:task?.30:.16,goalPressure01:task?.48:.36,
      reward01:task?.72:.62,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.17+t*.014)+task*.18)
    });
    b.afterOutcome({
      tick:t+1,action:actions[t%actions.length],reward01:task?.78:.74,
      predictionError01:shift?.74:(t%19===0?.42:.16),verified01:t%5===0?1:.82,
      nextInput:input(task,t+1),holdout01:t%3===0?1:0,goalPressure01:task?.48:.36,
      identityGap01:task?.30:.16,identityVector:Array.from({length:16},(_,k)=>Math.sin(k*.17+(t+1)*.014)+task*.18)
    });
  }
  return {b,d:b.diagnostics()};
};

const base=defaultNeuralExperienceBranch();
assert.equal(base. version,25);
assert.deepEqual(base.deepIntegration.delayHorizonTicks,[1,2,4,8,16,32,64,128]);
assert.equal(base.deepIntegration.externalValidation01,0);

const ctrl=new P2716DeepIntegrationController(96);
for(let t=1;t<=96;t++) ctrl.beforeDecision({tick:t,uncertainty01:.35,novelty01:t%11===0?.78:.24,predictionError01:t%13===0?.72:.18,identityGap01:.18,goalPressure01:.35,computeBudget01:.82,worldConfidence01:.71,selfContinuity01:.82,policyInformationGain01:.45,experimentValue01:.56,baseUtilities:utilities});
for(let t=1;t<=96;t++) ctrl.afterOutcome({tick:t,reward01:.72,predictionError01:t%17===0?.45:.14,verified01:.9,causalCredit01:.68,latentResidual01:.22,policyInformationGain01:.44,experimentValue01:.55,replayCredit01:.34,selfPredictionError01:.18,identityContinuity01:.82,worldPredictionError01:.20,neuralBefore:new Array(96).fill(.12),neuralAfter:new Array(96).fill(.14),action:'respond',goalPressure01:.35,novelty01:.28,uncertainty01:.32});
const cm=ctrl.metrics();
assert.ok(cm.outcomes===96);
assert.ok(cm.creditSourceEma.some(x=>x>0));
assert.equal(cm.delayLadder.length,8);
assert.ok(Math.abs(cm.delayConsensus01)<=1);
assert.ok(cm.internalReadiness01>=0);
ctrl.recordExternalValidation({matchedControl01:0,ablation01:0,counterfactual01:0,continual01:0,longHorizon01:0,persistence01:0,mobile01:0});
assert.equal(ctrl.metrics().promotionEligible,false);

const started=performance.now();
const exp=run(true), ctl=run(false); const elapsed=performance.now()-started;
const ew=exp.d.edgeWeights.flat(),cw=ctl.d.edgeWeights.flat();
const diff=ew.reduce((s,x,i)=>s+Math.abs(x-(cw[i]??0)),0);
assert.ok(diff>.05,`deep integration trajectory did not diverge: ${diff}`);
assert.ok(exp.d.deepIntegration.outcomes===144);
assert.ok(exp.d.deepIntegration.creditSourceEma.some(x=>x>.01));
assert.ok(exp.d.deepIntegration.protectedMass01>.15);
assert.ok(exp.d.deepIntegration.delayLadder.length===8);
assert.ok(exp.d.deepIntegration.phaseConfidence01>=0 && exp.d.deepIntegration.phaseConfidence01<=1);
assert.ok(exp.d.deepIntegration.hotPathCadence>=1);
assert.ok(elapsed<15000,`144-cycle paired deep integration run too slow: ${elapsed.toFixed(1)}ms`);

console.log(`P2716_DEEP_INTEGRATION=PASS outcomes=${exp.d.deepIntegration.outcomes} phase=${exp.d.deepIntegration.phase} phaseConfidence=${exp.d.deepIntegration.phaseConfidence01.toFixed(4)} learningScale=${exp.d.deepIntegration.learningScale01.toFixed(4)} protection=${exp.d.deepIntegration.protectedMass01.toFixed(4)} delayConsensus=${exp.d.deepIntegration.delayConsensus01.toFixed(4)} taskShift=${exp.d.deepIntegration.taskShift01.toFixed(4)} diff=${diff.toFixed(4)} elapsedMs=${elapsed.toFixed(1)}`);
