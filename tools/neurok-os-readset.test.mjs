import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureReadSet, verifyReadSet } from "./neurok-os-readset.mjs";

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "neurok-readset-"));
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "NK1 test"], { cwd: root });
    execFileSync("git", ["config", "user.email", "nk1-test@example.invalid"], { cwd: root });
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src/core.mjs"), "export const value = 1;\n");
    await writeFile(path.join(root, "docs.md"), "base context\n");
    const baseSha = commit(root, "base");
    await run({ root, baseSha });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function commit(root, message) {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync("git", ["commit", "-m", message], { cwd: root, stdio: "ignore" });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

test("read-set remains valid across unrelated commits", async () => fixture(async ({ root, baseSha }) => {
  const receipt = captureReadSet(["src/core.mjs", "docs.md"], { root, baseSha });
  await writeFile(path.join(root, "unrelated.txt"), "no dependency change\n");
  const currentSha = commit(root, "unrelated change");
  const result = verifyReadSet(receipt, { root, currentSha });
  assert.equal(result.ok, true);
  assert.deepEqual(result.stalePaths, []);
  assert.equal(result.unchangedPaths.length, 2);
}));

test("changed dependency is rejected at patch admission", async () => fixture(async ({ root, baseSha }) => {
  const receipt = captureReadSet(["src/core.mjs"], { root, baseSha });
  await writeFile(path.join(root, "src/core.mjs"), "export const value = 2;\n");
  const currentSha = commit(root, "change dependency");
  const result = verifyReadSet(receipt, { root, currentSha });
  assert.equal(result.ok, false);
  assert.deepEqual(result.stalePaths, [{ path: "src/core.mjs", reason: "content-changed" }]);
}));

test("deleted dependency is reported as stale, not as an invalid receipt", async () => fixture(async ({ root, baseSha }) => {
  const receipt = captureReadSet(["docs.md"], { root, baseSha });
  execFileSync("git", ["rm", "docs.md"], { cwd: root, stdio: "ignore" });
  const currentSha = commit(root, "delete dependency");
  const result = verifyReadSet(receipt, { root, currentSha });
  assert.equal(result.ok, false);
  assert.deepEqual(result.stalePaths, [{ path: "docs.md", reason: "missing" }]);
  assert.deepEqual(result.invalidPaths, []);
}));

test("receipt is bound to the actual base tree and detects digest tampering", async () => fixture(async ({ root, baseSha }) => {
  const receipt = captureReadSet(["src/core.mjs"], { root, baseSha });
  const forged = structuredClone(receipt);
  forged.entries[0].sha256 = "0".repeat(64);
  const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const result = verifyReadSet(forged, { root, currentSha });
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidPaths, ["src/core.mjs"]);
}));

test("rejects traversal, duplicate and over-sized path lists", async () => fixture(async ({ root, baseSha }) => {
  assert.throws(() => captureReadSet(["../outside"], { root, baseSha }), /unsafe read-set path/);
  assert.throws(() => captureReadSet(["src/core.mjs", "src/core.mjs"], { root, baseSha }), /duplicate/);
  assert.throws(() => captureReadSet(Array.from({ length: 1001 }, (_, i) => "src/f" + i), { root, baseSha }), /1-1000/);
}));

test("rejects stale or malformed commit identities before inspecting files", async () => fixture(async ({ root, baseSha }) => {
  assert.throws(() => captureReadSet(["src/core.mjs"], { root, baseSha: "not-a-sha" }), /full 40-character/);
  assert.throws(() => captureReadSet(["src/core.mjs"], { root, baseSha: "f".repeat(40) }), /not an available Git commit/);
}));

test("rejects malformed receipts and sparse entry arrays", async () => fixture(async ({ root, baseSha }) => {
  const receipt = captureReadSet(["src/core.mjs"], { root, baseSha });
  const currentSha = baseSha;
  assert.throws(() => verifyReadSet({ ...receipt, algorithm: "md5" }, { root, currentSha }), /hash algorithm/);
  const sparse = { ...receipt, entries: new Array(1) };
  assert.throws(() => verifyReadSet(sparse, { root, currentSha }), /dense array/);
}));
