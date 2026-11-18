import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const dir = await mkdtemp(path.join(tmpdir(), 'nk-negative-space-core-'));
const stateStore = new MemoryStateStore();
const worldStateStore = new MemoryStateStore();
const makeRuntime = () => new OrganismRuntime({
  stateFile: path.join(dir, 'state.json'),
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: false,
  stateStore,
  worldStateStore,
  journal: new BoundedOperationalJournal(),
  performanceProfile: 'mobile',
});

let runtime;
let restarted;
let runtimeStopped = false;
try {
  runtime = makeRuntime();
  await runtime.init();
  await runtime.core.flush();

  // Seed the real RegretEngine with one initially unverified, high-confidence alternative.
  // The test deliberately uses its engine owner only for deterministic fixture setup; all
  // assertions target the public OrganismCore mutation APIs and their persisted effects.
  const regretEngine = runtime.core.cognitiveRuntime.regretEngine;
  regretEngine.observe('respond', 0.2, [{
    action: 'explore',
    expectedOutcome01: 0.95,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-durability-001',
    decisionAt: 100,
    outcomeAt: 200,
    chosenExpectedOutcome01: 0.9,
    significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
    outcomeEvidence: ['initial-unverified-report'],
    outcomeVerified01: 0,
    outcomeIndependent01: 0,
    outcomeSource: 'internal',
  });

  assert.equal(runtime.core.negativeSpaceMemoryReviewQueue().length, 0);
  const corroborated = await runtime.core.negativeSpaceMemoryRecordOutcome({
    decisionId: 'core-negative-space-durability-001',
    actualOutcome01: 0.2,
    verified01: 1,
    independent01: 1,
    source: 'external-evidence',
    evidence: ['independent-postcondition-confirmation'],
    at: 400,
  });
  assert.equal(corroborated?.reviewStatus, 'review-eligible');
  assert.equal(runtime.core.negativeSpaceMemoryReviewQueue().length, 1);

  // The persistence-batch guard must reject before mutating either Core API's canonical engine state.
  regretEngine.observe('respond', 0.3, [{
    action: 'verify',
    expectedOutcome01: 0.9,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-batch-reopen-002',
    decisionAt: 110,
    outcomeAt: 210,
    chosenExpectedOutcome01: 0.9,
    significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
    outcomeEvidence: ['initial-verified-report'],
    outcomeVerified01: 1,
    outcomeIndependent01: 1,
    outcomeSource: 'external-evidence',
  });
  const batchReopenBefore = runtime.core.negativeSpaceMemorySnapshot();
  await runtime.core.beginBatch();
  try {
    await assert.rejects(
      runtime.core.negativeSpaceMemoryMarkReopened(
        'core-negative-space-batch-reopen-002',
        'verify',
        'must not mutate inside active batch',
        450,
      ),
      /negative-space-memory-persistence-busy/,
    );
    assert.deepEqual(
      runtime.core.negativeSpaceMemorySnapshot(),
      batchReopenBefore,
      'a rejected reopen during a batch must not mutate in-memory history',
    );
  } finally {
    await runtime.core.endBatch();
  }

  regretEngine.observe('respond', 0.3, [{
    action: 'explore',
    expectedOutcome01: 0.9,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-batch-outcome-003',
    decisionAt: 120,
    outcomeAt: 220,
    chosenExpectedOutcome01: 0.9,
    significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
    outcomeEvidence: ['initial-unverified-report'],
    outcomeVerified01: 0,
    outcomeIndependent01: 0,
    outcomeSource: 'internal',
  });
  const batchOutcomeBefore = runtime.core.negativeSpaceMemorySnapshot();
  await runtime.core.beginBatch();
  try {
    await assert.rejects(
      runtime.core.negativeSpaceMemoryRecordOutcome({
        decisionId: 'core-negative-space-batch-outcome-003',
        actualOutcome01: 0.3,
        verified01: 1,
        independent01: 1,
        source: 'external-evidence',
        evidence: ['must-not-be-applied-inside-active-batch'],
        at: 460,
      }),
      /negative-space-memory-persistence-busy/,
    );
    assert.deepEqual(
      runtime.core.negativeSpaceMemorySnapshot(),
      batchOutcomeBefore,
      'a rejected outcome update during a batch must not mutate in-memory history',
    );
  } finally {
    await runtime.core.endBatch();
  }

  // A successful public mutation must update the canonical persisted facet and be durable
  // before the API resolves; relying on the next cognitive tick is not sufficient.
  let saved = await stateStore.load();
  let savedRecord = saved?.facets?.advanced?.regret?.negativeSpace?.records
    ?.find(row => row.decisionId === 'core-negative-space-durability-001');
  assert.ok(savedRecord, 'late outcome evidence must be persisted by OrganismCore');
  assert.equal(savedRecord.outcomeVerified01, 1);
  assert.equal(savedRecord.reviewStatus, 'review-eligible');
  assert.ok(savedRecord.outcomeEvidence.includes('independent-postcondition-confirmation'));

  const reopened = await runtime.core.negativeSpaceMemoryMarkReopened(
    'core-negative-space-durability-001',
    'explore',
    'reviewed after independent corroboration',
    500,
  );
  assert.equal(reopened, true);
  const remainingReviewQueue = runtime.core.negativeSpaceMemoryReviewQueue();
  assert.deepEqual(
    remainingReviewQueue.map(item => ({ decisionId: item.decisionId, action: item.alternative.action })),
    [{ decisionId: 'core-negative-space-batch-reopen-002', action: 'verify' }],
    'reopening one alternative must leave other decisions reviewable',
  );

  saved = await stateStore.load();
  savedRecord = saved?.facets?.advanced?.regret?.negativeSpace?.records
    ?.find(row => row.decisionId === 'core-negative-space-durability-001');
  assert.equal(savedRecord?.reviewStatus, 'reopened');
  assert.equal(savedRecord?.alternatives?.[0]?.reviewEligible, false);
  assert.equal(savedRecord?.alternatives?.[0]?.reopenedAt, 500);
  assert.equal(savedRecord?.alternatives?.[0]?.reopenReason, 'reviewed after independent corroboration');


  // A failed durable checkpoint must roll the canonical engine and persisted facet back.
  regretEngine.observe('respond', 0.2, [{
    action: 'fallback',
    expectedOutcome01: 0.9,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-checkpoint-failure-004',
    decisionAt: 130,
    outcomeAt: 230,
    chosenExpectedOutcome01: 0.9,
    significance: { cost01: 0.2, risk01: 0.95, futureImportance01: 0.1 },
    outcomeEvidence: ['initial-unverified-report'],
    outcomeVerified01: 0,
    outcomeIndependent01: 0,
    outcomeSource: 'internal',
  });
  await runtime.core.flush();
  const beforeFailedCheckpoint = runtime.core.negativeSpaceMemorySnapshot();
  const persistedBeforeFailedCheckpoint = await stateStore.load();
  const originalSave = stateStore.save.bind(stateStore);
  let failNextSave = true;
  stateStore.save = async value => {
    if (failNextSave) {
      failNextSave = false;
      throw new Error('injected-negative-space-durability-failure');
    }
    await originalSave(value);
  };
  try {
    await assert.rejects(
      runtime.core.negativeSpaceMemoryRecordOutcome({
        decisionId: 'core-negative-space-checkpoint-failure-004',
        actualOutcome01: 0.2,
        verified01: 1,
        independent01: 1,
        source: 'external-evidence',
        evidence: ['must-be-rolled-back-after-failed-save'],
        at: 470,
      }),
      /injected-negative-space-durability-failure/,
    );
  } finally {
    stateStore.save = originalSave;
  }
  assert.deepEqual(
    runtime.core.negativeSpaceMemorySnapshot(),
    beforeFailedCheckpoint,
    'failed durable writes must roll back the in-memory Negative Space ledger',
  );
  const persistedAfterFailedCheckpoint = await stateStore.load();
  assert.deepEqual(
    persistedAfterFailedCheckpoint?.facets?.advanced?.regret?.negativeSpace,
    persistedBeforeFailedCheckpoint?.facets?.advanced?.regret?.negativeSpace,
    'failed durable writes must leave the durable snapshot unchanged',
  );


  // Concurrent durability updates are serialized: a failed first write must not roll back
  // the second decision's independently successful evidence promotion.
  regretEngine.observe('respond', 0.2, [{
    action: 'explore',
    expectedOutcome01: 0.9,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-concurrent-failure-005',
    decisionAt: 140,
    outcomeAt: 240,
    chosenExpectedOutcome01: 0.8,
    significance: { cost01: 0.1, risk01: 0.9, futureImportance01: 0.1 },
    outcomeVerified01: 0,
    outcomeIndependent01: 0,
    outcomeSource: 'internal',
  });
  regretEngine.observe('respond', 0.25, [{
    action: 'verify',
    expectedOutcome01: 0.85,
    confidence01: 1,
  }], {
    decisionId: 'core-negative-space-concurrent-success-006',
    decisionAt: 150,
    outcomeAt: 250,
    chosenExpectedOutcome01: 0.8,
    significance: { cost01: 0.1, risk01: 0.9, futureImportance01: 0.1 },
    outcomeVerified01: 0,
    outcomeIndependent01: 0,
    outcomeSource: 'internal',
  });
  await runtime.core.flush();
  const stableStoreSave = stateStore.save.bind(stateStore);
  let failConcurrentFirstSave = true;
  stateStore.save = async value => {
    if (failConcurrentFirstSave) {
      failConcurrentFirstSave = false;
      throw new Error('injected-first-concurrent-negative-space-save-failure');
    }
    await stableStoreSave(value);
  };
  let concurrentResults;
  try {
    concurrentResults = await Promise.allSettled([
      runtime.core.negativeSpaceMemoryRecordOutcome({
        decisionId: 'core-negative-space-concurrent-failure-005',
        actualOutcome01: 0.2,
        verified01: 1,
        independent01: 1,
        source: 'external-evidence',
        evidence: ['first-write-fails'],
        at: 480,
      }),
      runtime.core.negativeSpaceMemoryRecordOutcome({
        decisionId: 'core-negative-space-concurrent-success-006',
        actualOutcome01: 0.25,
        verified01: 1,
        independent01: 1,
        source: 'external-evidence',
        evidence: ['second-write-must-survive'],
        at: 490,
      }),
    ]);
  } finally {
    stateStore.save = stableStoreSave;
  }
  assert.equal(concurrentResults[0].status, 'rejected');
  assert.equal(concurrentResults[1].status, 'fulfilled');
  const concurrentState = runtime.core.negativeSpaceMemorySnapshot();
  const failedRecord = concurrentState.records.find(row => row.decisionId === 'core-negative-space-concurrent-failure-005');
  const successfulRecord = concurrentState.records.find(row => row.decisionId === 'core-negative-space-concurrent-success-006');
  assert.equal(failedRecord?.outcomeVerified01, 0,
    'failed concurrent mutation must be rolled back');
  assert.equal(successfulRecord?.outcomeVerified01, 1,
    'later successful mutation must survive an earlier rollback');
  const concurrentStored = await stateStore.load();
  const storedSuccessfulRecord = concurrentStored?.facets?.advanced?.regret?.negativeSpace?.records
    ?.find(row => row.decisionId === 'core-negative-space-concurrent-success-006');
  assert.equal(storedSuccessfulRecord?.outcomeVerified01, 1);

  await runtime.stop();
  runtimeStopped = true;

  // Restart from the actual store, not a hand-passed in-memory snapshot.
  restarted = makeRuntime();
  await restarted.init();
  const restored = restarted.core.negativeSpaceMemorySnapshot();
  const restoredRecord = restored?.records?.find(row => row.decisionId === 'core-negative-space-durability-001');
  assert.equal(restoredRecord?.reviewStatus, 'reopened');
  assert.equal(restoredRecord?.alternatives?.[0]?.reopenedAt, 500);
  const restoredReviewQueue = restarted.core.negativeSpaceMemoryReviewQueue();
  assert.deepEqual(
    restoredReviewQueue.map(item => ({ decisionId: item.decisionId, action: item.alternative.action })),
    [{ decisionId: 'core-negative-space-batch-reopen-002', action: 'verify' }],
    'restart must preserve unrelated review-eligible decisions',
  );

  console.log('NEGATIVE_SPACE_MEMORY_CORE_PERSISTENCE=PASS', JSON.stringify({
    outcomeVerified01: savedRecord?.outcomeVerified01,
    reviewStatus: restoredRecord?.reviewStatus,
    restoredReopenedAt: restoredRecord?.alternatives?.[0]?.reopenedAt,
  }));
} finally {
  if (restarted) await restarted.stop();
  if (runtime && !runtimeStopped) await runtime.stop();
  await rm(dir, { recursive: true, force: true });
}
