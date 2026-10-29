import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { VersionedSkillCandidateStore, InMemorySkillStorePersistence } from '../src/organism/learning/VersionedSkillCandidateStore.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-workpass622-learning-journals-'));
const stateFile = path.join(root, 'organism.json');
let runtime;
try {
  const engine = new P23LearningEngine();
  engine.configureVerifiedSkillLifecycle(new VersionedSkillCandidateStore(new InMemorySkillStorePersistence()));

  runtime = new OrganismRuntime({
    stateFile,
    enableLanguage: false,
    autoRun: false,
    compoundRepairRevision: {
      engine,
      provideInputs: async () => { throw new Error('the integration fixture must not start background revision work'); },
    },
  });

  const fitnessBeforeInit = engine.learningFitnessJournalDiagnostics();
  const lifecycleBeforeInit = engine.learningLifecycleJournalDiagnostics();
  assert.deepEqual(
    { configured: fitnessBeforeInit.configured, available: fitnessBeforeInit.available },
    { configured: true, available: true },
    'runtime must attach a durable fitness journal to the canonical P23 engine',
  );
  assert.deepEqual(
    { configured: lifecycleBeforeInit.configured, available: lifecycleBeforeInit.available },
    { configured: true, available: true },
    'runtime must attach a durable lifecycle journal to the canonical P23 engine',
  );

  await runtime.init();
  const reconciliation = engine.reconcileLearningLifecycleOutcomes();
  assert.equal(reconciliation.configured, true);
  assert.equal(reconciliation.available, true);
  assert.equal(reconciliation.observedPending, 0);
  assert.equal(reconciliation.unresolved, 0);

  // Journal diagnostics expose aggregates only; raw task rows or candidate payloads are not returned.
  const fitnessAfterInit = engine.learningFitnessJournalDiagnostics();
  const lifecycleAfterInit = engine.learningLifecycleJournalDiagnostics();
  assert.equal(fitnessAfterInit.available, true);
  assert.equal(lifecycleAfterInit.available, true);
  assert.equal('entries' in fitnessAfterInit, false);
  assert.equal('entries' in lifecycleAfterInit, false);
  console.log('WORKPASS622_RUNTIME_LEARNING_JOURNAL_WIRING=PASS durableFitness=true durableLifecycle=true startupReconciliation=true');
} finally {
  if (runtime) {
    try { await runtime.stop(); } catch { /* Preserve the assertion failure, if any. */ }
  }
  await rm(root, { recursive: true, force: true });
}
