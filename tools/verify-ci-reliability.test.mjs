import test from "node:test";
import assert from "node:assert/strict";
import { validateCiConfig, validateWorkflowScriptReferences } from "./verify-ci-reliability.mjs";

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


test("maps npm run commands to the package in the actual workflow execution context", () => {
  const errors = validateWorkflowScriptReferences({
    workflows: {
      "multi-package.yml": `name: context-map
jobs:
  test:
    steps:
      - name: Runtime scripts
        working-directory: runtime/neuro-kurisu
        run: npm run typecheck
      - name: App scripts selected by prefix
        run: npm --prefix app run build
      - name: Root scripts
        run: npm run audit:ci-reliability
`,
    },
    scriptsByContext: {
      root: { "audit:ci-reliability": "node tools/verify-ci-reliability.mjs" },
      app: { build: "vite build" },
      runtime: { typecheck: "node scripts/typecheck-runtime.mjs" },
    },
  });
  assert.deepEqual(errors, []);
});

test("reports undefined scripts in their correct package instead of a false root match", () => {
  const errors = validateWorkflowScriptReferences({
    workflows: {
      "broken-wiring.yml": `jobs:
  test:
    steps:
      - name: Runtime missing script
        working-directory: runtime/neuro-kurisu
        run: npm run missing-runtime-test
      - name: Explicit runtime prefix
        run: npm --prefix runtime/neuro-kurisu run missing-prefixed-test
      - name: App missing script
        run: npm --prefix app run missing-app-test
`,
    },
    scriptsByContext: {
      root: { "missing-runtime-test": "must-not-satisfy-runtime" },
      app: { build: "vite build" },
      runtime: { typecheck: "node scripts/typecheck-runtime.mjs" },
    },
  });
  assert.equal(errors.length, 3);
  assert.match(errors.join("\n"), /missing-runtime-test is not defined in the runtime package.json/);
  assert.match(errors.join("\n"), /missing-prefixed-test is not defined in the runtime package.json/);
  assert.match(errors.join("\n"), /missing-app-test is not defined in the app package.json/);
});

test("keeps legacy policy-only unit callers backward-compatible when script maps are omitted", () => {
  assert.deepEqual(validateWorkflowScriptReferences({
    workflows: { "old-test.yml": "run: npm run intentionally-unmapped\n" },
  }), []);
});
