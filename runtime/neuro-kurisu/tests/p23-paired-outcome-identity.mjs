import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

// Identity fields deliberately contain separators: pair grouping must be tuple-safe,
// not dependent on ad-hoc concatenation.
const tasks = [
  { taskId: 'family:alpha', family: 'memory', split: 'holdout', prompt: 'alpha' },
  { taskId: 'family', family: 'reasoning', split: 'holdout', prompt: 'beta' },
].map(task => ({
  taskId: task.taskId,
  family: task.family,
  split: task.split,
  promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt(task.prompt),
  verifierId: 'verifier-v1',
  version: '1',
}));
const ledger = new VerifiedOutcomeLedger(tasks);
for (const task of tasks) {
  for (const method of ['baseline', 'candidate']) {
    const result = ledger.record({
      taskId: task.taskId,
      taskVersion: '1',
      method,
      seed: task.taskId === 'family' ? 2 : 1,
      attempt: task.taskId === 'family' ? 1 : 2,
      passed: method === 'candidate',
      authority: 'independent-verifier',
      verifierId: 'verifier-v1',
      evidenceRef: `artifact://paired-identity/${encodeURIComponent(task.taskId)}/${method}`,
      observedAt: 1_800_000_000_000,
    });
    assert.equal(result.accepted, true);
  }
}
const comparison = ledger.comparePaired('baseline', 'candidate');
assert.equal(comparison.pairedN, 2, 'each distinct task/seed/attempt tuple contributes exactly one pair');
assert.equal(comparison.baselinePassRate, 0);
assert.equal(comparison.candidatePassRate, 1);
assert.equal(comparison.absoluteGain, 1);
console.log('P23_PAIRED_OUTCOME_IDENTITY=PASS');
