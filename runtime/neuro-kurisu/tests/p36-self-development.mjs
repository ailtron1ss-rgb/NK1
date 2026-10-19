import assert from 'node:assert/strict';
import { P36AutonomousSelfDevelopmentEngine } from '../src/organism/learning/P36AutonomousSelfDevelopment.ts';

const engine=new P36AutonomousSelfDevelopmentEngine();
const state={version:39,tick:12,at:Date.now(),needs:{energy:.72,cognitiveLoad:.3,uncertainty:.75,socialNeed:.2,novelty:.55,identityCoherence:.82,goalPressure:.4},predictionError:.62,attentionBudget:.82,lastAction:'reflect',lastActionSuccess:.55,autonomyScore:.7,selfPredictionError:.58,predictedNextAction:'reflect',lastPredictionConfidence:.5,worldContextVersion:1};
engine.beginCycle();
const h=engine.propose(state,{worldError01:.7,selfError01:.6,perception01:.4,resourceRisk01:.2});
assert.ok(h,'a developmental hypothesis should be generated');
assert.ok(h.hypothesis.length>20);
const x=engine.runSafeExperiment(h.id,state,7);
assert.ok(x,'safe developmental experiment should run');
assert.equal(x.safeSandbox,true);
assert.ok(Number.isFinite(engine.snapshot().actionBias.reflect));
const d=engine.diagnostics();
assert.ok(d.cycles===1);
assert.ok(d.experiments===1);
assert.ok(d.curriculum.completedSteps>=0);
console.log('P36_SELF_DEVELOPMENT=PASS',JSON.stringify({area:h.area,delta01:x.delta01,acceptedChanges:d.acceptedChanges,focus:d.curriculum.focus}));
