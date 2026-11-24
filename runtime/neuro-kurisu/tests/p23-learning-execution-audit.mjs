import assert from 'node:assert/strict';
import { createLearningExperimentPlan } from '../src/organism/learning/LearningExperimentPlan.ts';
import { auditLearningExecutionCoverage } from '../src/organism/learning/LearningExecutionAudit.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const manifest = [
  { taskId: 'a', family: 'memory', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('alpha'), verifierId: 'v1', version: '1' },
  { taskId: 'b', family: 'transfer', split: 'holdout', promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('beta'), verifierId: 'v2', version: '1' },
];
const plan = createLearningExperimentPlan(manifest, { split: 'holdout', seeds: [2], resetEvery: [1],
  priorMethod: 'prior', continuousMethod: 'continuous', resetMethodPrefix: 'reset-' });
const receiptFor = (run, overrides = {}) => ({
  schemaVersion: 2, executionId: 'exec-' + run.runId.slice(0, 8), runId: run.runId,
  planFingerprint: plan.planFingerprint, manifestFingerprint: plan.manifestFingerprint,
  commandFingerprint: 'c'.repeat(64), startedAt: 100, finishedAt: 120, status: 'completed',
  exitCode: 0, signal: null, stdout: '', stderr: '', stdoutBytes: 0, stderrBytes: 0,
  outputTruncated: false, runDirectory: '/tmp/run', surviveDirectory: '/tmp/survive', boundaries: [], ...overrides,
});
const all = plan.runs.map(run => receiptFor(run));
const complete = auditLearningExecutionCoverage(plan, manifest, all);
assert.equal(complete.complete, true);
assert.equal(complete.cleanCompleted, plan.runs.length);
assert.equal(complete.arms.length, plan.arms.length);
assert.ok(complete.arms.every(arm => arm.completionRate === 1));
const partial = auditLearningExecutionCoverage(plan, manifest, all.slice(1));
assert.equal(partial.complete, false);
assert.equal(partial.missing, 1);
const failed = auditLearningExecutionCoverage(plan, manifest, [receiptFor(plan.runs[0], { status: 'failed', exitCode: 4 }), ...all.slice(1)]);
assert.equal(failed.failedOrInvalid, 1);
assert.equal(failed.complete, false);
const duplicate = auditLearningExecutionCoverage(plan, manifest, [...all, all[0]]);
assert.equal(duplicate.duplicateReceipts, 1);
assert.equal(duplicate.complete, false);
const orphan = auditLearningExecutionCoverage(plan, manifest, [...all, receiptFor(plan.runs[0], { runId: 'not-scheduled' })]);
assert.equal(orphan.orphanReceipts, 1);
assert.equal(orphan.complete, false);
const tampered = auditLearningExecutionCoverage(plan, manifest, all.map((r,i)=>i===0?{...r,manifestFingerprint:'d'.repeat(64)}:r));
assert.equal(tampered.complete, false);
console.log('P23_LEARNING_EXECUTION_AUDIT=PASS');
