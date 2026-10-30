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

  const byPath = new Map(inventory.assets.map((asset) => [asset.path.split("/").slice(2).join("/"), asset]));
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
    assert.ok(asset.path.startsWith("app/public/sprites/") && asset.path.endsWith(".png"));

    assert.ok(asset.semanticAudit && typeof asset.semanticAudit === "object");
    assert.equal(asset.semanticAudit.reverifiedInThisPass, false);
    if (asset.semanticAudit.status === "matched-prior-pixel-audit") {
      assert.ok(asset.semanticAudit.depictedContent);
      assert.ok(asset.semanticAudit.semanticRole);
      assert.ok(asset.semanticAudit.recommendedUse);
      assert.equal(asset.semanticAudit.source, "docs/AVATAR_RENDERING_VISUAL_AUDIT_2026-10-29.md#WorkPass622");
    } else {
      assert.equal(asset.semanticAudit.status, "requires-fresh-visual-review");
      assert.match(asset.semanticAudit.note, /do not infer/i);
      assert.equal(asset.semanticAudit.depictedContent, undefined);
    }
  }

  assert.deepEqual(inventory.semanticAuditSummary, {
    matchedPriorAuditIds: 25,
    requiresFreshVisualReview: 7,
    unmatchedIds: ["embarrassed", "phone_look", "thinking_chin", "soft_smile", "city_stand", "phone_lean", "street_walk"],
    policy: "Descriptions are transcribed from the prior WorkPass622 visual audit, not a new pixel inspection in this pass. Unmatched IDs remain deliberately unclassified.",
  });
  assert.equal(inventory.assets.filter((asset) => asset.semanticAudit.status === "matched-prior-pixel-audit").length, 25);
  assert.equal(inventory.assets.filter((asset) => asset.semanticAudit.status === "requires-fresh-visual-review").length, 7);

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
