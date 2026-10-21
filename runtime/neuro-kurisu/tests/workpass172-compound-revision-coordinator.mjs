import assert from 'node:assert/strict';
import { P23CompoundRepairRevisionCoordinator } from '../src/organism/learning/P23CompoundRepairRevisionCoordinator.ts';

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
  };
});
const result = await coordinator.reviseFromObservedRepairs('skill-a');
assert.equal(result.status, 'candidate-staged');
assert.equal(result.candidateId, 'candidate-staged-1');
assert.equal(providerCalls, 1);
assert.equal(stagedCalls, 1);
assert.equal(received.sourceCandidateId, 'source-candidate-1');

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
console.log('WorkPass172 coordinator regression passed');
