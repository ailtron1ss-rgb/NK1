/**
 * Small deterministic replay buffer for NK1's online policy-learning samples.
 * Byte-bounded for mobile/local use; supports uniform, diversity-aware and priority-weighted draws.
 * It is opt-in and does not silently change the production learner's behavior.
 */
import { Buffer } from "node:buffer";

const finite = (value, label) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
};

function makeRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    getState() { return state; },
    setState(nextState) {
      if (!Number.isInteger(nextState) || nextState < 0 || nextState > 0xFFFFFFFF) {
        throw new RangeError("rngState must be an unsigned 32-bit integer");
      }
      state = nextState >>> 0;
    }
  };
}

export class BoundedExperienceReplayBuffer {
  #items = [];
  #bytes = 0;
  #nextId = 1;
  #random;

  constructor({ maxBytes, strategy = "uniform", seed = 42, priorityAlpha = 0.6, importanceBeta = 0.4 } = {}) {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new RangeError("maxBytes must be a positive integer");
    if (!["uniform", "diversity", "prioritized"].includes(strategy)) throw new TypeError("strategy must be uniform, diversity or prioritized");
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
      if (this.strategy === "uniform" || this.strategy === "diversity") {
        removeIndex = Math.floor(this.#random.next() * this.#items.length);
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
    const n = this.strategy === "prioritized" ? count : Math.min(count, this.#items.length);
    if (!n || this.#items.length === 0) return [];
    const selected = [];
    const totalPriority = this.#items.reduce((sum, item) => sum + item.priority ** this.priorityAlpha, 0);
    const probabilityFor = item => this.strategy === "prioritized"
      ? item.priority ** this.priorityAlpha / totalPriority
      : 1 / this.#items.length;
    const maxUnnormalizedWeight = this.strategy === "prioritized"
      ? Math.max(...this.#items.map(item => (this.#items.length * probabilityFor(item)) ** (-this.importanceBeta)))
      : 1;

    // Uniform sampling is without replacement. Prioritized experience replay
    // samples with replacement, matching the probability used by its IS weights.
    const available = this.strategy !== "prioritized" ? [...this.#items] : null;
    for (let drawIndex = 0; drawIndex < n; drawIndex += 1) {
      let item;
      let drawProbability = probabilityFor(this.#items[0]);
      if (this.strategy === "uniform") {
        const index = Math.floor(this.#random.next() * available.length);
        [item] = available.splice(index, 1);
        drawProbability = 1 / (available.length + 1);
      } else if (this.strategy === "diversity") {
        const groups = new Map();
        for (const entry of available) {
          const group = String(entry.sample.replayGroup ?? entry.sample.taskId ?? entry.sample.action ?? entry.sample.kind ?? "__default__");
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group).push(entry);
        }
        const groupKeys = [...groups.keys()];
        const chosenGroup = groupKeys[Math.floor(this.#random.next() * groupKeys.length)];
        const candidates = groups.get(chosenGroup);
        item = candidates[Math.floor(this.#random.next() * candidates.length)];
        available.splice(available.findIndex(entry => entry.id === item.id), 1);
        drawProbability = 1 / groupKeys.length / candidates.length;
      } else {
        let draw = this.#random.next() * totalPriority;
        item = this.#items.find(entry => (draw -= entry.priority ** this.priorityAlpha) < 0)
          ?? this.#items[this.#items.length - 1];
      }
      const probability = this.strategy === "diversity" ? drawProbability : probabilityFor(item);
      const rawImportanceWeight = this.strategy === "prioritized"
        ? (this.#items.length * probability) ** (-this.importanceBeta)
        : 1;
      const importanceWeight = this.strategy === "prioritized"
        ? Math.min(1, rawImportanceWeight / maxUnnormalizedWeight)
        : 1;
      selected.push({
        id: item.id,
        sample: structuredClone(item.sample),
        priority: item.priority,
        samplingProbability: probability,
        importanceWeight01: importanceWeight,
        bytes: item.bytes
      });
    }
    return selected;
  }
  snapshot() {
    return {
      schemaVersion: 1,
      strategy: this.strategy,
      maxBytes: this.maxBytes,
      priorityAlpha: this.priorityAlpha,
      importanceBeta: this.importanceBeta,
      rngState: this.#random.getState(),
      nextId: this.#nextId,
      bytesUsed: this.#bytes,
      items: this.#items.map(item => ({
        id: item.id, sample: structuredClone(item.sample), bytes: item.bytes, priority: item.priority
      }))
    };
  }

  restore(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new TypeError("snapshot must be an object");
    }
    if (snapshot.schemaVersion !== 1) throw new Error("unsupported replay snapshot schemaVersion");
    for (const key of ["strategy", "maxBytes", "priorityAlpha", "importanceBeta"]) {
      if (snapshot[key] !== this[key]) throw new Error(`snapshot ${key} does not match buffer configuration`);
    }
    if (!Array.isArray(snapshot.items)) throw new TypeError("snapshot.items must be an array");
    if (!Number.isInteger(snapshot.nextId) || snapshot.nextId < 1) throw new RangeError("snapshot.nextId is invalid");
    if (!Number.isInteger(snapshot.rngState) || snapshot.rngState < 0 || snapshot.rngState > 0xFFFFFFFF) {
      throw new RangeError("snapshot.rngState is invalid");
    }
    const restored = [];
    const ids = new Set();
    let bytes = 0;
    for (const [index, raw] of snapshot.items.entries()) {
      if (!raw || !Number.isInteger(raw.id) || raw.id < 1 || ids.has(raw.id)) {
        throw new Error(`snapshot.items[${index}].id is invalid or duplicated`);
      }
      if (!Number.isFinite(raw.priority) || raw.priority <= 0) {
        throw new RangeError(`snapshot.items[${index}].priority must be positive and finite`);
      }
      const sample = structuredClone(raw.sample);
      const measuredBytes = Buffer.byteLength(JSON.stringify(sample), "utf8");
      if (measuredBytes !== raw.bytes) throw new Error(`snapshot.items[${index}] byte size does not match its sample`);
      ids.add(raw.id);
      bytes += measuredBytes;
      restored.push({ id: raw.id, sample, bytes: measuredBytes, priority: raw.priority });
    }
    if (bytes > this.maxBytes || bytes !== snapshot.bytesUsed) throw new Error("snapshot byte accounting is inconsistent or exceeds budget");
    if (restored.some(item => item.id >= snapshot.nextId)) throw new Error("snapshot.nextId must exceed every stored item ID");
    this.#items = restored;
    this.#bytes = bytes;
    this.#nextId = snapshot.nextId;
    this.#random.setState(snapshot.rngState);
    return this.stats;
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
  // Draw only prior experience before inserting the current batch. Otherwise
  // every new sample could be trained twice in its first update, biasing the
  // comparison against a true no-replay baseline.
  const replayCount = Math.floor(replayBatchSize * replayRatio);
  const replayEntries = buffer.sample(replayCount);
  for (const sample of incomingSamples) buffer.add(sample, { priority: priorityOf(sample) });
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
