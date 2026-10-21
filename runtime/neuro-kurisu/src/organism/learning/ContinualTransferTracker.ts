/**
 * Continual transfer metrics adapted from the task-keyed Forgetting/BWT
 * concepts in ContinualAI/Avalanche (MIT). This is a dependency-free
 * evaluation primitive; it never trains a model or stores examples.
 *
 * Scores must be comparable held-out quality values in [0, 1], higher is better.
 */
export type TransferPhase = 'baseline' | 'before-task-training' | 'after-task-training';

export interface TransferObservation {
  stage: number;
  phase: TransferPhase;
  score01: number;
}

export interface TaskTransferRecord {
  taskId: string;
  baselineScore01: number | null;
  beforeTrainingScore01: number | null;
  firstPostTrainingScore01: number | null;
  latestScore01: number | null;
  forwardTransfer01: number | null;
  backwardTransfer01: number | null;
  observations: TransferObservation[];
}

export interface TransferSummary {
  taskCount: number;
  measuredForwardTransferTasks: number;
  measuredBackwardTransferTasks: number;
  meanForwardTransfer01: number | null;
  meanBackwardTransfer01: number | null;
  tasks: TaskTransferRecord[];
}

interface TaskState {
  baseline: number | null;
  beforeTraining: number | null;
  firstPostTraining: number | null;
  latest: number | null;
  observations: TransferObservation[];
}

const isScore = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const isStage = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const validTaskId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Forward transfer = performance after prior tasks but before learning this
 * task minus the task's reference baseline. Backward transfer = latest
 * performance minus the first post-training performance on the same task.
 * Positive values indicate transfer/improvement; negative values indicate
 * interference/regression. Missing comparisons are null, never fabricated 0.
 */
export class ContinualTransferTracker {
  private readonly states = new Map<string, TaskState>();

  private state(taskId: string): TaskState {
    const key = taskId.trim();
    let value = this.states.get(key);
    if (!value) {
      value = { baseline: null, beforeTraining: null, firstPostTraining: null, latest: null, observations: [] };
      this.states.set(key, value);
    }
    return value;
  }

  private validate(taskId: unknown, score01: unknown, stage: unknown): string {
    if (!validTaskId(taskId)) throw new TypeError('transfer-task-id-required');
    if (!isScore(score01)) throw new RangeError('transfer-score-out-of-range');
    if (!isStage(stage)) throw new RangeError('transfer-stage-invalid');
    return taskId.trim();
  }

  private record(taskId: string, score01: number, stage: number, phase: TransferPhase): TaskTransferRecord {
    const state = this.state(taskId);
    const previous = state.observations[state.observations.length - 1];
    if (previous && stage < previous.stage) throw new RangeError('transfer-stage-must-be-monotonic');
    state.observations.push({ stage, phase, score01 });
    if (phase === 'baseline') state.baseline = score01;
    if (phase === 'before-task-training') state.beforeTraining = score01;
    if (phase === 'after-task-training') {
      if (state.firstPostTraining === null) state.firstPostTraining = score01;
      state.latest = score01;
    }
    return this.toRecord(taskId, state);
  }

  recordBaseline(taskId: string, score01: number, stage = 0): TaskTransferRecord {
    const key = this.validate(taskId, score01, stage);
    const state = this.state(key);
    if (state.baseline !== null) throw new Error('transfer-baseline-already-recorded');
    if (state.firstPostTraining !== null) throw new Error('transfer-baseline-after-training');
    return this.record(key, score01, stage, 'baseline');
  }

  recordBeforeTaskTraining(taskId: string, score01: number, stage: number): TaskTransferRecord {
    const key = this.validate(taskId, score01, stage);
    const state = this.states.get(key);
    if (!state || state.baseline === null) throw new Error('transfer-baseline-required-first');
    if (state.firstPostTraining !== null) throw new Error('transfer-before-training-after-training');
    return this.record(key, score01, stage, 'before-task-training');
  }

  recordAfterTaskTraining(taskId: string, score01: number, stage: number): TaskTransferRecord {
    const key = this.validate(taskId, score01, stage);
    const state = this.states.get(key);
    if (!state || state.baseline === null) throw new Error('transfer-baseline-required-first');
    if (state.beforeTraining === null) throw new Error('transfer-before-training-score-required');
    return this.record(key, score01, stage, 'after-task-training');
  }

  private toRecord(taskId: string, state: TaskState): TaskTransferRecord {
    return {
      taskId,
      baselineScore01: state.baseline,
      beforeTrainingScore01: state.beforeTraining,
      firstPostTrainingScore01: state.firstPostTraining,
      latestScore01: state.latest,
      forwardTransfer01: state.baseline !== null && state.beforeTraining !== null
        ? state.beforeTraining - state.baseline : null,
      backwardTransfer01: state.firstPostTraining !== null && state.latest !== null
        ? state.latest - state.firstPostTraining : null,
      observations: state.observations.map((item) => ({ ...item })),
    };
  }

  result(): TransferSummary {
    const tasks = [...this.states.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([taskId, state]) => this.toRecord(taskId, state));
    const forward = tasks.flatMap((task) => task.forwardTransfer01 === null ? [] : [task.forwardTransfer01]);
    const backward = tasks.flatMap((task) => task.backwardTransfer01 === null ? [] : [task.backwardTransfer01]);
    return {
      taskCount: tasks.length,
      measuredForwardTransferTasks: forward.length,
      measuredBackwardTransferTasks: backward.length,
      meanForwardTransfer01: forward.length ? forward.reduce((a, b) => a + b, 0) / forward.length : null,
      meanBackwardTransfer01: backward.length ? backward.reduce((a, b) => a + b, 0) / backward.length : null,
      tasks,
    };
  }

  snapshot(): TransferSummary {
    return this.result();
  }

  restore(snapshot: TransferSummary): void {
    if (!snapshot || !Array.isArray(snapshot.tasks)) throw new TypeError('transfer-snapshot-invalid');
    const restored = new Map<string, TaskState>();
    for (const item of snapshot.tasks) {
      if (!item || !validTaskId(item.taskId) || restored.has(item.taskId.trim()) ||
          !Array.isArray(item.observations)) throw new TypeError('transfer-snapshot-entry-invalid');
      const state: TaskState = { baseline: null, beforeTraining: null, firstPostTraining: null, latest: null, observations: [] };
      let lastStage = -1;
      for (const observation of item.observations) {
        if (!observation || !isStage(observation.stage) || observation.stage < lastStage ||
            !isScore(observation.score01) ||
            !['baseline', 'before-task-training', 'after-task-training'].includes(observation.phase)) {
          throw new TypeError('transfer-snapshot-observation-invalid');
        }
        lastStage = observation.stage;
        state.observations.push({ ...observation });
        if (observation.phase === 'baseline') {
          if (state.baseline !== null || state.firstPostTraining !== null) throw new TypeError('transfer-snapshot-baseline-invalid');
          state.baseline = observation.score01;
        } else if (observation.phase === 'before-task-training') {
          if (state.baseline === null || state.firstPostTraining !== null) throw new TypeError('transfer-snapshot-pretraining-invalid');
          state.beforeTraining = observation.score01;
        } else {
          if (state.baseline === null || state.beforeTraining === null) throw new TypeError('transfer-snapshot-posttraining-invalid');
          if (state.firstPostTraining === null) state.firstPostTraining = observation.score01;
          state.latest = observation.score01;
        }
      }
      restored.set(item.taskId.trim(), state);
    }
    this.states.clear();
    for (const [key, state] of restored) this.states.set(key, state);
  }

  clear(): void {
    this.states.clear();
  }
}
