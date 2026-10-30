import type { P23LearningEngine } from './P23LearningEngine.ts';
import { JsonlLearningFitnessJournal } from './LearningFitnessJournal.ts';
import { JsonlLearningLifecycleJournal, learningLifecycleJournalPathForStateFile } from './LearningLifecycleJournal.ts';

export interface LearningJournalBootstrapResult {
  fitnessPath: string;
  lifecyclePath: string;
}

/**
 * Bind durable, privacy-filtered P23 decision journals to the runtime state root.
 * Explicit host-provided sinks always win; this helper only fills absent sinks.
 */
export function configureDefaultLearningJournals(
  engine: P23LearningEngine,
  stateFile: string,
): LearningJournalBootstrapResult {
  if (!stateFile || typeof stateFile !== 'string' || stateFile.trim() !== stateFile || stateFile.includes('\u0000')) {
    throw new Error('p23-learning-journal-state-file-invalid');
  }
  const fitnessPath = stateFile.toLowerCase().endsWith('.json')
    ? stateFile.replace(/\.json$/i, '.learning-fitness.jsonl')
    : `${stateFile}.learning-fitness.jsonl`;
  const lifecyclePath = learningLifecycleJournalPathForStateFile(stateFile);
  engine.configureLearningFitnessJournalIfAbsent(new JsonlLearningFitnessJournal(fitnessPath));
  engine.configureLearningLifecycleJournalIfAbsent(new JsonlLearningLifecycleJournal(lifecyclePath));
  return { fitnessPath, lifecyclePath };
}
