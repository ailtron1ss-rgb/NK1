import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDepthRigAssetManifest } from "../src/components/avatar/depthRigAssetManifest.ts";
import { buildDepthRigAssetInventory } from "./lib/depth-rig-asset-inventory.mjs";

const [rigFile, manifestFile, assetRoot] = process.argv.slice(2);
if (!rigFile || !manifestFile || !assetRoot) {
  process.stderr.write(
    "Usage: node --experimental-strip-types scripts/validate-depth-rig-assets.mjs <rig.json> <manifest.json> <asset-root>\n",
  );
  process.exit(2);
}

try {
  const [rigText, manifestText] = await Promise.all([
    readFile(path.resolve(rigFile), "utf8"),
    readFile(path.resolve(manifestFile), "utf8"),
  ]);
  const rig = JSON.parse(rigText);
  const manifest = JSON.parse(manifestText);
  const scan = await buildDepthRigAssetInventory(path.resolve(assetRoot));
  const validation = validateDepthRigAssetManifest(rig, manifest, scan.inventory);
  const scanErrors = scan.diagnostics.filter((item) => item.severity === "error");
  const status = scanErrors.length || validation.status === "blocked" ? "blocked" : "asset-preflight-pass";
  const report = {
    status,
    inventoryFiles: scan.filesScanned,
    checkedLayers: validation.checkedLayers,
    checkedMasks: validation.checkedMasks,
    scanDiagnostics: scan.diagnostics,
    manifestDiagnostics: validation.diagnostics,
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (status !== "asset-preflight-pass") process.exitCode = 1;
} catch (error) {
  process.stderr.write(`2.5D asset preflight failed: ${error instanceof Error ? error.message : "unknown-error"}\n`);
  process.exitCode = 1;
}
