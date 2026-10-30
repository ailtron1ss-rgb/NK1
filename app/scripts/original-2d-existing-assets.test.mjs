import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(appRoot, "public/kurisu-original/existing-assets-audit.json");
const spriteManifestPath = path.join(appRoot, "public/sprites/manifest.json");

test("existing sprite audit exactly inventories the legacy manifest without promoting stills to production art", async () => {
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const manifest = JSON.parse(await readFile(spriteManifestPath, "utf8"));
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.id, "nk1-original-2d-existing-assets-audit");
  assert.equal(inventory.status, "source-tree-inventory-only");
  assert.equal(inventory.totalAssets, manifest.cells.length);
  assert.equal(inventory.totalAssets, 32);
  assert.equal(inventory.policy.eligibleAsProductionLayeredMaster, false);
  assert.equal(inventory.policy.eligibleAs2d5dLayerSource, false);

  const byPath = new Map(inventory.assets.map((asset) => [asset.path.replace(/^app\\/public\\//, ""), asset]));
  assert.equal(byPath.size, inventory.assets.length);
  for (const cell of manifest.cells) {
    const asset = byPath.get(cell.file);
    assert.ok(asset, `missing inventory entry for ${cell.file}`);
    assert.equal(asset.id, cell.id);
    assert.equal(asset.sheet, cell.sheet);
    assert.equal(asset.classification, "legacy-static-pose-reference");
    assert.equal(asset.productionArtMaster, false);
    assert.equal(asset.licenseStatus, "not-revalidated-in-this-inventory");
    assert.match(asset.gitBlobSha1, /^[a-f0-9]{40}$/);
    assert.ok(Number.isInteger(asset.bytes) && asset.bytes > 20_000);
    assert.match(asset.path, /^app\\/public\\/sprites\\/[^/]+\\/[^/]+\\.png$/);
  }

  const counts = Object.fromEntries(
    Object.entries(inventory.groups).map(([sheet, group]) => [sheet, group.count]),
  );
  assert.deepEqual(counts, {
    sheet_anime_office: 8,
    sheet_cinematic: 8,
    sheet_lab: 8,
    sheet_trench_full: 8,
  });
});
