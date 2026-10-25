import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { P23CompoundRepairRevisionCoordinator } from '../src/organism/learning/P23CompoundRepairRevisionCoordinator.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const evidence = [{
  skillId: 'skill-a', skillName: 'fallback', failureFingerprint: 'fp-a', stepId: 'step-1',
  failedTool: 'primary', diagnosis: 'verified failure', contextSignature: 'ctx-a',
  candidateTools: ['fallback'], selectedTool: 'fallback', verified: true, confidence01: .9,
  observedAt: 10, revisionEligible: true,
}];
let providerCalls = 0;
let stagedCalls = 0;
let received = null;
const runtime = {
  compoundSkillRepairEvidence: () => evidence,
  generateCompoundSkillRevision: async input => {
    stagedCalls++;
    received = input;
    return { candidate: { candidateId: 'candidate-staged-1' }, repairEvidenceCount: input.skillId === 'skill-a' ? 1 : 0 };
  },
};
const engine = { generateAndStageReflectiveSkillRevision() {} };
const coordinator = new P23CompoundRepairRevisionCoordinator(runtime, engine, async input => {
  providerCalls++;
  assert.equal(input.skillId, 'skill-a');
  assert.deepEqual(input.repairFingerprints, ['fp-a']);
  assert.equal(input.repairEvidence[0].selectedTool, 'fallback');
  return {
    proposal: { authentic: true },
    sourceCandidateId: 'source-candidate-1',
    baseline: { validation: [], holdout: [] },
    candidateEvaluation: { validation: [], holdout: [] },
    generate: async request => ({ generatedFrom: request.optimizerInstruction }),
    evaluateRevisedCandidate: async input => ({ payloadFingerprint: input.payloadFingerprint, evaluationFingerprint: 'a'.repeat(64), evaluation: { validation: [], holdout: [] } }),
  };
});
const result = await coordinator.reviseFromObservedRepairs('skill-a');
assert.equal(result.status, 'candidate-staged');
assert.equal(result.candidateId, 'candidate-staged-1');
assert.equal(providerCalls, 1);
assert.equal(stagedCalls, 1);
assert.equal(received.sourceCandidateId, 'source-candidate-1');
assert.match(received.sourceEvidenceFingerprint, /^[a-f0-9]{64}$/,
  'exact eligible repair evidence digest must accompany the staging request');

// WorkPass293: the identical eligible repair evidence must never stage again.
const repeated = await coordinator.reviseFromObservedRepairs('skill-a');
assert.equal(repeated.status, 'already-staged-for-evidence');
assert.equal(repeated.evidenceDigest.length, 64);
assert.equal(providerCalls, 1, 'repeated evidence must not rerun the expensive provider');
assert.equal(stagedCalls, 1, 'repeated evidence must not duplicate the candidate');

// WorkPass222: the coordinator itself snapshots provider-owned evidence, even if
// the provider is not wrapped by withIndependentCandidateEvaluation.
let retainedInputs;
let snapshotReceived;
const snapshotRuntime = {
  compoundSkillRepairEvidence: () => evidence,
  generateCompoundSkillRevision: async input => {
    snapshotReceived = input;
    return { candidate: { candidateId: 'snapshot-candidate' }, repairEvidenceCount: 1 };
  },
};
const snapshotCoordinator = new P23CompoundRepairRevisionCoordinator(
  snapshotRuntime,
  engine,
  async () => {
    retainedInputs = {
      proposal: { metadata: { label: 'original-proposal' } },
      baseline: { validation: [{ taskId: 'baseline-v1' }], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      options: { attempt: 1 },
    };
    setTimeout(() => {
      retainedInputs.proposal.metadata.label = 'mutated-proposal';
      retainedInputs.baseline.validation[0].taskId = 'mutated-baseline';
      retainedInputs.options.attempt = 99;
    }, 0);
    return {
      ...retainedInputs,
      sourceCandidateId: 'snapshot-source',
      generate: async () => ({ generated: true }),
      evaluateRevisedCandidate: async input => ({ payloadFingerprint: input.payloadFingerprint, evaluationFingerprint: 'b'.repeat(64), evaluation: { validation: [], holdout: [] } }),
    };
  },
);
await snapshotCoordinator.reviseFromObservedRepairs('skill-a');
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(snapshotReceived.proposal.metadata.label, 'original-proposal',
  'provider-retained proposal references must not mutate staged revision evidence');
assert.equal(snapshotReceived.baseline.validation[0].taskId, 'baseline-v1',
  'provider-retained baseline references must not mutate staged baseline evidence');
assert.equal(snapshotReceived.options.attempt, 1,
  'provider-retained options must not mutate staged revision configuration');
const missingEvaluatorCoordinator = new P23CompoundRepairRevisionCoordinator(runtime, engine, async () => ({
  proposal: { authentic: true },
  sourceCandidateId: 'source-candidate-1',
  baseline: { validation: [], holdout: [] },
  candidateEvaluation: { validation: [], holdout: [] },
  generate: async () => ({ generated: true }),
}));
await assert.rejects(
  () => missingEvaluatorCoordinator.reviseFromObservedRepairs('skill-a'),
  /incomplete proposal\/evaluation\/generator inputs/,
  'provider cannot stage a generated revision without a fresh independent evaluator',
);

const noEvidenceRuntime = {
  compoundSkillRepairEvidence: () => [{ ...evidence[0], revisionEligible: false }],
  generateCompoundSkillRevision: async () => { throw new Error('must not stage without eligible evidence'); },
};
const noEvidenceCoordinator = new P23CompoundRepairRevisionCoordinator(
  noEvidenceRuntime,
  engine,
  async () => { throw new Error('provider must not run without eligible evidence'); },
);
assert.deepEqual(await noEvidenceCoordinator.reviseFromObservedRepairs('skill-a'), {
  status: 'no-eligible-repair-evidence', skillId: 'skill-a', repairEvidenceCount: 0,
});
assert.throws(() => coordinator.reviseFromObservedRepairs('   '), /compound skill id is required/);
// Exercise the public runtime entry point without constructing unrelated Core subsystems.
const runtimeFacade = Object.create(OrganismRuntime.prototype);
runtimeFacade.initialized = true;
runtimeFacade.compoundRepairRevisionCoordinator = {
  reviseFromObservedRepairs: async id => ({ status: 'no-eligible-repair-evidence', skillId: id, repairEvidenceCount: 0 }),
};
runtimeFacade.enqueue = work => work();
runtimeFacade.journal = { write: async () => {} };
assert.deepEqual(await runtimeFacade.reviseCompoundSkillsFromObservedRepairs('skill-empty'), {
  status: 'no-eligible-repair-evidence', skillId: 'skill-empty', repairEvidenceCount: 0,
});
runtimeFacade.compoundRepairRevisionCoordinator = null;
await assert.rejects(
  () => runtimeFacade.reviseCompoundSkillsFromObservedRepairs('skill-empty'),
  /compound-repair-revision-provider-not-configured/,
);
runtimeFacade.initialized = false;
await assert.rejects(
  () => runtimeFacade.reviseCompoundSkillsFromObservedRepairs('skill-empty'),
  /organism-runtime-not-initialized/,
);


const mutableEvidence = [{ ...evidence[0] }];
let staleStageCalls = 0;
const staleRuntime = {
  compoundSkillRepairEvidence: () => mutableEvidence,
  generateCompoundSkillRevision: async () => {
    staleStageCalls++;
    throw new Error('stale evidence must never reach candidate staging');
  },
};
const staleCoordinator = new P23CompoundRepairRevisionCoordinator(
  staleRuntime,
  engine,
  async () => {
    // Preserve count and failure fingerprint while changing the actual evidence payload.
    mutableEvidence[0] = { ...mutableEvidence[0], diagnosis: 'changed after snapshot' };
    return {
      proposal: { authentic: true },
      sourceCandidateId: 'source-candidate-1',
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ generated: true }),
      evaluateRevisedCandidate: async input => ({ payloadFingerprint: input.payloadFingerprint, evaluationFingerprint: 'a'.repeat(64), evaluation: { validation: [], holdout: [] } }),
    };
  },
);
await assert.rejects(
  () => staleCoordinator.reviseFromObservedRepairs('skill-a'),
  /compound repair evidence changed while trusted revision inputs were being prepared/,
);
assert.equal(staleStageCalls, 0, 'mutated evidence must be rejected before candidate staging');

// Concurrent invocations for the same skill coalesce into one evaluation and stage.
let releaseProvider;
const providerBarrier = new Promise(resolve => { releaseProvider = resolve; });
let concurrentProviderCalls = 0;
let concurrentStageCalls = 0;
const concurrentRuntime = {
  compoundSkillRepairEvidence: () => evidence,
  generateCompoundSkillRevision: async () => {
    concurrentStageCalls++;
    return { candidate: { candidateId: 'concurrent-candidate' }, repairEvidenceCount: 1 };
  },
};
const concurrentCoordinator = new P23CompoundRepairRevisionCoordinator(
  concurrentRuntime,
  engine,
  async () => {
    concurrentProviderCalls++;
    await providerBarrier;
    return {
      proposal: { authentic: true },
      sourceCandidateId: 'concurrent-source',
      baseline: { validation: [], holdout: [] },
      candidateEvaluation: { validation: [], holdout: [] },
      generate: async () => ({ generated: true }),
      evaluateRevisedCandidate: async input => ({ payloadFingerprint: input.payloadFingerprint, evaluationFingerprint: 'c'.repeat(64), evaluation: { validation: [], holdout: [] } }),
    };
  },
);
const concurrentOne = concurrentCoordinator.reviseFromObservedRepairs('skill-a');
const concurrentTwo = concurrentCoordinator.reviseFromObservedRepairs('skill-a');
assert.equal(concurrentProviderCalls, 1, 'concurrent invocation must coalesce before asynchronous provider work');
releaseProvider();
const [concurrentResultOne, concurrentResultTwo] = await Promise.all([concurrentOne, concurrentTwo]);
assert.equal(concurrentResultOne.status, 'candidate-staged');
assert.equal(concurrentResultTwo.status, 'candidate-staged');
assert.equal(concurrentStageCalls, 1, 'concurrent callers must not create duplicate candidate stages');
assert.strictEqual(concurrentResultOne, concurrentResultTwo, 'coalesced callers should share the same result object');

// A persisted candidate carries the same source-evidence digest across coordinator restarts.
const durableDigest = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
let durableProviderCalls = 0;
let durableStageCalls = 0;
const durableCoordinator = new P23CompoundRepairRevisionCoordinator(
  {
    compoundSkillRepairEvidence: () => evidence,
    generateCompoundSkillRevision: async () => {
      durableStageCalls++;
      throw new Error('persisted duplicate must not stage again');
    },
  },
  {
    verifiedSkillCandidateSnapshot: () => ({
      candidates: [{
        skillId: 'skill-a',
        candidateId: 'persisted-candidate',
        revisionProvenance: { sourceEvidenceFingerprint: durableDigest },
      }],
    }),
  },
  async () => {
    durableProviderCalls++;
    throw new Error('persisted duplicate must not rerun the provider');
  },
);
const durableDuplicate = await durableCoordinator.reviseFromObservedRepairs('skill-a');
assert.equal(durableDuplicate.status, 'already-staged-for-evidence');
assert.equal(durableDuplicate.candidateId, 'persisted-candidate');
assert.equal(durableDuplicate.durable, true);
assert.equal(durableProviderCalls, 0);
assert.equal(durableStageCalls, 0);

// WP294: repeated failure on the same evidence digest backs off; a new digest retries immediately.
const retryEvidence = [structuredClone(evidence[0])];
let failureProviderCalls = 0;
const retryCoordinator = new P23CompoundRepairRevisionCoordinator(
  {
    compoundSkillRepairEvidence: () => retryEvidence,
    generateCompoundSkillRevision: async () => {
      throw new Error('provider must fail before candidate staging in this scenario');
    },
  },
  engine,
  async () => {
    failureProviderCalls++;
    throw new Error('deliberate independent evaluator/provider failure');
  },
);
await assert.rejects(
  () => retryCoordinator.reviseFromObservedRepairs('skill-a'),
  /deliberate independent evaluator\/provider failure/,
);
assert.equal(failureProviderCalls, 1);
const cooled = await retryCoordinator.reviseFromObservedRepairs('skill-a');
assert.equal(cooled.status, 'retry-backoff-active');
assert.equal(cooled.attempts, 1);
assert.ok(cooled.retryInMs > 0 && cooled.retryInMs <= 30 * 60 * 1000);
assert.equal(failureProviderCalls, 1, 'same-evidence retry must not rerun the expensive provider during cooldown');
assert.equal(retryCoordinator.retryBackoffDiagnostics()[0].active, true);

retryEvidence[0] = { ...retryEvidence[0], failureFingerprint: 'fp-new-evidence' };
await assert.rejects(
  () => retryCoordinator.reviseFromObservedRepairs('skill-a'),
  /deliberate independent evaluator\/provider failure/,
);
assert.equal(failureProviderCalls, 2, 'new verified repair evidence must bypass the old digest cooldown');
assert.equal(retryCoordinator.retryBackoffDiagnostics()[0].attempts, 1,
  'new evidence gets a fresh bounded retry budget');

console.log('WorkPass172 + WorkPass293 + WorkPass294 coordinator regressions completed');
