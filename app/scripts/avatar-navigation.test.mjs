import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/", import.meta.url);

test("avatar is a first-class mobile navigation section", async () => {
  const [store, navigation, route] = await Promise.all([
    readFile(new URL("organism/store.ts", root), "utf8"),
    readFile(new URL("components/AppNavigation.tsx", root), "utf8"),
    readFile(new URL("routes/index.tsx", root), "utf8"),
  ]);

  assert.match(store, /export type AppSection =[^;]*"avatar"/,
    "the shared navigation state must include the avatar section");
  assert.match(navigation, /\{\s*id:\s*"avatar",\s*label:\s*"Аватар"/,
    "the bottom navigation must expose the avatar destination");
  assert.match(navigation, /aria-current=\{active === id \? "page" : undefined\}/,
    "the selected tab must remain accessible");
  assert.equal((navigation.match(/id: "(?:home|avatar|memory|motivation|settings|more)"/g) ?? []).length, 5,
    "the mobile navigation must remain a five-item bar");

  const avatarSection = route.match(/\{section === "avatar" \? \([\s\S]*?\) : null\}/);
  assert.ok(avatarSection, "the route must render a dedicated avatar section");
  assert.match(avatarSection[0], /<AvatarStage snap=\{snap\} thinking=\{busy\} \/>/,
    "the avatar tab must host the existing canonical AvatarStage");
  assert.match(avatarSection[0], /aria-label="Аватар"/,
    "the avatar destination must have a named landmark");

  const homeSection = route.match(/\{section === "home" \? \(([\s\S]*?)\) : null\}/);
  assert.ok(homeSection, "the home section must remain available");
  assert.doesNotMatch(homeSection[1], /<AvatarStage/,
    "the heavyweight avatar renderer must not mount on Home as well");
});


test("primary mobile navigation uses concise Russian labels and a localized landmark", async () => {
  const navigation = await readFile(new URL("components/AppNavigation.tsx", root), "utf8");
  const route = await readFile(new URL("routes/index.tsx", root), "utf8");

  assert.match(navigation, /aria-label="Основная навигация"/);
  for (const label of ["Главная", "Аватар", "Память", "Настройки", "Ещё"]) {
    assert.ok(navigation.includes(`label: "${label}"`), `missing Russian navigation label: ${label}`);
  }
  assert.match(route, /aria-label="Главная"/);
  assert.match(route, /aria-label="Нейропамять и знания"/);
  assert.match(route, /Нейропамять и знания/);
  assert.match(route, /Мотивация/);
  assert.match(route, /Инструменты и диагностика/);
  assert.doesNotMatch(navigation, /label: "(?:Home|Avatar|Brain|Settings|More)"/);
});


test("avatar workspace compares actual renderer manifests instead of hard-coded capability claims", async () => {
  const route = await readFile(new URL("routes/index.tsx", root), "utf8");
  const { DEFAULT_RENDERER_MANIFESTS } = await import("../src/components/avatar/rendererRegistryDefaults.ts");

  assert.equal(DEFAULT_RENDERER_MANIFESTS.length, 4, "the four wired body renderers must be represented");
  assert.match(route, /DEFAULT_RENDERER_MANIFESTS/);
  for (const field of [
    "renderer.label",
    "renderer.assetKind",
    "renderer.channels.length",
    "renderer.supportsSpeechVisemes",
    "renderer.supportsPhysics",
    "renderer.productionReady",
  ]) {
    assert.ok(route.includes(field), `renderer comparison must read live manifest field: ${field}`);
  }

  const threeD = DEFAULT_RENDERER_MANIFESTS.find((renderer) => renderer.rendererId === "nk1-three-vrm3d");
  assert.ok(threeD, "the 3D preview renderer must remain in the canonical capability list");
  assert.equal(threeD.productionReady, false, "a preview candidate must not be represented as production-ready");
  assert.equal(threeD.assetKind, "gltf");
  assert.ok(threeD.notes?.includes("not production-ready"));
});


test("renderer asset names have one exhaustive shared presentation dictionary", async () => {
  const route = await readFile(new URL("routes/index.tsx", root), "utf8");
  const presentation = await readFile(new URL("../src/components/avatar/rendererPresentation.ts", import.meta.url), "utf8");
  assert.match(route, /import \{ AVATAR_ASSET_KIND_LABELS \} from "@\/components\/avatar\/rendererPresentation"/);
  assert.match(route, /AVATAR_ASSET_KIND_LABELS\[renderer\.assetKind\]/);
  assert.match(presentation, /AVATAR_ASSET_KIND_LABELS:\s*Record<AvatarAssetKind, string>/,
    "adding a renderer asset kind must require one shared localized label");
  assert.match(route, /alt="Курису в задумчивой позе"/,
    "the Home companion preview must provide localized alternative text");
});
