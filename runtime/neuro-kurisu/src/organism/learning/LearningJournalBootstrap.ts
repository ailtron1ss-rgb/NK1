import type { P23LearningEngine } from './P23LearningEngine.ts';
import { JsonlLearningFitnessJournal, type LearningFitnessJournalSink } from './LearningFitnessJournal.ts';
import { JsonlLearningLifecycleJournal, learningLifecycleJournalPathForStateFile, type LearningLifecycleJournalSink } from './LearningLifecycleJournal.ts';

export interface DefaultLearningJournalSinks {
  fitness: LearningFitnessJournalSink;
  lifecycle: LearningLifecycleJournalSink;
  fitnessPath: string;
  lifecyclePath: string;
}

export interface LearningJournalBootstrapResult {
  fitnessPath: string;
  lifecyclePath: string;
}

/** Create one shared pair of durable, privacy-filtered sinks for every P23 surface in a runtime. */
export function createDefaultLearningJournals(stateFile: string): DefaultLearningJournalSinks {
  if (!stateFile || typeof stateFile !== 'string' || stateFile.trim() !== stateFile || stateFile.includes('\u0000')) {
    throw new Error('p23-learning-journal-state-file-invalid');
  }
  const fitnessPath = stateFile.toLowerCase().endsWith('.json')
    ? stateFile.replace(/\.json$/i, '.learning-fitness.jsonl')
    : `${stateFile}.learning-fitness.jsonl`;
  const lifecyclePath = learningLifecycleJournalPathForStateFile(stateFile);
  return {
    fitness: new JsonlLearningFitnessJournal(fitnessPath),
    lifecycle: new JsonlLearningLifecycleJournal(lifecyclePath),
    fitnessPath,
    lifecyclePath,
  };
}

/** Preserve any explicitly injected host sink; only absent sinks receive defaults. */
export function configureLearningJournals(
  engine: P23LearningEngine,
  sinks: DefaultLearningJournalSinks,
): void {
  engine.configureLearningFitnessJournalIfAbsent(sinks.fitness);
  engine.configureLearningLifecycleJournalIfAbsent(sinks.lifecycle);
}

export function configureDefaultLearningJournals(
  engine: P23LearningEngine,
  stateFile: string,
): LearningJournalBootstrapResult {
  const sinks = createDefaultLearningJournals(stateFile);
  configureLearningJournals(engine, sinks);
  return { fitnessPath: sinks.fitnessPath, lifecyclePath: sinks.lifecyclePath };
}
