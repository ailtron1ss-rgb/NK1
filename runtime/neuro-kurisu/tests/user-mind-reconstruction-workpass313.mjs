import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';
import { MotiveEcologyFabric } from '../src/organism/cognition/evolution/MotiveEcologyFabric.ts';
import { P28PlasticitySubstrate } from '../src/organism/learning/P28PlasticitySubstrate.ts';
import { MemoryConsolidationController } from '../src/organism/memory/MemoryConsolidationController.ts';

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

const tetherKernel = new SocialMindKernel();
tetherKernel.observePerson({ id: 'long-term-contact', displayName: 'contact', at: 1000, confidence01: .9, visible01: .9, source: 'interaction' });
const relationshipBeforeOutcome = tetherKernel.person('long-term-contact');
tetherKernel.recordOutcome('long-term-contact', { actualIntent: 'information', outcome01: .9, surprise01: .1, at: 2000, agentAction: 'respond' });
const relationshipAfterOutcome = tetherKernel.person('long-term-contact');
assert.ok(relationshipAfterOutcome.trust01 > relationshipBeforeOutcome.trust01, 'recordOutcome updates must persist to the canonical person state');
assert.ok(relationshipAfterOutcome.warmth01 > relationshipBeforeOutcome.warmth01, 'successful social outcomes must update the canonical warmth state');
assert.ok(relationshipAfterOutcome.relationshipStrength01 > relationshipBeforeOutcome.relationshipStrength01, 'relationship-strength updates must persist after recomputation');
const beforeSleepSnapshot = tetherKernel.snapshot();
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const laterAt = 2000 + thirtyDaysMs;
tetherKernel.observePerson({ id: 'long-term-contact', displayName: 'contact', at: laterAt, confidence01: .9, visible01: .9, source: 'interaction' });
const fadedRelationship = tetherKernel.person('long-term-contact');
assert.ok(fadedRelationship.trust01 < relationshipAfterOutcome.trust01, 'trust should decay gradually toward neutral between sessions');
assert.ok(Math.abs(fadedRelationship.warmth01 - .5) < Math.abs(relationshipAfterOutcome.warmth01 - .5), 'warmth should decay toward neutral between sessions');
assert.ok(fadedRelationship.relationshipStrength01 < relationshipAfterOutcome.relationshipStrength01, 'the relational tether should decay with a trust-adaptive half-life');
const tetherRestored = new SocialMindKernel();
tetherRestored.restore(beforeSleepSnapshot);
tetherRestored.observePerson({ id: 'long-term-contact', displayName: 'contact', at: laterAt, confidence01: .9, visible01: .9, source: 'interaction' });
assert.deepEqual(tetherRestored.person('long-term-contact'), fadedRelationship, 'relational decay should remain deterministic across restart');
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

const originalVector = [1, ...new Array(15).fill(0)];
const nearbyVector = [.8, .6, ...new Array(14).fill(0)];
const vectorCosine = (a, b) => {
  const dot = a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return dot / Math.max(1e-9, normA * normB);
};
const highPlasticity = new P28PlasticitySubstrate();
const lowPlasticity = new P28PlasticitySubstrate();
for (const substrate of [highPlasticity, lowPlasticity]) {
  substrate.observe({ vector: originalVector, modality: 'text', source: 'workpass313', tick: 1, trust01: .9 });
}
highPlasticity.observe({ vector: nearbyVector, modality: 'text', source: 'workpass313', tick: 2, trust01: .9, learningModulation: { entropyFloor01: .7, plasticity01: .8, trustRegionRadius01: .8 } });
lowPlasticity.observe({ vector: nearbyVector, modality: 'text', source: 'workpass313', tick: 2, trust01: .9, learningModulation: { entropyFloor01: .05, plasticity01: .1, trustRegionRadius01: .05 } });
const highVector = highPlasticity.snapshot().prototypes[0].vector;
const lowVector = lowPlasticity.snapshot().prototypes[0].vector;
assert.ok(vectorCosine(highVector, nearbyVector) > vectorCosine(lowVector, nearbyVector), 'higher EILS plasticity with a wider trust region must produce a larger bounded prototype update');
const curious = new P28PlasticitySubstrate();
const baseline = new P28PlasticitySubstrate();
const intermediateVector = [.4, Math.sqrt(.84), ...new Array(14).fill(0)];
curious.observe({ vector: originalVector, modality: 'text', source: 'workpass313', tick: 1, trust01: .9 });
baseline.observe({ vector: originalVector, modality: 'text', source: 'workpass313', tick: 1, trust01: .9 });
curious.observe({ vector: intermediateVector, modality: 'text', source: 'workpass313', tick: 2, trust01: .9, learningModulation: { entropyFloor01: .8, plasticity01: .5, trustRegionRadius01: .5 } });
baseline.observe({ vector: intermediateVector, modality: 'text', source: 'workpass313', tick: 2, trust01: .9 });
assert.equal(curious.snapshot().prototypes.length, 2, 'curiosity entropy floor should preserve additional novel patterns');
assert.equal(baseline.snapshot().prototypes.length, 1, 'default plasticity behavior remains unchanged when no EILS modulation is passed');
const memoryCandidates = Array.from({ length: 20 }, (_, i) => ({
  id: `memory-${i}`, salience01: .7, novelty01: .6, predictionError01: .4,
  uncertainty01: .5, outcome01: .7, recency01: .8,
}));
const consolidation = new MemoryConsolidationController();
const awakeBatch = consolidation.rank(memoryCandidates, { batchSize: 12, pressure01: .5, awake01: 1 });
const sleepBatch = consolidation.rank(memoryCandidates, { batchSize: 4, pressure01: .5, awake01: 0 });
assert.equal(awakeBatch.length, 4, 'active cycles must keep the consolidation batch small');
assert.equal(sleepBatch.length, 12, 'sleep-time cycles can use a larger bounded consolidation batch');
assert.equal(consolidation.diagnostics().awakeBoundedRuns, 1);
assert.equal(consolidation.diagnostics().sleepTimeRuns, 1);
const consolidationRestore = new MemoryConsolidationController();
consolidationRestore.restore(consolidation.snapshot());
assert.equal(consolidationRestore.diagnostics().sleepTimeRuns, 1, 'sleep-time counters must persist across restart');
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
