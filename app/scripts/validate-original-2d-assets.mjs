import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(appRoot, "public");
const contractPath = join(publicRoot, "kurisu-original/character-art-contract.json");
const manifestPath = join(publicRoot, "kurisu-original/asset-manifest.json");
const errors = [];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

function safeAssetPath(value, assetId, field) {
  if (typeof value !== "string" || !value.trim() || value.includes("\\") || isAbsolute(value)) {
    errors.push(`${assetId}: ${field} must be a non-empty relative POSIX path`);
    return null;
  }
  const absolute = resolve(publicRoot, value);
  if (absolute !== publicRoot && !absolute.startsWith(publicRoot + sep)) {
    errors.push(`${assetId}: ${field} escapes the public asset root`);
    return null;
  }
  return absolute;
}

async function verifyFile(absolute, assetId, field) {
  try {
    await access(absolute, constants.R_OK);
    return await readFile(absolute);
  } catch {
    errors.push(`${assetId}: missing or unreadable ${field}`);
    return null;
  }
}

async function main() {
  let contract, manifest;
  try {
    [contract, manifest] = await Promise.all([
      readFile(contractPath, "utf8").then(JSON.parse),
      readFile(manifestPath, "utf8").then(JSON.parse),
    ]);
  } catch (error) {
    console.error(`Original 2D asset validation could not load its contract/manifest: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  requireCondition(manifest.schemaVersion === 1, "unsupported manifest schemaVersion");
  requireCondition(manifest.characterContract === contract.id, "manifest points at a different character contract");
  requireCondition(manifest.assetCount === manifest.assets?.length, "assetCount does not match assets.length");
  requireCondition(Array.isArray(manifest.assets), "assets must be an array");

  const allowedStatuses = new Set(manifest.statusVocabulary ?? []);
  const ids = new Set();
  const requiredGroups = [
    ["master", ["full-character"]],
    ["turnaround-view", contract.requiredViews],
    ["expression", contract.requiredExpressions],
    ["outfit", contract.requiredOutfits],
    ["accessory", contract.requiredAccessorySlots],
  ];

  for (const [kind, variants] of requiredGroups) {
    const actual = manifest.assets.filter((asset) => asset.kind === kind).map((asset) => asset.variant);
    requireCondition(actual.length === variants.length && variants.every((variant) => actual.includes(variant)),
      `${kind} inventory does not exactly cover the character contract`);
  }

  for (const asset of manifest.assets) {
    requireCondition(typeof asset.id === "string" && !ids.has(asset.id), `duplicate or invalid asset id: ${asset.id}`);
    ids.add(asset.id);
    requireCondition(allowedStatuses.has(asset.status), `${asset.id}: unsupported status ${asset.status}`);

    if (asset.status === "not-authored") {
      requireCondition(asset.sourceFile == null && asset.previewFile == null && asset.sha256 == null,
        `${asset.id}: not-authored assets must not claim files or hashes`);
      continue;
    }

    const sourcePath = safeAssetPath(asset.sourceFile, asset.id, "sourceFile");
    const previewPath = safeAssetPath(asset.previewFile, asset.id, "previewFile");
    requireCondition(/^[a-f0-9]{64}$/i.test(asset.sha256 ?? ""), `${asset.id}: valid SHA-256 is required`);
    if (!sourcePath || !previewPath) continue;

    const sourceBytes = await verifyFile(sourcePath, asset.id, "sourceFile");
    const previewBytes = await verifyFile(previewPath, asset.id, "previewFile");
    if (sourceBytes) requireCondition(sourceBytes.length > 0, `${asset.id}: source file is empty`);
    if (previewBytes) requireCondition(previewBytes.length > 0, `${asset.id}: preview file is empty`);
    if (sourceBytes && /^[a-f0-9]{64}$/i.test(asset.sha256 ?? "")) {
      const actualHash = createHash("sha256").update(sourceBytes).digest("hex");
      requireCondition(actualHash === asset.sha256.toLowerCase(), `${asset.id}: source SHA-256 mismatch`);
    }
    if (sourcePath === previewPath) errors.push(`${asset.id}: source and preview must be separate deliverables`);
    if (asset.status === "exported") requireCondition(Boolean(previewBytes?.length), `${asset.id}: exported preview is empty`);
  }

  if (errors.length) {
    console.error(`Original 2D asset validation failed (${errors.length} issue(s)):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const authored = manifest.assets.filter((asset) => asset.status !== "not-authored").length;
  const pending = manifest.assets.length - authored;
  console.log(`Original 2D asset inventory valid: ${manifest.assets.length} slots; ${authored} authored/in progress; ${pending} not authored.`);
}

await main();
