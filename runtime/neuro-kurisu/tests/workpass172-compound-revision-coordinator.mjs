import assert from 'node:assert/strict';
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
await assert.rejects(() => coordinator.reviseFromObservedRepairs('   '), /compound skill id is required/);
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

console.log('WorkPass172 coordinator regression passed');
