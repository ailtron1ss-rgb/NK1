import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectAvatarMotorActionTo3DAction } from "../src/components/avatar/avatarMotorProjection.ts";

test("projects every canonical motor action into a supported 3D rig action", () => {
  assert.deepEqual(
    ["rest", "listen", "reflect", "inspect", "explain", "comfort", "respond"].map(projectAvatarMotorActionTo3DAction),
    ["rest", "wait", "reflect", "explore", "respond", "respond", "respond"],
  );
});

test("AvatarStage forwards the speech lifecycle required by the shared 3D motor planner", async () => {
  const stage = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  const start = stage.indexOf("<Avatar3DStage");
  const end = stage.indexOf("/> : <>", start);
  assert.ok(start >= 0 && end > start, "Avatar3DStage invocation must remain present");
  const call = stage.slice(start, end);
  assert.match(call, /hasFreshTurn=\{/);
  assert.match(call, /turnText=\{/);
  assert.match(call, /predictionError=\{snap\.predictionError\}/);
  assert.match(call, /traits=\{snap\.identity\.traits\}/);
});

test("3D renderer consumes the shared motor plan for action selection, head tilt and gesture damping", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /planAvatarMotorIntent/);
  assert.match(stage, /projectAvatarMotorActionTo3DAction/);
  assert.match(stage, /motorIntent\.headTilt/);
  assert.match(stage, /motorIntent\.gesture/);
  assert.match(stage, /headTilt: motorIntent.headTilt/);
  assert.match(stage, /latestMotorIntent/);
});
