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

export interface AvatarAssetEvidenceBundleContext {
  modelFingerprint: string;
  coordinateFrameId: string;
  nk1PreflightPassed: boolean;
}
export type AvatarAssetEvidenceBundleResult =
  | { accepted: true; manifest: AvatarAssetManifestV1; releaseEligible: boolean; releaseBlockReason: string | null;
      khronosReport: { validatorVersion: string; validatedAt: string | null; numErrors: 0; numWarnings: number; numInfos: number; numHints: number } }
  | { accepted: false; reason: "invalid-evidence-bundle" | "khronos-report-digest-mismatch" | "khronos-report-invalid" | "khronos-report-has-errors" | "khronos-report-incomplete" | "khronos-validator-version-mismatch" | "external-resource-in-khronos-report" | "manifest-rejected"; manifestReason?: string };

async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") throw new Error("webcrypto-unavailable");
  const digestBuffer = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digestBuffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

/**
 * A local evidence bundle carries the original Khronos JSON as text so its
 * exact bytes can be re-hashed. A digest-only manifest is not enough to earn
 * a Khronos PASS. The model fingerprint and NK1 preflight receipt are checked
 * separately; neither is inferred from the Khronos report.
 */
export async function parseAvatarAssetEvidenceBundleJson(
  json: string,
  context: AvatarAssetEvidenceBundleContext,
): Promise<AvatarAssetEvidenceBundleResult> {
  const reject = (reason: AvatarAssetEvidenceBundleResult extends { accepted: false; reason: infer R } ? R : never): AvatarAssetEvidenceBundleResult =>
    ({ accepted: false, reason });
  if (typeof json !== "string" || json.length < 2 || json.length > 4 * 1024 * 1024) {
    return reject("invalid-evidence-bundle");
  }
  try {
    const raw: unknown = JSON.parse(json);
    if (!record(raw) || raw.schemaVersion !== 1 || !record(raw.manifest)
      || typeof raw.khronosReportJson !== "string" || raw.khronosReportJson.length < 2
      || raw.khronosReportJson.length > 3 * 1024 * 1024) return reject("invalid-evidence-bundle");

    const expectedDigest = raw.manifest.validation && record(raw.manifest.validation)
      ? raw.manifest.validation.khronosReportSha256 : null;
    if (!digest(expectedDigest)) return reject("invalid-evidence-bundle");
    const actualDigest = await sha256Hex(raw.khronosReportJson);
    if (actualDigest !== expectedDigest) return reject("khronos-report-digest-mismatch");

    let report: unknown;
    try { report = JSON.parse(raw.khronosReportJson); } catch { return reject("khronos-report-invalid"); }
    if (!record(report) || !nonempty(report.validatorVersion, 80) || !record(report.issues)
      || !Number.isSafeInteger(report.issues.numErrors) || (report.issues.numErrors as number) < 0
      || !Number.isSafeInteger(report.issues.numWarnings) || (report.issues.numWarnings as number) < 0
      || !Number.isSafeInteger(report.issues.numInfos) || (report.issues.numInfos as number) < 0
      || !Number.isSafeInteger(report.issues.numHints) || (report.issues.numHints as number) < 0
      || !Array.isArray(report.issues.messages) || typeof report.issues.truncated !== "boolean"
      || !record(report.info) || report.info.version !== "2.0") return reject("khronos-report-invalid");
    if (report.issues.truncated !== false) return reject("khronos-report-incomplete");
    if (report.issues.numErrors !== 0 || report.issues.messages.some((message) =>
      record(message) && message.severity === 0)) return reject("khronos-report-has-errors");
    if (report.validatorVersion !== raw.manifest.validation.khronosValidatorVersion) {
      return reject("khronos-validator-version-mismatch");
    }
    if (Array.isArray(report.info.resources) && report.info.resources.some((resource) =>
      record(resource) && resource.storage === "external")) {
      return reject("external-resource-in-khronos-report");
    }
    const manifestResult = validateAvatarAssetManifestV1(raw.manifest, {
      ...context,
      khronosReportSha256: actualDigest,
    });
    if (!manifestResult.accepted) return { accepted: false, reason: "manifest-rejected", manifestReason: manifestResult.reason };
    return {
      accepted: true,
      manifest: manifestResult.manifest,
      releaseEligible: manifestResult.releaseEligible,
      releaseBlockReason: manifestResult.releaseBlockReason,
      khronosReport: {
        validatorVersion: report.validatorVersion,
        validatedAt: typeof report.validatedAt === "string" && iso(report.validatedAt) ? report.validatedAt : null,
        numErrors: 0,
        numWarnings: report.issues.numWarnings as number,
        numInfos: report.issues.numInfos as number,
        numHints: report.issues.numHints as number,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "webcrypto-unavailable") return reject("invalid-evidence-bundle");
    return reject("invalid-evidence-bundle");
  }
}
