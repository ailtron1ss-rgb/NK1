import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { solvePlanarTwoBoneIK } from "../src/components/avatar/motorKinematics.ts";

test("two-bone IK returns finite shoulder and elbow angles for a reachable target", () => {
  const result = solvePlanarTwoBoneIK({ targetX: 0.24, targetY: -0.42, upperLength: 0.3, lowerLength: 0.3, bendDirection: 1 });
  assert.ok(Number.isFinite(result.shoulderRotation));
  assert.ok(Number.isFinite(result.elbowRotation));
  assert.ok(result.reachableDistance <= 0.6);
  assert.equal(result.clamped, false);
});

test("unreachable targets clamp to the arm's safe reachable annulus", () => {
  const far = solvePlanarTwoBoneIK({ targetX: 100, targetY: -100, upperLength: 0.3, lowerLength: 0.3 });
  const near = solvePlanarTwoBoneIK({ targetX: 0, targetY: 0, upperLength: 0.3, lowerLength: 0.3 });
  assert.equal(far.clamped, true);
  assert.equal(near.clamped, true);
  assert.ok(far.reachableDistance < 0.6);
  assert.ok(near.reachableDistance > 0);
  assert.ok(far.reachError > 0 && near.reachError > 0);
});

test("invalid numeric inputs cannot produce NaN and segment lengths stay positive", () => {
  const result = solvePlanarTwoBoneIK({ targetX: Number.NaN, targetY: Number.POSITIVE_INFINITY, upperLength: 0, lowerLength: Number.NaN });
  for (const value of [result.shoulderRotation, result.elbowRotation, result.reachableDistance, result.requestedDistance, result.reachError]) assert.ok(Number.isFinite(value));
  assert.ok(result.reachableDistance > 0);
});

test("procedural and imported 3D arm paths both consume elbow IK", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /solvePlanarTwoBoneIK\(/);
  assert.match(stage, /leftElbow/);
  assert.match(stage, /rightElbow/);
  assert.match(stage, /leftforearm|leftlowerarm|leftelbow/);
  assert.match(stage, /rightforearm|rightlowerarm|rightelbow/);
  assert.match(stage, /upperLength:\.30,lowerLength:\.30/);
});
