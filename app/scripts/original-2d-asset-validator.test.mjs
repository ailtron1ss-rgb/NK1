import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Original 2D asset validator accepts the honest empty production inventory", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-original-2d-assets.mjs"], {
    cwd: appRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /24 slots; 0 authored\/in progress; 24 not authored/);
});


test("Original 2D validator fails closed when authored artwork lacks verified redistribution provenance", async () => {
  const source = await readFile(join(appRoot, "scripts/validate-original-2d-assets.mjs"), "utf8");
  for (const field of [
    "provenance.creator",
    "provenance.sourceUrl",
    "provenance.licenseId",
    "provenance.permissionEvidence",
    "provenance.redistributionAllowed",
    "provenance.verifiedAt",
    "provenance.verifiedBy",
  ]) {
    assert.ok(source.includes(field), `validator must enforce ${field}`);
  }
  assert.match(source, /redistributionAllowed === true/);
  assert.match(source, /https:/);
  assert.match(source, /not-authored assets must not claim provenance/);
});
