import assert from "node:assert/strict";
import test from "node:test";
import { validateStoredWardrobeSelection, validateWardrobeStorageIdentity, wardrobeStorageKey } from "../src/components/avatar/wardrobePackStore.ts";

const manifest=()=>({
 schemaVersion:1,packId:"kurisu-modular",version:"1.0.0",creator:"NK1 test",source:"https://example.org/kurisu-pack",
 licenseId:"CC-BY-4.0",attribution:"Test asset attribution",targetBodyId:"body-kurisu-v1",targetRigVersion:"nk1-three-skeleton-name-map-v1",
 assets:[
  {id:"coat-v1",garmentId:"coat-lab",slot:"outerwear",renderer:"vrm3d",path:"garments/coat.glb",sha256:"a".repeat(64),bytes:64,mime:"model/gltf-binary"},
  {id:"shoes-v1",garmentId:"shoes-black",slot:"footwear",renderer:"vrm3d",path:"garments/shoes.glb",sha256:"b".repeat(64),bytes:64,mime:"model/gltf-binary"},
  {id:"coat-preview",garmentId:"coat-preview",slot:"outerwear",renderer:"depth2d",path:"previews/coat.webp",sha256:"c".repeat(64),bytes:64,mime:"image/webp"}
 ]
});

test("stored wardrobe selection preserves independent slots and exact renderer scope",()=>{
 assert.deepEqual(validateStoredWardrobeSelection(manifest(),["coat-v1","shoes-v1"]),[]);
});
test("stored wardrobe selection rejects empty, unknown, duplicate and same-slot items",()=>{
 assert.ok(validateStoredWardrobeSelection(manifest(),[]).includes("wardrobe:stored-selection-empty"));
 assert.ok(validateStoredWardrobeSelection(manifest(),["missing"]).includes("wardrobe:stored-selection-unknown-asset:missing"));
 assert.ok(validateStoredWardrobeSelection(manifest(),["coat-v1","coat-v1"]).includes("wardrobe:stored-selection-duplicate-id:coat-v1"));
 assert.ok(validateStoredWardrobeSelection(manifest(),["coat-v1","coat-preview"]).includes("wardrobe:stored-selection-wrong-renderer:coat-preview"));
});
test("same-slot garment replacement is rejected before persistence",()=>{
 const value=manifest();
 value.assets.push({...value.assets[0],id:"coat-alt",path:"garments/coat-alt.glb"});
 assert.ok(validateStoredWardrobeSelection(value,["coat-v1","coat-alt"]).includes("wardrobe:stored-selection-duplicate-slot:outerwear"));
});
test("wardrobe persistence keys are body- and rig-specific and bounded",()=>{
 assert.equal(wardrobeStorageKey("body-a","rig-1"),"body-a::rig-1");
 assert.notEqual(wardrobeStorageKey("body-a","rig-1"),wardrobeStorageKey("body-b","rig-1"));
 assert.notEqual(wardrobeStorageKey("body-a","rig-1"),wardrobeStorageKey("body-a","rig-2"));
 assert.throws(()=>wardrobeStorageKey("","rig-1"),/invalid-storage-identity/);
});


test("stored manifest identity must match both the exact body and rig version",()=>{
 const value=manifest();
 assert.deepEqual(validateWardrobeStorageIdentity("body-kurisu-v1","nk1-three-skeleton-name-map-v1",value),[]);
 assert.ok(validateWardrobeStorageIdentity("other-body","nk1-three-skeleton-name-map-v1",value).includes("wardrobe:storage-body-mismatch"));
 assert.ok(validateWardrobeStorageIdentity("body-kurisu-v1","other-rig",value).includes("wardrobe:storage-rig-mismatch"));
});
