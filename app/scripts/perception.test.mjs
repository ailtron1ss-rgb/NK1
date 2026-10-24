import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeObservation,
  buildWorldClaims,
  currentWorldModel,
} from "../src/organism/perception.ts";

const now = 1_800_000_000_000;
const observation = (overrides = {}) => ({
  id: "event-1",
  source: "sensor-a",
  modality: "environment",
  subject: "room",
  predicate: "temperature",
  value: 21,
  observedAt: now - 1000,
  receivedAt: now,
  confidence: 0.9,
  ...overrides,
});

test("normalizes confidence and canonical text while preserving provenance", () => {
  const result = normalizeObservation(observation({ source: "  sensor-a  ", confidence: 4 }), now);
  assert.equal(result.source, "sensor-a");
  assert.equal(result.confidence, 1);
  assert.equal(result.status, "current");
  assert.ok(result.freshness > 0 && result.freshness <= 1);
});

test("rejects malformed parent lineage rather than silently filtering it", () => {
  const result = normalizeObservation(observation({ parentIds: ["root", " root "] }), now);
  assert.equal(result.status, "invalid");
  assert.equal(result.confidence, 0);
});

test("marks old observations stale and excludes them from the world model", () => {
  const old = observation({ observedAt: now - 60 * 60_000 });
  assert.equal(normalizeObservation(old, now).status, "stale");
  assert.deepEqual(currentWorldModel([old], now), []);
});

test("deduplicates event IDs and exposes contradictory observations", () => {
  const a = normalizeObservation(observation(), now);
  const duplicate = normalizeObservation(observation({ source: "sensor-b" }), now);
  const conflict = normalizeObservation(observation({
    id: "event-2", source: "sensor-c", value: 29, confidence: 0.8,
  }), now);
  const claims = buildWorldClaims([a, duplicate, conflict]);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, "conflicted");
  assert.equal(claims[0].supportingObservationIds.length, 1);
  assert.equal(claims[0].conflictingObservationIds.length, 1);
});

test("separate predicates produce separate claims", () => {
  const a = observation();
  const b = observation({ id: "event-2", predicate: "humidity", value: 45 });
  assert.equal(currentWorldModel([a, b], now).length, 2);
});
