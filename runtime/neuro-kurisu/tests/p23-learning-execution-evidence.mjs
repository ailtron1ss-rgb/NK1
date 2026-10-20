import assert from 'node:assert/strict';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { recordExecutionBackedLearningOutcome } from '../src/organism/learning/LearningExecutionEvidence.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const manifest = [
  { taskId: 'memory-1', family: 'memory', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('retain fact'), verifierId: 'verifier-v1', version: 'v1' },
  { taskId: 'transfer-1', family: 'transfer', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('transfer rule'), verifierId: 'verifier-v2', version: 'v1' },
];
const plan = createLearningExperimentPlan(manifest, {
  split: 'holdout', seeds: [1], resetEvery: [1], priorMethod: 'prior', continuousMethod: 'continuous', resetMethodPrefix: 'reset-',
});
const ledger = new VerifiedOutcomeLedger(manifest);
const run = plan.runs.find(item => item.arm === 'P' && item.taskId === 'memory-1');
const receipt = {
  schemaVersion: 1, executionId: 'exec-001', runId: run.runId,
  planFingerprint: plan.planFingerprint, commandFingerprint: 'c'.repeat(64),
  startedAt: 100, finishedAt: 120, durationMs: 20, status: 'completed',
  exitCode: 0, signal: null, stdout: '', stderr: '', stdoutBytes: 0, stderrBytes: 0,
  outputTruncated: false, runDirectory: '/tmp/run', surviveDirectory: '/tmp/survive', boundaries: [],
};
const outcome = { attempt: 1, passed: true, authority: 'independent-verifier', verifierId: 'verifier-v1',
  evidenceRef: 'artifact://verifier/result-1', observedAt: 1_800_000_000_000 };
assert.equal(recordExecutionBackedLearningOutcome(ledger, plan, manifest, run.runId, receipt, outcome).accepted, true);
assert.equal(ledger.snapshot().outcomes[0].passed, true);
assert.throws(() => recordExecutionBackedLearningOutcome(new VerifiedOutcomeLedger(manifest), plan, manifest,
  run.runId, { ...receipt, status: 'failed', exitCode: 3 }, outcome), /clean successful scheduled execution/);
assert.throws(() => recordExecutionBackedLearningOutcome(new VerifiedOutcomeLedger(manifest), plan, manifest,
  run.runId, { ...receipt, planFingerprint: 'd'.repeat(64) }, outcome), /clean successful scheduled execution/);
assert.throws(() => recordExecutionBackedLearningOutcome(new VerifiedOutcomeLedger(manifest), plan, manifest,
  run.runId, receipt, { ...outcome, authority: 'self-report' }), /require independent verification/);
assert.throws(() => recordExecutionBackedLearningOutcome(new VerifiedOutcomeLedger(manifest), plan, manifest,
  plan.runs[1].runId, receipt, outcome), /clean successful scheduled execution/);
console.log('P23_LEARNING_EXECUTION_EVIDENCE=PASS');
