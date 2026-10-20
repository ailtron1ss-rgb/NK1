import test from "node:test";
import assert from "node:assert/strict";
import {
  BoundedExperienceReplayBuffer,
  trainWithExperienceReplay
} from "../src/learning/bounded-experience-replay-workpass76.mjs";

const sample = (id, extra = {}) => ({
  state: { energy: 0.2 + id / 100 },
  action: id % 2 ? "rest" : "respond",
  target01: id / 10,
  learningRate01: 0.08,
  id,
  ...extra
});

test("byte-bounded replay never exceeds its configured memory budget", () => {
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 240, strategy: "uniform", seed: 17 });
  for (let i = 0; i < 20; i += 1) buffer.add(sample(i));
  assert.ok(buffer.stats.size > 0);
  assert.ok(buffer.stats.bytesUsed <= 240);
  assert.equal(buffer.stats.withinBudget, true);
  const rejected = buffer.add({ data: "x".repeat(1000) });
  assert.equal(rejected.accepted, false);
  assert.equal(buffer.stats.bytesUsed <= 240, true);
});

test("uniform replay sampling is deterministic for a fixed seed and samples without replacement", () => {
  const make = () => {
    const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 123 });
    for (let i = 0; i < 8; i += 1) buffer.add(sample(i));
    return buffer.sample(5).map(entry => entry.id);
  };
  assert.deepEqual(make(), make());
  assert.equal(new Set(make()).size, 5);
});

test("prioritized replay exposes importance weights and permits priority updates", () => {
  const buffer = new BoundedExperienceReplayBuffer({
    maxBytes: 4096, strategy: "prioritized", seed: 7, priorityAlpha: 1, importanceBeta: 0.5
  });
  const low = buffer.add(sample(1), { priority: 0.1 });
  const high = buffer.add(sample(2), { priority: 10 });
  assert.equal(buffer.updatePriority(high.id, 20), true);
  assert.equal(buffer.updatePriority(999, 1), false);
  const entries = buffer.sample(2);
  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => entry.importanceWeight01 > 0 && entry.importanceWeight01 <= 1));
  assert.ok(entries.every(entry => entry.samplingProbability > 0));
  assert.ok(buffer.stats.withinBudget);
});

test("training adapter trains incoming data plus replay and reports measured buffer use", () => {
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 42 });
  const learner = {
    calls: 0,
    lastSamples: [],
    trainBatch(samples) {
      this.calls += 1;
      this.lastSamples = samples;
      return { samples: samples.length, updates: this.calls };
    }
  };
  const incoming = [sample(1), sample(2), sample(3), sample(4)];
  const result = trainWithExperienceReplay(learner, incoming, buffer, {
    replayRatio: 0.5, replayBatchSize: 4
  });
  assert.equal(learner.calls, 1);
  assert.equal(result.incomingSampleCount, 4);
  assert.equal(result.replaySampleCount, 2);
  assert.equal(learner.lastSamples.length, 6);
  assert.equal(result.replayIds.length, 2);
  assert.equal(result.buffer.withinBudget, true);
});

test("rejects malformed budgets, strategies and replay ratios", () => {
  assert.throws(() => new BoundedExperienceReplayBuffer({ maxBytes: 0 }), /maxBytes must be a positive integer/);
  assert.throws(() => new BoundedExperienceReplayBuffer({ maxBytes: 100, strategy: "magic" }), /strategy must be uniform or prioritized/);
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 1000 });
  assert.throws(() => trainWithExperienceReplay({ trainBatch() {} }, [], buffer, { replayRatio: 2 }), /replayRatio must be in/);
});
