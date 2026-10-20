/**
 * Small deterministic replay buffer for NK1's online policy-learning samples.
 * Byte-bounded for mobile/local use; supports uniform and priority-weighted draws.
 * It is opt-in and does not silently change the production learner's behavior.
 */
import { Buffer } from "node:buffer";

const finite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
};

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class BoundedExperienceReplayBuffer {
  #items = [];
  #bytes = 0;
  #nextId = 1;
  #random;

  constructor({ maxBytes, strategy = "uniform", seed = 42, priorityAlpha = 0.6, importanceBeta = 0.4 } = {}) {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new RangeError("maxBytes must be a positive integer");
    if (!["uniform", "prioritized"].includes(strategy)) throw new TypeError("strategy must be uniform or prioritized");
    if (!Number.isInteger(seed) || !Number.isFinite(seed)) throw new TypeError("seed must be a finite integer");
    for (const [name, value] of Object.entries({ priorityAlpha, importanceBeta })) {
      finite(value, name);
      if (value < 0 || value > 1) throw new RangeError(`${name} must be in [0, 1]`);
    }
    this.maxBytes = maxBytes;
    this.strategy = strategy;
    this.priorityAlpha = priorityAlpha;
    this.importanceBeta = importanceBeta;
    this.#random = makeRandom(seed);
  }

  add(sample, { priority = 1 } = {}) {
    if (!sample || typeof sample !== "object" || Array.isArray(sample)) throw new TypeError("sample must be an object");
    finite(priority, "priority");
    if (priority < 0) throw new RangeError("priority must be non-negative");
    const snapshot = structuredClone(sample);
    const serialized = JSON.stringify(snapshot);
    if (typeof serialized !== "string") throw new TypeError("sample must be JSON serializable");
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > this.maxBytes) return { accepted: false, reason: "sample-exceeds-budget", bytes, id: null };

    while (this.#bytes + bytes > this.maxBytes && this.#items.length) {
      let removeIndex = 0;
      if (this.strategy === "uniform") {
        removeIndex = Math.floor(this.#random() * this.#items.length);
      } else {
        removeIndex = this.#items.reduce((lowest, item, index, items) =>
          item.priority < items[lowest].priority ? index : lowest, 0);
      }
      const [removed] = this.#items.splice(removeIndex, 1);
      this.#bytes -= removed.bytes;
    }
    const item = { id: this.#nextId++, sample: snapshot, bytes, priority: Math.max(priority, 1e-8) };
    this.#items.push(item);
    this.#bytes += bytes;
    return { accepted: true, id: item.id, bytes, size: this.#items.length, totalBytes: this.#bytes };
  }

  updatePriority(id, priority) {
    finite(priority, "priority");
    if (priority < 0) throw new RangeError("priority must be non-negative");
    const item = this.#items.find(entry => entry.id === id);
    if (!item) return false;
    item.priority = Math.max(priority, 1e-8);
    return true;
  }

  sample(count) {
    if (!Number.isInteger(count) || count < 0) throw new RangeError("count must be a non-negative integer");
    const n = Math.min(count, this.#items.length);
    if (!n) return [];
    const available = [...this.#items];
    const selected = [];
    while (selected.length < n) {
      let index;
      if (this.strategy === "uniform") {
        index = Math.floor(this.#random() * available.length);
      } else {
        const weights = available.map(item => item.priority ** this.priorityAlpha);
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let draw = this.#random() * total;
        index = weights.findIndex(weight => (draw -= weight) < 0);
        if (index < 0) index = available.length - 1;
      }
      const [item] = available.splice(index, 1);
      const probability = this.strategy === "prioritized"
        ? item.priority ** this.priorityAlpha /
          this.#items.reduce((sum, entry) => sum + entry.priority ** this.priorityAlpha, 0)
        : 1 / this.#items.length;
      const maxWeight = this.strategy === "prioritized"
        ? Math.max(...this.#items.map(entry => (this.#items.length * (
          entry.priority ** this.priorityAlpha /
          this.#items.reduce((sum, candidate) => sum + candidate.priority ** this.priorityAlpha, 0)
        )) ** (-this.importanceBeta)))
        : 1;
      const importanceWeight = this.strategy === "prioritized"
        ? Math.min(1, (this.#items.length * probability) ** (-this.importanceBeta) / maxWeight)
        : 1;
      selected.push({ id: item.id, sample: structuredClone(item.sample), priority: item.priority,
        samplingProbability: probability, importanceWeight01: importanceWeight, bytes: item.bytes });
    }
    return selected;
  }

  get stats() {
    return {
      strategy: this.strategy,
      size: this.#items.length,
      bytesUsed: this.#bytes,
      maxBytes: this.maxBytes,
      budgetUtilization01: this.#bytes / this.maxBytes,
      withinBudget: this.#bytes <= this.maxBytes
    };
  }
}

/** Add current experience and train once on it plus a bounded replay minibatch. */
export function trainWithExperienceReplay(learner, incomingSamples, buffer, {
  replayRatio = 0.25,
  replayBatchSize = incomingSamples?.length ?? 0,
  priorityOf = () => 1
} = {}) {
  if (!learner || typeof learner.trainBatch !== "function") throw new TypeError("learner.trainBatch is required");
  if (!Array.isArray(incomingSamples)) throw new TypeError("incomingSamples must be an array");
  if (!(buffer instanceof BoundedExperienceReplayBuffer)) throw new TypeError("buffer must be a BoundedExperienceReplayBuffer");
  finite(replayRatio, "replayRatio");
  if (replayRatio < 0 || replayRatio > 1) throw new RangeError("replayRatio must be in [0, 1]");
  if (!Number.isInteger(replayBatchSize) || replayBatchSize < 0) throw new RangeError("replayBatchSize must be a non-negative integer");
  for (const sample of incomingSamples) buffer.add(sample, { priority: priorityOf(sample) });
  const replayCount = Math.floor(replayBatchSize * replayRatio);
  const replayEntries = buffer.sample(replayCount);
  const replay = replayEntries.map(entry => ({
    ...entry.sample,
    sampleWeight01: entry.importanceWeight01
  }));
  const trained = learner.trainBatch([...incomingSamples, ...replay]);
  return {
    trained,
    incomingSampleCount: incomingSamples.length,
    replaySampleCount: replay.length,
    buffer: buffer.stats,
    replayIds: replayEntries.map(entry => entry.id)
  };
}
