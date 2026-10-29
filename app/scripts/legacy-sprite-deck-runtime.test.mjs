import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "src/legacy/avatar/LegacySpriteDeck.tsx"), "utf8");

test("legacy avatar keeps one animation loop while speaking and outfit values change", () => {
  assert.match(source, /const speakingRef = useRef\(speaking\)/);
  assert.match(source, /const outfitRef = useRef\(outfit\)/);
  assert.match(source, /говорит · статичный кадр/);
  assert.match(source, /getOutfit\(outfitRef\.current\)\.nameRu/);
  assert.match(source, /raf = requestAnimationFrame\(draw\); return \(\) => cancelAnimationFrame\(raf\);\s*\}, \[\]\);/);
});

test("stale legacy sprite image callbacks cannot replace the newest requested sprite", () => {
  assert.match(source, /let cancelled = false;/);
  assert.match(source, /if \(cancelled\) return;\s*previousRef\.current = currentRef\.current;/);
  assert.match(source, /if \(!cancelled\) setReady\(Boolean\(currentRef\.current\)\);/);
  assert.match(source, /cancelled = true;\s*img\.onload = null;\s*img\.onerror = null;/);
});

test("legacy avatar only resizes the canvas when layout dimensions change", () => {
  assert.match(source, /const w = canvas\.clientWidth \|\| 320;\s*const h = canvas\.clientHeight \|\| 360;/);
  assert.match(source, /if \(canvas\.width !== bitmapWidth\) canvas\.width = bitmapWidth;/);
  assert.match(source, /if \(canvas\.height !== bitmapHeight\) canvas\.height = bitmapHeight;/);
  assert.doesNotMatch(source, /const w = canvas\.width = canvas\.clientWidth/);
  assert.doesNotMatch(source, /const h = canvas\.height = canvas\.clientHeight/);
});

test("legacy sprite selection is deterministic and action-aware", async () => {
  const engine = await readFile(join(root, "src/legacy/avatar/spriteEngine.ts"), "utf8");
  assert.match(engine, /const ACTION_PREFERENCES/);
  assert.match(engine, /action\?: SpriteAction/);
  assert.match(engine, /ACTION_PREFERENCES\[action\]\.find/);
  assert.match(engine, /const actionDriven = action === "explore"/);
  assert.match(engine, /if \(actionDriven\) \{/);
  assert.match(engine, /actionCandidates = ACTION_PREFERENCES\[action\]/);
  assert.doesNotMatch(engine, /Date\.now\(\)\s*\/\s*120000/);
});

test("legacy sprites use a capped high-DPI canvas and do not fake lip-sync", () => {
  assert.match(source, /window\.devicePixelRatio/);
  assert.match(source, /ctx\.setTransform\(dpr, 0, 0, dpr, 0, 0\)/);
  assert.match(source, /ctx\.imageSmoothingQuality = "high"/);
  assert.match(source, /говорит · статичный кадр/);
  assert.doesNotMatch(source, /ctx\.ellipse\(cx, cy \+ d\.dh/);
});
