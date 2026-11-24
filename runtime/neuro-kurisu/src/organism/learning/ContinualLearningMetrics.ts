/**
 * Continual-learning metrics for sequential task evaluation.
 * Scores must be externally measured on one fixed task protocol; this module
 * does not infer learning from memory size, self-reports, or synthetic success.
 */
export interface ContinualTask {
  taskId: string;
  preTrainingScore?: number;
  scoreByStage: number[];
}
export interface ContinualLearningMetrics {
  taskCount: number;
  stageCount: number;
  finalAverageScore: number;
  averageForgetting: number;
  averageBackwardTransfer: number;
  averageForwardTransfer: number | null;
  forwardTransferTaskCount: number;
  perTask: Array<{ taskId: string; finalScore: number; peakPostLearningScore: number; forgetting: number; backwardTransfer: number; forwardTransfer: number | null }>;
}
function assertScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be a finite number in [0, 1]`);
}
/**
 * scoreByStage[i] is a task's score after sequential stage i. For task i,
 * scoreByStage[i] is its score immediately after learning; later scores expose
 * retention/forgetting. Forward transfer is preTrainingScore minus referenceScore.
 * Supply a meaningful fixed/random-policy reference; default 0 is only a fallback.
 */
export function evaluateContinualLearning(tasks: ContinualTask[], referenceScore = 0): ContinualLearningMetrics {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('at least one task is required');
  assertScore(referenceScore, 'referenceScore');
  const ids = new Set<string>();
  const stageCount = tasks[0]?.scoreByStage?.length ?? 0;
  if (stageCount === 0 || stageCount !== tasks.length) throw new Error('score matrix must have one stage per task');
  const perTask = tasks.map((task, taskIndex) => {
    if (!task || typeof task.taskId !== 'string' || !task.taskId.trim()) throw new Error(`task ${taskIndex} requires a non-empty taskId`);
    if (ids.has(task.taskId)) throw new Error(`duplicate taskId: ${task.taskId}`);
    ids.add(task.taskId);
    if (!Array.isArray(task.scoreByStage) || task.scoreByStage.length !== stageCount) throw new Error(`task ${task.taskId} must have exactly ${stageCount} stage scores`);
    task.scoreByStage.forEach((score, stage) => assertScore(score, `${task.taskId}.scoreByStage[${stage}]`));
    if (task.preTrainingScore !== undefined) assertScore(task.preTrainingScore, `${task.taskId}.preTrainingScore`);
    const finalScore = task.scoreByStage[stageCount - 1]!;
    const peakPostLearningScore = Math.max(...task.scoreByStage.slice(taskIndex));
    const forgetting = Math.max(0, peakPostLearningScore - finalScore);
    const backwardTransfer = finalScore - task.scoreByStage[taskIndex]!;
    const forwardTransfer = task.preTrainingScore === undefined ? null : task.preTrainingScore - referenceScore;
    return { taskId: task.taskId, finalScore, peakPostLearningScore, forgetting, backwardTransfer, forwardTransfer };
  });
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const forwardValues = perTask.flatMap(item => item.forwardTransfer === null ? [] : [item.forwardTransfer]);
  return {
    taskCount: tasks.length, stageCount,
    finalAverageScore: mean(perTask.map(item => item.finalScore)),
    averageForgetting: mean(perTask.map(item => item.forgetting)),
    averageBackwardTransfer: mean(perTask.map(item => item.backwardTransfer)),
    averageForwardTransfer: forwardValues.length ? mean(forwardValues) : null,
    forwardTransferTaskCount: forwardValues.length, perTask,
  };
}
