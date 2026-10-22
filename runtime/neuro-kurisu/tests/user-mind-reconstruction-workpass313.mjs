import assert from 'node:assert/strict';
import { SocialMindKernel } from '../src/organism/cognition/SocialMindKernel.ts';
import { MotiveEcologyFabric } from '../src/organism/cognition/evolution/MotiveEcologyFabric.ts';
import { P28PlasticitySubstrate } from '../src/organism/learning/P28PlasticitySubstrate.ts';
import { MemoryConsolidationController } from '../src/organism/memory/MemoryConsolidationController.ts';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { SelfModelEngine } from '../src/organism/cognition/SelfModelV2.ts';

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
const selfModel = new SelfModelEngine();
const selfBefore = selfModel.snapshot();
const ungroundedSelfUpdate = selfModel.learnGoalOutcome({ action: 'explore', goalAlignment01: .9, reward01: .9, tick: 1 });
assert.equal(ungroundedSelfUpdate.identityUpdateAccepted, false, 'unbound outcome must not update high-level self-beliefs');
assert.equal(selfModel.snapshot().agencyBelief, selfBefore.agencyBelief, 'agency belief remains stable without independent evidence');
assert.equal(selfModel.snapshot().identityCoherence, selfBefore.identityCoherence, 'identity coherence remains stable without independent evidence');
assert.notEqual(selfModel.snapshot().selfConsistentAction11.explore, selfBefore.selfConsistentAction11.explore, 'action-level preference can still learn from the bounded reward');
assert.equal(selfModel.snapshot().identityGateRejectedCount, 1);
const correlatedSelfUpdate = selfModel.learnGoalOutcome({ action: 'explore', goalAlignment01: .95, reward01: .95, tick: 2, evidence: { verified: true, independent: false, source: 'world-transition', evidenceRef: 'world-transition:correlated' } });
assert.equal(correlatedSelfUpdate.identityUpdateAccepted, false, 'verified but non-independent evidence cannot revise identity');
assert.equal(selfModel.snapshot().identityGateRejectedCount, 2);
const groundedSelfUpdate = selfModel.learnGoalOutcome({ action: 'verify', goalAlignment01: .9, reward01: .9, tick: 3, evidence: { verified: true, independent: true, source: 'world-transition', evidenceRef: 'world-transition:trace-3:tick-3' } });
assert.equal(groundedSelfUpdate.identityUpdateAccepted, true, 'verified independent outcome bound to a receipt may update high-level self-beliefs');
assert.equal(selfModel.snapshot().identityGateAcceptedCount, 1);
assert.equal(selfModel.snapshot().lastIdentityGate.reason, 'verified-independent-outcome-bound');
const memDoctor = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
const doctorAt = Date.now();
memDoctor.encode({
  id: 'doctor-healthy-record', content: 'Unique memory doctor fixture record.', kind: 'semantic',
  source: 'workpass313-memory-doctor', tags: [], context: {}, salience: .6, emotionalWeight: .1,
  identityRelevance: .2, goalRelevance: .3, socialRelevance: .1, predictionError: .1,
  confidence: .9, epistemicStatus: 'fact', entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  contradictionLinks: [], validFromAt: doctorAt - 1000, observedAt: doctorAt - 500,
});
const healthyDoctor = memDoctor.doctor({ at: doctorAt });
assert.equal(healthyDoctor.pass, true, 'a clean canonical memory snapshot should pass doctor');
assert.equal(healthyDoctor.issueCount, 0, 'a clean snapshot should not report memory hygiene issues');
const damagedMemorySnapshot = memDoctor.snapshot();
damagedMemorySnapshot.items[0].contentHash = 'not-the-canonical-content-hash';
damagedMemorySnapshot.items[0].semanticLinks = ['missing-memory-doctor-target'];
damagedMemorySnapshot.items[0].supersedesId = 'missing-memory-revision';
damagedMemorySnapshot.items[0].observedAt = doctorAt + 3_600_000;
const damagedMemory = new MemoryOS2({ signalFusionProfile: 'balanced', embeddingProvider: null });
damagedMemory.restore(damagedMemorySnapshot);
const doctorReport = damagedMemory.doctor({ at: doctorAt });
assert.equal(doctorReport.readOnly, true, 'doctor must never repair or rewrite memory automatically');
assert.equal(doctorReport.pass, false, 'content hash inconsistency should fail doctor');
assert.ok(doctorReport.counts.hashMismatch > 0, 'doctor should detect altered canonical content hashes');
assert.ok(doctorReport.counts.danglingRevision > 0, 'doctor should detect unresolved revision pointers');
assert.ok(doctorReport.counts.danglingLinks > 0, 'doctor should detect unresolved relationship links');
assert.ok(doctorReport.counts.futureEvidence > 0, 'doctor should detect future-dated evidence');
assert.ok(doctorReport.issues.length <= 64, 'doctor output must remain bounded');
const cappedDoctor = damagedMemory.doctor({ at: doctorAt, maxIssues: 1 });
assert.equal(cappedDoctor.issues.length, 1, 'doctor must cap detailed issue payloads');
assert.equal(cappedDoctor.errors, 1, 'severity counters must include issues beyond the display cap');
assert.ok(cappedDoctor.warnings > 0, 'warning counters must include issues beyond the display cap');
assert.equal(cappedDoctor.truncated, true, 'doctor must mark a capped issue list as truncated');
assert.equal(damagedMemory.snapshot().items[0].contentHash, 'not-the-canonical-content-hash', 'read-only doctor must not mutate the record it reports');
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
