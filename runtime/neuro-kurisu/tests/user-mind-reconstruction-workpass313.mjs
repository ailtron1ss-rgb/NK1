import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';
import { MotiveEcologyFabric } from '../src/organism/cognition/evolution/MotiveEcologyFabric.ts';

const social = new SocialMindKernel();
const intentEvidence = social.observeText('user', 'Почему это работает? Объясни, пожалуйста.', 1000);
const userStatement = social.recordObservedUserStatement('user', 'The user asked for an explanation', 1050, 0.94);
const actionEvidence = social.recordObservedUserAction('user', 'sent-message', 1100, 0.94);
const otherEvidence = social.observeText('another-person', 'Как это работает?', 1120);

const frame = social.reconstructUserMind({
  personId: 'user',
  at: 1200,
  environment: [{
    claim: 'The runtime believes this feature is available',
    probability01: 0.72,
    confidence01: 0.98,
    evidenceIds: intentEvidence.evidenceIds,
  }],
  observations: [{
    claim: 'The user asked for an explanation',
    confidence01: 0.97,
    evidenceIds: [userStatement.id],
  }, {
    claim: 'The user approved the release',
    confidence01: 0.99,
    evidenceIds: intentEvidence.evidenceIds,
  }],
  beliefs: [
    {
      claim: 'The user may believe the feature is unreliable',
      probability01: 0.61,
      confidence01: 0.88,
      evidenceIds: intentEvidence.evidenceIds,
    },
    {
      claim: 'Unsupported private assumption',
      probability01: 0.99,
      confidence01: 0.99,
      evidenceIds: otherEvidence.evidenceIds,
    },
  ],
  intentions: [{
    kind: 'information-seeking',
    probability01: 0.86,
    confidence01: 0.91,
    evidenceIds: intentEvidence.evidenceIds,
  }],
  actions: [
    { kind: 'sent-message', confidence01: 0.99, evidenceIds: [actionEvidence.id] },
    { kind: 'approved-release', confidence01: 0.99, evidenceIds: [] },
  ],
});

assert.equal(frame.personId, 'user');
assert.equal(frame.environment.length, 1);
assert.equal(frame.environment[0].evidenceStatus, 'evidence-backed-hypothesis');
assert.equal(frame.observations[0].evidenceStatus, 'direct-observation');
assert.ok(frame.observations[0].confidence01 <= 0.94, 'confidence must not exceed the strongest linked observed evidence');
assert.equal(frame.observations[1].evidenceStatus, 'unresolved', 'generic same-person intent evidence must not be mistaken for an exact observation receipt');
assert.ok(frame.observations[1].confidence01 <= 0.2);
assert.equal(frame.observations[1].evidenceStatus, 'unresolved', 'generic same-person intent evidence must not be mistaken for an exact observation receipt');
assert.ok(frame.observations[1].confidence01 <= 0.2);
assert.equal(frame.beliefs[0].evidenceStatus, 'evidence-backed-hypothesis');
assert.equal(frame.beliefs[1].evidenceStatus, 'unresolved', 'evidence from another person must not ground this user model');
assert.ok(frame.beliefs[1].confidence01 <= 0.2, 'unsupported belief must remain low-confidence');
assert.equal(frame.intentions[0].evidenceStatus, 'evidence-backed-hypothesis');
assert.equal(frame.actions[0].observed, true, 'an action is observed only with exact action evidence');
assert.equal(frame.actions[1].observed, false, 'intent or guess must not be promoted into an observed action');
assert.ok(frame.missingEvidence.includes('action-evidence-missing'));
assert.ok(frame.grounding01 > 0 && frame.grounding01 < 1);

const restored = new SocialMindKernel();
restored.restore(social.snapshot());
assert.deepEqual(restored.userMindFrame('user'), frame, 'reconstruction must survive snapshot/restore');
assert.throws(() => social.reconstructUserMind({ personId: '', at: -1 }), /valid personId and timestamp/);

const motive = new MotiveEcologyFabric();
const common = {
  intrinsic: { epistemic: .6, novelty: .5, competence: .6, coherence: .7, social: .5, homeostatic: .5, overall: .6 },
  values: { curiosity: .6, truth: .8, autonomy: .7, evidence: .8, care: .7, responsibility: .8, social: .6 },
  socialNeed01: .45, socialTrust01: .7, socialPredictionError01: .2,
  selfConsistency01: .8, noveltyPressure01: .5, agency01: .7,
  developmental: { phase: 'stable', revisionReadiness01: .4, identityPressure01: .2, counterEvidencePressure01: .2, integrity01: .85 },
};
const lowStress = motive.evaluate({
  ...common, goalPressure01: .15, uncertainty01: .2, predictionError01: .15, energy01: .9, cognitiveConflict01: .1,
});
const highStress = motive.evaluate({
  ...common, goalPressure01: .8, uncertainty01: .9, predictionError01: .9, energy01: .1, cognitiveConflict01: .8,
});
assert.ok(highStress.eilsSignals.stress01 > lowStress.eilsSignals.stress01);
assert.ok(highStress.learningModulation.plasticity01 > lowStress.learningModulation.plasticity01);
assert.ok(lowStress.learningModulation.trustRegionRadius01 > highStress.learningModulation.trustRegionRadius01);
assert.ok(highStress.actionBiases.verify >= lowStress.actionBiases.verify);
assert.ok(highStress.actionBiases.rest >= lowStress.actionBiases.rest);

console.log(JSON.stringify({
  pass: true,
  workpass: 313,
  userMind: {
    grounding01: frame.grounding01,
    missingEvidence: frame.missingEvidence,
    observedAction: frame.actions[0].observed,
    unsupportedAction: frame.actions[1].observed,
  },
  eils: {
    lowStress: lowStress.eilsSignals,
    highStress: highStress.eilsSignals,
    lowPlasticity: lowStress.learningModulation.plasticity01,
    highPlasticity: highStress.learningModulation.plasticity01,
  },
}));
