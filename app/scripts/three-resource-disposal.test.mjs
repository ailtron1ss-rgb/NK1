import test from "node:test";
import assert from "node:assert/strict";
import {
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Texture,
} from "three";
import { disposeThreeObjectTree } from "../src/components/avatar/threeResourceDisposal.ts";

function countDisposals(resource) {
  let count = 0;
  resource.addEventListener("dispose", () => { count += 1; });
  return () => count;
}

test("shared geometries, materials, textures and skeletons are disposed exactly once", () => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const texture = new Texture();
  const standard = new MeshStandardMaterial({ map: texture });
  const shader = new ShaderMaterial({
    uniforms: { image: { value: texture }, imageArray: { value: [texture] } },
  });
  const skeleton = { disposeCount: 0, dispose() { this.disposeCount += 1; } };
  const first = new Mesh(geometry, standard);
  const second = new Mesh(geometry, standard);
  const third = new Mesh(geometry, shader);
  first.skeleton = skeleton;
  second.skeleton = skeleton;
  root.add(first, second, third);

  const geometryDisposals = countDisposals(geometry);
  const textureDisposals = countDisposals(texture);
  const standardDisposals = countDisposals(standard);
  const shaderDisposals = countDisposals(shader);

  disposeThreeObjectTree(root);

  assert.equal(geometryDisposals(), 1);
  assert.equal(textureDisposals(), 1);
  assert.equal(standardDisposals(), 1);
  assert.equal(shaderDisposals(), 1);
  assert.equal(skeleton.disposeCount, 1);
});

test("renderer-owned shared textures are preserved during imported model cleanup", () => {
  const root = new Group();
  const protectedTexture = new Texture();
  const material = new MeshStandardMaterial({ map: protectedTexture });
  root.add(new Mesh(new BoxGeometry(), material));
  const protectedDisposals = countDisposals(protectedTexture);

  disposeThreeObjectTree(root, [protectedTexture]);

  assert.equal(protectedDisposals(), 0);
});
