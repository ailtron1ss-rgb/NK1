import test from "node:test";
import assert from "node:assert/strict";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from "three";
import {
  applyAnimeToonMaterials,
  createProceduralToonMaterial,
  getSharedAnimeGradientTexture,
} from "../src/components/avatar/threeToonMaterials.ts";
import { disposeThreeObjectTree } from "../src/components/avatar/threeResourceDisposal.ts";

function disposalCount(resource) {
  let count = 0;
  resource.addEventListener("dispose", () => { count += 1; });
  return () => count;
}

test("shared GLB materials convert once and keep their source textures alive", () => {
  const root = new Group();
  const map = new Texture();
  const normalMap = new Texture();
  const source = new MeshStandardMaterial({ map, normalMap, color: 0x87352c });
  source.name = "shared-hair";
  source.userData = { sourceTag: "glb" };
  const sourceDisposals = disposalCount(source);
  const mapDisposals = disposalCount(map);
  const normalDisposals = disposalCount(normalMap);
  root.add(
    new Mesh(new BoxGeometry(), source),
    new Mesh(new BoxGeometry(), source),
  );

  applyAnimeToonMaterials(root);

  const [first, second] = root.children;
  assert.equal(first.material, second.material, "shared source material should map to one cached toon material");
  assert.equal(first.material.isMeshToonMaterial, true);
  assert.equal(first.material.map, map);
  assert.equal(first.material.normalMap, normalMap);
  assert.equal(first.material.name, "shared-hair_NK1_Toon");
  assert.deepEqual(first.material.userData, { sourceTag: "glb", nk1ToonConverted: true });
  assert.equal(sourceDisposals(), 1, "source material should be disposed exactly once");
  assert.equal(mapDisposals(), 0, "source texture must remain alive while the converted material references it");
  assert.equal(normalDisposals(), 0);
});

test("physical materials convert while non-PBR materials are left untouched", () => {
  const root = new Group();
  const physical = new MeshPhysicalMaterial({ color: 0x884422, clearcoat: 0.7 });
  const basic = new MeshBasicMaterial({ color: 0x123456 });
  root.add(new Mesh(new BoxGeometry(), physical), new Mesh(new BoxGeometry(), basic));

  applyAnimeToonMaterials(root);

  assert.equal(root.children[0].material.isMeshToonMaterial, true);
  assert.equal(root.children[1].material, basic);
  assert.equal(getSharedAnimeGradientTexture()?.isTexture, true);
});

test("procedural and imported toon materials share one renderer-owned gradient", () => {
  const procedural = createProceduralToonMaterial(0xf4d7c8);
  const root = new Group();
  const source = new MeshStandardMaterial({ color: 0x87352c });
  root.add(new Mesh(new BoxGeometry(), source));
  applyAnimeToonMaterials(root);

  const gradient = getSharedAnimeGradientTexture();
  assert.ok(gradient?.isTexture);
  assert.equal(procedural.gradientMap, gradient);
  assert.equal(root.children[0].material.gradientMap, gradient);

  const gradientDisposals = disposalCount(gradient);
  disposeThreeObjectTree(root, [gradient]);
  assert.equal(gradientDisposals(), 0, "model cleanup must not dispose renderer-owned gradient texture");
  procedural.dispose();
  gradient.dispose();
});
