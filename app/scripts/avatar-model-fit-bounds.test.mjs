import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { resolveAvatarModelFitBounds } from "../src/components/avatar/avatarModelFitBounds.ts";

function mesh(name, geometry, type = "static") {
  const material = new THREE.MeshBasicMaterial();
  const result = type === "skinned"
    ? new THREE.SkinnedMesh(geometry, material)
    : new THREE.Mesh(geometry, material);
  result.name = name;
  if (type === "skinned") {
    const count = geometry.attributes.position.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);
    for (let index = 0; index < count; index += 1) skinWeights[index * 4] = 1;
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
    const bone = new THREE.Bone();
    result.bind(new THREE.Skeleton([bone]));
  }
  return result;
}

test("rigged character fit bounds ignore a 200m environment floor", () => {
  const root = new THREE.Group();
  const body = mesh("BODY_torso", new THREE.BoxGeometry(0.7, 1.75, 0.34), "skinned");
  body.position.y = 0.9;
  const head = mesh("HEAD_face", new THREE.BoxGeometry(0.29, 0.37, 0.25), "skinned");
  head.position.y = 1.55;
  const floor = mesh("ENV_floor", new THREE.PlaneGeometry(200, 200));
  floor.rotation.x = -Math.PI / 2;
  root.add(body, head, floor);

  const result = resolveAvatarModelFitBounds(root);
  const size = new THREE.Vector3();
  result.bounds.getSize(size);

  assert.equal(result.source, "skinned-meshes");
  assert.equal(result.includedMeshes, 2);
  assert.equal(result.excludedEnvironmentMeshes, 1);
  assert.ok(size.y >= 1.7 && size.y <= 1.9, "character height must not be scaled by the floor");
  assert.ok(size.x < 1 && size.z < 0.5, "character width/depth must remain human-sized");
});

test("a rigged asset prefers skinned character meshes over unskinned plinth and environment", () => {
  const root = new THREE.Group();
  const body = mesh("BODY_torso", new THREE.BoxGeometry(0.6, 1.7, 0.3), "skinned");
  body.position.y = 0.85;
  const plinth = mesh("ENV_avatar_plinth", new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16));
  plinth.position.y = 0.02;
  const floor = mesh("ENV_floor", new THREE.PlaneGeometry(200, 200));
  root.add(body, plinth, floor);

  const result = resolveAvatarModelFitBounds(root);
  const size = new THREE.Vector3();
  result.bounds.getSize(size);

  assert.equal(result.source, "skinned-meshes");
  assert.equal(result.includedMeshes, 1);
  assert.equal(result.excludedEnvironmentMeshes, 1);
  assert.ok(size.y > 1.6 && size.y < 1.8);
});

test("static GLB fallback keeps character meshes but skips named and degenerate oversized environment planes", () => {
  const root = new THREE.Group();
  const body = mesh("character_body", new THREE.BoxGeometry(0.5, 1.6, 0.25));
  body.position.y = 0.8;
  const floor = mesh("ENV_floor", new THREE.PlaneGeometry(200, 200));
  const unnamedGround = mesh("large_backdrop_plane", new THREE.PlaneGeometry(120, 120));
  root.add(body, floor, unnamedGround);

  const result = resolveAvatarModelFitBounds(root);
  const size = new THREE.Vector3();
  result.bounds.getSize(size);

  assert.equal(result.source, "character-meshes");
  assert.equal(result.includedMeshes, 1);
  assert.equal(result.excludedEnvironmentMeshes, 2);
  assert.ok(size.y > 1.5 && size.y < 1.7);
});

test("fit bounds fail closed when a model has no usable character meshes", () => {
  const root = new THREE.Group();
  root.add(mesh("ENV_floor", new THREE.PlaneGeometry(200, 200)));
  assert.throws(() => resolveAvatarModelFitBounds(root), /no usable character mesh bounds/i);
});
