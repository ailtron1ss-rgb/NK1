import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hydrateCanonicalPublicAssets } from "./sync-canonical-public-assets.mjs";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(appRoot);
const publicRoot = path.join(appRoot, "public", "live2d");
const manifestPath = path.join(repoRoot, "contracts/inventory/canonical-public-assets-workpass42.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function resolveSafe(root, relative, { allowParent = false } = {}) {
  assert.equal(typeof relative, "string", "asset references must be strings");
  assert.ok(relative.length > 0, "asset references must not be empty");
  assert.ok(!path.isAbsolute(relative), `absolute asset reference rejected: ${relative}`);
  assert.ok(!relative.includes("\\"), `Windows separator rejected in asset reference: ${relative}`);
  const parts = relative.split("/");
  assert.ok(!parts.some((part) => part === "" || part === "." || (!allowParent && part === "..")), `non-canonical asset reference: ${relative}`);
  const resolved = path.resolve(root, ...parts);
  const rel = path.relative(root, resolved);
  assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel), `asset reference escapes model root: ${relative}`);
  return resolved;
}

async function assertRegularFile(filePath, label) {
  const info = await lstat(filePath);
  assert.ok(!info.isSymbolicLink(), `${label}: symlinks are not accepted`);
  assert.ok(info.isFile(), `${label}: expected a regular file`);
  return info;
}

// Exercise the same fail-closed hydration path used by Vite dev/build before
// checking the deployed shadow assets. A conflicting existing target must fail.
const hydration = await hydrateCanonicalPublicAssets(repoRoot);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.schemaVersion, 1);
assert.ok(Array.isArray(manifest.items) && manifest.items.length >= 15, "canonical Live2D manifest coverage regressed");

const seenTargets = new Set();
for (const item of manifest.items) {
  assert.ok(item.targetPath.startsWith("app/public/live2d/"), `target outside app Live2D surface: ${item.targetPath}`);
  assert.ok(item.canonicalPath.startsWith("runtime/neuro-kurisu/public/live2d/"), `canonical owner changed unexpectedly: ${item.canonicalPath}`);
  assert.ok(!seenTargets.has(item.targetPath), `duplicate manifest target: ${item.targetPath}`);
  seenTargets.add(item.targetPath);
  assert.ok(Number.isSafeInteger(item.sizeBytes) && item.sizeBytes > 0, `invalid asset size: ${item.targetPath}`);
  assert.match(item.sha256, /^[a-f0-9]{64}$/u, `invalid SHA-256: ${item.targetPath}`);

  const source = resolveSafe(repoRoot, item.canonicalPath);
  const target = resolveSafe(repoRoot, item.targetPath);
  await assertRegularFile(source, item.canonicalPath);
  await assertRegularFile(target, item.targetPath);
  const [sourceInfo, targetInfo, sourceBytes, targetBytes] = await Promise.all([
    stat(source), stat(target), readFile(source), readFile(target),
  ]);
  assert.equal(sourceInfo.size, item.sizeBytes, `canonical size mismatch: ${item.canonicalPath}`);
  assert.equal(targetInfo.size, item.sizeBytes, `hydrated size mismatch: ${item.targetPath}`);
  assert.equal(sha256(sourceBytes), item.sha256, `canonical hash mismatch: ${item.canonicalPath}`);
  assert.equal(sha256(targetBytes), item.sha256, `hydrated hash mismatch: ${item.targetPath}`);
}

const variants = [
  { name: "quality", dir: path.join(publicRoot, "Kurisu"), model: "Kurisu.model3.json", minTextureBytes: 100_000 },
  { name: "mobile", dir: path.join(publicRoot, "Kurisu.mobile"), model: "Kurisu-mobile.model3.json", minTextureBytes: 100_000 },
];
const loaded = [];
for (const variant of variants) {
  const modelPath = path.join(variant.dir, variant.model);
  await assertRegularFile(modelPath, `${variant.name} model`);
  const model = JSON.parse(await readFile(modelPath, "utf8"));
  assert.equal(model.Version, 3, `${variant.name}: expected Cubism model version 3`);
  const refs = model.FileReferences;
  assert.ok(refs && typeof refs === "object", `${variant.name}: FileReferences missing`);
  const expressionRefs = refs.Expressions ?? [];
  const motionRefs = Object.values(refs.Motions ?? {}).flat();
  const relativeRefs = [
    refs.Moc, refs.Physics, refs.DisplayInfo,
    ...(refs.Textures ?? []),
    ...motionRefs.map((motion) => motion.File),
    ...expressionRefs.map((expression) => expression.File),
  ].filter(Boolean);
  assert.ok(relativeRefs.length >= 10, `${variant.name}: model resource coverage unexpectedly small`);
  assert.ok(expressionRefs.length >= 7, `${variant.name}: expression coverage regressed`);
  assert.ok(motionRefs.length >= 4, `${variant.name}: motion coverage regressed`);

    assert.ok(!path.isAbsolute(reference) && !reference.includes("\\"), `${variant.name}: unsafe model reference ${reference}`);
    const filePath = resolveSafe(variant.dir, reference, { allowParent: true });
    await assertRegularFile(filePath, `${variant.name} reference ${reference}`);
    const info = await stat(filePath);
    assert.ok(info.size > 0, `${variant.name}: empty referenced asset ${reference}`);
  }
  const textures = refs.Textures ?? [];
  assert.ok(textures.length > 0, `${variant.name}: no texture declared`);
  for (const texture of textures) {
    const info = await stat(resolveSafe(variant.dir, texture));
    assert.ok(info.size >= variant.minTextureBytes, `${variant.name}: texture too small: ${texture}`);
  }
  loaded.push({ name: variant.name, refs, expressionNames: expressionRefs.map((item) => item.Name).sort() });
}

assert.deepEqual(loaded[0].expressionNames, loaded[1].expressionNames, "quality and mobile expression sets must match");
assert.deepEqual(Object.keys(loaded[0].refs.Motions ?? {}).sort(), Object.keys(loaded[1].refs.Motions ?? {}).sort(),
  "quality and mobile motion groups must match");

const viewerPath = path.join(publicRoot, "viewer.html");
const viewer = await readFile(viewerPath, "utf8");
for (const localRuntime of ["./vendor/pixi.min.js", "./vendor/live2dcubismcore.min.js", "./vendor/cubism4.min.js"]) {
  const scriptPath = resolveSafe(publicRoot, localRuntime.slice(2));
  assert.ok(viewer.includes(`loadScript('${localRuntime}')`), `viewer must reference ${localRuntime}`);
  await assertRegularFile(scriptPath, localRuntime);
  assert.ok((await stat(scriptPath)).size > 10_000, `vendored runtime unexpectedly small: ${localRuntime}`);
}
assert.doesNotMatch(viewer, /loadScript\(['"]https?:\/\//u, "Live2D runtime scripts must remain local and pinned by the repository");
assert.match(viewer, /function updateTickerBudget\(/u);
assert.match(viewer, /document\.addEventListener\(['"]visibilitychange['"]/u);
assert.match(viewer, /app\.stop\(\)/u);
assert.match(viewer, /app\.start\(\)/u);
assert.match(viewer, /lastAppliedExpression/u);

const mapMatch = viewer.match(/const EXPR_MAP=\{([\s\S]*?)\};/u);
assert.ok(mapMatch, "viewer expression mapping must exist");
const mappedNames = [...mapMatch[1].matchAll(/:\s*['"]([^'"]+)['"]/gu)].map((match) => match[1]);
const availableNames = new Set(loaded[0].expressionNames);
for (const name of mappedNames) assert.ok(availableNames.has(name), `viewer expression maps to missing model expression: ${name}`);

console.log(`NK1_LIVE2D_ASSET_INTEGRITY=PASS manifest=${manifest.items.length} hydrated=${hydration.total} qualityRefs=${loaded[0].refs.Expressions.length + Object.values(loaded[0].refs.Motions ?? {}).flat().length} mobileRefs=${loaded[1].refs.Expressions.length + Object.values(loaded[1].refs.Motions ?? {}).flat().length}`);
