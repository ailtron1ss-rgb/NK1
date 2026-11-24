/**
 * Task-level continual-learning forgetting metric, adapted conceptually from
 * ContinualAI/Avalanche's MIT-licensed Forgetting metric.
 *
 * Scores are expected to be held-out task quality in [0, 1] (higher is better).
 * The metric owns only scalar observations, never training examples or models.
 */
export interface TaskForgettingScore {
  taskId: string;
  bestScore01: number;
  latestScore01: number;
  forgetting01: number;
  observations: number;
}

export interface ForgettingSummary {
  taskCount: number;
  meanForgetting01: number;
  maxForgetting01: number;
  tasks: TaskForgettingScore[];
}

interface TaskState {
  best: number;
  latest: number;
  observations: number;
}

const score = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * Tracks the gap between the best observed held-out score and the latest score.
 * Call record() after evaluation on the same stable task-specific validation
 * set. Do not feed training rewards or untrusted self-reports into this metric.
 */
export class ContinualForgettingTracker {
  private readonly states = new Map<string, TaskState>();

  record(taskId: string, score01: number): TaskForgettingScore {
    if (typeof taskId !== 'string' || taskId.trim().length === 0) {
      throw new TypeError('forgetting-task-id-required');
    }
    if (!score(score01)) throw new RangeError('forgetting-score-out-of-range');

    const key = taskId.trim();
    const previous = this.states.get(key);
    const next: TaskState = previous
      ? {
          best: Math.max(previous.best, score01),
          latest: score01,
          observations: previous.observations + 1,
        }
      : { best: score01, latest: score01, observations: 1 };
    this.states.set(key, next);
    return this.toScore(key, next);
  }

  private toScore(taskId: string, state: TaskState): TaskForgettingScore {
    return {
      taskId,
      bestScore01: state.best,
      latestScore01: state.latest,
      forgetting01: Math.max(0, state.best - state.latest),
      observations: state.observations,
    };
  }

  result(): ForgettingSummary {
    const tasks = [...this.states.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([taskId, state]) => this.toScore(taskId, state));
    const total = tasks.reduce((sum, item) => sum + item.forgetting01, 0);
    return {
      taskCount: tasks.length,
      meanForgetting01: tasks.length ? total / tasks.length : 0,
      maxForgetting01: tasks.reduce((max, item) => Math.max(max, item.forgetting01), 0),
      tasks,
    };
  }

  snapshot(): ForgettingSummary {
    return this.result();
  }

  restore(snapshot: ForgettingSummary): void {
    if (!snapshot || !Array.isArray(snapshot.tasks)) throw new TypeError('forgetting-snapshot-invalid');
    const restored = new Map<string, TaskState>();
    for (const item of snapshot.tasks) {
      if (!item || typeof item.taskId !== 'string' || !item.taskId.trim()
        || !score(item.bestScore01) || !score(item.latestScore01)
        || !Number.isSafeInteger(item.observations) || item.observations < 1
        || item.bestScore01 < item.latestScore01) {
        throw new TypeError('forgetting-snapshot-entry-invalid');
      }
      const key = item.taskId.trim();
      if (restored.has(key)) throw new TypeError('forgetting-snapshot-duplicate-task');
      restored.set(key, {
        best: item.bestScore01,
        latest: item.latestScore01,
        observations: item.observations,
      });
    }
    this.states.clear();
    for (const [key, state] of restored) this.states.set(key, state);
  }

  clear(): void {
    this.states.clear();
  }
}
