import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

const state=()=>({tick:1,at:1,predictionError:.26,selfPredictionError:.21,autonomyScore:.64,attentionBudget:.78,lastAction:'none',predictedNextAction:'respond',lastPredictionConfidence:.5,worldContextVersion:1,needs:{energy:.84,cognitiveLoad:.22,uncertainty:.46,socialNeed:.38,novelty:.44,identityCoherence:.86,goalPressure:.32}});

const e=new P36AutonomousSelfDevelopmentEngine();
let s=state();
for(let i=0;i<3;i++) e.beginCycle();
const h=e.propose(s,{worldError01:.32,selfError01:.24});
assert.ok(h);
const c=e.beginAutonomousDevelopmentCycle({hypothesisId:h.id,origin:'autonomous-gap',requestedAction:'verify',requiredContexts:3,requiredPositiveDelays:2,requiredHoldout:4});
assert.ok(c);
for(let i=0;i<8;i++) e.recordExternalEvidence({hypothesisId:h.id,contextKey:`ctx-${i%3}`,control01:.52,treatment01:.72,independentVerified:true,holdout:i>=4,delayMs:i%2?6000:1000,evaluatorVersion:'b196-r1',evidenceSource:'external-evaluator',protocolId:'b196-developmental-gate',trialId:`t-${i}` ,at:100+i});
const certEvidence=e.developmentEvidence(h.id);
assert.equal(certEvidence.length,8);
const diag=e.diagnostics();
assert.ok(diag.externalEvidence>=8);
assert.ok(['holdout-verified','replicated'].includes(certEvidence.length>=8 ? e.snapshot().hypotheses.find(x=>x.id===h.id).evidenceGate : 'insufficient'));

for(let i=0;i<12;i++){ e.beginCycle(); e.observeDevelopmentalOutcome({area:'learning',outcome01:.82,verified:true,delayed:true,transfer:true,at:1000+i}); }
const maturity=e.developmentalCertification();
assert.equal(maturity.stage,'stable');
assert.equal(maturity.verifiedOutcomeCount,12);
assert.equal(maturity.retainedOutcomeCount,12);
assert.equal(maturity.transferredOutcomeCount,12);
assert.ok(maturity.certified);
const restored=new P36AutonomousSelfDevelopmentEngine();
restored.restore(e.snapshot());
assert.deepEqual(restored.snapshot(),e.snapshot());
assert.deepEqual(restored.developmentalCertification(),maturity);
console.log(`BIG_PASS_196_MATURITY=PASS stage=${maturity.stage} score=${maturity.score01.toFixed(3)} verified=${maturity.verifiedOutcomeCount} retained=${maturity.retainedOutcomeCount} transferred=${maturity.transferredOutcomeCount}`);
