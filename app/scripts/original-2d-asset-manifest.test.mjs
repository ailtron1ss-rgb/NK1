import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(appRoot, "public");
const contract = JSON.parse(await readFile(join(publicRoot, "kurisu-original/character-art-contract.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(publicRoot, "kurisu-original/asset-manifest.json"), "utf8"));

test("Original 2D inventory covers every contracted production slot exactly once", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.characterContract, contract.id);
  assert.equal(manifest.assetCount, manifest.assets.length);
  const ids = manifest.assets.map((asset) => asset.id);
  assert.equal(new Set(ids).size, ids.length, "asset IDs must be unique");
  for (const [field, kind] of [["requiredViews", "turnaround-view"], ["requiredExpressions", "expression"], ["requiredOutfits", "outfit"], ["requiredAccessorySlots", "accessory"]]) {
    const actual = new Set(manifest.assets.filter((asset) => asset.kind === kind).map((asset) => asset.variant));
    assert.deepEqual(actual, new Set(contract[field]), `${field} inventory must match the contract`);
  }
  assert.equal(manifest.assets.filter((asset) => asset.kind === "master").length, 1);
});

test("uncreated artwork is represented honestly and approved assets require provenance", async () => {
  const allowed = new Set(manifest.statusVocabulary);
  for (const asset of manifest.assets) {
    assert.ok(allowed.has(asset.status), `unknown status for ${asset.id}`);
    if (["review", "approved", "exported"].includes(asset.status)) {
      assert.match(asset.sha256 ?? "", /^[a-f0-9]{64}$/i, `${asset.id} needs a SHA-256`);
      assert.ok(asset.sourceFile, `${asset.id} needs an editable source`);
      assert.ok(asset.previewFile, `${asset.id} needs a preview export`);
    }
    if (asset.status === "not-authored") {
      assert.equal(asset.sourceFile, null);
      assert.equal(asset.previewFile, null);
      assert.equal(asset.sha256, null);
    }
    for (const candidate of [asset.sourceFile, asset.previewFile].filter(Boolean)) {
      assert.equal(candidate.includes("\\"), false, "asset paths must use POSIX separators");
      assert.equal(candidate.startsWith("/"), false, "asset paths must be relative");
      const resolved = resolve(publicRoot, candidate);
      assert.ok(resolved.startsWith(publicRoot + sep), "asset path must remain inside public assets");
      await access(resolved, constants.R_OK);
    }
  }
  assert.equal(manifest.manifestStatus, "planning-inventory");
  assert.ok(manifest.assets.every((asset) => asset.status === "not-authored"), "planning inventory must not imply artwork exists");
});
