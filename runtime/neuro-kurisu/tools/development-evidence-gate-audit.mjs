import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

const state={tick:7,predictionError:.6,selfPredictionError:.5,autonomyScore:.7,attentionBudget:.8,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.55,socialNeed:.2,novelty:.4,identityCoherence:.85,goalPressure:.3}};
const e=new P36AutonomousSelfDevelopmentEngine();
const h=e.propose(state,{worldError01:.6,selfError01:.5,relationship01:.3,resourceRisk01:.2});
assert.ok(h);
const preview=e.runSafeExperiment(h.id,state,3);
assert.equal(preview?.evidenceGate,'sandbox-preview');
assert.equal(e.snapshot().acceptedChanges,0);
for(const [ctx,holdout,delay] of [['a',false,1000],['b',false,2000],['c',true,3000],['d',true,4000],['e',true,5000],['f',true,6000]]) e.recordExternalEvidence({hypothesisId:h.id,contextKey:ctx,control01:.5,treatment01:.6,independentVerified:true,holdout,delayMs:delay,evaluatorVersion:'audit-ext-v1',evidenceSource:'external-evaluator'});
const s=e.snapshot();
assert.equal(s.acceptedChanges,1);
assert.equal(s.hypotheses[0].evidenceGate,'replicated');
console.log('DEVELOPMENT_EVIDENCE_GATE_AUDIT=PASS',JSON.stringify({checks:4,acceptedChanges:s.acceptedChanges,gate:s.hypotheses[0].evidenceGate}));
