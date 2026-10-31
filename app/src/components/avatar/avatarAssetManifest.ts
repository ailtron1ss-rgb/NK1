export type AvatarAssetFormat = "vrm" | "glb2" | "layered-2.5d-glb2";
export type AvatarAssetSourceKind = "original" | "commissioned" | "licensed" | "open-source" | "user-import";
export interface AvatarAssetManifestV1 {
  schemaVersion: 1;
  assetId: string;
  format: AvatarAssetFormat;
  modelFingerprint: string;
  source: { kind: AvatarAssetSourceKind; name: string; url: string | null; author: string };
  license: { spdxId: string; redistributionPermitted: boolean; attribution: string; evidenceUrl: string | null };
  coordinateFrame: { id: string; unit: "meter"; handedness: "right" | "left"; upAxis: "x" | "y" | "z"; forwardAxis: "+x" | "-x" | "+y" | "-y" | "+z" | "-z" };
  validation: { createdAt: string; khronosValidatorVersion: string; khronosReportSha256: string; nk1PreflightVersion: string; nk1PreflightStatus: "pass" };
  vrmCalibrationBundleSha256?: string;
  depthRigAssetVersion?: 1;
}
export interface AvatarAssetManifestContext {
  modelFingerprint: string;
  coordinateFrameId: string;
  khronosReportSha256: string;
  nk1PreflightPassed: boolean;
}
export type AvatarAssetManifestResult =
  | { accepted: true; manifest: AvatarAssetManifestV1; releaseEligible: boolean; releaseBlockReason: string | null }
  | { accepted: false; reason: "invalid-manifest" | "model-fingerprint-mismatch" | "coordinate-frame-mismatch" | "validation-evidence-mismatch" };

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const sha256=(value:unknown):value is string=>typeof value==="string"&&/^sha256:[0-9a-f]{64}$/.test(value);
const digest=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{64}$/.test(value);
const nonempty=(value:unknown,max:number):value is string=>typeof value==="string"&&value.trim().length>0&&value.length<=max;
const uriOrNull=(value:unknown):value is string|null=>{
 if(value===null)return true;
 if(typeof value!=="string"||value.length>2048)return false;
 try{const url=new URL(value);return url.protocol==="https:";}
 catch{return false;}
};
const iso=(value:unknown):value is string=>typeof value==="string"&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

/** Validate identity and evidence; redistribution rights are a separate output, never inferred. */
export function validateAvatarAssetManifestV1(raw:unknown,context:AvatarAssetManifestContext):AvatarAssetManifestResult{
  type AvatarAssetManifestRejectReason = "invalid-manifest" | "model-fingerprint-mismatch" | "coordinate-frame-mismatch" | "validation-evidence-mismatch";
const reject=(reason:AvatarAssetManifestRejectReason):AvatarAssetManifestResult=>({accepted:false,reason});
 if(!record(raw)||raw.schemaVersion!==1||!nonempty(raw.assetId,128)||!/^[a-z0-9][a-z0-9._:-]+$/i.test(raw.assetId)
  ||!["vrm","glb2","layered-2.5d-glb2"].includes(String(raw.format))||!sha256(raw.modelFingerprint)
  ||!record(raw.source)||!["original","commissioned","licensed","open-source","user-import"].includes(String(raw.source.kind))
  ||!nonempty(raw.source.name,180)||!nonempty(raw.source.author,180)||!uriOrNull(raw.source.url)
  ||!record(raw.license)||!nonempty(raw.license.spdxId,80)||typeof raw.license.redistributionPermitted!=="boolean"
  ||typeof raw.license.attribution!=="string"||raw.license.attribution.length>2000||!uriOrNull(raw.license.evidenceUrl)
  ||!record(raw.coordinateFrame)||!nonempty(raw.coordinateFrame.id,128)||!/^[a-z0-9][a-z0-9._:-]+$/i.test(raw.coordinateFrame.id)
  ||raw.coordinateFrame.unit!=="meter"||!["right","left"].includes(String(raw.coordinateFrame.handedness))
  ||!["x","y","z"].includes(String(raw.coordinateFrame.upAxis))
  ||!["+x","-x","+y","-y","+z","-z"].includes(String(raw.coordinateFrame.forwardAxis))
  ||raw.coordinateFrame.forwardAxis===("+"+String(raw.coordinateFrame.upAxis))
  ||raw.coordinateFrame.forwardAxis===("-"+String(raw.coordinateFrame.upAxis))
  ||!record(raw.validation)||!iso(raw.validation.createdAt)
  ||!nonempty(raw.validation.khronosValidatorVersion,80)||!digest(raw.validation.khronosReportSha256)
  ||!nonempty(raw.validation.nk1PreflightVersion,80)||raw.validation.nk1PreflightStatus!=="pass"
  ||(raw.vrmCalibrationBundleSha256!==undefined&&!digest(raw.vrmCalibrationBundleSha256))
  ||(raw.depthRigAssetVersion!==undefined&&raw.depthRigAssetVersion!==1)){
  return reject("invalid-manifest");
 }
 if(!context||!sha256(context.modelFingerprint)||!digest(context.khronosReportSha256)||typeof context.nk1PreflightPassed!=="boolean"){
  return reject("invalid-manifest");
 }
 if(raw.modelFingerprint!==context.modelFingerprint)return reject("model-fingerprint-mismatch");
 if(raw.coordinateFrame.id!==context.coordinateFrameId)return reject("coordinate-frame-mismatch");
 if(raw.validation.khronosReportSha256!==context.khronosReportSha256||!context.nk1PreflightPassed){
  return reject("validation-evidence-mismatch");
 }
 const manifest=Object.freeze({
  schemaVersion:1 as const,assetId:raw.assetId as string,format:raw.format as AvatarAssetFormat,
  modelFingerprint:raw.modelFingerprint,source:Object.freeze({...raw.source}) as AvatarAssetManifestV1["source"],
  license:Object.freeze({...raw.license}) as AvatarAssetManifestV1["license"],
  coordinateFrame:Object.freeze({...raw.coordinateFrame}) as AvatarAssetManifestV1["coordinateFrame"],
  validation:Object.freeze({...raw.validation}) as AvatarAssetManifestV1["validation"],
  ...(typeof raw.vrmCalibrationBundleSha256==="string"?{vrmCalibrationBundleSha256:raw.vrmCalibrationBundleSha256}:{}),
  ...(raw.depthRigAssetVersion===1?{depthRigAssetVersion:1 as const}:{})
 });
 const releaseEligible=manifest.license.redistributionPermitted;
 return {accepted:true,manifest,releaseEligible,releaseBlockReason:releaseEligible?null:"license-does-not-permit-redistribution"};
}

export function parseAvatarAssetManifestJson(json:string,context:AvatarAssetManifestContext):AvatarAssetManifestResult{
 if(typeof json!=="string"||json.length<2||json.length>32_768)return {accepted:false,reason:"invalid-manifest"};
 try{return validateAvatarAssetManifestV1(JSON.parse(json) as unknown,context);}catch{return {accepted:false,reason:"invalid-manifest"};}
}
