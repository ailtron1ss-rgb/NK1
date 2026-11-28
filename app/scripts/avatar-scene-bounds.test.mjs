import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { resolveAvatarFramingBounds, resolveAvatarSceneBounds } from "../src/components/avatar/avatarSceneBounds.ts";

test("environment floor does not shrink the character's normalized bounds", () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.6, 0.3),
    new THREE.MeshBasicMaterial(),
  );
  body.name = "BODY_torso_core";
  body.position.y = 0.45;
  root.add(body);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial(),
  );
  floor.name = "ENV_floor";
  floor.rotation.x = Math.PI / 2;
  root.add(floor);

  const resolved = resolveAvatarSceneBounds(root);
  const size = resolved.bounds.getSize(new THREE.Vector3());

  assert.deepEqual(resolved.excludedEnvironmentMeshes, ["ENV_floor"]);
  assert.equal(floor.visible, false, "studio environment geometry must not render as part of the avatar");
  assert.ok(Math.abs(size.x - 0.4) < 1e-6);
  assert.ok(Math.abs(size.y - 1.6) < 1e-6);
  assert.ok(Math.abs(size.z - 0.3) < 1e-6);
});

test("environment classification is scoped to mesh nodes, not humanoid bones", () => {
  const root = new THREE.Group();
  const helper = new THREE.Object3D();
  helper.name = "ENV_attachment";
  root.add(helper);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
  face.name = "HEAD_face";
  root.add(face);

  const resolved = resolveAvatarSceneBounds(root);

  assert.deepEqual(resolved.excludedEnvironmentMeshes, []);
  assert.equal(helper.visible, true);
  assert.equal(face.visible, true);
  assert.ok(resolved.bounds.getSize(new THREE.Vector3()).length() > 0);
});

test("scene bounds ignore position-buffer vertices not referenced by rendered triangles", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.2, 0, 0,
     0.2, 0, 0,
     0, 1.6, 0,
     0, 12, 0,
  ], 3));
  geometry.setIndex([0, 1, 2]);
  const body = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  body.name = "BODY_rendered_surface";
  root.add(body);

  const resolved = resolveAvatarSceneBounds(root);
  const size = resolved.bounds.getSize(new THREE.Vector3());

  assert.ok(Math.abs(size.x - 0.4) < 1e-6);
  assert.ok(Math.abs(size.y - 1.6) < 1e-6,
    "an unreferenced position-buffer outlier must not expand the rendered character bounds");
  assert.ok(Math.abs(size.z) < 1e-6);
  assert.equal(resolved.includedVertexCount, 3);
});

test("morph deformation is included only for indexed rendered vertices", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.2, 0, 0, 0.2, 0, 0, 0, 1, 0, 0, 20, 0,
  ], 3));
  geometry.setIndex([0, 1, 2]);
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([
    0, 0, 0, 0, 0, 0, 0, 1.5, 0, 0, 100, 0,
  ], 3)];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ morphTargets: true }));
  mesh.name = "BODY_morph_surface";
  mesh.morphTargetInfluences = [1];
  root.add(mesh);

  const resolved = resolveAvatarSceneBounds(root);
  const size = resolved.bounds.getSize(new THREE.Vector3());

  assert.ok(Math.abs(size.y - 1.5) < 1e-6,
    "morph-deformed positions must be measured without unreferenced outliers");
  assert.equal(resolved.includedVertexCount, 3);
});


test("a tiny pathological skinned mesh cannot shrink the full avatar normalization bounds", () => {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = "hips";
  const head = new THREE.Bone();
  head.name = "head";
  head.position.y = 0.82;
  hips.add(head);
  root.add(hips);

  const bodyGeometry = new THREE.BoxGeometry(0.4, 0.82, 0.3, 4, 4, 4);
  const body = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial());
  body.name = "BODY_torso_and_limbs";
  body.position.y = 0.8;
  root.add(body);

  const mouthGeometry = new THREE.BufferGeometry();
  mouthGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.05, 0.04, 0.08,
     0.05, 1.6, 0.08,
     0, 3.19, 0.08,
  ], 3));
  mouthGeometry.setIndex([0, 1, 2]);
  const mouth = new THREE.Mesh(mouthGeometry, new THREE.MeshBasicMaterial());
  mouth.name = "FACE_mouth";
  root.add(mouth);
  root.updateWorldMatrix(true, true);

  const completeBounds = resolveAvatarSceneBounds(root);
  const framing = resolveAvatarFramingBounds(root);
  const completeSize = completeBounds.bounds.getSize(new THREE.Vector3());
  const framingSize = framing.bounds.getSize(new THREE.Vector3());

  assert.ok(Math.abs(completeSize.y - 3.15) < 1e-6,
    "the full geometry audit must retain the outlier rather than hide or mutate the asset");
  assert.ok(Math.abs(framingSize.x - 0.4) < 1e-6);
  assert.ok(Math.abs(framingSize.y - 0.82) < 1e-6,
    "the single tiny outlier must not determine the avatar's scale");
  assert.ok(Math.abs(framingSize.z - 0.3) < 1e-6);
  assert.deepEqual(framing.excludedOutlierMeshes.map((item) => item.name), ["FACE_mouth"]);
  assert.equal(mouth.visible, true, "outlier geometry remains rendered and available to diagnostics");
});
