import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_LIMITS = Object.freeze({ maxFiles: 8192, maxDepth: 16, maxFileBytes: 128 * 1024 * 1024 });

/** Read PNG IHDR dimensions and whether the encoded color model carries transparency. */
export function parsePngMetadata(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let sawHeader = false;
  let paletteTransparency = false;

  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const nextOffset = dataEnd + 4;
    if (dataEnd > buffer.length || nextOffset > buffer.length) return null;

    if (!sawHeader) {
      if (chunkType !== "IHDR" || chunkLength !== 13) return null;
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      colorType = buffer[dataStart + 9];
      sawHeader = true;
    } else if (chunkType === "tRNS") {
      paletteTransparency = true;
    } else if (chunkType === "IDAT" || chunkType === "IEND") {
      break;
    }
    offset = nextOffset;
  }

  if (!sawHeader || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return null;
  if (![0, 2, 3, 4, 6].includes(colorType)) return null;
  return { width, height, hasAlpha: colorType === 4 || colorType === 6 || (colorType === 3 && paletteTransparency) };
}

const diagnostic = (code, message, pathValue, severity = "error") => ({
  severity,
  code,
  ...(pathValue ? { path: pathValue } : {}),
  message,
});

const boundedInteger = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
};

/**
 * Build a deterministic inventory from real files without following symlinks.
 * Recognized roots: layers/ (*.png), masks/ (*.png), provenance/ (evidence files).
 * The caller passes the returned inventory to validateDepthRigAssetManifest.
 */
export async function buildDepthRigAssetInventory(rootPath, options = {}) {
  const root = path.resolve(String(rootPath ?? ""));
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch {
    throw new Error("asset-root-must-be-a-real-directory");
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("asset-root-must-be-a-real-directory");
  }

  const limits = {
    maxFiles: boundedInteger(options.maxFiles, DEFAULT_LIMITS.maxFiles, 1, 8192),
    maxDepth: boundedInteger(options.maxDepth, DEFAULT_LIMITS.maxDepth, 1, 32),
    maxFileBytes: boundedInteger(options.maxFileBytes, DEFAULT_LIMITS.maxFileBytes, 1024, 512 * 1024 * 1024),
  };
  const inventory = [];
  const diagnostics = [];
  let filesScanned = 0;
  let limitReached = false;

  const walk = async (directory, depth) => {
    if (depth > limits.maxDepth || limitReached) return;
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (limitReached) return;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const category = relativePath.split("/")[0];
      if (!["layers", "masks", "provenance"].includes(category)) continue;

      if (entry.isSymbolicLink()) {
        diagnostics.push(diagnostic("symlink-skipped", "Symlinked asset paths are never followed or admitted.", relativePath, "warning"));
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;

      if (filesScanned >= limits.maxFiles) {
        diagnostics.push(diagnostic("inventory-limit", `Asset inventory exceeded the ${limits.maxFiles}-file limit.`, relativePath));
        limitReached = true;
        return;
      }

      const stat = await lstat(absolutePath);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        diagnostics.push(diagnostic("symlink-skipped", "Non-regular or symlinked asset entries are not admitted.", relativePath, "warning"));
        continue;
      }
      if (!Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > limits.maxFileBytes) {
        diagnostics.push(diagnostic("file-size-invalid", "Asset/evidence file must be non-empty and within the configured byte limit.", relativePath));
        continue;
      }

      const kind = category === "layers" ? "image" : category === "masks" ? "mask" : "evidence";
      const item = { path: relativePath, kind, byteLength: stat.size };
      if (kind === "image" || kind === "mask") {
        if (path.extname(entry.name).toLowerCase() !== ".png") {
          item.hasAlpha = false;
          diagnostics.push(diagnostic("invalid-image", "Layer and mask assets must currently be PNG files with inspectable dimensions.", relativePath));
        } else {
          const metadata = parsePngMetadata(await readFile(absolutePath));
          if (!metadata) {
            item.hasAlpha = false;
            diagnostics.push(diagnostic("invalid-image", "PNG signature or IHDR metadata is invalid.", relativePath));
          } else {
            item.width = metadata.width;
            item.height = metadata.height;
            item.hasAlpha = metadata.hasAlpha;
          }
        }
      }
      inventory.push(item);
      filesScanned += 1;
    }
  };

  await walk(root, 0);
  inventory.sort((left, right) => left.path.localeCompare(right.path));
  diagnostics.sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "") || left.code.localeCompare(right.code));
  return { inventory, diagnostics, filesScanned };
}
