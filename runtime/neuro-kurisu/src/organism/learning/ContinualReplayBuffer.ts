import type { ActionKind } from '../core/types.ts';
import { ParametricPolicyLearner } from './ParametricPolicyLearner.ts';
import { priorityFromTdError, samplePrioritized } from './PrioritizedReplaySampler.ts';

export interface ReplayExperience {
  taskId: string;
  features: number[];
  action: ActionKind;
  target01: number;
  learningRate01: number;
  sampleWeight01?: number;
}

export interface ReplayTrainingReport {
  currentCount: number;
  replayCount: number;
  memorySize: number;
  seenCount: number;
  meanLoss01: number;
  perTaskMemory: Record<string, number>;
  replayStrategy: 'balanced' | 'prioritized';
}

export interface ReplayTrainingOptions {
  strategy?: 'balanced' | 'prioritized';
  alpha?: number;
  beta?: number;
  random?: () => number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Bounded experience replay adapted from continual-learning replay strategies.
 * Keeps memory lightweight and dependency-free for the Neuro Kurisu runtime.
 * Randomness is injectable so tests and experiments can be reproduced.
 */
export class ContinualReplayBuffer {
  readonly capacity: number;
  private readonly memory: ReplayExperience[] = [];
  private seen = 0;
  private readonly random: () => number;
  private readonly actions: Set<string>;

  constructor(
    capacity: number,
    actions: readonly ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'],
    random: () => number = Math.random,
  ) {
    this.capacity = capacity;
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('replay-capacity-must-be-positive-integer');
    if (typeof random !== 'function') throw new TypeError('replay-random-must-be-function');
    this.actions = new Set(actions);
    if (this.actions.size === 0) throw new TypeError('replay-actions-required');
    this.random = () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('replay-random-out-of-range');
      return value;
    };
  }

  get size(): number { return this.memory.length; }
  get seenCount(): number { return this.seen; }

  private validate(raw: ReplayExperience): ReplayExperience {
    if (!isRecord(raw) || !nonEmpty(raw.taskId)) throw new TypeError('replay-task-id-required');
    if (!Array.isArray(raw.features) || raw.features.length === 0 || raw.features.some((v) => !Number.isFinite(v))) {
      throw new TypeError('replay-features-must-be-nonempty-finite-array');
    }
    if (typeof raw.action !== 'string' || !this.actions.has(raw.action)) throw new TypeError('replay-action-invalid');
    if (!Number.isFinite(raw.target01) || raw.target01 < 0 || raw.target01 > 1) throw new TypeError('replay-target-out-of-range');
    if (!Number.isFinite(raw.learningRate01) || raw.learningRate01 <= 0) throw new TypeError('replay-learning-rate-invalid');
    if (raw.sampleWeight01 !== undefined && (!Number.isFinite(raw.sampleWeight01) || raw.sampleWeight01 < 0 || raw.sampleWeight01 > 1)) {
      throw new TypeError('replay-sample-weight-out-of-range');
    }
    return {
      taskId: raw.taskId.trim(),
      features: raw.features.slice(),
      action: raw.action,
      target01: raw.target01,
      learningRate01: raw.learningRate01,
      ...(raw.sampleWeight01 === undefined ? {} : { sampleWeight01: raw.sampleWeight01 }),
    };
  }

  validateForTraining(raw: ReplayExperience): ReplayExperience { return this.validate(raw); }

  add(raw: ReplayExperience): void {
    const item = this.validate(raw);
    this.seen += 1;
    if (this.memory.length < this.capacity) {
      this.memory.push(item);
      return;
    }
    // Algorithm R: every observed experience has an equal probability of
    // occupying a slot in the bounded reservoir.
    const candidate = Math.floor(this.random() * this.seen);
    if (candidate < this.capacity) this.memory[candidate] = item;
  }

  addMany(items: ReplayExperience[]): void {
    if (!Array.isArray(items)) throw new TypeError('replay-items-must-be-array');
    // Validate the entire intake first to avoid partial memory mutation.
    const valid = items.map((item) => this.validate(item));
    for (const item of valid) this.add(item);
  }

  sampleBalanced(count: number): ReplayExperience[] {
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('replay-sample-count-invalid');
    if (count === 0 || this.memory.length === 0) return [];
    const groups = new Map<string, ReplayExperience[]>();
    for (const item of this.memory) {
      const group = groups.get(item.taskId) ?? [];
      group.push(item);
      groups.set(item.taskId, group);
    }
    const buckets = [...groups.values()];
    // Shuffle task buckets and their members with the injected RNG.
    const shuffle = <T>(items: T[]): T[] => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };
    const shuffled = buckets.map(shuffle);
    const result: ReplayExperience[] = [];
    let round = 0;
    while (result.length < Math.min(count, this.memory.length)) {
      const active = shuffled.filter((bucket) => bucket[round] !== undefined);
      if (active.length === 0) break;
      for (const bucket of shuffle(active)) {
        if (result.length >= Math.min(count, this.memory.length)) break;
        result.push(bucket[round]);
      }
      round += 1;
    }
    return result.map((item) => ({ ...item, features: item.features.slice() }));
  }

  taskCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of this.memory) counts[item.taskId] = (counts[item.taskId] ?? 0) + 1;
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  }

  snapshot(): { version: 1; capacity: number; seenCount: number; items: ReplayExperience[] } {
    return {
      version: 1,
      capacity: this.capacity,
      seenCount: this.seen,
      items: this.memory.map((item) => ({ ...item, features: item.features.slice() })),
    };
  }

  restore(raw: unknown): void {
    if (!isRecord(raw) || raw.version !== 1 || raw.capacity !== this.capacity ||
        !Number.isSafeInteger(raw.seenCount) || Number(raw.seenCount) < 0 ||
        !Array.isArray(raw.items) || raw.items.length > this.capacity || Number(raw.seenCount) < raw.items.length) {
      throw new TypeError('replay-snapshot-invalid');
    }
    const items = raw.items.map((item) => this.validate(item as ReplayExperience));
    this.memory.splice(0, this.memory.length, ...items);
    this.seen = Number(raw.seenCount);
  }

  clear(): void {
    this.memory.length = 0;
    this.seen = 0;
  }
}

/**
 * Train on current examples plus older experience. Balanced sampling remains
 * the default; proportional prioritization is opt-in and uses the learner's
 * current absolute prediction error as its priority signal. Memory is sampled
 * before current items are inserted to avoid double-counting the current batch.
 */
export function trainWithExperienceReplay(
  learner: ParametricPolicyLearner,
  buffer: ContinualReplayBuffer,
  current: ReplayExperience[],
  replayBatchSize: number,
  options: ReplayTrainingOptions = {},
): ReplayTrainingReport {
  if (!Array.isArray(current)) throw new TypeError('replay-current-batch-required');
  if (!Number.isSafeInteger(replayBatchSize) || replayBatchSize < 0) throw new RangeError('replay-batch-size-invalid');
  // Validate the entire current batch before changing either learner or memory.
  const checked = current.map((item) => buffer.validateForTraining(item));
  const strategy = options.strategy ?? 'balanced';
  if (strategy !== 'balanced' && strategy !== 'prioritized') throw new TypeError('replay-strategy-invalid');
  const replay = strategy === 'balanced'
    ? buffer.sampleBalanced(replayBatchSize).map((item) => ({ item, weight: item.sampleWeight01 ?? 1 }))
    : samplePrioritized(buffer.snapshot().items.map((item) => ({
        item,
        priority01: priorityFromTdError(Math.abs(item.target01 - learner.predictFromFeatures(item.features, item.action))),
      })), replayBatchSize, { alpha: options.alpha, beta: options.beta })
        .map((sample) => ({ item: sample.item.item, weight: sample.importanceWeight01 * (sample.item.item.sampleWeight01 ?? 1) }));
  const combined = [...checked.map((item) => ({ item, weight: item.sampleWeight01 ?? 1 })), ...replay];
  let loss = 0;
  for (const entry of combined) {
    const item = entry.item;
    loss += learner.trainFeatures({
      features: item.features,
      action: item.action,
      target01: item.target01,
      learningRate01: item.learningRate01,
      sampleWeight01: Math.max(0, Math.min(1, entry.weight)),
    }).loss01;
  }
  buffer.addMany(checked);
  return {
    currentCount: checked.length,
    replayCount: replay.length,
    memorySize: buffer.size,
    seenCount: buffer.seenCount,
    meanLoss01: combined.length ? Number((loss / combined.length).toFixed(6)) : 0,
    perTaskMemory: buffer.taskCounts(),
    replayStrategy: strategy,
  };
}
