import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/nk1-release-license-audit.yml", import.meta.url),
  "utf8",
);

test("license snapshot runs on current source and supports manual refresh", () => {
  assert.match(workflow, /branches: \[workpass70-source\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /npm run test:provenance-current/);
  assert.match(workflow, /node tools\/audit-release-license-readiness\.mjs/);
});

test("license snapshot is read-only and never packages or publishes releases", () => {
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /gh release create|gh release upload|upload_url/);
  assert.doesNotMatch(workflow, /git archive|Neuro_Kurisu_WORKPASS70_MAIN_SYNC_/);
});

test("pending legal decisions are reported without pretending the audit is approval", () => {
  assert.match(workflow, /Release redistribution ready/);
  assert.match(workflow, /does not approve licenses, grant redistribution rights/);
  assert.match(workflow, /Release remains blocked by pending or invalid human license decisions/);
});
