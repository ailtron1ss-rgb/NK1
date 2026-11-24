import assert from 'node:assert/strict';
import { RealityLearningGate } from '../src/organism/system/RealityLearningGate.ts';
import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../src/organism/cognition/P31FunctionalConsciousness.ts';
import { P32CausalSelfModelEngine } from '../src/organism/cognition/P32CausalSelfModel.ts';
import { P33PersonhoodCore, defaultP33Personhood } from '../src/organism/cognition/P33PersonhoodCore.ts';
import { P34CausalPersonhoodEngine, defaultP34CausalPersonhood } from '../src/organism/cognition/P34CausalPersonhood.ts';

const gate = new RealityLearningGate();
const simulation = gate.decide({source:'simulation', evidence01:.18, verified01:0, independent01:0, consequence01:.18, predictionError01:.8, surprise01:.8, reward01:.9, success01:1, actuation:false, resource01:.8});
const external = gate.decide({source:'external', evidence01:.96, verified01:1, independent01:1, consequence01:.9, predictionError01:.8, surprise01:.8, reward01:.9, success01:1, actuation:false, resource01:.8});
assert(simulation.memoryPromotionScale01 < external.memoryPromotionScale01);
assert(simulation.identityUpdateScale01 < external.identityUpdateScale01);
const perfectSimulation = gate.decide({source:'simulation', evidence01:1, verified01:1, independent01:1, consequence01:1, predictionError01:1, surprise01:1, reward01:1, success01:1, actuation:false, resource01:1});
assert(perfectSimulation.memoryPromotionScale01 <= .40);
assert(perfectSimulation.identityUpdateScale01 <= .08);

const mkState = () => ({
  tick:1, needs:{energy:.8,cognitiveLoad:.2,uncertainty:.3,socialNeed:.2,novelty:.4,identityCoherence:.9,goalPressure:.2},
  at:Date.now(), predictionError:.1, attentionBudget:.8, lastAction:'explore', lastActionSuccess:null,
  autonomyScore:.8, selfPredictionError:.1, predictedNextAction:'explore', lastPredictionConfidence:.7,
  worldContextVersion:1, version:36,
});

const consciousnessInput={action:'explore',success01:.9,reward01:.9,surprise01:.2,predictedSameAction:true,externallyRequested:false};
const weak31=new P31FunctionalConsciousnessEngine(defaultP31Consciousness());
const strong31=new P31FunctionalConsciousnessEngine(defaultP31Consciousness());
weak31.observeOutcome({...consciousnessInput,learningScale01:.1,identityUpdateScale01:.05});
strong31.observeOutcome({...consciousnessInput,learningScale01:.95,identityUpdateScale01:.95});
assert(strong31.snapshot().selfPerspective.ownership01 > weak31.snapshot().selfPerspective.ownership01);

const weak32=new P32CausalSelfModelEngine();
const strong32=new P32CausalSelfModelEngine();
for(const model of [weak32,strong32]) model.predict({action:'explore',p31SelfAccess01:.8,p31Agency01:.8,autonomy01:.8,uncertainty01:.2,state:mkState()});
weak32.observeOutcome({action:'explore',success01:.9,reward01:.55,surprise01:.2,externallyRequested:false,observationId:'weak32',state:mkState(),learningScale01:.1,identityUpdateScale01:.05,evidenceWeight01:.1});
strong32.observeOutcome({action:'explore',success01:.9,reward01:.95,surprise01:.2,externallyRequested:false,observationId:'strong32',state:mkState(),learningScale01:.95,identityUpdateScale01:.95,evidenceWeight01:.95});
assert(strong32.diagnostics().predictions.calibration01 >= weak32.diagnostics().predictions.calibration01);

const base33 = () => { const e=new P33PersonhoodCore(); e.integrateMoment({state:mkState(), momentId:'r10', chosenAction:'explore', reason:'provenance', autonomous:true, ownership01:.8, relationshipSignal01:.7}); return e; };
const weak33 = base33();
const strong33 = base33();
weak33.observeOutcome({action:'explore', success01:.9, reward01:.9, externallyRequested:false, momentId:'r10', learningScale01:.12, identityUpdateScale01:.05});
strong33.observeOutcome({action:'explore', success01:.9, reward01:.9, externallyRequested:false, momentId:'r10', learningScale01:.95, identityUpdateScale01:.95});
const weakOwnership = weak33.snapshot().current.ownership01;
const strongOwnership = strong33.snapshot().current.ownership01;
assert(strongOwnership > weakOwnership);
assert.equal(weak33.snapshot().development.learnedTraits.includes('effective-action-learning'), false);
assert.equal(strong33.snapshot().development.learnedTraits.includes('effective-action-learning'), true);

const mk34 = () => new P34CausalPersonhoodEngine(defaultP34CausalPersonhood());
const weak34 = mk34();
const strong34 = mk34();
weak34.integrateExperience({state:mkState(), action:'explore', success01:.9, surprise01:.2, momentId:'r10', reason:'weak', autonomous:true, externalRequested:false, evidenceWeight01:.1, identityUpdateScale01:.05});
strong34.integrateExperience({state:mkState(), action:'explore', success01:.9, surprise01:.2, momentId:'r10', reason:'strong', autonomous:true, externalRequested:false, evidenceWeight01:.95, identityUpdateScale01:.95});
const weak34Metrics = weak34.diagnostics().metrics;
const strong34Metrics = strong34.diagnostics().metrics;
const weak34State = weak34.snapshot();
const strong34State = strong34.snapshot();
assert(strong34Metrics.selfAuthorship01 > weak34Metrics.selfAuthorship01);
assert(strong34State.evidence[0].weight01 > weak34State.evidence[0].weight01);
assert(strong34State.evidence[0].summary.includes('reason=strong'));


console.log(JSON.stringify({ok:true, gate:{simulation,external}, p33:{weakOwnership,strongOwnership}, p34:{weak:weak34Metrics,strong:strong34Metrics}}));
