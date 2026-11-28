import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { resolveAvatarSceneBounds } from "../src/components/avatar/avatarSceneBounds.ts";

test("environment floor does not shrink the character's normalized bounds", () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.6, 0.3),
    new THREE.MeshBasicMaterial(),
  );
  body.name = "BODY_torso_core";
  body.position.y = 0.8;
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
});
