import assert from "node:assert/strict";
import test from "node:test";
import * as vertexDynamics from "../src/components/avatar/avatarSecondaryVertexDynamics.ts";

function makeGeometry(minY = -1, maxY = 1) {
  return {
    attributes: { position: { count: 64 } },
    boundingBox: { min: { y: minY }, max: { y: maxY } },
  };
}

function makeMaterial(name = "coat-material") {
  return {
    name,
    isMeshStandardMaterial: true,
    color: { value: 0xffffff },
    roughness: 0.82,
    metalness: 0.12,
    onBeforeCompile() {},
    customProgramCacheKey() { return "original-program"; },
    userData: { keep: true },
    disposed: false,
    clone() {
      const source = this;
      return {
        ...source,
        userData: { ...source.userData },
        color: { ...source.color },
        disposed: false,
        dispose() { this.disposed = true; },
      };
    },
  };
}

function mesh(name, options = {}) {
  const value = {
    name,
    isMesh: true,
    isSkinnedMesh: options.skinned !== false,
    geometry: options.geometry ?? makeGeometry(),
    material: options.material ?? makeMaterial(),
    children: [],
    parent: null,
  };
  return value;
}

function scene(nodes) {
  const root = { name: "Scene", children: [], traverse(visitor) {
    const visit = (node) => { visitor(node); for (const child of node.children ?? []) visit(child); };
    visit(this);
  } };
  for (const child of nodes) { child.parent = root; root.children.push(child); }
  return root;
}

function frame(overrides = {}) {
  return {
    deltaSeconds: 1 / 60,
    awake: true,
    energy: 0.8,
    arousal: 0.55,
    cognitiveLoad: 0.3,
    uncertainty: 0.2,
    curiosity: 0.7,
    novelty: 0.45,
    predictionError: 0.1,
    action: "listen",
    quality: "high",
    bodyChannels: { headYaw: 0.2, torsoYaw: 0.1, breath: 0.35, leftAnkle: 0.4, rightAnkle: 0.2 },
    ...overrides,
  };
}

test("shader injection adds a bounded displacement only after the skinning transform", () => {
  assert.equal(typeof vertexDynamics.injectAvatarSecondaryVertexShader, "function");
  const shader = {
    uniforms: {},
    vertexShader: [
      "#include <common>",
      "void main() {",
      "  vec3 transformed = position;",
      "  #include <skinning_vertex>",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);",
      "}",
    ].join("\n"),
  };
  const uniforms = {
    nk1SecondaryTime: { value: 0 },
    nk1SecondaryMotion: { value: 0 },
    nk1SecondaryGait: { value: 0 },
    nk1SecondaryBreath: { value: 0 },
    nk1SecondaryYaw: { value: 0 },
    nk1SecondaryMinY: { value: -1 },
    nk1SecondaryInvHeight: { value: 0.5 },
    nk1SecondaryAmplitude: { value: 0.004 },
    nk1SecondaryPhase: { value: 0.7 },
    nk1SecondarySide: { value: -1 },
    nk1SecondaryHair: { value: 1 },
  };
  const original = shader.vertexShader;
  assert.equal(vertexDynamics.injectAvatarSecondaryVertexShader(shader, uniforms), true);
  assert.ok(shader.vertexShader.includes("#include <skinning_vertex>"));
  assert.ok(shader.vertexShader.indexOf("#include <skinning_vertex>") < shader.vertexShader.indexOf("transformed.x +="));
  assert.ok(shader.vertexShader.includes("transformed.x +="));
  assert.ok(shader.vertexShader.includes("transformed.z +="));
  assert.ok(shader.vertexShader.length > original.length);
  assert.equal(shader.uniforms.nk1SecondaryAmplitude, uniforms.nk1SecondaryAmplitude);
});

test("shader injection fails closed when the skinned vertex anchor is absent", () => {
  assert.equal(typeof vertexDynamics.injectAvatarSecondaryVertexShader, "function");
  const shader = { uniforms: {}, vertexShader: "#include <common>\nvoid main() { vec3 transformed = position; }" };
  const original = shader.vertexShader;
  assert.equal(vertexDynamics.injectAvatarSecondaryVertexShader(shader, {}), false);
  assert.equal(shader.vertexShader, original);
  assert.deepEqual(shader.uniforms, {});
});

test("attachment is limited to separate skinned hair locks and garment panels, never the identity rig", () => {
  assert.equal(typeof vertexDynamics.attachAvatarSecondaryVertexDynamics, "function");
  const selected = [
    mesh("HAIR_long_lock_L"),
    mesh("HAIR_front_strand_R"),
    mesh("HAIR_layer_L1"),
    mesh("CLOTH_skirt"),
    mesh("CLOTH_tie_blade"),
    mesh("CLOTH_labcoat_main"),
  ];
  const excluded = [
    mesh("HAIR_back_mass"),
    mesh("HAIR_crown"),
    mesh("HAIR_fringe_center"),
    mesh("face"),
    mesh("eyes"),
    mesh("CLOTH_lapel_left"),
    mesh("CLOTH_lower_sleeve_L"),
    mesh("HAIR_long_lock_R", { skinned: false }),
  ];
  const root = scene([...selected, ...excluded]);
  const originalMaterials = selected.map((part) => part.material);
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(root, 2);
  assert.equal(bindings.length, selected.length);
  for (let index = 0; index < selected.length; index += 1) {
    assert.notEqual(selected[index].material, originalMaterials[index]);
    assert.equal(selected[index].material.isMeshStandardMaterial, true);
    assert.equal(selected[index].material.roughness, 0.82);
    assert.equal(selected[index].material.metalness, 0.12);
    assert.equal(originalMaterials[index].disposed, false);
  }
  for (const part of excluded) assert.equal(part.material.userData?.nk1SecondaryVertexDynamics, undefined);
  assert.ok(bindings.every((binding) => binding.uniforms.nk1SecondaryAmplitude.value > 0));
  assert.ok(bindings.every((binding) => binding.uniforms.nk1SecondaryAmplitude.value < 0.02));
  assert.ok(bindings[0].uniforms.nk1SecondaryAmplitude.value > bindings[1].uniforms.nk1SecondaryAmplitude.value);
  assert.equal(bindings[2].uniforms.nk1SecondarySide.value, -1);
});

test("frame drive is deterministic, bounded, and respects sleep and device quality", () => {
  assert.equal(typeof vertexDynamics.resolveAvatarSecondaryVertexDrive, "function");
  const awake = vertexDynamics.resolveAvatarSecondaryVertexDrive(frame());
  const again = vertexDynamics.resolveAvatarSecondaryVertexDrive(frame());
  const sleeping = vertexDynamics.resolveAvatarSecondaryVertexDrive(frame({ awake: false }));
  const low = vertexDynamics.resolveAvatarSecondaryVertexDrive(frame({ quality: "low" }));
  assert.deepEqual(awake, again);
  for (const value of Object.values(awake)) assert.ok(Number.isFinite(value) && Math.abs(value) <= 1);
  assert.ok(sleeping.motion < awake.motion);
  assert.ok(low.motion < awake.motion);
  assert.ok(awake.gait > 0);
  assert.ok(awake.breath > 0);
});

test("uniform updates clamp frame values and restore releases cloned materials safely", () => {
  assert.equal(typeof vertexDynamics.updateAvatarSecondaryVertexDynamics, "function");
  assert.equal(typeof vertexDynamics.disposeAvatarSecondaryVertexDynamics, "function");
  const part = mesh("HAIR_long_lock_L");
  const original = part.material;
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1.5);
  vertexDynamics.updateAvatarSecondaryVertexDynamics(bindings, frame({ energy: 99, arousal: -4 }), 3.25);
  assert.equal(bindings[0].uniforms.nk1SecondaryTime.value, 3.25);
  assert.ok(bindings[0].uniforms.nk1SecondaryMotion.value >= 0);
  assert.ok(bindings[0].uniforms.nk1SecondaryMotion.value <= 1);
  const clone = part.material;
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
  assert.equal(part.material, original);
  assert.equal(clone.disposed, true);
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
  assert.equal(part.material, original);
});


test("shader injection rejects malformed supplemental uniforms without partial mutation", () => {
  const shader = {
    uniforms: {},
    vertexShader: [
      "#include <common>",
      "void main() {",
      "  vec3 transformed = position;",
      "  #include <skinning_vertex>",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);",
      "}",
    ].join("\n"),
  };
  const originalShader = shader.vertexShader;
  const uniforms = {
    nk1SecondaryTime: { value: 0 },
    nk1SecondaryMotion: { value: 0 },
    nk1SecondaryGait: { value: 0 },
    nk1SecondaryBreath: { value: 0 },
    nk1SecondaryYaw: { value: 0 },
    nk1SecondaryMinY: { value: -1 },
    nk1SecondaryInvHeight: { value: 0.5 },
    nk1SecondaryAmplitude: { value: 0.004 },
    nk1SecondaryPhase: { value: 0.7 },
    nk1SecondarySide: { value: -1 },
    nk1SecondaryHair: { value: 1 },
    nk1ExtraMalformed: { value: Number.NaN },
  };

  assert.equal(vertexDynamics.injectAvatarSecondaryVertexShader(shader, uniforms), false);
  assert.equal(shader.vertexShader, originalShader, "a rejected uniform must not leave a patched shader behind");
  assert.deepEqual(shader.uniforms, {}, "a rejected uniform must not register a partial uniform set");
});
