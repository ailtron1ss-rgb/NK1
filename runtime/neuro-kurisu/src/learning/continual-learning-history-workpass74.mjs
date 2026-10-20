/**
 * Continual-learning history metrics for NK1.
 *
 * Rows are evaluation checkpoints after each sequential task has been learned;
 * columns are the same fixed task suite evaluated at every checkpoint.
 * Scores must come from held-out tasks/examples, not training-loss counters.
 * This module measures retention and transfer; it does not train or promote.
 */
const finite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
};

const mean = values => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

function validateHistory(history, taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length < 2) {
    throw new TypeError("taskIds must contain at least two tasks");
  }
  const ids = taskIds.map((id, index) => {
    if (typeof id !== "string" || !id.trim()) {
      throw new TypeError(`taskIds[${index}] must be a non-empty string`);
    }
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new Error("taskIds must be unique");
  if (!Array.isArray(history) || history.length !== ids.length) {
    throw new TypeError("history must contain one checkpoint per learned task");
  }
  for (const [rowIndex, row] of history.entries()) {
    if (!Array.isArray(row) || row.length !== ids.length) {
      throw new TypeError(`history[${rowIndex}] must score every task`);
    }
    for (const [taskIndex, score] of row.entries()) {
      finite(score, `history[${rowIndex}][${taskIndex}]`);
      if (score < 0 || score > 1) throw new RangeError("task scores must be in [0, 1]");
    }
  }
  return ids;
}

/**
 * @param {{taskIds:string[], history:number[][], memoryBytes?:number, memoryBudgetBytes?:number}} input
 */
export function evaluateContinualLearningHistory(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("input must be an object");
  }
  const taskIds = validateHistory(input.history, input.taskIds);
  const taskCount = taskIds.length;
  const finalScores = input.history[taskCount - 1];
  const forgetting = [];
  const backwardTransfer = [];
  const taskReports = taskIds.map((taskId, taskIndex) => {
    const firstLearnedScore = input.history[taskIndex][taskIndex];
    const finalScore = finalScores[taskIndex];
    const bestPostLearningScore = Math.max(...input.history.slice(taskIndex).map(row => row[taskIndex]));
    const forgetting01 = Math.max(0, bestPostLearningScore - finalScore);
    if (taskIndex < taskCount - 1) {
      forgetting.push(forgetting01);
      backwardTransfer.push(finalScore - firstLearnedScore);
    }
    return {
      taskId,
      scoreImmediatelyAfterLearning01: firstLearnedScore,
      bestPostLearningScore01: bestPostLearningScore,
      finalScore01: finalScore,
      forgetting01,
      backwardTransfer01: finalScore - firstLearnedScore
    };
  });

  let resource = null;
  if (input.memoryBytes != null || input.memoryBudgetBytes != null) {
    if (input.memoryBytes == null || input.memoryBudgetBytes == null) {
      throw new TypeError("memoryBytes and memoryBudgetBytes must be supplied together");
    }
    const memoryBytes = finite(input.memoryBytes, "memoryBytes");
    const memoryBudgetBytes = finite(input.memoryBudgetBytes, "memoryBudgetBytes");
    if (!Number.isInteger(memoryBytes) || memoryBytes < 0) {
      throw new RangeError("memoryBytes must be a non-negative integer");
    }
    if (!Number.isInteger(memoryBudgetBytes) || memoryBudgetBytes <= 0) {
      throw new RangeError("memoryBudgetBytes must be a positive integer");
    }
    resource = {
      memoryBytes,
      memoryBudgetBytes,
      budgetUtilization01: memoryBytes / memoryBudgetBytes,
      withinMemoryBudget: memoryBytes <= memoryBudgetBytes
    };
  }

  return {
    schemaVersion: 1,
    kind: "nk1.continual-learning-history-report",
    taskCount,
    metrics: {
      finalAverageAccuracy01: mean(finalScores),
      averageForgetting01: mean(forgetting),
      averageBackwardTransfer01: mean(backwardTransfer),
      taskRetentionRate01: mean(taskReports.map(task => task.finalScore01)),
      memory: resource
    },
    taskReports,
    interpretation: {
      forgettingDefinition: "Mean of max post-learning held-out score minus final held-out score, clipped at zero, over all but the last task.",
      backwardTransferDefinition: "Mean final held-out score minus score immediately after each task was first learned, over all but the last task.",
      forwardTransferReported: false,
      forwardTransferReason: "Forward transfer requires a declared pre-training/chance baseline; this history format does not infer one.",
      promotionAllowed: false
    }
  };
}
