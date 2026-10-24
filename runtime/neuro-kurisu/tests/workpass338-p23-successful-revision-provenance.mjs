import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { VersionedSkillCandidateStore, InMemorySkillStorePersistence } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { evaluateSkillLearnBenchTrial } from '../src/organism/learning/SkillLearnBenchAdapter.ts';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const trustedKeys = new Map([['verifier-v1', publicKey.export({ type: 'spki', format: 'pem' }).toString()]]);
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const manifest = Array.from({ length: 10 }, (_, i) => ({
  taskId: 'task-' + i,
  family: i < 5 ? 'memory' : 'tool-use',
  split: 'holdout',
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('unique prompt ' + i),
  verifierId: 'verifier-v1',
  version: 'v1',
}));

function recordSigned(ledger, taskId, method, seed, passed, attempt = 1) {
  const task = manifest.find(entry => entry.taskId === taskId);
  const payload = {
    schemaVersion: 1,
    artifactId: `artifact-${taskId}-${method}-${seed}-${attempt}`,
    runId: `run-${method}-${seed}`,
    manifestFingerprint: ledger.manifestFingerprint(),
    taskId,
    taskVersion: task.version,
    method,
    seed,
    attempt,
    passed,
    verifierId: task.verifierId,
    observedAt: Date.now(),
  };
  return ingestSignedOutcomeArtifact(
    ledger,
    manifest,
    signOutcomePayloadForFixture(payload, privateKeyPem),
    trustedKeys,
  );
}

const ledger = new VerifiedOutcomeLedger(manifest);
for (let seed = 1; seed <= 5; seed++) {
  for (let i = 0; i < manifest.length; i++) {
    for (const [method, passed] of [['baseline', i < 6], ['candidate', i < 8]]) {
      assert.equal(recordSigned(ledger, 'task-' + i, method, seed, passed).accepted, true);
    }
  }
}
const proposal = proposeVerifiedSkillPromotion(ledger, 'baseline', 'candidate', {
  minPairedTasks: 8,
  minAbsoluteGain: 0.1,
  minCompleteSeeds: 3,
});
assert.equal(proposal.gate.accepted, true, 'fixture must be backed by authenticated, accepted learning evidence');

const report = (taskId, trialId, profile) => {
  const strong = profile === 'strong';
  const weak = profile === 'weak';
  const expectedStepIds = ['inspect', 'reason', 'verify'];
  return evaluateSkillLearnBenchTrial({
    taskId,
    trialId,
    verifierPassed: !weak,
    skill: {
      requiredCapabilityIds: ['inspect', 'reason', 'verify'],
      coveredCapabilityIds: strong ? ['inspect', 'reason', 'verify'] :
        weak ? ['inspect'] : ['inspect', 'reason'],
      executable: true,
      safetyViolationCount: 0,
    },
    trajectory: {
      expectedStepIds,
      observedStepIds: strong ? expectedStepIds :
        weak ? ['verify', 'inspect'] : ['inspect', 'unexpected-step', 'reason', 'verify'],
    },
  });
};
const makeEvaluation = profile => ({
  validation: [report('validation-a', 'validation-a-trial', profile), report('validation-b', 'validation-b-trial', profile)],
  holdout: [report('holdout-a', 'holdout-a-trial', profile), report('holdout-b', 'holdout-b-trial', profile)],
});
const baseline = makeEvaluation('baseline');
const sourceEvaluation = makeEvaluation('weak');
const freshEvaluation = makeEvaluation('strong');
const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');

const engine = new P23LearningEngine();
const store = new VersionedSkillCandidateStore(new InMemorySkillStorePersistence());
engine.configureVerifiedSkillLifecycle(store);
const source = store.stageCandidate(proposal, 'skill-successful-repair', { instructions: 'version one' });
const sourceFitness = engine.evaluateReflectiveSkillCandidate(baseline, sourceEvaluation);
const sourcePlan = engine.planReflectiveSkillRevision(sourceEvaluation, sourceFitness);
assert.equal(sourcePlan.blockedBySafety, false);
assert.ok(sourcePlan.targets.length > 0, 'the original candidate must have evidence-backed repair targets');

let generatorCalled = false;
const result = await engine.generateAndStageReflectiveSkillRevision(
  proposal,
  'skill-successful-repair',
  source.candidateId,
  baseline,
  sourceEvaluation,
  async request => {
    generatorCalled = true;
    assert.ok(request.targets.length > 0, 'generator receives the original evidence-backed repair targets');
    assert.equal(request.holdoutGeneralization.requiresFreshIndependentEvaluation, true);
    return { instructions: 'version two repaired' };
  },
  async ({ payload, payloadFingerprint }) => {
    assert.deepEqual(payload, { instructions: 'version two repaired' });
    return {
      payloadFingerprint,
      evaluationFingerprint: digest(freshEvaluation),
      evaluation: structuredClone(freshEvaluation),
    };
  },
);
assert.equal(generatorCalled, true);
assert.equal(result.candidate.status, 'staged');
assert.equal(result.fitness.eligible, true, 'the fresh candidate independently improves on baseline');
assert.ok(result.plan.targets.length > 0, 'returned plan identifies what the generator was asked to repair');
assert.equal(result.postRevisionPlan.targets.length, 0, 'post-revision plan correctly reports no remaining performance targets');
assert.equal(
  result.candidate.revisionProvenance.planFingerprint,
  digest(sourcePlan),
  'persisted provenance must fingerprint the plan used to generate the candidate, not the empty post-revision plan',
);
assert.deepEqual(
  result.candidate.revisionProvenance.dimensions,
  [...new Set(sourcePlan.targets.map(target => target.dimension))],
  'staged provenance preserves the original repair dimensions even when the fixed candidate has no remaining targets',
);
assert.equal(store.snapshot().candidates.length, 2, 'the repaired candidate is staged as a new version without mutating its source');
console.log('WORKPASS338_P23_SUCCESSFUL_REVISION_PROVENANCE=PASS sourcePlanPreserved=true noRemainingTargetsAccepted=true');
