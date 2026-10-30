import assert from "node:assert/strict";
import test from "node:test";
import { GARMENTS, OUTFITS, getOutfit, isSafeWardrobeAssetPath, recommendOutfit, resolveOutfitAssets, resolveWardrobeSelection, validateWardrobeCatalog } from "../src/components/avatar/wardrobeSystem.ts";

test("wardrobe catalog has unique garments, valid outfit references and no slot collisions",()=>{
 assert.deepEqual(validateWardrobeCatalog(),[]);
 assert.equal(new Set(GARMENTS.map(x=>x.id)).size,GARMENTS.length);
 assert.equal(new Set(OUTFITS.map(x=>x.id)).size,OUTFITS.length);
});
test("catalog explicitly models interchangeable outfit families without claiming missing art exists",()=>{
 assert.equal(OUTFITS.length,6);
 assert.ok(GARMENTS.every(g=>Object.values(g.assets).every(a=>a.state==="missing")));
 assert.deepEqual(resolveOutfitAssets("lab_coat","vrm3d"),[]);
});
test("asset paths reject traversal, remote URLs and unsafe references",()=>{
 for(const p of ["../secret.png","/absolute.png","https://evil.test/a.png","a\\b.png","a.png?x=1","./a.png","a//b.png"])assert.equal(isSafeWardrobeAssetPath(p),false,p);
 for(const p of ["packs/kurisu/coat.webp","textures/hair.png","model/kurisu.vrm"])assert.equal(isSafeWardrobeAssetPath(p),true,p);
});
test("user selection is authoritative even when autonomous wardrobe is enabled",()=>{
 const result=recommendOutfit({userPinnedOutfit:"summer",autoChangeEnabled:true,sleeping:true,intent:"sleep"});
 assert.equal(result.outfitId,"summer");assert.equal(result.source,"user-pin");
});
test("autonomous recommendation requires explicit opt-in and otherwise stays neutral",()=>{
 const result=recommendOutfit({intent:"sleep",sleeping:true});
 assert.equal(result.outfitId,"lab_coat");assert.equal(result.source,"default");
});
test("autonomous selection responds to state and context, not only wall-clock time",()=>{
 assert.equal(recommendOutfit({autoChangeEnabled:true,sleeping:true}).outfitId,"nightwear");
 assert.equal(recommendOutfit({autoChangeEnabled:true,intent:"science"}).outfitId,"lab_coat");
 assert.equal(recommendOutfit({autoChangeEnabled:true,intent:"presentation"}).outfitId,"formal");
 assert.equal(recommendOutfit({autoChangeEnabled:true,energy01:0.1}).outfitId,"hoodie");
 assert.equal(recommendOutfit({autoChangeEnabled:true,intent:"social"}).outfitId,"casual");
 assert.equal(recommendOutfit({autoChangeEnabled:true,intent:"outdoor",thermalComfort01:0.95}).outfitId,"summer");
});
test("asset resolution exposes only verified renderer-specific assets",()=>{
 assert.equal(resolveOutfitAssets("casual","live2d").length,0);
});
test("unknown outfit ids fall back deterministically to the canonical first outfit",()=>{
 assert.equal(getOutfit("unknown").id,"lab_coat");
});


test("wardrobe selection composes independent slots without pretending missing art is renderable",()=>{
 const selection=resolveWardrobeSelection(["coat-lab","bottom-neutral","shoes-neutral","hair-clip-red"],"vrm3d");
 assert.equal(selection.valid,true);
 assert.equal(selection.ready,false);
 assert.equal(selection.garments.length,4);
 assert.equal(selection.assets.length,0);
 assert.deepEqual(selection.missingGarmentIds,["coat-lab","bottom-neutral","shoes-neutral","hair-clip-red"]);
});
test("wardrobe selection rejects duplicate slots, unknown IDs and repeated garments",()=>{
 const duplicateSlot=resolveWardrobeSelection(["top-casual","top-hoodie"],"vrm3d");
 assert.ok(duplicateSlot.errors.includes("selection:duplicate-slot:top"));
 const duplicateId=resolveWardrobeSelection(["coat-lab","coat-lab"],"vrm3d");
 assert.ok(duplicateId.errors.includes("selection:duplicate-garment:coat-lab"));
 const unknown=resolveWardrobeSelection(["not-a-garment"],"vrm3d");
 assert.ok(unknown.errors.includes("selection:unknown-garment:not-a-garment"));
});
test("untrusted non-string asset paths fail closed instead of throwing",()=>{
 assert.equal(isSafeWardrobeAssetPath(17),false);
 assert.equal(isSafeWardrobeAssetPath({toString:()=>"safe.png"}),false);
});
