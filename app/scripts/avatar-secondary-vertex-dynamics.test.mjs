import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import * as vertexDynamics from "../src/components/avatar/avatarSecondaryVertexDynamics.ts";

function makeGeometry(minY = -1, maxY = 1) {
  return {
    attributes: { position: { count: 64 } },
    boundingBox: { min: { y: minY }, max: { y: maxY } },
  };
}

function makeMaterial(name = "coat-material", kind = "standard") {
  return {
    name,
    isMeshStandardMaterial: kind === "standard",
    isMeshPhysicalMaterial: kind === "physical",
    isMeshToonMaterial: kind === "toon",
    color: { value: 0xffffff },
    roughness: 0.82,
    metalness: 0.12,
    gradientMap: kind === "toon" ? { isTexture: true, name: "NK1 shared cel gradient" } : null,
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

function makeParticleGeometry(rows = 3) {
  const positions = [];
  const index = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < 3; x += 1) positions.push(x * 0.1, y * (0.2 / (rows - 1)), 0);
  }
  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < 2; x += 1) {
      const a = y * 3 + x, b = a + 1, c = a + 3, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geometry = {
    attributes: { position: { array: new Float32Array(positions), count: positions.length / 3, getY(i) { return this.array[i * 3 + 1]; } } },
    index: { array: new Uint16Array(index) },
    boundingBox: { min: { y: 0 }, max: { y: 0.2 } },
    disposed: false,
    setAttribute(name, attribute) { this.attributes[name] = attribute; },
    getAttribute(name) { return this.attributes[name]; },
    clone() {
      const clone = {
        ...this,
        attributes: { ...this.attributes },
        index: this.index,
        disposed: false,
        setAttribute: this.setAttribute,
        getAttribute: this.getAttribute,
        dispose() { this.disposed = true; },
      };
      return clone;
    },
    dispose() { this.disposed = true; },
  };
  return geometry;
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
  assert.equal(vertexDynamics.injectAvatarSecondaryVertexShader(shader, uniforms, true), true);
  assert.ok(shader.vertexShader.includes("#include <skinning_vertex>"));
  assert.ok(shader.vertexShader.indexOf("#include <skinning_vertex>") < shader.vertexShader.indexOf("transformed.x +="));
  assert.ok(shader.vertexShader.indexOf("#include <skinning_vertex>") < shader.vertexShader.indexOf("transformed += nk1SecondaryOffset;"),
    "XPBD offsets must be applied after skinning so body contacts share deformed mesh space");
  assert.ok(shader.vertexShader.includes("transformed.x +="));
  assert.ok(shader.vertexShader.includes("transformed.z +="));
  assert.ok(shader.vertexShader.length > original.length);
  assert.equal(shader.uniforms.nk1SecondaryAmplitude, uniforms.nk1SecondaryAmplitude);
});

function bodySurfaceMesh() {
  const positions = new Float32Array([
    0, 0, 0,
    0.5, 0, 0,
    0, 0.5, 0,
    0, 0, 0.5,
  ]);
  const geometry = {
    attributes: { position: { array: positions, count: 4 } },
    index: { array: new Uint16Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]) },
  };
  return {
    name: "BODY_torso_core", isMesh: true, isSkinnedMesh: true, geometry,
    getVertexPosition(index, target) { return target.fromArray(positions, index * 3); },
    localToWorld(target) { return target; },
    worldToLocal(target) { return target; },
    updateWorldMatrix() {},
    skeleton: { update() {} },
  };
}

test("body surface resolver selects only the exact canonical skinned torso shell", () => {
  const canonical = bodySurfaceMesh();
  const impostor = { ...bodySurfaceMesh(), name: "BODY_torso_core_proxy" };
  const staticMesh = { ...bodySurfaceMesh(), name: "BODY_torso_core_static", isSkinnedMesh: false };
  const root = scene([impostor, staticMesh, canonical]);
  assert.equal(vertexDynamics.resolveAvatarSecondaryBodySurface(root), canonical);
});

test("XPBD vertices are projected against the current skinned torso surface in mesh-local space", () => {
  const torso = bodySurfaceMesh();
  const part = mesh("CLOTH_labcoat_main", { geometry: makeParticleGeometry(3) });
  const positions = part.geometry.attributes.position.array;
  for (let vertex = 0; vertex < part.geometry.attributes.position.count; vertex += 1) {
    const offset = vertex * 3;
    positions[offset] = 0.08 + (vertex % 3) * 0.01;
    positions[offset + 1] = 0.08 + Math.floor(vertex / 3) * 0.01;
    positions[offset + 2] = 0.08;
  }
  part.geometry.boundingBox = { min: { y: 0.08 }, max: { y: 0.1 } };
  part.getVertexPosition = (index, target) => target.fromArray(part.geometry.attributes.position.array, index * 3);
  part.localToWorld = (target) => target;
  part.worldToLocal = (target) => target;
  part.updateWorldMatrix = () => {};
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part, torso]), 1);
  assert.equal(bindings.length, 1);
  const state = bindings[0].particleState;
  assert.ok(state);
  vertexDynamics.updateAvatarSecondaryVertexDynamics(bindings, frame({ deltaSeconds: 0 }), 0, torso);
  assert.ok(state.bodyCollisionCount > 0, "an embedded movable cloth vertex must receive torso contact");
  assert.ok(state.maxBodyCollisionCorrection > 0);
  const offsets = bindings[0].patchedGeometry.getAttribute("nk1SecondaryOffset").array;
  assert.ok(offsets.some((value) => Math.abs(value) > 1e-6),
    "the body contact correction must reach the post-skin GPU offset attribute");
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
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

test("the asset-verified HAIR_layer_R0 mesh is eligible for bounded secondary hair dynamics", () => {
  const part = mesh("HAIR_layer_R0", { geometry: makeParticleGeometry(3) });
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1);
  assert.equal(bindings.length, 1,
    "the canonical v5 browser audit exposes HAIR_layer_R0 as a detached hair-layer mesh");
  assert.equal(bindings[0].role, "hair");
  assert.equal(bindings[0].uniforms.nk1SecondarySide.value, 1);
  assert.ok(bindings[0].particleState,
    "the validated low-vertex-count surface must use XPBD rather than shader-only sway");
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
});

test("the asset-verified HAIR_layer_L0 mesh receives mirrored bounded XPBD hair dynamics", () => {
  const part = mesh("HAIR_layer_L0", { geometry: makeParticleGeometry(3) });
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1);
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].role, "hair");
  assert.equal(bindings[0].uniforms.nk1SecondarySide.value, -1);
  assert.ok(bindings[0].particleState);
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
});

test("toon-converted GLB materials keep their cel gradient and accept the same vertex sway hook", () => {
  const original = makeMaterial("NK1_Toon_Hair", "toon");
  original.userData.nk1ToonConverted = true;
  const part = mesh("HAIR_long_lock_L", { material: original });
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 3.15);
  assert.equal(bindings.length, 1, "MeshToonMaterial converted by NK1 must remain eligible");
  assert.equal(part.material.isMeshToonMaterial, true);
  assert.equal(part.material.gradientMap, original.gradientMap, "the shared cel-shading ramp must survive cloning");
  assert.equal(part.material.userData.nk1ToonConverted, true);
  assert.equal(part.material.userData.nk1SecondaryVertexDynamics, true);
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\\nvoid main() { vec3 transformed = position; #include <skinning_vertex> gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0); }",
  };
  part.material.onBeforeCompile(shader, {});
  assert.ok(shader.vertexShader.includes("NK1_SECONDARY_VERTEX_MOTION_V1"));
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
  assert.equal(part.material, original);
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


test("authored mesh vertices run through XPBD particles and restore geometry on disposal", () => {
  const part = mesh("CLOTH_skirt", { geometry: makeParticleGeometry() });
  const originalGeometry = part.geometry;
  const originalMaterial = part.material;
  const originalFrustumCulled = true;
  part.frustumCulled = originalFrustumCulled;
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1);
  assert.equal(bindings.length, 1);
  assert.ok(bindings[0].particleState, "the real vertex grid must receive an XPBD state");
  assert.notEqual(part.geometry, originalGeometry);
  assert.equal(part.frustumCulled, false, "simulated offsets must not be culled by stale bounds");
  const offset = part.geometry.getAttribute("nk1SecondaryOffset");
  assert.ok(offset);
  const rest = new Float32Array(offset.array.length);
  vertexDynamics.updateAvatarSecondaryVertexDynamics(bindings, frame(), 1 / 60);
  assert.ok(offset.array.some((value, index) => Math.abs(value - rest[index]) > 1e-8));
  assert.ok(bindings[0].particleState.completedSteps > 0);
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
  assert.equal(part.geometry, originalGeometry);
  assert.equal(part.material, originalMaterial);
  assert.equal(part.frustumCulled, originalFrustumCulled);
  assert.equal(bindings[0].patchedGeometry.disposed, true);
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

test("authored nk1SecondaryPin attributes preserve soft attachment gradients", () => {
  const part = mesh("CLOTH_skirt", { geometry: makeParticleGeometry() });
  const weights = new Float32Array([1, 1, 1, 0.25, 0.5, 0, 0, 0, 0]);
  part.geometry.attributes.nk1SecondaryPin = { array: weights, count: weights.length };
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1);
  assert.equal(bindings.length, 1);
  assert.ok(bindings[0].particleState);
  assert.equal(bindings[0].particleState.inverseMass[0], 0, "authored hard pins remain immovable");
  assert.equal(bindings[0].particleState.inverseMass[3], 0.75, "authored 0.25 pin allows 0.75 inverse mass");
  assert.equal(bindings[0].particleState.inverseMass[4], 0.5, "authored 0.5 pin allows 0.5 inverse mass");
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
});

test("inferred mesh attachment bands blend into the freely moving surface", () => {
  const part = mesh("CLOTH_skirt", { geometry: makeParticleGeometry(8) });
  const bindings = vertexDynamics.attachAvatarSecondaryVertexDynamics(scene([part]), 1);
  assert.equal(bindings.length, 1);
  const state = bindings[0].particleState;
  assert.ok(state);
  assert.equal(state.inverseMass[21], 0, "the distal attachment row must remain hard-pinned");
  assert.ok(state.inverseMass[18] > 0 && state.inverseMass[18] < 1,
    "the lower edge of the attachment band must transition through a soft pin");
  assert.equal(state.inverseMass[15], 1, "the free surface below the attachment band must remain fully movable");
  vertexDynamics.disposeAvatarSecondaryVertexDynamics(bindings);
});
