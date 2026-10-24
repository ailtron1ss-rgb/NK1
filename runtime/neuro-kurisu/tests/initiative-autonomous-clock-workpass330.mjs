import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/organism/core/OrganismRuntime.ts", import.meta.url), "utf8");

test("the production cognitive clock initiates endogenous cycles without external text", () => {
  const clockAt = runtime.indexOf("id: 'cognitive', initialDelayMs: 0");
  assert.ok(clockAt >= 0, "cognitive clock must be registered");
  const taskAt = runtime.indexOf("task: async () =>", clockAt);
  const nextClockAt = runtime.indexOf("id: 'embodiment'", taskAt);
  assert.ok(taskAt > clockAt && nextClockAt > taskAt, "cognitive task must belong to cognitive clock");
  const task = runtime.slice(taskAt, nextClockAt);
  assert.match(task, /this\.step\(undefined,\s*\{\s*deliberate:\s*false,\s*spontaneous:\s*true\s*\}\)/);
  assert.match(runtime, /if\s*\(this\.config\.autoRun\)\s*this\.startCognitiveClock\(\)/);
});

test("autonomous initiative gate remains restricted to spontaneous, non-user cycles", () => {
  assert.match(runtime, /const initiativeDecision = !externalText && options\.spontaneous/);
  assert.match(runtime, /if\s*\(!externalText && options\.spontaneous && initiativeDecision && !initiativeDecision\.allowed\)/);
  assert.match(runtime, /source:\s*'initiative-policy'/);
});
