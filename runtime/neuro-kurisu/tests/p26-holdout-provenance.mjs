import assert from 'node:assert/strict';
import { P26TrueLearningEngine } from '../src/organism/learning/P26TrueLearningEngine.ts';

const mkState=(energy=.42)=>({
  version:29,tick:1,at:0,
  needs:{energy,cognitiveLoad:.3,uncertainty:.4,socialNeed:.2,novelty:.5,identityCoherence:.8,goalPressure:.25},
  predictionError:.2,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,
  selfPredictionError:.1,predictedNextAction:'none',lastPredictionConfidence:.5,worldContextVersion:1,
});
const evidence={evidenceId:'e1',taskId:'task-a',protocolId:'frozen-v1',verifierId:'oracle-a',sampleSetHash:'sha-a',baseline01:.4,learned01:.8,verified:true,independent:true};
// The verifier is an explicit deterministic test authority bound to this one fixture.
// The default engine must reject the same caller-supplied flags without an authority.
const verifyFixtureEvidence = candidate =>
  candidate.evidenceId==='e1'&&candidate.taskId==='task-a'&&candidate.protocolId==='frozen-v1'&&
  candidate.verifierId==='oracle-a'&&candidate.sampleSetHash==='sha-a'&&
  candidate.verified===true&&candidate.independent===true;
const defaultDeny = new P26TrueLearningEngine();
assert.equal(defaultDeny.recordVerifiedHoldout(evidence).accepted,false,
  'caller-asserted verified/independent flags are not authority');
assert.equal(defaultDeny.metrics().generalizationEvidence01,0);

const engine=new P26TrueLearningEngine({verifyHoldoutEvidence:verifyFixtureEvidence});
const state=mkState();
const replay=engine.replay([{state,action:'verify',reward:.9,nextState:mkState(.5),surprise:.8}]);
assert.equal(replay.updates,1);
assert.ok(engine.metrics().trainingExposure01>0,'replay updates count as training exposure');
assert.equal(engine.metrics().generalizationEvidence01,0,'parameter updates alone are not generalization evidence');

engine.recordHoldout(.4,.8);
assert.equal(engine.metrics().generalizationEvidence01,0,'legacy diagnostic has no independent provenance');
const weak=engine.recordVerifiedHoldout({evidenceId:'e0',taskId:'task-a',protocolId:'v1',verifierId:'oracle-a',sampleSetHash:'sha-a',baseline01:.4,learned01:.8,verified:false,independent:true});
assert.equal(weak.accepted,false,'unverified holdout must be rejected');
assert.equal(engine.metrics().generalizationEvidence01,0);

assert.equal(engine.recordVerifiedHoldout(evidence).accepted,true);
assert.equal(engine.metrics().independentHoldoutSamples,1);
assert.equal(engine.metrics().generalizationEvidence01,.05);
assert.equal(engine.recordVerifiedHoldout(evidence).reason,'duplicate-holdout-evidence','duplicate evidence must not inflate maturity');
assert.equal(engine.metrics().independentHoldoutSamples,1);

const restored=new P26TrueLearningEngine({verifyHoldoutEvidence:verifyFixtureEvidence});
restored.restore(engine.snapshot());
assert.equal(restored.metrics().generalizationEvidence01,.05,'authenticated evidence count should survive persistence and be reverified');
assert.equal(restored.recordVerifiedHoldout(evidence).reason,'duplicate-holdout-evidence','duplicate guard should survive persistence');
console.log('P26_HOLDOUT_PROVENANCE=PASS',JSON.stringify({trainingExposure01:restored.metrics().trainingExposure01,generalizationEvidence01:restored.metrics().generalizationEvidence01,independentHoldoutSamples:restored.metrics().independentHoldoutSamples}));
