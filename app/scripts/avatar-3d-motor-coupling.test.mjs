import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("3D renderer has an explicit projection from all canonical motor actions", async () => {
  const stage = await readFile(new URL("../src/components/Avatar3DStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /projectAvatarMotorActionTo3DAction/);
  for (const action of ["rest", "listen", "reflect", "inspect", "explain", "comfort", "respond"]) {
    assert.ok(stage.includes(action), "3D action projection is missing " + action);
  }
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
  assert.match(stage, /latestMotorIntent/);
});
