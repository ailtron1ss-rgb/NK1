import test from "node:test";
import assert from "node:assert/strict";
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

test("requires cognitive CI for pull requests targeting rebuild", () => {
  const missingTarget = pinnedWorkflow.replace("      - rebuild\n", "");
  const errors = validateCiConfig({
    workflows: { "workpass79-cognitive-regression.yml": missingTarget },
    nodeVersion: "22.16.0"
  });
  assert.match(errors.join("\n"), /must run for pull requests targeting rebuild/);
});

test("separates Hexis push and pull-request cancellation groups", () => {
  const hexisWorkflow = [
    "name: Hexis",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "concurrency:",
    "  group: nk1-hexis-${{ github.event_name }}-${{ github.head_ref || github.ref_name }}",
    "  cancel-in-progress: true",
    "jobs:",
    "  test:",
    "    runs-on: ubuntu-latest"
  ].join("\n");

  const validErrors = validateCiConfig({
    workflows: { "hexis-canonical-apply.yml": hexisWorkflow },
    nodeVersion: "24"
  });
  assert.deepEqual(validErrors, []);

  const sharedGroup = hexisWorkflow.replace(
    "nk1-hexis-${{ github.event_name }}-",
    "nk1-hexis-"
  );
  const invalidErrors = validateCiConfig({
    workflows: { "hexis-canonical-apply.yml": sharedGroup },
    nodeVersion: "24"
  });
  assert.match(invalidErrors.join("\n"), /must include github.event_name/);
});
