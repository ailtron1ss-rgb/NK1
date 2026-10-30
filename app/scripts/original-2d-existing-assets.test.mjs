import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(appRoot, "public/kurisu-original/existing-assets-audit.json");
const spriteManifestPath = path.join(appRoot, "public/sprites/manifest.json");
const priorAuditSource = "docs/AVATAR_RENDERING_VISUAL_AUDIT_2026-10-29.md#WorkPass622";
const currentPixelReviewSource = "docs/ASPECT_02_LEGACY_SPRITE_PIXEL_REVIEW_2026-10-30.md";

test("existing sprite audit exactly inventories legacy assets and distinguishes prior/current pixel reviews", async () => {
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  const manifest = JSON.parse(await readFile(spriteManifestPath, "utf8"));
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.id, "nk1-original-2d-existing-assets-audit");
  assert.equal(inventory.status, "source-tree-inventory-only");
  assert.equal(inventory.totalAssets, manifest.cells.length);
  assert.equal(inventory.totalAssets, 32);
  assert.equal(inventory.policy.eligibleAsProductionLayeredMaster, false);
  assert.equal(inventory.policy.eligibleAs2d5dLayerSource, false);
  assert.equal(inventory.pixelReview.date, "2026-10-30");
  assert.deepEqual(inventory.pixelReview.reviewedIds, [
    "embarrassed", "phone_look", "thinking_chin", "soft_smile",
    "city_stand", "phone_lean", "street_walk",
  ]);

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

    if (asset.semanticAudit.status === "matched-prior-pixel-audit") {
      assert.equal(asset.semanticAudit.reverifiedInThisPass, false);
      assert.ok(asset.semanticAudit.depictedContent);
      assert.ok(asset.semanticAudit.semanticRole);
      assert.ok(asset.semanticAudit.recommendedUse);
      assert.equal(asset.semanticAudit.source, priorAuditSource);
    } else if (asset.semanticAudit.status === "pixel-reviewed-this-pass") {
      assert.equal(asset.semanticAudit.reverifiedInThisPass, true);
      assert.ok(asset.semanticAudit.depictedContent);
      assert.ok(asset.semanticAudit.semanticRole);
      assert.ok(asset.semanticAudit.recommendedUse);
      assert.ok(asset.semanticAudit.source.startsWith(currentPixelReviewSource + "#"));
      assert.equal(asset.visualReview, asset.semanticAudit.source);
    } else {
      assert.fail(`unexpected or unresolved semantic status for ${asset.id}: ${asset.semanticAudit.status}`);
    }
  }

  assert.deepEqual(inventory.semanticAuditSummary, {
    matchedPriorAuditIds: 25,
    pixelReviewedThisPassIds: 7,
    requiresFreshVisualReview: 0,
    unmatchedIds: [],
    policy: "25 descriptions remain attributed to the prior WorkPass622 visual audit. Seven previously unmatched images were fetched and visually inspected directly in this pass; their labels are based on visible pixels, not filenames. License/provenance remains unverified.",
  });
  assert.equal(inventory.assets.filter((asset) => asset.semanticAudit.status === "matched-prior-pixel-audit").length, 25);
  assert.equal(inventory.assets.filter((asset) => asset.semanticAudit.status === "pixel-reviewed-this-pass").length, 7);

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
