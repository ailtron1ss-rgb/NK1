import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  KURISU_HYBRID_MODEL,
  KURISU_HYBRID_MODEL_V12_CANDIDATE,
} from "../src/components/avatar/avatarModelCatalog.ts";
import { preflightAvatarModel } from "../src/components/avatar/avatarModelPreflight.ts";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  resolveGlbExpressionMorphWeights,
  resolveGlbMouthMorphWeights,
} from "../src/components/avatar/glbMouthMorphAdapter.ts";

async function fetchAndInspect(asset) {
  const response = await fetch(asset.url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true, `Hosted ${asset.label} returned HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") ?? "", /^model\/gltf-binary(?:;|$)/i);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.byteLength, asset.sizeBytes, "Hosted asset size must match the pinned catalog");
  const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  assert.equal(sha256, asset.sha256, "Hosted asset content must match its pinned SHA-256");
  const preflight = preflightAvatarModel(bytes, asset.filename);
  assert.equal(preflight.format, "glb");
  assert.equal(preflight.hasBinaryChunk, true);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const document = JSON.parse(new TextDecoder("utf-8", { fatal: true })
    .decode(bytes.subarray(20, 20 + jsonLength)).trim());
  const morphTargets = (document.meshes ?? []).reduce((sum, mesh) =>
    sum + (mesh.primitives ?? []).reduce((n, primitive) => n + (primitive.targets?.length ?? 0), 0), 0);
  assert.ok((document.nodes?.length ?? 0) > 0, "Hosted model must contain scene nodes");
  assert.ok((document.skins?.length ?? 0) > 0, "Hosted model must contain a humanoid skin");
  assert.ok(morphTargets >= 10, "Hosted model must retain face and blink morph targets");
  return { bytes, sha256, document, morphTargets };
}

const canonical = await fetchAndInspect(KURISU_HYBRID_MODEL);
assert.ok(canonical.document.animations.some((animation) => /rig_kurisu/i.test(animation.name ?? "")),
  "Canonical v5 must retain its known humanoid rig animation fallback");

console.log("HOSTED_KURISU_CANONICAL=PASS", JSON.stringify({
  id: KURISU_HYBRID_MODEL.id,
  bytes: canonical.bytes.byteLength,
  sha256: canonical.sha256,
  nodes: canonical.document.nodes.length,
  meshes: canonical.document.meshes.length,
  morphTargets: canonical.morphTargets,
  animations: canonical.document.animations.length,
}));

// v12 is a candidate, not canonical: verify its public CORS endpoint and
// exact face/blink contract while keeping it preview-only in the app.
const candidate = await fetchAndInspect(KURISU_HYBRID_MODEL_V12_CANDIDATE);
const gltf = candidate.document;
assert.equal(candidate.morphTargets, 11, "v12 must preserve all 11 authored facial morph targets");
assert.equal(gltf.animations.length, 8, "v12 must preserve four face and four semantic body animation clips");
assert.equal(gltf.skins[0].joints.length, 19, "v12 must retain its 19-joint humanoid skin");
const nodeByName = new Map((gltf.nodes ?? []).map((node) => [node.name, node]));
const expectedTargets = {
  EYE_white_L: ["blink"],
  EYE_white_R: ["blink"],
  FACE_mouth: ["viseme_aa", "viseme_oh", "viseme_ee", "viseme_ih", "viseme_ou", "happy", "sad", "angry"],
  HEAD_face: ["NK1_Jaw_Taper"],
};
for (const [name, expected] of Object.entries(expectedTargets)) {
  const node = nodeByName.get(name);
  assert.ok(node && Number.isInteger(node.mesh), `v12 must contain facial mesh node ${name}`);
  const mesh = gltf.meshes[node.mesh];
  const actual = mesh.extras?.targetNames ?? [];
  assert.deepEqual(actual, expected, `v12 morph target names for ${name} must remain stable`);
  assert.equal(mesh.primitives.reduce((n, primitive) => n + (primitive.targets?.length ?? 0), 0), expected.length,
    `v12 morph target geometry for ${name} must be exported`);
}
const clipByName = new Map((gltf.animations ?? []).map((animation) => [animation.name, animation]));
for (const clip of ["idle_breathing", "talk_gesture", "thinking_pose", "explore_turn", "EYE_white_L", "EYE_white_R", "FACE_mouth", "HEAD_face"]) {
  assert.ok(clipByName.has(clip), `v12 must retain animation clip ${clip}`);
}
const jointNodes = new Set(gltf.skins[0].joints.map((index) => gltf.nodes[index]?.name));
for (const clip of ["idle_breathing", "talk_gesture", "thinking_pose", "explore_turn"]) {
  const animation = clipByName.get(clip);
  assert.equal(animation.channels.length, 57, `v12 body clip ${clip} must contain 57 joint channels`);
  const channelNodes = new Set(animation.channels.map((channel) => gltf.nodes[channel.target.node]?.name));
  assert.deepEqual(channelNodes, jointNodes, `v12 body clip ${clip} must target the 19-joint humanoid rig`);
}

console.log("HOSTED_KURISU_V12_MORPH_PREVIEW=PASS", JSON.stringify({
  id: KURISU_HYBRID_MODEL_V12_CANDIDATE.id,
  bytes: candidate.bytes.byteLength,
  sha256: candidate.sha256,
  nodes: gltf.nodes.length,
  meshes: gltf.meshes.length,
  joints: gltf.skins[0].joints.length,
  morphTargets: candidate.morphTargets,
  facialTargetCounts: Object.fromEntries(Object.entries(expectedTargets).map(([name, targets]) => [name, targets.length])),
  animations: [...clipByName.keys()],
}));

// Exercise the exact production GLTFLoader and AnimationMixer path in Node.
// The bitmap stand-in is only for image decoding; geometry, animation tracks,
// morph dictionaries, and Three.js runtime evaluation remain real.
if (typeof globalThis.createImageBitmap !== "function") {
  globalThis.createImageBitmap = async (blob) => ({
    width: 1,
    height: 1,
    close() {},
    data: new Uint8Array(await blob.arrayBuffer()),
  });
}
const binary = candidate.bytes.buffer.slice(
  candidate.bytes.byteOffset,
  candidate.bytes.byteOffset + candidate.bytes.byteLength,
);
const loaded = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(binary, "", resolve, reject);
});
assert.ok(loaded.scene, "Three.js GLTFLoader must create a real scene");
const loadedMeshes = new Map();
const loadedBones = [];
loaded.scene.traverse((node) => {
  if (node.isMesh && node.morphTargetDictionary) loadedMeshes.set(node.name, node);
  if (node.isBone) loadedBones.push(node);
});
assert.equal(loadedBones.length, 19, "Three.js must instantiate all 19 humanoid bones");
for (const [name, required] of Object.entries(expectedTargets)) {
  const mesh = loadedMeshes.get(name);
  assert.ok(mesh, `Three.js must load facial mesh ${name}`);
  assert.deepEqual(Object.keys(mesh.morphTargetDictionary), required,
    `Three.js morph dictionary for ${name} must retain exported target names`);
}
const leftEye = loadedMeshes.get("EYE_white_L");
const rightEye = loadedMeshes.get("EYE_white_R");
const mouth = loadedMeshes.get("FACE_mouth");
const head = loadedMeshes.get("HEAD_face");
for (const mesh of [leftEye, rightEye]) {
  for (const target of resolveGlbExpressionMorphWeights(mesh.morphTargetDictionary, "calm", true, 0.5)) {
    mesh.morphTargetInfluences[target.index] = target.value;
  }
  assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.blink], 0.92,
    "both eyes must receive the same active blink weight");
  for (const target of resolveGlbExpressionMorphWeights(mesh.morphTargetDictionary, "calm", false, 0.5)) {
    mesh.morphTargetInfluences[target.index] = target.value;
  }
  assert.equal(mesh.morphTargetInfluences[mesh.morphTargetDictionary.blink], 0,
    "both eyes must return to neutral blink weight");
}
const mouthPoseByViseme = [
  { viseme: "open", open: 0.6, form: 0.1, expected: "viseme_aa" },
  { viseme: "round", open: 0.4, form: -0.5, expected: "viseme_ou" },
  { viseme: "round", open: 0.4, form: -0.2, expected: "viseme_oh" },
  { viseme: "wide", open: 0.3, form: 0.4, expected: "viseme_ee" },
  { viseme: "teeth", open: 0.2, form: 0.1, expected: "viseme_ih" },
];
for (const pose of mouthPoseByViseme) {
  for (const target of resolveGlbMouthMorphWeights(mouth.morphTargetDictionary, pose, true)) {
    mouth.morphTargetInfluences[target.index] = target.value;
  }
  const active = Object.entries(mouth.morphTargetDictionary)
    .filter(([name]) => name.startsWith("viseme_"))
    .filter(([, index]) => mouth.morphTargetInfluences[index] > 0);
  assert.deepEqual(active.map(([name]) => name), [pose.expected],
    `real Three.js mouth mesh must activate only ${pose.expected}`);
}
for (const [emotion, targetName, expectedWeight] of [
  ["joy", "happy", 0.75],
  ["anxiety", "sad", 0.62],
  ["frustration", "angry", 0.7],
]) {
  for (const target of resolveGlbExpressionMorphWeights(mouth.morphTargetDictionary, emotion, false, 0.5)) {
    mouth.morphTargetInfluences[target.index] = target.value;
  }
  assert.equal(mouth.morphTargetInfluences[mouth.morphTargetDictionary[targetName]], expectedWeight,
    `real Three.js face mesh must activate ${targetName} for ${emotion}`);
}
assert.equal(head.morphTargetInfluences[head.morphTargetDictionary.NK1_Jaw_Taper], 1,
  "the authored NK1 jaw taper must keep its non-neutral baseline value");

const boneSnapshot = loadedBones.map((bone) => ({
  bone,
  position: bone.position.clone(),
  quaternion: bone.quaternion.clone(),
  scale: bone.scale.clone(),
}));
const clipMovement = [];
for (const name of ["idle_breathing", "talk_gesture", "thinking_pose", "explore_turn"]) {
  const clip = loaded.animations.find((animation) => animation.name === name);
  assert.ok(clip, `Three.js must load semantic clip ${name}`);
  assert.equal(clip.tracks.length, 57, `Three.js clip ${name} must target all 19 bones`);
  const mixer = new THREE.AnimationMixer(loaded.scene);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(0.18);
  const changedBones = boneSnapshot.filter(({ bone, position, quaternion, scale }) =>
    bone.position.distanceTo(position) > 1e-6
    || 1 - Math.abs(bone.quaternion.dot(quaternion)) > 1e-6
    || bone.scale.distanceTo(scale) > 1e-6,
  ).length;
  assert.ok(changedBones > 0, `Three.js AnimationMixer must visibly change bones for ${name}`);
  clipMovement.push({ name, changedBones, tracks: clip.tracks.length, duration: clip.duration });
  mixer.stopAllAction();
  for (const state of boneSnapshot) {
    state.bone.position.copy(state.position);
    state.bone.quaternion.copy(state.quaternion);
    state.bone.scale.copy(state.scale);
  }
}
console.log("HOSTED_KURISU_V12_THREE_RUNTIME=PASS", JSON.stringify({
  bones: loadedBones.length,
  facialMeshes: [...loadedMeshes.keys()],
  morphTargets: candidate.morphTargets,
  visemes: mouthPoseByViseme.map((pose) => pose.expected),
  expressionWeights: { joy: 0.75, anxiety: 0.62, frustration: 0.7 },
  clipMovement,
}));
