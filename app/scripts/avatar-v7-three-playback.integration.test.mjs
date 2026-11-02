import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyAvatarAnimationFrame } from "../src/components/avatar/avatarAnimationRuntime.ts";

const CANDIDATE_URL = "https://d2ol7oe51mr4n9.cloudfront.net/user_3LTKlQrHJFFxzAMNuCHI3842j5m/3e7b233a-31c8-4121-be63-1ef5f911f017.glb";
const CANDIDATE_SIZE = 1_876_476;
const CANDIDATE_SHA256 = "9eb90244a35db827334c65a2101e5e4640875b9a25f53836876f1ca20972f8a0";

const EXPECTED_MOVEMENT = Object.freeze({
  idle_breathing: { action: "rest", bones: ["chest", "head"] },
  talk_gesture: { action: "respond", bones: ["chest", "rightUpperArm"] },
  thinking_pose: { action: "reflect", bones: ["head", "leftUpperArm"] },
  explore_turn: { action: "explore", bones: ["chest", "head", "leftUpperArm", "rightUpperArm"] },
});

const HUMANOID_NODES = [
  "hips", "spine", "chest", "neck", "head",
  "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
  "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
];

function ensureNodeLoaderGlobals() {
  if (typeof globalThis.ProgressEvent === "undefined") {
    globalThis.ProgressEvent = class ProgressEvent extends Event {
      constructor(type, init = {}) {
        super(type);
        this.lengthComputable = Boolean(init.lengthComputable);
        this.loaded = Number(init.loaded ?? 0);
        this.total = Number(init.total ?? 0);
      }
    };
  }
  if (typeof globalThis.createImageBitmap === "undefined") {
    globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
  }
}

async function loadPinnedCandidate() {
  const response = await fetch(CANDIDATE_URL, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true, `Kurisu v7 CDN returned HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.byteLength, CANDIDATE_SIZE, "the runtime candidate size must stay pinned");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), CANDIDATE_SHA256,
    "the runtime candidate bytes must match the pinned SHA-256");

  ensureNodeLoaderGlobals();
  const loader = new GLTFLoader();
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new Promise((resolve, reject) => loader.parse(data, "", resolve, reject));
  return { gltf, bytes };
}

function readHumanoidPose(scene) {
  const pose = {};
  for (const name of HUMANOID_NODES) {
    const node = scene.getObjectByName(name);
    assert.ok(node, `loaded v7 scene is missing humanoid node ${name}`);
    pose[name] = {
      position: node.position.toArray(),
      quaternion: node.quaternion.toArray(),
      scale: node.scale.toArray(),
    };
  }
  return pose;
}

function resetHumanoidPose(scene, baseline) {
  for (const name of HUMANOID_NODES) {
    const node = scene.getObjectByName(name);
    const pose = baseline[name];
    node.position.fromArray(pose.position);
    node.quaternion.fromArray(pose.quaternion);
    node.scale.fromArray(pose.scale);
  }
}

function vectorDelta(actual, baseline) {
  return Math.max(...actual.map((value, index) => Math.abs(value - baseline[index])));
}

function changedHumanoidNodes(scene, baseline) {
  const changed = [];
  for (const name of HUMANOID_NODES) {
    const node = scene.getObjectByName(name);
    const before = baseline[name];
    const delta = Math.max(
      vectorDelta(node.position.toArray(), before.position),
      vectorDelta(node.quaternion.toArray(), before.quaternion),
      vectorDelta(node.scale.toArray(), before.scale),
    );
    if (delta > 1e-5) changed.push(name);
  }
  return changed.sort();
}

test("the pinned Kurisu v7 GLB loads and every semantic action animates its expected real bones", async () => {
  const { gltf, bytes } = await loadPinnedCandidate();
  assert.ok(gltf.scene.children.length > 0, "the candidate must contain a visible glTF scene");
  assert.equal(bytes.byteLength, CANDIDATE_SIZE);

  const animationNames = gltf.animations.map((clip) => clip.name).sort();
  assert.deepEqual(animationNames, Object.keys(EXPECTED_MOVEMENT).sort());

  const baseline = readHumanoidPose(gltf.scene);
  const playbackEvidence = {};

  for (const [clipName, expected] of Object.entries(EXPECTED_MOVEMENT)) {
    resetHumanoidPose(gltf.scene, baseline);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const applied = applyAvatarAnimationFrame({
      mixer,
      clips: gltf.animations,
      action: expected.action,
      previousAction: null,
      previousClipName: "",
      awake: true,
      energy: 0.7,
      fadeSeconds: 0.05,
    });

    assert.equal(applied.clipName, clipName, `NK1 action ${expected.action} must select ${clipName}`);
    mixer.update(0.35);

    const changed = changedHumanoidNodes(gltf.scene, baseline);
    assert.deepEqual(changed, [...expected.bones].sort(),
      `${clipName} must animate only its verified v7 body joints`);

    playbackEvidence[clipName] = {
      action: expected.action,
      changedBones: changed,
      trackCount: applied.resolved.clip.tracks.length,
    };
    mixer.stopAllAction();
  }

  assert.deepEqual(playbackEvidence.idle_breathing.changedBones, ["chest", "head"]);
  assert.deepEqual(playbackEvidence.talk_gesture.changedBones, ["chest", "rightUpperArm"]);
  assert.deepEqual(playbackEvidence.thinking_pose.changedBones, ["head", "leftUpperArm"]);
  assert.deepEqual(playbackEvidence.explore_turn.changedBones,
    ["chest", "head", "leftUpperArm", "rightUpperArm"]);
});

test("the pinned v7 GLB preserves viseme, emotion and blink morph targets after GLTFLoader parsing", async () => {
  const { gltf } = await loadPinnedCandidate();
  const morphsByMesh = new Map();

  gltf.scene.traverse((node) => {
    if (!node.isMesh || !node.morphTargetDictionary) return;
    morphsByMesh.set(node.name, Object.keys(node.morphTargetDictionary));
  });

  const mouthTargets = [...morphsByMesh.values()].find((names) =>
    ["viseme_aa", "viseme_oh", "viseme_ee", "viseme_ih", "viseme_ou", "happy", "sad", "angry"]
      .every((name) => names.includes(name)),
  );
  assert.ok(mouthTargets, "GLTFLoader must retain all mouth visemes and three emotion morphs");

  for (const eye of ["MESH_EYE_white_L", "MESH_EYE_white_R"]) {
    assert.ok(morphsByMesh.get(eye)?.includes("blink"), `${eye} must retain its blink target`);
  }
});
