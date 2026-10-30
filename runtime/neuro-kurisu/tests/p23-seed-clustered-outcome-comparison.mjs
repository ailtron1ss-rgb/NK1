import assert from 'node:assert/strict';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { evaluateOutcomePromotion } from '../src/organism/learning/VerifiedOutcomePromotionGate.ts';

const prompt = (name) => VerifiedOutcomeLedger.fingerprintPrompt(name);
const tasks = [
  { taskId: 'memory-a', family: 'memory', split: 'holdout', promptFingerprint: prompt('memory A'), verifierId: 'v1', version: '1' },
  { taskId: 'memory-b', family: 'memory', split: 'holdout', promptFingerprint: prompt('memory B'), verifierId: 'v1', version: '1' },
  { taskId: 'transfer-a', family: 'transfer', split: 'holdout', promptFingerprint: prompt('transfer A'), verifierId: 'v1', version: '1' },
  { taskId: 'tool-a', family: 'tool-use', split: 'holdout', promptFingerprint: prompt('tool A'), verifierId: 'v1', version: '1' },
  { taskId: 'train-only', family: 'memory', split: 'train', promptFingerprint: prompt('train only'), verifierId: 'v1', version: '1' },
];
assert.throws(
  () => new VerifiedOutcomeLedger(tasks.map((task, index) => index === 0 ? { ...task, split: 'hidden' } : task)),
  /invalid task manifest entry/,
  'unknown split labels must not silently remove tasks from holdout coverage',
);
assert.throws(
  () => new VerifiedOutcomeLedger(tasks.map((task, index) => index === 0 ? { ...task, family: '   ' } : task)),
  /invalid task manifest entry/,
  'whitespace-only family labels must not create ambiguous evaluation strata',
);
const ledger = new VerifiedOutcomeLedger(tasks);
const record = (taskId, method, seed, passed, attempt = 1) => ledger.record({
  taskId, taskVersion: '1', method, seed, attempt, passed,
  authority: 'independent-verifier', verifierId: 'v1',
  evidenceRef: `artifact://${taskId}/${method}/${seed}/${attempt}`,
  observedAt: 1000 + seed + attempt,
});

for (let seed = 1; seed <= 4; seed++) {
  record('memory-a', 'baseline', seed, false);
  record('memory-a', 'candidate', seed, true);
  record('memory-b', 'baseline', seed, false);
  record('memory-b', 'candidate', seed, true);
  record('transfer-a', 'baseline', seed, true);
  record('transfer-a', 'candidate', seed, true);
  record('tool-a', 'baseline', seed, false);
  record('tool-a', 'candidate', seed, false);
}
// Retries must not become extra independent observations or override attempt 1.
record('memory-a', 'candidate', 1, false, 2);
// An incomplete seed is excluded in full rather than compared on a smaller task subset.
record('memory-a', 'baseline', 99, true);
record('memory-a', 'candidate', 99, true);
record('memory-b', 'baseline', 99, true);

const bySeed = ledger.comparePairedBySeed('baseline', 'candidate');
assert.equal(bySeed.pairedN, 4, 'independent sample count is seeds, not task cells or attempts');
assert.equal(bySeed.baselinePassRate, 0.25);
assert.equal(bySeed.candidatePassRate, 0.75);
assert.equal(bySeed.absoluteGain, 0.5);
assert.equal(bySeed.discordantCandidateWins, 4, 'wins count seed-level aggregate differences');
assert.equal(bySeed.discordantBaselineWins, 0);
assert.equal(bySeed.statisticalUnit, 'seed');
assert.equal(bySeed.signTestPValue, 2 / (2 ** 4), 'four independent seed wins and no losses have an exact two-sided sign-test p-value of 0.125');
assert.ok(bySeed.approximate95CI);
assert.ok(bySeed.bootstrap95CI, 'seed-cluster bootstrap interval is available with multiple independent seeds');
assert.ok(bySeed.bootstrap95CI[0] <= bySeed.absoluteGain && bySeed.bootstrap95CI[1] >= bySeed.absoluteGain);
assert.deepEqual(
  ledger.comparePairedBySeed('baseline', 'candidate').bootstrap95CI,
  bySeed.bootstrap95CI,
  'bootstrap interval is deterministic for the same ledger and method pair',
);
const completeOnlyLedger = new VerifiedOutcomeLedger(tasks);
for (let seed = 1; seed <= 4; seed++) {
  for (const task of tasks.slice(0, 4)) {
    const baselinePassed = task.taskId === 'transfer-a';
    const candidatePassed = task.taskId === 'memory-a' || task.taskId === 'memory-b' || task.taskId === 'transfer-a';
    for (const [method, passed] of [['baseline', baselinePassed], ['candidate', candidatePassed]]) {
      completeOnlyLedger.record({
        taskId: task.taskId, taskVersion: '1', method, seed, attempt: 1, passed,
        authority: 'independent-verifier', verifierId: 'v1',
        evidenceRef: `complete-only://${task.taskId}/${method}/${seed}`, observedAt: 4000 + seed,
      });
    }
  }
}
assert.deepEqual(completeOnlyLedger.comparePairedBySeed('baseline', 'candidate').bootstrap95CI,
  bySeed.bootstrap95CI, 'incomplete extra seeds cannot perturb the bootstrap interval for the same complete paired sample');
const reverseOrderLedger = new VerifiedOutcomeLedger(tasks);
for (let seed = 4; seed >= 1; seed--) {
  for (const task of tasks.slice(0, 4)) {
    const baselinePassed = task.taskId === 'transfer-a';
    const candidatePassed = task.taskId === 'memory-a' || task.taskId === 'memory-b' || task.taskId === 'transfer-a';
    for (const [method, passed] of [['baseline', baselinePassed], ['candidate', candidatePassed]]) {
      reverseOrderLedger.record({
        taskId: task.taskId, taskVersion: '1', method, seed, attempt: 1, passed,
        authority: 'independent-verifier', verifierId: 'v1',
        evidenceRef: `artifact://${task.taskId}/${method}/${seed}/1`, observedAt: 1000 + seed + 1,
      });
    }
  }
}
assert.deepEqual(reverseOrderLedger.comparePairedBySeed('baseline', 'candidate').bootstrap95CI,
  bySeed.bootstrap95CI, 'seed bootstrap interval is invariant to outcome arrival order');

assert.equal(ledger.comparePairedBySeed('baseline', 'candidate', 'train').pairedN, 0);

const families = ledger.comparePairedByFamilyAndSeed('baseline', 'candidate');
assert.deepEqual(families.map(x => x.family), ['memory', 'tool-use', 'transfer']);
assert.deepEqual(families.map(x => x.pairedN), [4, 4, 4]);
assert.equal(families.find(x => x.family === 'memory').absoluteGain, 1);
assert.equal(families.find(x => x.family === 'transfer').absoluteGain, 0);
assert.equal(families.find(x => x.family === 'tool-use').absoluteGain, 0);
assert.equal(ledger.comparePairedByFamilyAndSeed('baseline', 'candidate', 'train')[0].pairedN, 0);

// The same seed contributes to each family stratum. The gate must not
// interpret those repeated seed-level counts as a disjoint partition.
const seedClusteredGate = evaluateOutcomePromotion(bySeed, families, {
  minPairedTasks: 4,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
  familyPairCountMode: 'seed-repeated',
});
assert.equal(seedClusteredGate.eligible, false, JSON.stringify(seedClusteredGate));
assert.equal(seedClusteredGate.statisticalEvidence.rawPValue, 0.125);
assert.ok(seedClusteredGate.reasons.includes('primary-sign-test-not-significant'),
  'four independent seed wins are not enough for a two-sided exact sign-test at alpha 0.05');
const incorrectPartitionGate = evaluateOutcomePromotion(bySeed, families, {
  minPairedTasks: 4,
  minFamilies: 3,
  minAbsoluteGain: 0.02,
  maxFamilyRegression: 0.05,
  requirePositiveConfidenceLowerBound: true,
  familyPairCountMode: 'partition',
});
assert.equal(incorrectPartitionGate.eligible, false);
assert.ok(incorrectPartitionGate.reasons.includes('family-pair-count-mismatch'),
  'mismatched aggregation units must not be silently treated as equivalent');


const oneSeedLedger = new VerifiedOutcomeLedger(tasks.slice(0, 2));
for (const method of ['baseline', 'candidate']) {
  for (const task of tasks.slice(0, 2)) {
    oneSeedLedger.record({
      taskId: task.taskId, taskVersion: '1', method, seed: 7, attempt: 1,
      passed: method === 'candidate', authority: 'independent-verifier',
      verifierId: 'v1', evidenceRef: `artifact://one/${method}/${task.taskId}`, observedAt: 2000,
    });
  }
}
assert.equal(oneSeedLedger.comparePairedBySeed('baseline', 'candidate').approximate95CI, null,
  'a single independent seed must not produce a confidence interval');
assert.equal(oneSeedLedger.comparePairedBySeed('baseline', 'candidate').bootstrap95CI, null,
  'a single independent seed must not produce a bootstrap interval');

console.log('P23_SEED_CLUSTERED_OUTCOME_COMPARISON=PASS');
console.log(JSON.stringify({ pairedSeeds: bySeed.pairedN, taskCellsPerSeed: 4, aggregateGain: bySeed.absoluteGain, families: families.map(x => ({ family: x.family, pairedSeeds: x.pairedN, gain: x.absoluteGain })) }));
