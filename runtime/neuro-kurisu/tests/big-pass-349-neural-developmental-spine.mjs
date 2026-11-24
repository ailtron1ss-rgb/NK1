import assert from 'node:assert/strict';
import { B349NeuralDevelopmentalSpine } from '../src/organism/system/B349NeuralDevelopmentalSpine.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const spine=new B349NeuralDevelopmentalSpine();
const base={tick:1,candidates:actions,b269Assembly:Array(48).fill(0),b269Plasticity01:.65,b289Latent:Array(24).fill(0),b289Integration01:.72,b293PredictedSelf01:.72,b293PredictedWorld01:.71,b293PredictionError01:.18,b294CausalConfidence01:.78,b296ActionBias:Object.fromEntries(actions.map(a=>[a,0])),b296Agency01:.70,identityContinuity01:.82,goalPressure01:.64,novelty01:.45,uncertainty01:.20,energy01:.80,learningEnabled:true,externalInput01:0};
const before=spine.step(base);
assert(Number.isFinite(before.neuralContribution01));
const baselineBias=before.actionBias.verify;
for(let tick=2;tick<=80;tick++){
  spine.learnFromOutcome({tick,action:'verify',reward01:.95,predictionError01:.10,verified01:1,independent01:1,autonomous01:1});
  spine.step({...base,tick});
}
const after=spine.step({...base,tick:81});
assert(spine.diagnostics().learningUpdates>0);
assert(after.actionBias.verify>baselineBias || spine.diagnostics().actionWeights.verify>0);
const lateBefore=spine.applyLateResidency(actions,.9).biasByAction.verify;
for(let tick=82;tick<=160;tick++) spine.learnFromOutcome({tick,action:'verify',reward01:.95,predictionError01:.08,verified01:1,independent01:1,autonomous01:1});
spine.step({...base,tick:161});
const lateAfter=spine.applyLateResidency(actions,.9).biasByAction.verify;
assert(lateAfter>lateBefore);
const snap=spine.snapshot();
const restored=new B349NeuralDevelopmentalSpine();
restored.restore(snap);
assert.deepEqual(restored.snapshot(),snap);
// Backward-compatible restore: legacy B349 state has no residency fields.
const legacy=JSON.parse(JSON.stringify(snap));
delete legacy.lateResidencyUpdates; delete legacy.lateResidencyChanges; delete legacy.lastLateResidencyAction; delete legacy.lastLateResidencyBias01;
const legacyRestored=new B349NeuralDevelopmentalSpine(); legacyRestored.restore(legacy);
const residency=legacyRestored.applyLateResidency(actions,.9);
assert(Number.isFinite(legacyRestored.diagnostics().lateResidencyUpdates));
assert(Number.isFinite(residency.strongestBias01));

const report={pass:true,baselineVerifyBias:baselineBias,afterVerifyBias:after.actionBias.verify,verifyWeight:restored.diagnostics().actionWeights.verify,learningUpdates:restored.diagnostics().learningUpdates,causalGain01:restored.diagnostics().lastNeuralContribution01,lateResidencyBefore:lateBefore,lateResidencyAfter:lateAfter};
console.log(JSON.stringify(report,null,2));
