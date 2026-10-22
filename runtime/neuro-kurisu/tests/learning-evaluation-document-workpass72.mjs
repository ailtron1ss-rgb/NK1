import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLearningDocument } from "../src/learning/learning-evaluation-document-workpass72.mjs";

const run = (seed, reward, overrides = {}) => ({
  seed, reward, regret: 1 - reward, success: reward >= 0.7,
  latencyMs: 100, ...overrides
});

test("JSON evidence adapter returns a versioned report and never auto-promotes tiny samples", () => {
  const document = {
    schemaVersion: 1,
    baseline: [run(1, 0.4), run(2, 0.5)],
    candidate: [run(1, 0.8), run(2, 0.9)]
  };
  const report = evaluateLearningDocument(document);
  assert.equal(report.kind, "nk1.learning-evaluation-report");
  assert.equal(report.evaluation.sampleCount, 2);
  assert.equal(report.evaluation.promotionEligible, false);
  assert.equal(report.evaluation.gates.minimumSampleCount, false);
});

test("rejects unsupported document schema and missing run arrays", () => {
  assert.throws(() => evaluateLearningDocument({ schemaVersion: 2, baseline: [], candidate: [] }), /schemaVersion must be 1/);
  assert.throws(() => evaluateLearningDocument({ schemaVersion: 1, baseline: [] }), /baseline and candidate run arrays/);
});

test("rejects non-object options instead of silently spreading malformed input", () => {
  assert.throws(() => evaluateLearningDocument({
    schemaVersion: 1, baseline: [run(1, 0.2), run(2, 0.3)],
    candidate: [run(1, 0.4), run(2, 0.5)], options: []
  }), /options must be an object/);
});

test("options cannot replace the baseline or candidate evidence arrays", () => {
  const baseline = [run(1, 0.4), run(2, 0.5)];
  const candidate = [run(1, 0.8), run(2, 0.9)];
  const report = evaluateLearningDocument({
    schemaVersion: 1, baseline, candidate,
    options: { baseline: [run(8, 0.1), run(9, 0.1)], minimumSampleCount: 2 }
  });
  assert.equal(report.evaluation.sampleCount, 2);
  assert.equal(report.evaluation.baseline.meanReward, 0.45);
});
