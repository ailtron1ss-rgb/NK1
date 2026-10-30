import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  applyVrmMorphTargetWeights,
  bindVrmExpressionTargets,
  buildVrmExpressionMap,
  canonicalizeVrmExpressionKey,
  deriveVrmExpressionWeights,
} from "../src/components/avatar/vrmExpressionMap.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("canonicalizes emotion and A/I/U/E/O aliases without guessing custom controls", () => {
  assert.equal(canonicalizeVrmExpressionKey("Joy"), "happy");
  assert.equal(canonicalizeVrmExpressionKey("Sorrow"), "sad");
  assert.equal(canonicalizeVrmExpressionKey("Blink_L"), "blinkLeft");
  assert.equal(canonicalizeVrmExpressionKey("LookRight"), "lookRight");
  assert.equal(canonicalizeVrmExpressionKey("A"), "aa");
  assert.equal(canonicalizeVrmExpressionKey("unknown_custom_face"), null);
});

test("reads VRM 1.0 preset/custom expression maps and node morphTargetBinds", () => {
  const definitions = buildVrmExpressionMap({
    VRMC_vrm: {
      expressions: {
        preset: {
          happy: {
            isBinary: true,
            overrideMouth: "blend",
            overrideBlink: "block",
            morphTargetBinds: [
              { node: 5, index: 2, weight: 0.75 },
              { node: 5, index: 3, weight: 1.4 },
              { node: -1, index: 1, weight: 0.5 },
              { node: 5, index: 1, weight: Number.NaN },
            ],
          },
          aa: { morphTargetBinds: [{ node: 5, index: 4, weight: 1 }] },
        },
        custom: {
          joy: { morphTargetBinds: [{ node: 8, index: 0, weight: 1 }] },
          custom_cheek_twitch: { morphTargetBinds: [{ node: 9, index: 1, weight: 1 }] },
        },
      },
    },
  });
  const happy = definitions.find((item) => item.key === "happy");
  assert.ok(happy);
  assert.equal(happy.isBinary, true);
  assert.equal(happy.overrideMouth, "blend");
  assert.equal(happy.overrideBlink, "block");
  assert.deepEqual(happy.binds, [{ targetKind: "node", targetIndex: 5, morphIndex: 2, weight: 0.75 }]);
  assert.ok(definitions.some((item) => item.key === "aa"));
  assert.equal(definitions.some((item) => item.key === "happy" && item.binds.some((bind) => bind.targetIndex === 8)), false);
  assert.equal(definitions.some((item) => item.key === "custom_cheek_twitch"), false);
});

test("reads legacy VRM 0.x BlendShape groups and converts 0-100 weights", () => {
  const definitions = buildVrmExpressionMap({
    VRM: {
      blendShapeMaster: {
        blendShapeGroups: [
          { name: "joy", presetName: "Joy", binds: [{ mesh: 7, index: 2, weight: 75 }] },
          { name: "vowel_a", presetName: "A", binds: [{ mesh: 7, index: 3, weight: 100 }] },
          { name: "sad face", presetName: "Sorrow", binds: [{ mesh: 8, index: 1, weight: 40 }] },
          { name: "custom_cheek_twitch", presetName: "unknown", binds: [{ mesh: 8, index: 4, weight: 100 }] },
        ],
      },
    },
  });
  const happy = definitions.find((item) => item.key === "happy");
  const aa = definitions.find((item) => item.key === "aa");
  const sad = definitions.find((item) => item.key === "sad");
  assert.deepEqual(happy?.binds[0], { targetKind: "mesh", targetIndex: 7, morphIndex: 2, weight: 0.75 });
  assert.equal(aa?.binds[0].weight, 1);
  assert.equal(sad?.binds[0].weight, 0.4);
  assert.equal(definitions.length, 3);
});

test("VRM 1.0 definitions take precedence when modern and legacy aliases collide", () => {
  const definitions = buildVrmExpressionMap({
    VRMC_vrm: {
      expressions: {
        preset: { happy: { morphTargetBinds: [{ node: 1, index: 0, weight: 0.25 }] } },
      },
    },
    VRM: {
      blendShapeMaster: {
        blendShapeGroups: [{ name: "Joy", presetName: "Joy", binds: [{ mesh: 3, index: 0, weight: 100 }] }],
      },
    },
  });
  const happy = definitions.find((item) => item.key === "happy");
  assert.equal(happy?.binds[0].targetKind, "node");
  assert.equal(happy?.binds[0].weight, 0.25);
});

test("organism affect maps to VRM emotion presets and existing viseme classes", () => {
  const definitions = buildVrmExpressionMap({
    VRMC_vrm: {
      expressions: {
        preset: Object.fromEntries([
          "happy", "angry", "sad", "relaxed", "surprised",
          "aa", "ih", "ou", "ee", "oh", "blink", "lookLeft", "lookRight", "lookUp", "lookDown",
        ].map((key) => [key, { morphTargetBinds: [{ node: 0, index: 0, weight: 1 }] }])),
      },
    },
  });

  const happy = deriveVrmExpressionWeights(definitions, {
    emotion: "joy", valence: 0.8, warmth: 0.4, awake: true,
    speaking: true, mouthPose: { open: 0.6, form: 0.1, viseme: "open" },
    gazeX: 0.7, gazeY: -0.4, blink: 0.8,
  });
  assert.ok(happy.happy > 0.7);
  assert.equal(happy.aa, 0.6);
  assert.equal(happy.blink, 0.8);
  assert.equal(happy.lookRight, 0.7);
  assert.equal(happy.lookUp, 0.4);

  const round = deriveVrmExpressionWeights(definitions, {
    emotion: "calm", speaking: true, awake: true,
    mouthPose: { open: 0.5, form: -0.4, viseme: "round" },
  });
  assert.ok(round.relaxed > 0);
  assert.equal(round.ou, 0.34);
  assert.equal(round.oh, 0.21);

  const sad = deriveVrmExpressionWeights(definitions, { emotion: "anxiety", awake: false, blink: 1 });
  assert.equal(sad.sad, 0.34);
  assert.equal(sad.blink, 0);
});

test("overrideMouth block prevents double-driving mouth shapes while an emotion is active", () => {
  const definitions = [
    { key: "happy", isBinary: false, overrideMouth: "block", overrideBlink: "none", overrideLookAt: "none", binds: [] },
    { key: "aa", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
    { key: "blink", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
  ];
  const values = deriveVrmExpressionWeights(definitions, {
    emotion: "joy", speaking: true, awake: true,
    mouthPose: { open: 0.9, form: 0.1, viseme: "open" },
    blink: 0.8,
  });
  assert.ok(values.happy > 0);
  assert.equal(values.aa, 0);
  assert.equal(values.blink, 0.8);
});

test("override blend attenuates procedural weights proportionally and respects binary presets", () => {
  const definitions = [
    { key: "happy", isBinary: false, overrideMouth: "blend", overrideBlink: "blend", overrideLookAt: "blend", binds: [] },
    { key: "aa", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
    { key: "blink", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
    { key: "relaxed", isBinary: true, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
  ];
  const values = deriveVrmExpressionWeights(definitions, {
    emotion: "joy", valence: 1, warmth: 0.5, speaking: true, awake: true,
    mouthPose: { open: 0.8, form: 0.1, viseme: "open" },
    blink: 0.6,
  });
  assert.ok(values.happy > 0.7);
  assert.ok(values.aa > 0 && values.aa < 0.25);
  assert.ok(values.blink > 0 && values.blink < 0.2);

  const calm = deriveVrmExpressionWeights(definitions, { emotion: "calm", warmth: 0.5 });
  assert.equal(calm.relaxed, 0);
});

test("binds modern node expressions to all mesh primitives under a node group", () => {
  const primitiveA = { morphTargetInfluences: [0, 0, 0] };
  const primitiveB = { morphTargetInfluences: [0, 0, 0] };
  const nodeGroup = {
    traverse(visitor) {
      visitor(this);
      visitor(primitiveA);
      visitor(primitiveB);
    },
  };
  const definitions = [{
    key: "happy", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none",
    binds: [{ targetKind: "node", targetIndex: 4, morphIndex: 2, weight: 0.75 }],
  }];
  const groups = bindVrmExpressionTargets(definitions, [[nodeGroup, { nodes: 4 }]]);
  assert.equal(groups.length, 2);
  assert.ok(groups.some((group) => group.object === primitiveA && group.morphIndex === 2));
  assert.ok(groups.some((group) => group.object === primitiveB && group.morphIndex === 2));
});

test("binds legacy mesh expressions to all primitives and de-duplicates group/object associations", () => {
  const primitiveA = { morphTargetInfluences: [0, 0] };
  const primitiveB = { morphTargetInfluences: [0, 0] };
  const meshGroup = {
    traverse(visitor) {
      visitor(this);
      visitor(primitiveA);
      visitor(primitiveB);
    },
  };
  const definitions = [{
    key: "happy", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none",
    binds: [{ targetKind: "mesh", targetIndex: 9, morphIndex: 1, weight: 0.5 }],
  }];
  const groups = bindVrmExpressionTargets(definitions, [
    [meshGroup, { meshes: 9 }],
    [primitiveA, { meshes: 9, primitives: 0 }],
    [primitiveB, { meshes: 9, primitives: 1 }],
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups.reduce((sum, group) => sum + group.bindings.length, 0), 2);
});

test("applies clamped accumulated expression values to mapped targets without touching other morphs", () => {
  const mesh = { morphTargetInfluences: [0.4, 0.25, 0.8] };
  const definitions = [
    { key: "happy", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
    { key: "sad", isBinary: false, overrideMouth: "none", overrideBlink: "none", overrideLookAt: "none", binds: [] },
  ];
  const groups = [
    { object: mesh, morphIndex: 0, bindings: [{ expression: "happy", weight: 0.75 }, { expression: "sad", weight: 0.5 }] },
    { object: mesh, morphIndex: 1, bindings: [{ expression: "happy", weight: 1.8 }] },
  ];
  applyVrmMorphTargetWeights(groups, { happy: 0.8, sad: 0.4 });
  assert.equal(mesh.morphTargetInfluences[0], 0.8);
  assert.equal(mesh.morphTargetInfluences[1], 0.8);
  assert.equal(mesh.morphTargetInfluences[2], 0.8);
});

test("the production 3D stage compiles VRM bindings once and applies them from organism state", async () => {
  const stage = await readFile(path.join(root, "src/components/Avatar3DStage.tsx"), "utf8");
  assert.match(stage, /buildVrmExpressionMap\(gltf\.parser\?\.json\?\.extensions\)/);
  assert.match(stage, /bindVrmExpressionTargets\(rt\.vrmExpressionDefinitions,gltf\.parser\?\.associations\?\.entries\?\.\(\)\?\?\[\]\)/);
  assert.match(stage, /deriveVrmExpressionWeights\(rt\.vrmExpressionDefinitions/);
  assert.match(stage, /applyVrmMorphTargetWeights\(rt\.vrmMorphTargets,expressionWeights\)/);
  assert.match(stage, /rt\.vrmMorphTargets/);
});
