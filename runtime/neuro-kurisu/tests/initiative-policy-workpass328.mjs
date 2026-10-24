import test from "node:test";
import assert from "node:assert/strict";
import { evaluateInitiative, explainInitiative } from "../src/organism/extensions/motivation/InitiativePolicy.ts";

test("initiative is allowed when curiosity is high and the organism is stable", () => {
  const result = evaluateInitiative({
    energy: 0.8, threat: 0.1, curiosity: 0.9, confidence: 0.7,
    lastInitiativeAt: 0,
  }, 10_000);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "curiosity-drive-ready");
  assert.ok(result.priority > 0.7 && result.priority <= 1);
  assert.equal(result.nextEligibleAt, 3_610_000);
});

test("initiative defers to low energy and high threat", () => {
  assert.equal(evaluateInitiative({ energy: 0.1, curiosity: 1 }, 100).reason, "energy-below-threshold");
  assert.equal(evaluateInitiative({ energy: 1, threat: 0.9, curiosity: 1 }, 100).reason, "threat-priority");
});

test("initiative requires sufficient curiosity and respects cooldown", () => {
  assert.equal(evaluateInitiative({ energy: 1, curiosity: 0.2 }, 100).reason, "insufficient-curiosity");
  const result = evaluateInitiative({
    energy: 1, curiosity: 1, lastInitiativeAt: 50_000, cooldownMs: 60_000,
  }, 80_000);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "cooldown");
  assert.equal(result.nextEligibleAt, 110_000);
});

test("non-finite sensor values fall back safely and rationale is bounded", () => {
  const result = evaluateInitiative({
    energy: Number.NaN, threat: Number.POSITIVE_INFINITY,
    curiosity: Number.NaN, confidence: Number.NaN,
  }, 1_000);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "energy-below-threshold");
  assert.equal(explainInitiative(result), "energy-below-threshold");
});

test("initiative explanation sanitizes control characters", () => {
  const result = { allowed: true, reason: "curiosity-drive-ready" };
  assert.equal(
    explainInitiative(result, "memory\nreview\tand learning"),
    "Internal curiosity is high enough to initiate a check-in about memory review and learning.",
  );
});
