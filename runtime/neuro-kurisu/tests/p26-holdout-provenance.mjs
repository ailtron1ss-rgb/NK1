import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const mkState=(energy=.42)=>({
  version:29,tick:1,at:0,
  needs:{energy,cognitiveLoad:.3,uncertainty:.4,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.25},
  predictionError:.2,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
  selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
});
const engine=new P26TrueLearningEngine();
const state=mkState();
const replay=engine.replay([{state,action:'verify',reward:.9,nextState:mkState(.5),surprise:.8}]);
assert.equal(replay.updates,1);
assert.equal(engine.metrics().generalizationEvidence01,0,'parameter updates alone are not generalization evidence');
assert.ok(engine.metrics().trainingExposure01>0,'training exposure should be tracked separately');

engine.recordHoldout(.4,.8);
assert.equal(engine.metrics().generalizationEvidence01,0,'legacy diagnostic has no independent provenance');
const weak=engine.recordVerifiedHoldout({evidenceId:'e0',taskId:'task-a',protocolId:'v1',verifierId:'oracle-a',sampleSetHash:'sha-a',baseline01:.4,learned01:.8,verified:false,independent:true});
assert.equal(weak.accepted,false,'unverified holdout must be rejected');
assert.equal(engine.metrics().generalizationEvidence01,0);

const evidence={evidenceId:'e1',taskId:'task-a',protocolId:'frozen-v1',verifierId:'oracle-a',sampleSetHash:'sha-a',baseline01:.4,learned01:.8,verified:true,independent:true};
assert.equal(engine.recordVerifiedHoldout(evidence).accepted,true);
assert.equal(engine.metrics().independentHoldoutSamples,1);
assert.equal(engine.metrics().generalizationEvidence01,.05);
assert.equal(engine.recordVerifiedHoldout(evidence).reason,'duplicate-holdout-evidence','duplicate evidence must not inflate maturity');
assert.equal(engine.metrics().independentHoldoutSamples,1);

const restored=new P26TrueLearningEngine();
restored.restore(engine.snapshot());
assert.equal(restored.metrics().generalizationEvidence01,.05,'independent evidence count should survive persistence');
assert.equal(restored.recordVerifiedHoldout(evidence).accepted,false,'duplicate guard should survive persistence');
console.log('P26_HOLDOUT_PROVENANCE=PASS',JSON.stringify({trainingExposure01:restored.metrics().trainingExposure01,generalizationEvidence01:restored.metrics().generalizationEvidence01,independentHoldoutSamples:restored.metrics().independentHoldoutSamples}));
