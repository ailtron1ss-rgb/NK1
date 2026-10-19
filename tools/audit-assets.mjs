#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_PUBLIC = resolve(ROOT, 'app/public');
const RUNTIME_PUBLIC = resolve(ROOT, 'runtime/neuro-kurisu/public');
const errors = [];
const checks = [];
const add = (label, ok, detail = '') => { checks.push({ label, ok, detail }); if (!ok) errors.push({ label, detail }); };
const digestFile = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// Sprites belong to the UI app; Live2D has one canonical owner under runtime/public.
const spriteManifest = resolve(APP_PUBLIC, 'sprites/manifest.json');
try {
  const manifest = JSON.parse(readFileSync(spriteManifest, 'utf8'));
  for (const cell of manifest.cells ?? []) {
    const p = resolve(APP_PUBLIC, cell.file);
    add(`sprite:${cell.id}`, existsSync(p) && statSync(p).size > 0, relative(ROOT, p));
  }
} catch (error) {
  add('sprites:manifest', false, String(error));
}

const canonicalAssetManifestPath = resolve(ROOT, 'contracts/inventory/canonical-public-assets-workpass42.json');
let canonicalAssets = [];
try {
  const manifest = JSON.parse(readFileSync(canonicalAssetManifestPath, 'utf8'));
  canonicalAssets = manifest.items ?? [];
  add('live2d:canonical-asset-manifest', manifest.schemaVersion === 1 && canonicalAssets.length === 21,
    `${canonicalAssets.length} byte-identical app shadows map to runtime-owned assets`);
  for (const item of canonicalAssets) {
    const canonical = resolve(ROOT, item.canonicalPath);
    const target = resolve(ROOT, item.targetPath);
    const canonicalOk = existsSync(canonical) && statSync(canonical).isFile() && statSync(canonical).size === item.sizeBytes && digestFile(canonical) === item.sha256;
    add(`live2d:canonical:${item.targetPath}`, canonicalOk, relative(ROOT, canonical));
    // A shadow is allowed to be absent in source checkout (it is hydrated before Vite),
    // but when present it must be byte-identical and may not be a symlink.
    if (existsSync(target)) {
      const meta = lstatSync(target);
      const shadowOk = meta.isFile() && !meta.isSymbolicLink() && meta.size === item.sizeBytes && digestFile(target) === item.sha256;
      add(`live2d:shadow:${item.targetPath}`, shadowOk, shadowOk ? 'present and identical' : 'present but differs from canonical source');
    } else {
      add(`live2d:shadow:${item.targetPath}`, true, 'absent in source; hydrated before Vite dev/build');
    }
  }
} catch (error) {
  add('live2d:canonical-asset-manifest', false, String(error));
}

const liveRoot = resolve(RUNTIME_PUBLIC, 'live2d/Kurisu');
const mobile = resolve(RUNTIME_PUBLIC, 'live2d/Kurisu.mobile/Kurisu-mobile.model3.json');
function checkModel(modelPath) {
  try {
    const model = JSON.parse(readFileSync(modelPath, 'utf8'));
    const base = dirname(modelPath);
    const refs = model.FileReferences ?? {};
    const values = [];
    for (const key of ['Moc', 'Physics', 'DisplayInfo']) if (typeof refs[key] === 'string') values.push(refs[key]);
    for (const x of refs.Textures ?? []) if (typeof x === 'string') values.push(x);
    for (const group of Object.values(refs.Motions ?? {})) for (const x of group ?? []) if (x?.File) values.push(x.File);
    for (const x of refs.Expressions ?? []) if (x?.File) values.push(x.File);
    for (const ref of values) {
      const p = resolve(base, ref);
      add(`live2d:model-ref:${relative(RUNTIME_PUBLIC, modelPath)}:${ref}`, existsSync(p) && statSync(p).isFile() && statSync(p).size > 0, relative(ROOT, p));
    }
  } catch (error) { add(`live2d:model:${relative(ROOT, modelPath)}`, false, String(error)); }
}
checkModel(resolve(liveRoot, 'Kurisu.model3.json'));
checkModel(mobile);
add('live2d:app-custom-viewer', existsSync(resolve(APP_PUBLIC, 'live2d/viewer.html')), 'app viewer is intentionally distinct from runtime viewer');
add('live2d:runtime-viewer', existsSync(resolve(RUNTIME_PUBLIC, 'live2d/viewer.html')), 'runtime-owned viewer remains shipped');

try {
  const profileSource = readFileSync(resolve(ROOT, 'app/src/legacy/avatar/outfitCatalog.ts'), 'utf8');
  const known = new Set((JSON.parse(readFileSync(spriteManifest, 'utf8')).cells ?? []).map(x => x.id));
  const blocks = [...profileSource.matchAll(/spritePreferences:\s*\[([^\]]*)\]/g)];
  for (const block of blocks) for (const id of [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])) add(`visual-profile:${id}`, known.has(id), `manifest:${id}`);
} catch (error) { add('visual-profile:catalog', false, String(error)); }

const summary = { ok: errors.length === 0, errorCount: errors.length, checks, generatedAt: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.ok ? 0 : 1;
