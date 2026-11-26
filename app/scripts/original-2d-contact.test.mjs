import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveOriginalStageContactPoint } from "../src/components/avatar/originalStageContact.ts";

test("Original SVG maps the authored head and body regions to canonical contact zones", () => {
  assert.deepEqual(resolveOriginalStageContactPoint(0.5, 0.22), { zone: "head", nx: 0.5, ny: 0.22 });
  assert.deepEqual(resolveOriginalStageContactPoint(0.5, 0.58), { zone: "body", nx: 0.5, ny: 0.58 });
  assert.equal(resolveOriginalStageContactPoint(-0.01, 0.5), null);
  assert.equal(resolveOriginalStageContactPoint(1.01, 0.5), null);
  assert.equal(resolveOriginalStageContactPoint(0.5, Number.NaN), null);
});

test("Original SVG forwards only a short primary pointer tap and supports the shared contact recorder", async () => {
  const stage = await readFile(new URL("../src/components/KurisuOriginalStage.tsx", import.meta.url), "utf8");
  const parent = await readFile(new URL("../src/components/AvatarStage.tsx", import.meta.url), "utf8");
  assert.match(stage, /const originalSvgRef = useRef<SVGSVGElement \\| null>\(null\)/);
  assert.match(stage, /<svg ref=\{originalSvgRef\}/);
  assert.match(stage, /svg\.addEventListener\("pointerdown", onDown, true\)/);
  assert.match(stage, /svg\.addEventListener\("pointerup", onUp, true\)/);
  assert.match(stage, /svg\.addEventListener\("pointercancel", onCancel, true\)/);
  assert.match(stage, /Math\.hypot\(event\.clientX - start\.x, event\.clientY - start\.y\) > 8/);
  assert.match(stage, /const rect = svg\.getBoundingClientRect\(\)/);
  assert.match(stage, /onContactRef\.current\(contact\)/);
  assert.ok(parent.includes('mode === "3d" || mode === "legacy" || mode === "original" ? "relative z-30'), "Original 2D toolbar must not cover the SVG contact surface");
  assert.match(parent, /KurisuOriginalStage[\s\S]*?onContact=\{\(contact\) => \{ void contactRecorder\.record\(\{ type: "live2d_tap", protocolVersion: 1, \.\.\.contact \}\); \}\}/);
});
