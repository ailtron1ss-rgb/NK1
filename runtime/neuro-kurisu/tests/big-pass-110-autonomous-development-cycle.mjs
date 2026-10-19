import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

const engine=new P36AutonomousSelfDevelopmentEngine();
const state={tick:7,predictionError:.71,selfPredictionError:.41,autonomyScore:.64,attentionBudget:.78,needs:{energy:.84,cognitiveLoad:.22,uncertainty:.66,socialNeed:.25,novelty:.48,identityCoherence:.79,goalPressure:.42}};
const h=engine.propose(state,{worldError01:.68,selfError01:.45,relationship01:.32,resourceRisk01:.18});
assert.ok(h);
const cycle=engine.beginAutonomousDevelopmentCycle({hypothesisId:h.id,origin:'autonomous-gap',objective:h.hypothesis,requestedAction:'verify'});
assert.ok(cycle);
assert.equal(engine.snapshot().acceptedChanges,0);
assert.equal(engine.developmentTaskRequest()?.requestedAction,'verify');
assert.ok(engine.developmentTaskBias('verify')>engine.developmentTaskBias('respond'));
engine.noteDevelopmentTaskIssued(h.id);
assert.equal(engine.developmentTaskRequest()?.issuedTasks,1);
const preview=engine.runSafeExperiment(h.id,state,9);
assert.ok(preview);
assert.equal(engine.snapshot().acceptedChanges,0);
for(const [i,delay] of [1000,2000,4000,8000,16000,32000].entries()){
  engine.recordExternalEvidence({hypothesisId:h.id,contextKey:`ctx-${i<3?'a':i<5?'b':'c'}`,control01:.50,treatment01:.59,independentVerified:true,holdout:i>=2,delayMs:delay,evaluatorVersion:'real-evaluator-v1',evidenceSource:'external-evaluator',protocolId:'protocol-real-1',sessionId:'session-real-1',trialId:`trial-${i}`,at:1000+i});
}
const snap=engine.snapshot();
assert.equal(snap.acceptedChanges,1);
assert.equal(snap.hypotheses[0].evidenceGate,'replicated');
assert.equal(snap.developmentCycles[0].stage,'replicated');
const second=engine.recordExternalEvidence({hypothesisId:h.id,contextKey:'ctx-c',control01:.50,treatment01:.59,independentVerified:true,holdout:true,delayMs:64000,evaluatorVersion:'real-evaluator-v1',evidenceSource:'external-evaluator',protocolId:'protocol-real-1',sessionId:'session-real-1',trialId:'trial-6',at:2000});
assert.equal(second.promoted,false);
assert.equal(engine.snapshot().acceptedChanges,1);
console.log('BIG_PASS_110_AUTONOMOUS_DEVELOPMENT=PASS',JSON.stringify({cycleStage:engine.snapshot().developmentCycles[0].stage,acceptedChanges:engine.snapshot().acceptedChanges,evidence:engine.snapshot().externalEvidence.length,request:engine.developmentTaskRequest()}));
