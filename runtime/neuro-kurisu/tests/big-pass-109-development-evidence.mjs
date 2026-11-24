import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

const engine=new P36AutonomousSelfDevelopmentEngine();
const state={tick:42,predictionError:.62,selfPredictionError:.55,autonomyScore:.68,attentionBudget:.81,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.58,socialNeed:.2,novelty:.4,identityCoherence:.82,goalPressure:.4}};
const h=engine.propose(state,{worldError01:.61,selfError01:.54,relationship01:.3,resourceRisk01:.2});
assert.ok(h);
const preview=engine.runSafeExperiment(h.id,state,11);
assert.ok(preview);
assert.equal(preview?.evidenceGate,'sandbox-preview');
assert.equal(engine.snapshot().acceptedChanges,0);

for(const [context,holdout,delay] of [['c1',false,1000],['c2',false,2000],['c3',true,3000],['c4',true,4000],['c5',true,5000],['c6',true,6000]]) {
  engine.recordExternalEvidence({hypothesisId:h.id,contextKey:context,control01:.50,treatment01:.59,independentVerified:true,holdout,delayMs:delay,evaluatorVersion:'external-v1',evidenceSource:'external-evaluator',protocolId:'dev-protocol-1',sessionId:'dev-session-1',at:100+context.charCodeAt(1)});
}
const report=engine.developmentEvidence(h.id);
const result=engine.snapshot();
assert.equal(report.length,6);
assert.equal(result.acceptedChanges,1);
assert.equal(result.hypotheses[0].evidenceGate,'replicated');
assert.ok(result.curriculum.completedSteps>=1);
const gate=engine.recordExternalEvidence({hypothesisId:h.id,contextKey:'c7',control01:.50,treatment01:.59,independentVerified:true,holdout:true,delayMs:7000,evaluatorVersion:'external-v1',evidenceSource:'external-evaluator',protocolId:'dev-protocol-1',sessionId:'dev-session-1',at:200});
assert.equal(result.acceptedChanges,1);
assert.equal(gate.promoted,false);
console.log('BIG_PASS_109_DEVELOPMENT_EVIDENCE=PASS',JSON.stringify({evidence:report.length,acceptedChanges:result.acceptedChanges,gate:result.hypotheses[0].evidenceGate,mastery:result.curriculum.mastery[h.area],ci:[gate.ci95Low01,gate.ci95High01]}));
