import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export interface CameraEvidence {
  version:1;
  at:number;
  cameraId:number;
  path?:string;
  byteLength:number;
  sha256:string;
  width:number|null;
  height:number|null;
  byteEntropy01:number;
  novelty01:number;
  captureQuality01:number;
  semanticVisionAvailable:boolean;
  evidenceKind:'camera-capture';
}

export interface CameraEvidenceState {
  version:1;
  captures:number;
  lastAt:number;
  last:CameraEvidence|null;
  previousHash:string;
  semanticVisionAvailable:boolean;
  semanticFrames:number;
  unresolvedSemanticRequests:number;
  cumulativeNovelty01:number;
}

export const defaultCameraEvidenceState=():CameraEvidenceState=>({
  version:1,captures:0,lastAt:0,last:null,previousHash:'',semanticVisionAvailable:false,semanticFrames:0,unresolvedSemanticRequests:0,cumulativeNovelty01:0,
});

function readU16(buf:Uint8Array, i:number){ return ((buf[i]??0)<<8) | (buf[i+1]??0); }
function jpegDimensions(buf:Uint8Array):{width:number;height:number}|null{
  if(buf.length<4 || buf[0]!==0xff || buf[1]!==0xd8) return null;
  let i=2;
  while(i+9<buf.length){
    if(buf[i]!==0xff){i++;continue;}
    const marker=buf[i+1]; i+=2;
    if(marker===0xd8 || marker===0xd9 || (marker>=0xd0&&marker<=0xd7)) continue;
    if(i+2>buf.length) break;
    const len=readU16(buf,i);
    if(len<2 || i+len>buf.length) break;
    const isSof=(marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf);
    if(isSof && len>=7){
      const height=readU16(buf,i+3); const width=readU16(buf,i+5);
      return {width,height};
    }
    i+=len;
  }
  return null;
}

function entropy01(buf:Uint8Array):number{
  if(!buf.length) return 0;
  const hist=new Uint32Array(256); const stride=Math.max(1,Math.ceil(buf.length/65536)); let samples=0;
  for(let i=0;i<buf.length;i+=stride){hist[buf[i]]++;samples++;}
  let h=0;
  for(const count of hist){if(!count)continue;const p=count/samples;h-=p*Math.log2(p);}
  return clamp(h/8);
}

function quality(dim:{width:number;height:number}|null,bytes:number,entropy:number):number{
  const resolution=dim?clamp(Math.sqrt(dim.width*dim.height)/900):0.35;
  const size=clamp(Math.log10(Math.max(1,bytes))/7);
  return clamp(resolution*.5+entropy*.25+size*.25);
}

export function inspectCameraBytes(input:{bytes:Uint8Array;cameraId?:number;at?:number;previousHash?:string;path?:string}):CameraEvidence{
  const at=input.at??Date.now(); const buf=input.bytes;
  const hash=createHash('sha256').update(buf).digest('hex');
  const dims=jpegDimensions(buf); const entropy=entropy01(buf);
  const novelty=input.previousHash&&input.previousHash===hash?0:1;
  const q=quality(dims,buf.length,entropy);
  return {version:1,at,cameraId:Math.max(0,Math.floor(input.cameraId??0)),path:input.path,byteLength:buf.length,sha256:hash,width:dims?.width??null,height:dims?.height??null,byteEntropy01:entropy,novelty01:novelty,captureQuality01:q,semanticVisionAvailable:false,evidenceKind:'camera-capture'};
}

export async function inspectCameraFile(input:{path:string;cameraId?:number;at?:number;previousHash?:string}):Promise<CameraEvidence>{
  const bytes=await readFile(input.path);
  return inspectCameraBytes({...input,bytes});
}

export function cameraEvidenceFromResult(result:{path?:string;size?:number;hash?:string}, cameraId=0, previousHash='', at=Date.now()):CameraEvidence{
  const byteLength=Math.max(0,Number(result.size??0));
  const sha256=String(result.hash??'');
  const novelty01=sha256&&sha256===previousHash?0:1;
  const entropy01=clamp(Math.log2(Math.max(1,byteLength))/24);
  const captureQuality01=clamp(entropy01*.35+clamp(Math.log10(Math.max(1,byteLength))/7)*.65);
  return {version:1,at,cameraId:Math.max(0,Math.floor(cameraId)),path:result.path,byteLength,sha256,width:null,height:null,byteEntropy01:entropy01,novelty01,captureQuality01,semanticVisionAvailable:false,evidenceKind:'camera-capture'};
}

export interface CameraCaptureObservationInput {
  id: string;
  sourceId: string;
  sourceKind: string;
  modality: 'vision';
  capturedAt: number;
  confidence01: number;
  reliability01: number;
  sessionId: string;
  provenance: 'device-capture';
  evidenceRefs: string[];
  payload: Record<string, unknown>;
}

/**
 * Bind camera-frame metadata to a verified ActionGateway receipt. It deliberately
 * excludes image bytes and filesystem paths; semantic detections stay a separate
 * model-output stream in P41.
 */
export function buildCameraCaptureObservation(input: {
  evidence: CameraEvidence;
  executionId: string;
  providerReceiptId?: string;
  sessionId: string;
  receiptVerified: boolean;
  consentGranted: boolean;
}): CameraCaptureObservationInput | null {
  const evidence = input?.evidence;
  const executionId = input?.executionId;
  const providerReceiptId = input?.providerReceiptId;
  const sessionId = input?.sessionId;
  if (!input || input.receiptVerified !== true || input.consentGranted !== true ||
      !evidence || evidence.evidenceKind !== 'camera-capture' ||
      !Number.isFinite(evidence.at) || evidence.at < 0 ||
      !Number.isSafeInteger(evidence.cameraId) || evidence.cameraId < 0 ||
      !Number.isSafeInteger(evidence.byteLength) || evidence.byteLength <= 0 ||
      typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(evidence.sha256) ||
      !Number.isFinite(evidence.captureQuality01) || evidence.captureQuality01 < 0 || evidence.captureQuality01 > 1 ||
      typeof executionId !== 'string' || !executionId.trim() || executionId.length > 128 ||
      typeof providerReceiptId !== 'string' || !providerReceiptId.trim() || providerReceiptId.length > 256 ||
      typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 128) return null;

  const cameraId = Math.floor(evidence.cameraId);
  const digest = evidence.sha256.toLowerCase();
  const capturedAt = Math.floor(evidence.at);
  const payload: Record<string, unknown> = {
    subject: 'camera-' + cameraId,
    kind: 'sensor',
    claim: 'frame:' + digest + ':' + capturedAt,
    cameraId,
    byteLength: evidence.byteLength,
    sha256: digest,
    captureQuality01: Math.max(0, Math.min(1, evidence.captureQuality01)),
    novelty01: Math.max(0, Math.min(1, evidence.novelty01)),
  };
  if (Number.isSafeInteger(evidence.width) && Number(evidence.width) > 0) payload.width = evidence.width;
  if (Number.isSafeInteger(evidence.height) && Number(evidence.height) > 0) payload.height = evidence.height;

  return {
    id: 'camera-capture:' + executionId,
    sourceId: 'android-camera-' + cameraId,
    sourceKind: 'camera-device-capture',
    modality: 'vision',
    capturedAt: evidence.at,
    confidence01: Math.max(0, Math.min(1, evidence.captureQuality01)),
    reliability01: 0.72,
    sessionId,
    provenance: 'device-capture',
    evidenceRefs: [executionId, providerReceiptId],
    payload,
  };
}
