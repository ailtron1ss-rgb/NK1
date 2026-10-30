import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
test("one affective body profile reaches Original 2D and 3D",()=>{
 const stage=read("../src/components/AvatarStage.tsx"),original=read("../src/components/KurisuOriginalStage.tsx"),three=read("../src/components/Avatar3DStage.tsx");
 assert.match(stage,/deriveAffectiveBodyLanguage/);assert.match(stage,/bodyLanguage=\{bodyLanguageProfile\}/);
 assert.match(original,/bodyLanguage\.torsoLean/);assert.match(original,/bodyLanguage\.headTiltBias/);
 assert.match(three,/p\.bodyLanguage\.armOpenness/);assert.match(three,/p\.bodyLanguage\.movementTempo/);
});
test("Live2D body signal is versioned, bounded and applied to real torso parameters",()=>{
 const viewer=read("../../runtime/neuro-kurisu/public/live2d/viewer.html");
 assert.match(viewer,/kurisu_body_language/);assert.match(viewer,/protocolVersion!==1/);
 for(const id of ["ParamBodyAngleX","ParamBodyAngleY","ParamBodyAngleZ"])assert.ok(viewer.includes(id));
});
