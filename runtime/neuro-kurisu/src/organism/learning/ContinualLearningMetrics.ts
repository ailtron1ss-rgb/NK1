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
function hasControlChars(value: string): boolean {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
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
export function evaluateContinualLearning(tasks: ContinualTask[], referenceScore?: number): ContinualLearningMetrics {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new Error('at least one task is required');
  // JavaScript arrays can contain holes; map/forEach silently skip them and can
  // otherwise under-count tasks while still reporting tasks.length as the sample size.
  for (let index = 0; index < tasks.length; index++) {
    if (!Object.prototype.hasOwnProperty.call(tasks, index)) throw new Error(`task list contains an empty slot at index ${index}`);
  }
  if (referenceScore !== undefined) assertScore(referenceScore, 'referenceScore');
  const hasForwardTransfer = tasks.some(task => task?.preTrainingScore !== undefined);
  // FWT is meaningful only relative to a measured fixed/random-policy baseline.
  // Defaulting that baseline to zero makes omitted experimental setup look like
  // genuine transfer, so fail closed when pre-training scores are supplied.
  if (hasForwardTransfer && referenceScore === undefined) {
    throw new Error('referenceScore is required when preTrainingScore is supplied');
  }
  const ids = new Set<string>();
  const stageCount = tasks[0]?.scoreByStage?.length ?? 0;
  if (stageCount === 0 || stageCount !== tasks.length) throw new Error('score matrix must have one stage per task');
  const perTask = tasks.map((task, taskIndex) => {
    if (!task || typeof task.taskId !== 'string' || !task.taskId.trim() || task.taskId.length > 128 || hasControlChars(task.taskId)) {
      throw new Error(`task ${taskIndex} requires a valid non-empty taskId`);
    }
    if (ids.has(task.taskId)) throw new Error(`duplicate taskId: ${task.taskId}`);
    ids.add(task.taskId);
    if (!Array.isArray(task.scoreByStage) || task.scoreByStage.length !== stageCount) throw new Error(`task ${task.taskId} must have exactly ${stageCount} stage scores`);
    for (let stage = 0; stage < stageCount; stage++) {
      if (!Object.prototype.hasOwnProperty.call(task.scoreByStage, stage)) throw new Error(`score matrix contains an empty slot: ${task.taskId}.scoreByStage[${stage}]`);
      assertScore(task.scoreByStage[stage]!, `${task.taskId}.scoreByStage[${stage}]`);
    }
    if (task.preTrainingScore !== undefined) assertScore(task.preTrainingScore, `${task.taskId}.preTrainingScore`);
    const finalScore = task.scoreByStage[stageCount - 1]!;
    const peakPostLearningScore = Math.max(...task.scoreByStage.slice(taskIndex));
    const forgetting = Math.max(0, peakPostLearningScore - finalScore);
    const backwardTransfer = finalScore - task.scoreByStage[taskIndex]!;
    const forwardTransfer = task.preTrainingScore === undefined ? null : task.preTrainingScore - referenceScore!;
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
