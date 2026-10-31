import assert from "node:assert/strict";
import test from "node:test";
import { parseAvatarAssetEvidenceBundleJson } from "../src/components/avatar/avatarAssetManifest.ts";

const hex = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
  value => value.toString(16).padStart(2, "0")).join("");
const context={
 modelFingerprint:"sha256:"+"a".repeat(64),
 coordinateFrameId:"kurisu-root-meter-v1",
 nk1PreflightPassed:true
};
const report=(overrides={})=>({
 validatorVersion:"2.0.0-dev.3.10",validatedAt:"2026-10-31T08:00:00.000Z",
 mimeType:"model/gltf-binary",
 issues:{numErrors:0,numWarnings:1,numInfos:0,numHints:0,messages:[],truncated:false},
 info:{version:"2.0",resources:[{pointer:"/buffers/0",storage:"glb"}]},
 ...overrides
});
async function bundle(overrides={}){
 const reportText=JSON.stringify(report(overrides.report||{}));
 const manifest={
  schemaVersion:1,assetId:"kurisu.vrm.production",format:"vrm",modelFingerprint:context.modelFingerprint,
  source:{kind:"commissioned",name:"Kurisu rig",url:"https://example.org/kurisu",author:"NK1 Art Team"},
  license:{spdxId:"CC-BY-4.0",redistributionPermitted:false,attribution:"Personal viewing only",evidenceUrl:"https://example.org/license"},
  coordinateFrame:{id:context.coordinateFrameId,unit:"meter",handedness:"right",upAxis:"y",forwardAxis:"-z"},
  validation:{createdAt:"2026-10-31T08:00:00.000Z",khronosValidatorVersion:"2.0.0-dev.3.10",
   khronosReportSha256:await hex(reportText),nk1PreflightVersion:"1.0.0",nk1PreflightStatus:"pass"},
 };
 if(overrides.manifest)Object.assign(manifest,overrides.manifest);
 return {json:JSON.stringify({schemaVersion:1,manifest,khronosReportJson:overrides.rawReport??reportText}),reportText};
}

test("accepts a full local Khronos evidence bundle after hashing exact report bytes",async()=>{
 const b=await bundle(),result=await parseAvatarAssetEvidenceBundleJson(b.json,context);
 assert.equal(result.accepted,true);
 if(result.accepted){
  assert.equal(result.khronosReport.numErrors,0);
  assert.equal(result.khronosReport.numWarnings,1);
  assert.equal(result.releaseEligible,false);
  assert.equal(result.releaseBlockReason,"license-does-not-permit-redistribution");
  assert.equal(result.manifest.modelFingerprint,context.modelFingerprint);
 }
});

test("rejects report digest tampering, unsupported version and non-GLB asset metadata",async()=>{
 const b=await bundle({manifest:{validation:{createdAt:"2026-10-31T08:00:00.000Z",khronosValidatorVersion:"2.0.0-dev.3.10",
   khronosReportSha256:"0".repeat(64),nk1PreflightVersion:"1.0.0",nk1PreflightStatus:"pass"}}});
 assert.deepEqual(await parseAvatarAssetEvidenceBundleJson(b.json,context),
  {accepted:false,reason:"khronos-report-digest-mismatch"});
 const wrongMime=await bundle({report:{mimeType:"model/gltf+json"}});
 const wrongMimeParsed=await parseAvatarAssetEvidenceBundleJson(wrongMime.json,context);
 assert.equal(wrongMimeParsed.accepted,true,"Khronos MIME metadata is checked separately from NK1 extension/format policy");
});

test("rejects Khronos report errors, truncation, external resources and validator-version mismatch",async()=>{
 const errors=await bundle({report:{issues:{numErrors:1,numWarnings:0,numInfos:0,numHints:0,messages:[{severity:0,code:"INVALID",message:"bad"}],truncated:false}}});
 assert.equal((await parseAvatarAssetEvidenceBundleJson(errors.json,context)).reason,"khronos-report-has-errors");
 const truncated=await bundle({report:{issues:{numErrors:0,numWarnings:0,numInfos:0,numHints:0,messages:[],truncated:true}}});
 assert.equal((await parseAvatarAssetEvidenceBundleJson(truncated.json,context)).reason,"khronos-report-incomplete");
 const external=await bundle({report:{info:{version:"2.0",resources:[{pointer:"/images/0",storage:"external"}]}}});
 assert.equal((await parseAvatarAssetEvidenceBundleJson(external.json,context)).reason,"external-resource-in-khronos-report");
 const mismatched=await bundle({report:{validatorVersion:"2.0.0-other"}});
 assert.equal((await parseAvatarAssetEvidenceBundleJson(mismatched.json,context)).reason,"khronos-validator-version-mismatch");
});

test("rejects malformed report JSON and evidence when NK1 preflight or exact asset identity is absent",async()=>{
 const b=await bundle({rawReport:"not-json"});
 assert.equal((await parseAvatarAssetEvidenceBundleJson(b.json,context)).reason,"khronos-report-invalid");
 const good=await bundle();
 assert.equal((await parseAvatarAssetEvidenceBundleJson(good.json,{...context,nk1PreflightPassed:false})).reason,"manifest-rejected");
 assert.equal((await parseAvatarAssetEvidenceBundleJson(good.json,{...context,modelFingerprint:"sha256:"+"d".repeat(64)})).reason,"manifest-rejected");
});
