import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { configureDefaultLearningJournals } from '../src/organism/learning/LearningJournalBootstrap.ts';

const root = mkdtempSync(join(tmpdir(), 'nk1-learning-journal-bootstrap-'));
try {
  const stateFile = join(root, 'organism.json');
  const engine = new P23LearningEngine();
  const paths = configureDefaultLearningJournals(engine, stateFile);
  assert.equal(paths.fitnessPath, join(root, 'organism.learning-fitness.jsonl'));
  assert.equal(paths.lifecyclePath, join(root, 'organism.learning-lifecycle.jsonl'));
  assert.deepEqual(engine.learningFitnessJournalDiagnostics(), {
    configured: true, available: true, totalDecisions: 0, acceptedDecisions: 0,
    rejectedDecisions: 0, acceptanceRate01: 0, rejectionCounts: {},
    meanValidationDelta: null, meanHoldoutDelta: null,
    latestValidationLowerBoundMinimum: null, latestHoldoutLowerBoundMinimum: null,
    lastDecisionAt: null, lastSequence: 0, chainHead: '0'.repeat(64), recent: [],
  });
  assert.equal(engine.learningLifecycleJournalDiagnostics().available, true);
  assert.equal(engine.learningLifecycleJournalDiagnostics().eventCount, 0);
  assert.equal(engine.learningLifecycleJournalDiagnostics().pendingActivationCount, 0);

  let hostFitnessWrites = 0;
  let hostLifecycleWrites = 0;
  const hostOwned = new P23LearningEngine();
  hostOwned.configureLearningFitnessJournal({ recordFitnessDecision() { hostFitnessWrites++; throw new Error('host sink invoked'); } });
  hostOwned.configureLearningLifecycleJournal({ recordLifecycleEvent() { hostLifecycleWrites++; throw new Error('host sink invoked'); } });
  configureDefaultLearningJournals(hostOwned, stateFile + '.host');
  assert.deepEqual(hostOwned.learningFitnessJournalDiagnostics(), {
    configured: true, available: false, reason: 'readback-unavailable',
  });
  assert.deepEqual(hostOwned.learningLifecycleJournalDiagnostics(), {
    configured: true, available: false, reason: 'readback-unavailable',
  });
  assert.throws(() => configureDefaultLearningJournals(engine, ''), /p23-learning-journal-state-file-invalid/);
  assert.throws(() => configureDefaultLearningJournals(engine, 'bad\u0000path'), /p23-learning-journal-state-file-invalid/);
  assert.equal(hostFitnessWrites, 0);
  assert.equal(hostLifecycleWrites, 0);
  console.log('WORKPASS421_P23_LEARNING_JOURNAL_BOOTSTRAP=PASS defaultDurableSinks=true explicitHostSinkPreserved=true pathValidation=true');
} finally {
  rmSync(root, { recursive: true, force: true });
}
