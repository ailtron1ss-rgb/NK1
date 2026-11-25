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

test("sprite semantics take precedence over misleading legacy filenames and sheet names", async () => {
  const engine = await readFile(join(root, "src/legacy/avatar/spriteEngine.ts"), "utf8");
  assert.match(engine, /explore: \["street_walk", "city_stand"/);
  assert.match(engine, /verify: \["wet_glance", "lab_chin"/);
  assert.match(engine, /rest: \["arms_crossed", "lab_crossed", "tired_rest"\]/);
  assert.match(engine, /dr_pepper_break: \['lab_steeple', 'sofa_phone'\]/);
  assert.match(engine, /visual review found several "lab_\*" filenames depict sleep, phone use or unrelated gestures/);
  assert.doesNotMatch(engine, /if \(preferLab\) \{\s*const labCandidates/);
});


test("legacy outfit preference hydrates after mount without SSR mismatch or default overwrite", () => {
  assert.match(source, /const \[outfit, setOutfit\] = useState<VisualProfileId>\("lab_coat"\)/);
  assert.match(source, /const \[preferencesHydrated, setPreferencesHydrated\] = useState\(false\)/);
  assert.match(source, /setOutfit\(readStoredOutfit\(\)\)/);
  assert.match(source, /setPreferencesHydrated\(true\)/);
  assert.match(source, /if \(!preferencesHydrated\) return;/);
  assert.doesNotMatch(source, /useState\(readStoredOutfit\)/);
});

test("legacy outfit picker exposes accessible disclosure and selected profile state", () => {
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls="legacy-outfit-options"/);
  assert.match(source, /id="legacy-outfit-options"/);
  assert.match(source, /aria-pressed=\{outfit === item\.id\}/);
});


test("legacy sprite loading exposes a terminal error instead of remaining stuck in loading", () => {
  assert.match(source, /type SpriteAssetStatus = "loading" \| "ready" \| "error"/);
  assert.match(source, /setAssetStatus\("loading"\)/);
  assert.match(source, /if \(!cancelled\) setAssetStatus\("error"\)/);
  assert.match(source, /assets unavailable/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /предыдущий кадр сохранён/);
});
