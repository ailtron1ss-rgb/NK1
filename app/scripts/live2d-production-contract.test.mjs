import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { smoothToward as smoothApp, sampleBlink as blinkApp } from "../public/live2d/temporal-smoothing.mjs";
import { smoothToward as smoothRuntime, sampleBlink as blinkRuntime } from "../../runtime/neuro-kurisu/public/live2d/temporal-smoothing.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const liveRoot = join(repoRoot, "runtime/neuro-kurisu/public/live2d");
const modelRoot = join(liveRoot, "Kurisu");
const viewerPaths = [
  join(repoRoot, "app/public/live2d/viewer.html"),
  join(liveRoot, "viewer.html"),
];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertContainedFile(root, relativePath, label) {
  assert.equal(typeof relativePath, "string", label + " must be a path");
  const target = resolve(root, relativePath);
  const pathFromRoot = relative(root, target);
  assert.ok(pathFromRoot && pathFromRoot !== ".." && !pathFromRoot.startsWith(".." + sep), label + " escapes the canonical asset root");
  await access(target, constants.R_OK);
  return target;
}

function extractWrittenParameterIds(viewer) {
  const ids = new Set();
  const pattern = /(?:setCore|addCoreOffset|set)\(\s*['"]([^'"]+)['"]/g;
  for (const match of viewer.matchAll(pattern)) ids.add(match[1]);
  return ids;
}

function extractObjectKeys(viewer, declaration) {
  const match = viewer.match(new RegExp("const " + declaration + "=Object\\.freeze\\((\\{[\\s\\S]*?\\})\\);"));
  assert.ok(match, declaration + " must be declared");
  return [...match[1].matchAll(/^    ([a-zA-Z_][a-zA-Z0-9_]*):/gm)].map((item) => item[1]);
}

test("app and runtime Live2D animation primitives stay byte-identical", async () => {
  const [appModule, runtimeModule] = await Promise.all([
    readFile(join(repoRoot, "app/public/live2d/temporal-smoothing.mjs"), "utf8"),
    readFile(join(liveRoot, "temporal-smoothing.mjs"), "utf8"),
  ]);
  assert.equal(appModule, runtimeModule, "the two viewer entry points must use the same timing implementation");
  assert.equal(smoothApp(0, 1, 0.1, 0.15), smoothRuntime(0, 1, 0.1, 0.15));
  assert.equal(blinkApp(90, 180), blinkRuntime(90, 180));
});

test("face and lip interpolation are independent of render frame rate", () => {
  const simulate = (fps) => {
    let value = 0;
    const dt = 1 / fps;
    for (let frame = 0; frame < fps; frame += 1) value = smoothApp(value, 1, dt, 0.16);
    return value;
  };
  const values = [30, 60, 144].map(simulate);
  assert.ok(Math.max(...values) - Math.min(...values) < 1e-10, "frame-rate drift detected: " + values.join(", "));
  assert.ok(values.every((value) => value > 0.99 && value < 1));
  assert.equal(smoothApp(0.25, 1, -1, 0.16), 0.25, "negative elapsed time must not move the model");
  assert.equal(smoothApp(0.25, 1, Number.NaN, 0.16), 0.25, "invalid elapsed time must not move the model");
});

test("blink envelope is bounded, symmetric, and time sampled", () => {
  for (const [elapsed, expected] of [[0, 0], [90, 1], [180, 0], [-5, 0], [200, 0]]) {
    assert.equal(blinkApp(elapsed, 180), expected);
  }
  for (let elapsed = 0; elapsed <= 180; elapsed += 1) {
    const value = blinkApp(elapsed, 180);
    assert.ok(value >= 0 && value <= 1);
    assert.ok(Math.abs(value - blinkApp(180 - elapsed, 180)) < 1e-12, "blink must be temporally symmetric");
  }
});

test("canonical Cubism model references every shipped file and reports consistent physics", async () => {
  const model = await readJson(join(modelRoot, "Kurisu.model3.json"));
  const cdi = await readJson(join(modelRoot, "Kurisu.cdi3.json"));
  const physics = await readJson(join(modelRoot, "Kurisu.physics3.json"));
  const refs = model.FileReferences;
  const paths = [
    refs.Moc,
    ...(refs.Textures ?? []),
    refs.Physics,
    refs.DisplayInfo,
    ...Object.values(refs.Motions ?? {}).flatMap((motions) => motions.map((motion) => motion.File)),
    ...(refs.Expressions ?? []).map((expression) => expression.File),
  ];
  for (const path of paths) await assertContainedFile(modelRoot, path, "Cubism FileReferences entry");

  const parameters = new Set((cdi.Parameters ?? []).map((parameter) => parameter.Id));
  assert.ok(parameters.size >= 60, "the canonical model parameter inventory unexpectedly shrank");
  const physicsSettings = physics.PhysicsSettings ?? [];
  assert.equal(physics.Meta.PhysicsSettingCount, physicsSettings.length);
  assert.equal(physics.Meta.TotalInputCount, physicsSettings.reduce((sum, setting) => sum + (setting.Input?.length ?? 0), 0));
  assert.equal(physics.Meta.TotalOutputCount, physicsSettings.reduce((sum, setting) => sum + (setting.Output?.length ?? 0), 0));
  for (const setting of physicsSettings) {
    for (const input of setting.Input ?? []) assert.ok(parameters.has(input.Source?.Id), "unknown physics input " + input.Source?.Id);
    for (const output of setting.Output ?? []) assert.ok(parameters.has(output.Destination?.Id), "unknown physics output " + output.Destination?.Id);
  }
});

test("both Live2D viewers write only parameters present in the canonical CDI3", async () => {
  const cdi = await readJson(join(modelRoot, "Kurisu.cdi3.json"));
  const parameters = new Set((cdi.Parameters ?? []).map((parameter) => parameter.Id));
  const viewers = await Promise.all(viewerPaths.map((path) => readFile(path, "utf8")));
  for (const [index, viewer] of viewers.entries()) {
    assert.match(viewer, /temporal-smoothing\.mjs/);
    const written = extractWrittenParameterIds(viewer);
    assert.ok(written.size >= 15, "viewer should exercise a meaningful subset of the model");
    for (const id of written) assert.ok(parameters.has(id), "viewer " + index + " writes unsupported Cubism parameter " + id);
    assert.match(viewer, /sampleBlink\(now-blinkStartedAt,blinkDurationMs\)/);
    assert.match(viewer, /smoothToward\(semanticEyeX/);
    assert.doesNotMatch(viewer, /blinkT\*=\.72|\*blend\)/, "frame-count-dependent smoothing must not return");
  }
});

test("expression and motion routing remain within the registered model inventory", async () => {
  const model = await readJson(join(modelRoot, "Kurisu.model3.json"));
  const expressionNames = new Set((model.FileReferences.Expressions ?? []).map((entry) => entry.Name));
  const motionCounts = Object.fromEntries(Object.entries(model.FileReferences.Motions ?? {}).map(([name, clips]) => [name, clips.length]));
  const viewers = await Promise.all(viewerPaths.map((path) => readFile(path, "utf8")));
  for (const [index, viewer] of viewers.entries()) {
    const exprMatch = viewer.match(/const EXPR_MAP=\{([\s\S]*?)\n  \};/);
    assert.ok(exprMatch, "viewer " + index + " must declare EXPR_MAP");
    for (const [, name] of exprMatch[1].matchAll(/:['"]([^'"]+)['"]/g)) {
      assert.ok(expressionNames.has(name), "viewer " + index + " maps to unregistered expression " + name);
    }
    const groups = extractObjectKeys(viewer, "MOTION_COUNTS");
    assert.deepEqual(Object.fromEntries(groups.map((group) => [group, motionCounts[group]])), motionCounts,
      "viewer " + index + " motion groups must exactly match the shipped model");
    const profiles = extractObjectKeys(viewer, "FACE_PROFILES");
    assert.ok(profiles.includes("neutral") && profiles.includes("tired"), "face profiles must include baseline and fatigue states");
  }
});

test("viewer state sampling uses the shared frame-rate-independent animation helpers", async () => {
  const viewers = await Promise.all(viewerPaths.map((path) => readFile(path, "utf8")));
  for (const viewer of viewers) {
    assert.match(viewer, /smoothToward\(lipCurrent,lipTarget,deltaSeconds,/);
    assert.match(viewer, /smoothToward\(lipFormCurrent,lipFormTarget,deltaSeconds,/);
    assert.match(viewer, /smoothToward\(eyeX,targetEyeX,deltaSeconds,/);
    assert.match(viewer, /smoothToward\(faceState\.eyeOpen\?\?1,face\.eyeOpen,faceDeltaSeconds,/);
    assert.match(viewer, /blinkStartedAt=now/);
  }
});

console.log("NK1_LIVE2D_PRODUCTION_CONTRACT=READY");
