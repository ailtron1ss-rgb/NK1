import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDocumentationInventory } from "./audit-documentation-inventory.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-doc-inventory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "old"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeFile(path.join(root, "README.md"), "# Root\n\n[status](docs/PROJECT_CURRENT_STATUS_1.md)\n");
  await writeFile(path.join(root, "docs", "PROJECT_CURRENT_STATUS_1.md"), "# Status snapshot\n");
  await writeFile(path.join(root, "old", "PROJECT_CURRENT_STATUS_2.md"), "# Status snapshot\n");
  await writeFile(path.join(root, "docs", "unlinked-note.md"), "# Unlinked note\n");
  await writeFile(path.join(root, "scripts", "uses-status.mjs"), 'const report = "docs/PROJECT_CURRENT_STATUS_1.md";\n');
  return root;
}

test("groups exact content without claiming same-name families are duplicates", async (t) => {
  const root = await fixture(t);
  const result = await buildDocumentationInventory({ root });
  assert.equal(result.scannedFiles, 4);
  assert.equal(result.exactDuplicateGroupCount, 1);
  assert.equal(result.exactDuplicateGroups[0].count, 2);
  assert.deepEqual(result.exactDuplicateGroups[0].paths, [
    "docs/PROJECT_CURRENT_STATUS_1.md",
    "old/PROJECT_CURRENT_STATUS_2.md"
  ]);
  const family = result.filenameFamilies.find((group) => group.family === "project-current-status");
  assert.equal(family.count, 2);
});

test("counts known inbound links and marks zero-inbound candidates conservatively", async (t) => {
  const root = await fixture(t);
  const result = await buildDocumentationInventory({ root });
  assert.equal(result.zeroInboundLinkCandidateCount, 2);
  assert.ok(result.zeroInboundLinkCandidates.some((item) => item.path === "docs/unlinked-note.md"));
  assert.ok(result.zeroInboundLinkCandidates.some((item) => item.path === "old/PROJECT_CURRENT_STATUS_2.md"));
  assert.ok(!result.zeroInboundLinkCandidates.some((item) => item.path === "docs/PROJECT_CURRENT_STATUS_1.md"));
  const referencedStatus = result.zeroInboundLinkCandidates.find((item) => item.path === "docs/PROJECT_CURRENT_STATUS_1.md");
  assert.equal(referencedStatus, undefined);
  assert.ok(result.nonMarkdownReferenceFileCount >= 1);
  assert.ok(result.nonMarkdownReferenceHitCount >= 1);
  assert.ok(result.zeroInboundAllLocalReferenceCandidates.some((item) => item.path === "docs/unlinked-note.md"));
});

test("does not fail silently for missing inventory inputs", async (t) => {
  const root = await fixture(t);
  const result = await buildDocumentationInventory({ root, files: ["missing.md"] });
  assert.equal(result.scannedFiles, 0);
  assert.equal(result.unreadableOrMissingFiles, 1);
  assert.equal(result.issues[0].path, "missing.md");
});
