import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Single source of truth for the counts written into ARCHITECTURE_MANIFEST.json.
// Both scripts/generate-manifests.mjs (writer) and scripts/audit-project-state.mjs
// (verifier) import this, so a stale manifest is detected instead of trusted.
export const SKIP_DIRS = ['legacy-original', 'history', 'node_modules', 'state'];

export async function walkFiles(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

export async function computeManifestCounts(root) {
  const files = (await walkFiles(root)).map((x) => path.relative(root, x).replace(/\\/g, '/'));
  return {
    canonicalFiles: files.filter((x) => x.startsWith('src/organism/')).length,
    sourceSurfaceFiles: files.filter((x) => /\.(ts|mjs|js)$/.test(x)).length,
  };
}
