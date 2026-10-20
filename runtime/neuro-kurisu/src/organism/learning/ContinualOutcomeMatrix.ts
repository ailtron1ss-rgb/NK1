import type { EvaluationSplit, TaskManifestEntry, VerifiedTaskOutcome } from './VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedger } from './VerifiedOutcomeLedger.ts';
import { evaluateContinualLearning, type ContinualLearningMetrics, type ContinualTask } from './ContinualLearningMetrics.ts';

export interface ContinualStage {
  /** A stable label for this checkpoint, e.g. "context-only" or "replay-32". */
  stageId: string;
  /** Exact method value written by the outcome recorder. */
  method: string;
}
export interface ContinualOutcomeMatrix {
  manifestFingerprint: string;
  split: EvaluationSplit;
  stages: ContinualStage[];
  seedCount: number;
  taskCount: number;
  tasks: ContinualTask[];
  metrics: ContinualLearningMetrics;
  evidence: {
    outcomeCount: number;
    authorityCounts: Record<'independent-verifier' | 'human-review', number>;
    seedIds: number[];
    taskVersions: Record<string, string>;
    taskFamilies: Record<string, string>;
  };
}

/**
 * Build a sequential task-by-checkpoint matrix from the durable evidence ledger.
 * Each cell is a pass-rate over the *same* seed set. Only independently verified
 * or human-reviewed outcomes from the requested split are eligible. Attempt 1 is
 * used deliberately so retries cannot inflate success rates. This adapter does
 * not run the learner, fetch evidence, or authenticate the verifier itself.
 */
export function buildContinualOutcomeMatrix(
  ledger: VerifiedOutcomeLedger,
  stages: ContinualStage[],
  options: { split?: EvaluationSplit; referenceScore?: number; preTrainingMethod?: string } = {},
): ContinualOutcomeMatrix {
  if (!Array.isArray(stages) || stages.length < 1) throw new Error('at least one stage is required');
  const stageIds = new Set<string>();
  const methods = new Set<string>();
  for (const [i, stage] of stages.entries()) {
    if (!stage || typeof stage.stageId !== 'string' || !stage.stageId.trim() ||
        typeof stage.method !== 'string' || !stage.method.trim()) throw new Error(`stage ${i} requires stageId and method`);
    if (stageIds.has(stage.stageId)) throw new Error(`duplicate stageId: ${stage.stageId}`);
    if (methods.has(stage.method)) throw new Error(`duplicate stage method: ${stage.method}`);
    stageIds.add(stage.stageId); methods.add(stage.method);
  }
  const split = options.split ?? 'holdout';
  const snapshot = ledger.snapshot();
  const manifest = snapshot.manifest as TaskManifestEntry[];
  const outcomes = snapshot.outcomes as VerifiedTaskOutcome[];
  const tasksInSplit = manifest.filter(task => task.split === split).sort((a,b) => a.taskId.localeCompare(b.taskId));
  if (!tasksInSplit.length) throw new Error(`no manifest tasks in split: ${split}`);
  const selectedMethods = new Set([
    ...stages.map(stage => stage.method),
    ...(options.preTrainingMethod ? [options.preTrainingMethod] : []),
  ]);
  const eligible = outcomes.filter(outcome =>
    outcome.attempt === 1 &&
    (outcome.authority === 'independent-verifier' || outcome.authority === 'human-review') &&
    tasksInSplit.some(task => task.taskId === outcome.taskId) &&
    selectedMethods.has(outcome.method));
  const cell = new Map<string, Map<number, boolean>>();
  for (const outcome of eligible) {
    const key = JSON.stringify([outcome.taskId, outcome.method]);
    const seeds = cell.get(key) ?? new Map<number, boolean>();
    if (seeds.has(outcome.seed)) throw new Error(`duplicate eligible seed cell: ${outcome.taskId}/${outcome.method}/${outcome.seed}`);
    seeds.set(outcome.seed, outcome.passed);
    cell.set(key, seeds);
  }
  const seedSets = stages.flatMap(stage => tasksInSplit.map(task => {
    const values = cell.get(JSON.stringify([task.taskId, stage.method]));
    if (!values || values.size === 0) throw new Error(`missing outcomes for task ${task.taskId}, method ${stage.method}`);
    return [...values.keys()].sort((a,b) => a-b);
  }));
  const canonicalSeeds = seedSets[0]!;
  for (const seeds of seedSets) {
    if (seeds.length !== canonicalSeeds.length || seeds.some((seed,i) => seed !== canonicalSeeds[i])) {
      throw new Error('all task/stage cells must use the exact same seed set');
    }
  }
  const referenceScore = options.referenceScore ?? 0;
  const tasks: ContinualTask[] = tasksInSplit.map(task => {
    const scoreByStage = stages.map(stage => {
      const values = cell.get(JSON.stringify([task.taskId, stage.method]))!;
      return [...values.values()].reduce((sum, passed) => sum + Number(passed), 0) / values.size;
    });
    let preTrainingScore: number | undefined;
    if (options.preTrainingMethod) {
      const baseline = cell.get(JSON.stringify([task.taskId, options.preTrainingMethod]));
      if (!baseline || baseline.size !== canonicalSeeds.length ||
          [...baseline.keys()].sort((a,b) => a-b).some((seed,i) => seed !== canonicalSeeds[i])) {
        throw new Error(`pre-training method lacks matched seeds for task ${task.taskId}`);
      }
      preTrainingScore = [...baseline.values()].reduce((sum, passed) => sum + Number(passed), 0) / baseline.size;
    }
    return { taskId: task.taskId, ...(preTrainingScore === undefined ? {} : { preTrainingScore }), scoreByStage };
  });
  const authorityCounts = { 'independent-verifier': 0, 'human-review': 0 };
  for (const outcome of eligible) authorityCounts[outcome.authority as keyof typeof authorityCounts]++;
  const taskVersions: Record<string,string> = {}, taskFamilies: Record<string,string> = {};
  for (const task of tasksInSplit) { taskVersions[task.taskId] = task.version; taskFamilies[task.taskId] = task.family; }
  return {
    manifestFingerprint: ledger.manifestFingerprint(), split, stages: stages.map(stage => ({...stage})),
    seedCount: canonicalSeeds.length, taskCount: tasks.length, tasks,
    metrics: evaluateContinualLearning(tasks, referenceScore),
    evidence: { outcomeCount: eligible.length, authorityCounts, seedIds: canonicalSeeds, taskVersions, taskFamilies },
  };
}
