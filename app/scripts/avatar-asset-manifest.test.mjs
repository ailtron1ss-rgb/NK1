import assert from "node:assert/strict";
import test from "node:test";
import { parseAvatarAssetManifestJson, validateAvatarAssetManifestV1 } from "../src/components/avatar/avatarAssetManifest.ts";

const context={
 modelFingerprint:"sha256:"+"a".repeat(64),
 coordinateFrameId:"kurisu-root-meter-v1",
 khronosReportSha256:"b".repeat(64),
 nk1PreflightPassed:true,
};
const manifest=(overrides={})=>({
 schemaVersion:1,assetId:"kurisu.vrm.production",format:"vrm",
 modelFingerprint:context.modelFingerprint,
 source:{kind:"commissioned",name:"Kurisu rig",url:"https://example.org/assets/kurisu",author:"NK1 Art Team"},
 license:{spdxId:"CC-BY-4.0",redistributionPermitted:true,attribution:"Author attribution",evidenceUrl:"https://example.org/license"},
 coordinateFrame:{id:context.coordinateFrameId,unit:"meter",handedness:"right",upAxis:"y",forwardAxis:"-z"},
 validation:{createdAt:"2026-10-31T07:00:00.000Z",khronosValidatorVersion:"2.0.0-dev.3.10",khronosReportSha256:context.khronosReportSha256,nk1PreflightVersion:"1.0.0",nk1PreflightStatus:"pass"},
 vrmCalibrationBundleSha256:"c".repeat(64),
 ...overrides
});

test("accepts a model manifest only when fingerprint, frame and both validator receipts match",()=>{
 const result=validateAvatarAssetManifestV1(manifest(),context);
 assert.equal(result.accepted,true);
 if(result.accepted){
  assert.equal(result.releaseEligible,true);
  assert.equal(result.releaseBlockReason,null);
  assert.ok(Object.isFrozen(result.manifest));
  assert.ok(Object.isFrozen(result.manifest.license));
 }
});

test("separates local-view permission from permission to redistribute in NK1 releases",()=>{
 const result=validateAvatarAssetManifestV1(manifest({
  license:{spdxId:"ARR",redistributionPermitted:false,attribution:"Personal import only",evidenceUrl:null}
 }),context);
 assert.equal(result.accepted,true);
 if(result.accepted){
  assert.equal(result.releaseEligible,false);
  assert.equal(result.releaseBlockReason,"license-does-not-permit-redistribution");
 }
});

test("rejects stale model fingerprint, coordinate frame and changed Khronos report",()=>{
 assert.deepEqual(validateAvatarAssetManifestV1(manifest(),{...context,modelFingerprint:"sha256:"+"d".repeat(64)}),
  {accepted:false,reason:"model-fingerprint-mismatch"});
 assert.deepEqual(validateAvatarAssetManifestV1(manifest(),{...context,coordinateFrameId:"camera"}),
  {accepted:false,reason:"coordinate-frame-mismatch"});
 assert.deepEqual(validateAvatarAssetManifestV1(manifest(),{...context,khronosReportSha256:"e".repeat(64)}),
  {accepted:false,reason:"validation-evidence-mismatch"});
 assert.deepEqual(validateAvatarAssetManifestV1(manifest(),{...context,nk1PreflightPassed:false}),
  {accepted:false,reason:"validation-evidence-mismatch"});
});

test("rejects malformed license/format/axis/timestamp and unsupported frame units",()=>{
 assert.equal(validateAvatarAssetManifestV1(manifest({format:"fbx"}),context).reason,"invalid-manifest");
 assert.equal(validateAvatarAssetManifestV1(manifest({license:{spdxId:"",redistributionPermitted:true,attribution:"",evidenceUrl:null}}),context).reason,"invalid-manifest");
 assert.equal(validateAvatarAssetManifestV1(manifest({coordinateFrame:{...manifest().coordinateFrame,unit:"cm"}}),context).reason,"invalid-manifest");
 assert.equal(validateAvatarAssetManifestV1(manifest({coordinateFrame:{...manifest().coordinateFrame,forwardAxis:"+y"}}),context).reason,"invalid-manifest");
 assert.equal(validateAvatarAssetManifestV1(manifest({validation:{...manifest().validation,createdAt:"yesterday"}}),context).reason,"invalid-manifest");
});

test("JSON import is bounded and rejects malformed payloads",()=>{
 assert.equal(parseAvatarAssetManifestJson("{",context).reason,"invalid-manifest");
 assert.equal(parseAvatarAssetManifestJson(" ".repeat(32769),context).reason,"invalid-manifest");
 assert.equal(parseAvatarAssetManifestJson(JSON.stringify(manifest()),context).accepted,true);
});
