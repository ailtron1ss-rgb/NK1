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
  const priorA = buffer.add(sample(90));
  const priorB = buffer.add(sample(91));
  const incoming = [sample(1), sample(2), sample(3), sample(4)];
  const result = trainWithExperienceReplay(learner, incoming, buffer, {
    replayRatio: 0.5, replayBatchSize: 4
  });
  assert.equal(learner.calls, 1);
  assert.equal(result.incomingSampleCount, 4);
  assert.equal(result.replaySampleCount, 2);
  assert.equal(learner.lastSamples.length, 6);
  assert.equal(result.replayIds.length, 2);
  assert.ok(result.replayIds.every(id => id === priorA.id || id === priorB.id), "replay minibatch must contain only prior experiences");
  assert.equal(result.buffer.withinBudget, true);
});

test("rejects malformed budgets, strategies and replay ratios", () => {
  assert.throws(() => new BoundedExperienceReplayBuffer({ maxBytes: 0 }), /maxBytes must be a positive integer/);
  assert.throws(() => new BoundedExperienceReplayBuffer({ maxBytes: 100, strategy: "magic" }), /strategy must be uniform, diversity or prioritized/);
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 1000 });
  assert.throws(() => trainWithExperienceReplay({ trainBatch() {} }, [], buffer, { replayRatio: 2 }), /replayRatio must be in/);
});

test("restores replay samples and PRNG state reproducibly across a restart", () => {
  const original = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 991 });
  for (let i = 0; i < 10; i += 1) original.add(sample(i));
  const checkpoint = original.snapshot();
  const expected = original.sample(5).map(entry => entry.id);
  const restarted = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 2 });
  restarted.restore(checkpoint);
  assert.deepEqual(restarted.sample(5).map(entry => entry.id), expected);
  assert.equal(restarted.stats.bytesUsed, original.stats.bytesUsed);
});

test("rejects corrupt snapshots instead of trusting persisted byte accounting", () => {
  const source = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 9 });
  source.add(sample(1));
  const corrupted = source.snapshot();
  corrupted.bytesUsed += 1;
  const target = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "uniform", seed: 9 });
  assert.throws(() => target.restore(corrupted), /byte accounting is inconsistent/);
  const wrongConfig = new BoundedExperienceReplayBuffer({ maxBytes: 1024, strategy: "uniform", seed: 9 });
  assert.throws(() => wrongConfig.restore(source.snapshot()), /maxBytes does not match/);
});

test("diversity replay spreads a minibatch across distinct task/action groups", () => {
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 8192, strategy: "diversity", seed: 31 });
  for (let i = 0; i < 12; i += 1) {
    buffer.add(sample(i, { replayGroup: i < 8 ? "memory" : "planning" }));
  }
  const draws = buffer.sample(6);
  assert.equal(draws.length, 6);
  assert.equal(new Set(draws.map(row => row.id)).size, 6);
  assert.ok(draws.some(row => row.sample.replayGroup === "memory"));
  assert.ok(draws.some(row => row.sample.replayGroup === "planning"));
  assert.ok(draws.every(row => row.samplingProbability > 0 && row.importanceWeight01 === 1));
});

test("prioritized replay supports minibatches larger than the resident buffer", () => {
  const buffer = new BoundedExperienceReplayBuffer({ maxBytes: 4096, strategy: "prioritized", seed: 12 });
  buffer.add(sample(1), { priority: 1 });
  buffer.add(sample(2), { priority: 3 });
  const draws = buffer.sample(20);
  assert.equal(draws.length, 20);
  assert.ok(draws.every(row => row.id === 1 || row.id === 2));
});
