import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDepthRigAssetInventory, parsePngMetadata } from "./lib/depth-rig-asset-inventory.mjs";

const png = (width, height, colorType = 6, includeTransparency = false) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "ascii");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8;
  ihdr[17] = colorType;
  const trns = Buffer.alloc(12);
  trns.writeUInt32BE(0, 0);
  trns.write("tRNS", 4, "ascii");
  const idat = Buffer.alloc(12);
  idat.writeUInt32BE(0, 0);
  idat.write("IDAT", 4, "ascii");
  const iend = Buffer.alloc(12);
  iend.writeUInt32BE(0, 0);
  iend.write("IEND", 4, "ascii");
  return Buffer.concat([signature, ihdr, ...(includeTransparency ? [trns] : []), idat, iend]);
};

test("reads PNG dimensions and detects alpha-bearing color types", () => {
  assert.deepEqual(parsePngMetadata(png(2048, 1024, 6)), {
    width: 2048, height: 1024, hasAlpha: true,
  });
  assert.deepEqual(parsePngMetadata(png(512, 512, 4)), {
    width: 512, height: 512, hasAlpha: true,
  });
  assert.deepEqual(parsePngMetadata(png(512, 512, 3, true)), {
    width: 512, height: 512, hasAlpha: true,
  });
  assert.deepEqual(parsePngMetadata(png(512, 512, 2)), {
    width: 512, height: 512, hasAlpha: false,
  });
  assert.equal(parsePngMetadata(Buffer.from("not a png")), null);
});

test("builds a deterministic filesystem-derived inventory and skips symlinks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-depth-assets-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "nk1-depth-outside-"));
  try {
    await mkdir(path.join(root, "layers"));
    await mkdir(path.join(root, "masks"));
    await mkdir(path.join(root, "provenance"));
    await mkdir(path.join(root, "other"));
    await writeFile(path.join(root, "layers", "head.png"), png(2048, 2048, 6));
    await writeFile(path.join(root, "masks", "head.png"), png(2048, 2048, 0));
    await writeFile(path.join(root, "provenance", "license.md"), "License evidence");
    await writeFile(path.join(root, "other", "ignored.bin"), Buffer.from([1, 2, 3]));
    await writeFile(path.join(outside, "secret.png"), png(8, 8, 6));
    await symlink(path.join(outside, "secret.png"), path.join(root, "layers", "linked.png"));

    const result = await buildDepthRigAssetInventory(root);
    assert.deepEqual(result.inventory.map((entry) => entry.path), [
      "layers/head.png", "masks/head.png", "provenance/license.md",
    ]);
    assert.deepEqual(result.inventory.map((entry) => entry.kind), ["image", "mask", "evidence"]);
    assert.equal(result.inventory[0].width, 2048);
    assert.equal(result.inventory[0].height, 2048);
    assert.equal(result.inventory[0].hasAlpha, true);
    assert.equal(result.inventory[1].hasAlpha, false);
    assert.ok(result.diagnostics.some((item) => item.code === "symlink-skipped"));
    assert.equal(result.filesScanned, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("reports malformed image assets instead of trusting their extensions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-depth-invalid-"));
  try {
    await mkdir(path.join(root, "layers"));
    await writeFile(path.join(root, "layers", "broken.png"), Buffer.from("not a png"));
    const result = await buildDepthRigAssetInventory(root);
    assert.equal(result.inventory.length, 1);
    assert.equal(result.inventory[0].kind, "image");
    assert.equal(result.inventory[0].hasAlpha, false);
    assert.ok(result.diagnostics.some((item) => item.code === "invalid-image"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed when the inventory exceeds its bounded file budget", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-depth-limit-"));
  try {
    await mkdir(path.join(root, "layers"));
    await writeFile(path.join(root, "layers", "a.png"), png(8, 8, 6));
    await writeFile(path.join(root, "layers", "b.png"), png(8, 8, 6));
    const result = await buildDepthRigAssetInventory(root, { maxFiles: 1 });
    assert.equal(result.inventory.length, 1);
    assert.ok(result.diagnostics.some((item) => item.code === "inventory-limit"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a symlink as the asset root and an invalid root path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nk1-depth-root-"));
  const link = root + "-link";
  try {
    await symlink(root, link);
    await assert.rejects(() => buildDepthRigAssetInventory(link), /asset-root-must-be-a-real-directory/);
    await assert.rejects(() => buildDepthRigAssetInventory(path.join(root, "missing")), /asset-root-must-be-a-real-directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(link, { force: true });
  }
});
