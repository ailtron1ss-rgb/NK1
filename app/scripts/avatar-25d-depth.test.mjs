import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deriveAvatar25DDepthOffsets, svgTranslate } from "../src/components/avatar/avatar25dDepth.ts";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("depth parallax assigns distinct signed offsets to rear hair, torso, head and fringe", () => {
  const offsets = deriveAvatar25DDepthOffsets(0.4, 0.4, 1);
  assert.deepEqual(offsets, {
    rearHair: { x: -1.45, y: -0.58 },
    torso: { x: 0.42, y: 0.2 },
    head: { x: 2.8, y: 1.45 },
    frontFringe: { x: 0.8, y: 0.42 },
  });
  assert.ok(offsets.rearHair.x < offsets.torso.x);
  assert.ok(offsets.torso.x < offsets.head.x);
  assert.ok(offsets.head.x > offsets.frontFringe.x);
});

test("depth parallax clamps gaze and applies a bounded motion scale", () => {
  const max = deriveAvatar25DDepthOffsets(99, -99, 5);
  const clamped = deriveAvatar25DDepthOffsets(0.4, -0.4, 1.5);
  assert.deepEqual(max, clamped);
  const minimum = deriveAvatar25DDepthOffsets(-99, 99, -5);
  assert.deepEqual(minimum, deriveAvatar25DDepthOffsets(-0.4, 0.4, 0));
  for (const offset of Object.values(minimum)) {
    assert.equal(offset.x, 0);
    assert.equal(offset.y, 0);
  }
});

test("SVG translation output is deterministic, finite and rounded to viewBox precision", () => {
  assert.equal(svgTranslate({ x: 1.23456, y: -2.98765 }), "translate(1.235 -2.988)");
  assert.equal(svgTranslate({ x: Number.NaN, y: Number.POSITIVE_INFINITY }), "translate(0 0)");
});

test("the original SVG renderer uses independent depth layers driven by organism gaze", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/KurisuOriginalStage.tsx"), "utf8");
  const parent = await readFile(path.join(appRoot, "src/components/AvatarStage.tsx"), "utf8");
  assert.match(stage, /deriveAvatar25DDepthOffsets\(gazeX, gazeY, motion === "soft" \? 0\.72 : 1\)/);
  assert.match(parent, /NK1 Original · 2\.5D/);
  for (const layer of ["rear-hair", "torso", "head", "front-fringe"]) {
    assert.match(stage, new RegExp(`data-depth-layer="${layer}"`));
  }
  assert.match(stage, /svgTranslate\(depth\.rearHair\)/);
  assert.match(stage, /svgTranslate\(depth\.torso\)/);
  assert.match(stage, /svgTranslate\(depth\.head\)/);
  assert.match(stage, /svgTranslate\(depth\.frontFringe\)/);
  assert.match(stage, /\.nk-depth-layer \{ transition: transform 320ms/);
  assert.match(stage, /\.nk-depth-layer \{ transform: none !important; transition: none !important; \}/);
  assert.match(parent, /<KurisuOriginalStage[^>]+gazeX=\{originalGaze\.x\} gazeY=\{originalGaze\.y\}/);
});

test("the 2.5D stage remains an editable SVG concept, not a hidden bitmap replacement", async () => {
  const stage = await readFile(path.join(appRoot, "src/components/KurisuOriginalStage.tsx"), "utf8");
  assert.match(stage, /<svg viewBox="0 0 420 560"/);
  assert.match(stage, /MODE 2\.5D/);
  assert.match(stage, /2\.5D depth preview/);
  assert.match(stage, /<path d="M150 79/);
  assert.match(stage, /<g className="nk-depth-layer nk-depth-head"/);
  assert.doesNotMatch(stage, /<img[^>]+kurisu-original/i);
});
