import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCiConfig } from "./verify-ci-reliability.mjs";

const pinnedWorkflow = `name: example
on:
  pull_request:
    branches:
      - rebuild
jobs:
  test:
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
      - name: Verify selected Node.js matches repository pin
        run: |
          expected="$(tr -d '[:space:]' < .nvmrc)"
          actual="$(node --version | sed 's/^v//')"
          case "$expected" in
            *.*.*) test "$actual" = "$expected" ;;
            *) case "$actual" in "$expected"|"$expected".*) ;; *) exit 1 ;; esac ;;
          esac
`;

test("accepts current first-party Actions and an asserted repository Node pin", () => {
  const errors = validateCiConfig({
    workflows: { "workpass79-cognitive-regression.yml": pinnedWorkflow },
    nodeVersion: "24\n"
  });
  assert.deepEqual(errors, []);
  const exactPinErrors = validateCiConfig({
    workflows: { "workpass79-cognitive-regression.yml": pinnedWorkflow },
    nodeVersion: "24.12.0\n"
  });
  assert.deepEqual(exactPinErrors, []);
});

test("rejects retired checkout/setup-node action majors", () => {
  const errors = validateCiConfig({
    workflows: { "old.yml": "steps:\n  - uses: actions/checkout@v4\n  - uses: actions/setup-node@v4\n" },
    nodeVersion: "22.16.0"
  });
  assert.ok(errors.length >= 2, `expected action-version errors, got: ${errors.join("\n")}`);
  assert.match(errors.join("\n"), /checkout@v4/);
  assert.match(errors.join("\n"), /setup-node@v4/);
  const pinnedShaErrors = validateCiConfig({
    workflows: { "sha-pinned.yml": "steps:\n  - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567\n" },
    nodeVersion: "22.16.0"
  });
  assert.match(pinnedShaErrors.join("\n"), /approved Node.js-24-compatible v7\+ release tag/);
});

test("requires setup-node to use and assert the shared .nvmrc", () => {
  const errors = validateCiConfig({
    workflows: { "workpass71-validation.yml": "steps:\n  - uses: actions/setup-node@v7\n    with:\n      node-version: '22'\n" },
    nodeVersion: "22.16.0"
  });
  assert.match(errors.join("\n"), /from root \.nvmrc/);
  assert.match(errors.join("\n"), /runtime assertion/);
});

test("rejects a missing or imprecise Node pin", () => {
  const errors = validateCiConfig({ workflows: { "minimal.yml": "run: echo ok\n" }, nodeVersion: "latest" });
  assert.match(errors.join("\n"), /major or exact version/);
});

test("rejects a too-short cognitive regression timeout", () => {
  const shortWorkflow = pinnedWorkflow.replace("timeout-minutes: 20", "timeout-minutes: 8");
  const errors = validateCiConfig({
    workflows: { "workpass79-cognitive-regression.yml": shortWorkflow },
    nodeVersion: "22.16.0"
  });
  assert.match(errors.join("\n"), /at least 15 minutes/);
});

test("rejects a workflow Node pin that drifts from the shared .nvmrc major", () => {
  const drifted = pinnedWorkflow.replace("node-version-file: '.nvmrc'", 'node-version: "22.12.0"');
  const errors = validateCiConfig({
    workflows: { "p26-learning-validation.yml": drifted },
    nodeVersion: "24\n"
  });
  assert.match(errors.join("\n"), /node-version 22\.12\.0 disagrees with root \.nvmrc major 24/);
  const aligned = validateCiConfig({
    workflows: { "p26-learning-validation.yml": drifted.replace("22.12.0", "24") },
    nodeVersion: "24\n"
  });
  assert.deepEqual(aligned, []);
});

test("requires cognitive CI for pull requests targeting rebuild", () => {
  const missingTarget = pinnedWorkflow.replace("      - rebuild\n", "");
  const errors = validateCiConfig({
    workflows: { "workpass79-cognitive-regression.yml": missingTarget },
    nodeVersion: "22.16.0"
  });
  assert.match(errors.join("\n"), /must run for pull requests targeting rebuild/);
});


test("release-required exact-SHA checks run on every canonical source push", async () => {
  const files = [
    ".github/workflows/workpass71-validation.yml",
    ".github/workflows/nk1-hexis-source-lineage.yml"
  ];
  for (const file of files) {
    const source = await readFile(new URL("../" + file, import.meta.url), "utf8");
    const pushBlock = /^  push:\n([\s\S]*?)(?=^  (?:pull_request|workflow_dispatch):|^jobs:)/m.exec(source)?.[1] ?? "";
    assert.ok(pushBlock, file + ": canonical source push trigger must exist");
    assert.match(pushBlock, /workpass70-source/, file + ": push trigger must include the canonical source branch");
    assert.doesNotMatch(pushBlock, /^\s*paths:/m, file + ": exact-SHA release-required check must not be skipped by push path filters");
    const pullRequestBlock = /^  pull_request:\n([\s\S]*?)(?=^  workflow_dispatch:|^permissions:)/m.exec(source)?.[1] ?? "";
    assert.match(pullRequestBlock, /^\s*paths:/m, file + ": pull-request path filters should remain scoped");
  }
});

 
test("release publisher starts only after exact-SHA core regression completes", async () => {
  const source = await readFile(new URL("../.github/workflows/publish-workpass70-main-sync.yml", import.meta.url), "utf8");
  const onBlock = /^on:\n([\s\S]*?)(?=^permissions:)/m.exec(source)?.[1] ?? "";
  assert.match(onBlock, /^  workflow_run:/m, "publisher must be triggered by the completed core regression workflow");
  assert.doesNotMatch(onBlock, /^  push:/m, "publisher must not race the core regression on an immediate source push");
  assert.match(onBlock, /workflows:\s*\["NeuroCore core regression validation"\]/);
  assert.match(source, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(source, /github\.event\.workflow_run\.head_branch == 'workpass70-source'/);
});
