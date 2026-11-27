import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../../.github/workflows/nk1-articulated-body-physics.yml", import.meta.url),
  "utf8",
);

test("articulated-body proof runs are isolated per pull request or ref", () => {
  assert.match(
    workflow,
    /group:\s*nk1-articulated-body-physics-\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*github\.ref\s*\}\}/,
  );
  assert.match(workflow, /cancel-in-progress:\s*false/);
});

test("the workflow explicitly executes body and workflow concurrency contracts", () => {
  const pathBlock = workflow.match(/pull_request:[\s\S]*?paths:\s*\n([\s\S]*?)\n\s*push:/)?.[1] ?? "";
  assert.match(pathBlock, /^\s*- "app\/scripts\/articulated-body-workflow\.test\.mjs"\s*$/m);
  assert.match(pathBlock, /^\s*- "app\/scripts\/articulated-body-particles\.test\.mjs"\s*$/m);
  assert.match(workflow, /articulated-body-workflow\.test\.mjs/);
});
