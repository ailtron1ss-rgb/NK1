import assert from 'node:assert/strict';
import { NeuralPlasticityBenchmarkSuite } from '../src/organism/system/NeuralPlasticityBenchmarkSuite.ts';
import { NeuralMemoryContinuityCore } from '../src/organism/system/NeuralMemoryContinuityCore.ts';
import { B296NeuralPersonalityAgencyNucleus } from '../src/organism/system/B296NeuralPersonalityAgencyNucleus.ts';
const suite=new NeuralPlasticityBenchmarkSuite();
const report=suite.run();
assert(report.overall01>0);
assert(report.multiTimescale.trainedRecall01>report.multiTimescale.ablatedRecall01);
assert(report.sequence.order01>=.99); assert(report.lesionRecovery.structuralDamage01>.45);
assert(report.falseMemory.unverifiedPromoted===false);
const m=new NeuralMemoryContinuityCore(); let prev=null;
for(let i=0;i<6;i++){const e=m.encode({tick:i+1,context:[i%2,.2,.8,.4],action:'verify',reward01:.8,predictionError01:.2,verified01:.9,novelty01:.5,source:'test',sequenceKey:'S',predecessorId:prev,protected01:.8});prev=e.id;}
assert.equal(m.sequenceRecall('S').order01,1); m.consolidate(10,.8); const snap=m.snapshot(); const m2=new NeuralMemoryContinuityCore(); m2.restore(snap); assert.equal(m2.diagnostics().causalLinks,m.diagnostics().causalLinks);
const n=new B296NeuralPersonalityAgencyNucleus(); for(let i=0;i<24;i++){n.step({tick:i+1,currentAction:'verify',b269Assembly:[.2,.8,.3],b270SelfLatent:[.4,.6],b289Latent:[.5,.2],b291Agency01:.7,b291IdentityFit01:.8,b291PersonalityFit01:.7,b293PredictedSelf01:.6,b293PredictedWorld01:.6,b293PredictionError01:.2,b294CausalConfidence01:.8,b295Budget01:.8,novelty01:.4,uncertainty01:.2,energy01:.8,goalPressure01:.6});n.learnFromOutcome({tick:i+1,action:'verify',reward01:.9,predictionError01:.2,identityContinuity01:.8,causalConfidence01:.85,externalEvidence01:1});}
const before=n.diagnostics().activeSynapses; const lesion=n.lesion(.5); assert(lesion.disabledSynapses>0); assert(n.diagnostics().activeSynapses<before); n.clearLesion(); assert.equal(n.diagnostics().activeSynapses,before);
console.log(JSON.stringify({ok:true,report,diagnostics:m2.diagnostics(),lesion}));
