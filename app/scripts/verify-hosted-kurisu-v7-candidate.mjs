import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const CANDIDATE = Object.freeze({
  id: "neuro-kurisu-hybrid-v7-nla-candidate",
  filename: "NeuroKurisu_3D_v7_NLA.glb",
  url: "https://d2ol7oe51mr4n9.cloudfront.net/user_3LTKlQrHJFFxzAMNuCHI3842j5m/3e7b233a-31c8-4121-be63-1ef5f911f017.glb",
  sizeBytes: 1_876_476,
  sha256: "9eb90244a35db827334c65a2101e5e4640875b9a25f53836876f1ca20972f8a0",
  sourceProjectId: "5cb8f13d-0f7d-4bf6-98cf-9b84503ce1ba",
  sourceRevision: 7,
  exportMode: "NLA_TRACKS",
  canonical: false,
});

const EXPECTED_JOINTS = [
  "hips", "spine", "chest", "neck", "head",
  "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand",
  "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand",
  "leftUpperLeg", "leftLowerLeg", "leftFoot",
  "rightUpperLeg", "rightLowerLeg", "rightFoot",
];

const REQUIRED_MOUTH_MORPHS = [
  "viseme_aa", "viseme_oh", "viseme_ee", "viseme_ih", "viseme_ou",
  "happy", "sad", "angry",
];

const REQUIRED_MOVEMENT = Object.freeze({
  idle_breathing: ["chest", "head"],
  talk_gesture: ["chest", "rightUpperArm"],
  thinking_pose: ["head", "leftUpperArm"],
  explore_turn: ["chest", "head", "leftUpperArm", "rightUpperArm"],
});

const COMPONENTS = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
});

function readGlb(bytes) {
  assert.ok(bytes instanceof Uint8Array, "GLB input must be Uint8Array");
  assert.ok(bytes.byteLength >= 20, "GLB is truncated");
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "glTF", "GLB magic is invalid");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(4, true), 2, "only glTF 2.0 is supported");
  assert.equal(view.getUint32(8, true), bytes.byteLength, "GLB declared length differs from downloaded bytes");

  let offset = 12;
  let jsonChunk = null;
  let binaryChunk = null;
  while (offset < bytes.byteLength) {
    assert.ok(offset + 8 <= bytes.byteLength, "GLB chunk header is truncated");
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    assert.ok(end <= bytes.byteLength, "GLB chunk exceeds container boundary");
    const chunk = bytes.subarray(start, end);

    if (type === 0x4e4f534a) {
      assert.equal(jsonChunk, null, "GLB contains duplicate JSON chunks");
      jsonChunk = chunk;
    } else if (type === 0x004e4942) {
      assert.equal(binaryChunk, null, "GLB contains duplicate BIN chunks");
      binaryChunk = chunk;
    }
    offset = end;
  }

  assert.ok(jsonChunk, "GLB JSON chunk is missing");
  assert.ok(binaryChunk, "GLB BIN chunk is missing");

  const document = JSON.parse(Buffer.from(jsonChunk).toString("utf8").replace(/[\u0000\u0020]+$/u, ""));
  assert.equal(document?.asset?.version, "2.0", "glTF asset version must be 2.0");

  return { document, binaryChunk };
}

function readFloatAccessor(document, binaryChunk, accessorIndex) {
  const accessor = document.accessors?.[accessorIndex];
  assert.ok(accessor, `animation references missing accessor ${accessorIndex}`);
  assert.equal(accessor.componentType, 5126, "skeletal animation output must use FLOAT accessors");
  const componentCount = COMPONENTS[accessor.type];
  assert.ok(componentCount, `unsupported animation accessor type ${accessor.type}`);
  assert.ok(Number.isSafeInteger(accessor.count) && accessor.count > 0, "animation accessor count is invalid");
  assert.equal(accessor.sparse, undefined, "sparse animation accessors are not supported by this candidate contract");

  const bufferView = document.bufferViews?.[accessor.bufferView];
  assert.ok(bufferView, "animation accessor references a missing bufferView");
  assert.ok(bufferView.buffer === undefined || bufferView.buffer === 0, "animation accessor references a non-GLB buffer");

  const elementBytes = componentCount * 4;
  const stride = bufferView.byteStride ?? elementBytes;
  assert.ok(stride >= elementBytes, "animation accessor byteStride is too small");

  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const finalByte = start + (accessor.count - 1) * stride + elementBytes;
  assert.ok(start >= 0 && finalByte <= binaryChunk.byteLength, "animation accessor exceeds the GLB BIN chunk");

  const values = new Array(componentCount).fill(null).map(() => ({ min: Infinity, max: -Infinity }));
  const view = new DataView(binaryChunk.buffer, binaryChunk.byteOffset, binaryChunk.byteLength);
  for (let index = 0; index < accessor.count; index += 1) {
    const sampleOffset = start + index * stride;
    for (let component = 0; component < componentCount; component += 1) {
      const value = view.getFloat32(sampleOffset + component * 4, true);
      assert.ok(Number.isFinite(value), "animation contains a non-finite transform value");
      values[component].min = Math.min(values[component].min, value);
      values[component].max = Math.max(values[component].max, value);
    }
  }

  return {
    count: accessor.count,
    componentRanges: values.map(({ min, max }) => max - min),
    varies: values.some(({ min, max }) => max - min > 1e-5),
  };
}

function inspectAnimation(document, binaryChunk, animation) {
  const movingBones = new Set();
  const samplers = animation.samplers ?? [];
  const channels = animation.channels ?? [];
  assert.ok(channels.length > 0, `animation ${animation.name} has no channels`);

  for (const channel of channels) {
    const target = channel.target;
    assert.ok(target && Number.isSafeInteger(target.node), `animation ${animation.name} has an invalid target node`);
    const node = document.nodes?.[target.node];
    assert.ok(node, `animation ${animation.name} targets a missing node`);
    assert.ok(["rotation", "translation", "scale", "weights"].includes(target.path), `animation ${animation.name} uses an unsupported target path`);

    const sampler = samplers[channel.sampler];
    assert.ok(sampler, `animation ${animation.name} references a missing sampler`);
    const output = readFloatAccessor(document, binaryChunk, sampler.output);

    if (target.path !== "weights" && output.varies) {
      movingBones.add(node.name);
    }
  }

  return { channelCount: channels.length, movingBones: [...movingBones].filter(Boolean).sort() };
}

function inspectMorphTargets(document) {
  const byMeshName = new Map();
  const allMorphs = new Set();

  for (const mesh of document.meshes ?? []) {
    const names = (mesh.extras?.targetNames ?? []).filter((name) => typeof name === "string");
    if (!names.length) continue;
    byMeshName.set(mesh.name ?? "", names);
    for (const name of names) allMorphs.add(name);

    for (const primitive of mesh.primitives ?? []) {
      const targetCount = primitive.targets?.length ?? 0;
      assert.equal(targetCount, names.length, `mesh ${mesh.name} target-name count does not match primitive morph targets`);
    }
  }

  const mouthTargets = [...byMeshName.values()].find((names) =>
    REQUIRED_MOUTH_MORPHS.every((required) => names.includes(required)),
  );
  assert.ok(mouthTargets, "mouth mesh must contain all five visemes and happy/sad/angry targets");

  for (const eyeName of ["MESH_EYE_white_L", "MESH_EYE_white_R"]) {
    const eyeTargets = byMeshName.get(eyeName) ?? [];
    assert.ok(eyeTargets.includes("blink"), `${eyeName} must retain the blink morph target`);
  }

  return { allMorphs: [...allMorphs].sort(), mouthTargets: [...mouthTargets].sort() };
}

export function verifyKurisuV7NlaCandidate(bytes) {
  const { document, binaryChunk } = readGlb(bytes);
  const nodeNames = new Set((document.nodes ?? []).map((node) => node.name).filter(Boolean));
  const meshCount = (document.meshes ?? []).length;
  assert.ok((document.nodes ?? []).length >= 120, "candidate must retain the expected scene graph");
  assert.ok(meshCount >= 100, "candidate must retain the skinned model geometry");

  const skin = (document.skins ?? []).find((entry) => Array.isArray(entry.joints));
  assert.ok(skin, "candidate must contain a humanoid skin");
  const jointNames = skin.joints.map((index) => document.nodes?.[index]?.name).filter(Boolean);
  assert.equal(jointNames.length, 19, "candidate must contain exactly 19 humanoid joints");
  for (const joint of EXPECTED_JOINTS) {
    assert.ok(jointNames.includes(joint), `humanoid skin is missing joint ${joint}`);
  }

  const animationList = document.animations ?? [];
  const animationsByName = new Map(animationList.map((animation) => [animation.name, animation]));
  assert.equal(animationsByName.size, animationList.length, "candidate contains duplicate animation names");

  const animationSummary = {};
  for (const [name, expectedBones] of Object.entries(REQUIRED_MOVEMENT)) {
    const animation = animationsByName.get(name);
    assert.ok(animation, `candidate is missing skeletal animation ${name}`);
    const inspected = inspectAnimation(document, binaryChunk, animation);
    for (const bone of expectedBones) {
      assert.ok(inspected.movingBones.includes(bone), `${name} does not contain measurable movement on ${bone}`);
    }
    animationSummary[name] = inspected;
  }

  const morphSummary = inspectMorphTargets(document);
  assert.ok(nodeNames.has("head") && nodeNames.has("hips"), "candidate is missing the core head/hips nodes");

  return {
    nodeCount: document.nodes.length,
    meshCount,
    jointCount: jointNames.length,
    jointNames,
    animationSummary,
    morphSummary,
  };
}

async function main() {
  const response = await fetch(CANDIDATE.url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.ok, true, `Candidate CDN returned HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.byteLength, CANDIDATE.sizeBytes, "candidate size differs from the pinned asset manifest");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256, CANDIDATE.sha256, "candidate bytes differ from the pinned SHA-256");

  const summary = verifyKurisuV7NlaCandidate(bytes);
  console.log("KURISU_V7_NLA_CANDIDATE=PASS", JSON.stringify({
    id: CANDIDATE.id,
    sourceProjectId: CANDIDATE.sourceProjectId,
    sourceRevision: CANDIDATE.sourceRevision,
    canonical: CANDIDATE.canonical,
    bytes: bytes.byteLength,
    sha256: `sha256:${sha256}`,
    ...summary,
  }));
}

await main();
