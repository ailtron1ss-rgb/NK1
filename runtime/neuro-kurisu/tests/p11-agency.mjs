import assert from 'node:assert/strict';
import { SelfGovernanceEngine } from '../src/organism/cognition/evolution/SelfGovernanceEngine.ts';
import { FutureSelfModel } from '../src/organism/cognition/evolution/FutureSelfModel.ts';

const governance = new SelfGovernanceEngine();
const candidates = [
  {id:'a',goalId:'g1',action:'verify',score:.62,predictedUtility:.62,predictedNeedRelief:.2,predictedCost:.3,confidence:.7,generatedAt:1},
  {id:'b',goalId:'g2',action:'respond',score:.61,predictedUtility:.61,predictedNeedRelief:.1,predictedCost:.2,confidence:.8,generatedAt:1},
  {id:'c',goalId:'g3',action:'rest',score:.50,predictedUtility:.50,predictedNeedRelief:.3,predictedCost:.1,confidence:.7,generatedAt:1},
];
const goals = [{id:'g1',title:'verify a scientific project',reason:'intrinsic',source:'intrinsic',status:'active',importance:.9,urgency:.8,confidence:.7,progress:.2,createdAt:1,updatedAt:1}];
const influenced = governance.influence(candidates,'respond',goals,.85,.2);
assert.equal(influenced[0].action,'verify');
const record = governance.recordDecision({requestedAction:'respond',chosenAction:'verify',autonomous:true,internalPressure:.85,commitmentPressure:.72,regretPressure:.2,reason:'active scientific commitment'});
assert.ok(record.overrideStrength > 0);
const consequence = governance.recordConsequence({action:'verify',expectedReward:.75,actualReward:.42,counterfactualBest:.86,source:'scientific-project'});
assert.ok(consequence.regret > .3);
assert.ok(governance.snapshot().consequenceOwnership > 0);

const self = new FutureSelfModel();
const state={version:13,tick:10,at:10,needs:{energy:.7,cognitiveLoad:.3,uncertainty:.6,socialNeed:.2,novelty:.4,identityCoherence:.8,goalPressure:.5},predictionError:.2,attentionBudget:.7,lastAction:'verify',lastActionSuccess:.4,autonomyScore:.4,selfPredictionError:.2,predictedNextAction:'verify',lastPredictionConfidence:.7,worldContextVersion:2};
self.forecast(state,goals,'verify',.8,4);
assert.equal(self.resolve('verify'),0);
self.forecast(state,goals,'explore',.8,4);
assert.ok(self.resolve('verify') > 0);
assert.ok(self.snapshot().futureIdentityCoherence < 1);
console.log(`P11_AGENCY=PASS governance=${governance.snapshot().governanceScore.toFixed(3)} regret=${consequence.regret.toFixed(3)} futureMismatch=${self.snapshot().lastMismatch.toFixed(3)}`);
