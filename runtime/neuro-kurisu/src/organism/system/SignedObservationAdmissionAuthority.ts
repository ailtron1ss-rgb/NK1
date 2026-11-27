import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { isPlainDataRecord, ownDataValue } from '../body/RestoreSanitizers.ts';
import { sha256Stable, stableJson } from '../core/StableSerialization.ts';

export type HostObservationModality = 'text'|'vision'|'audio'|'sensor'|'world'|'fusion';
export type HostObservationSignatureAlgorithm = 'ed25519'|'rsa-sha256'|'ecdsa-sha256';

export interface SignedHostObservationReceiptPayload {
  version:1;
  issuerId:string;
  keyId:string;
  deviceId:string;
  sessionId:string;
  nonce:string;
  observationId:string;
  modality:HostObservationModality;
  claim:string;
  confidence01:number;
  capturedAt:number;
  issuedAt:number;
  expiresAt:number;
  consentTicketId:string;
  consentRevision:number;
  captureDigest:string;
}
export interface SignedHostObservationReceipt extends SignedHostObservationReceiptPayload {
  signatureAlgorithm:HostObservationSignatureAlgorithm;
  signature:string;
}
export type HostObservationPublicKey=string|Buffer|ReturnType<typeof createPublicKey>;

export interface HostObservationConsentBinding {
  ticketId:string;
  consentRevision:number;
  deviceId:string;
  modality:HostObservationModality;
  capturedAt:number;
}
export interface HostObservationConsentAuthority {
  /** Must consult the canonical consent authority; no caller-provided boolean is accepted. */
  isActive(binding:HostObservationConsentBinding):boolean|Promise<boolean>;
}
export interface HostObservationNonceKey {
  issuerId:string;
  deviceId:string;
  sessionId:string;
  nonce:string;
  retainUntil:number;
}
export interface HostObservationNonceStore {
  /**
   * Atomically inserts the unique issuer/device/session/nonce tuple and retains it
   * durably until retainUntil. Returns false for an existing tuple. A process-local
   * Set or best-effort cache is NOT a conforming production implementation.
   */
  consume(key:HostObservationNonceKey):boolean|Promise<boolean>;
}
export interface SignedObservationAdmissionConfig {
  /** Trusted device identity provisioned by the host, never copied from the receipt. */
  expectedDeviceId:string;
  resolvePublicKey(issuerId:string,keyId:string):HostObservationPublicKey|null|undefined|Promise<HostObservationPublicKey|null|undefined>;
  consentAuthority:HostObservationConsentAuthority;
  nonceStore:HostObservationNonceStore;
  now?:()=>number;
  maxCaptureAgeMs?:number;
  maxFutureSkewMs?:number;
  maxReceiptLifetimeMs?:number;
}

export interface TrustedObservationAdmission {
  observationId:string;
  at:number;
  expiresAt:number;
  modality:HostObservationModality;
  claim:string;
  confidence01:number;
  deviceId:string;
  sessionId:string;
  consentTicketId:string;
  consentRevision:number;
  captureDigest:string;
  receiptDigest:string;
  issuerId:string;
}
export type ObservationAdmissionRejectReason =
  |'invalid-receipt'
  |'receipt-time-invalid'
  |'device-mismatch'
  |'signing-key-unavailable'
  |'signature-invalid'
  |'consent-authority-unavailable'
  |'consent-not-active'
  |'nonce-store-unavailable'
  |'nonce-replayed';
export type ObservationAdmissionResult =
  |{accepted:true;reason:'accepted';admission:TrustedObservationAdmission}
  |{accepted:false;reason:ObservationAdmissionRejectReason};

const trustedAdmissions=new WeakSet<object>();
const MODALITIES:ReadonlySet<string>=new Set(['text','vision','audio','sensor','world','fusion']);
const ALGORITHMS:ReadonlySet<string>=new Set(['ed25519','rsa-sha256','ecdsa-sha256']);
const IDENTIFIER=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/;
const NONCE=/^[A-Za-z0-9_-]{16,128}$/;
const CONTROL=/[\u0000-\u001f\u007f-\u009f]/;
const PAYLOAD_KEYS:ReadonlySet<string>=new Set([
  'version','issuerId','keyId','deviceId','sessionId','nonce','observationId','modality','claim',
  'confidence01','capturedAt','issuedAt','expiresAt','consentTicketId','consentRevision','captureDigest',
]);
const RECEIPT_KEYS:ReadonlySet<string>=new Set([...PAYLOAD_KEYS,'signatureAlgorithm','signature']);

const reject=(reason:ObservationAdmissionRejectReason):ObservationAdmissionResult=>({accepted:false,reason});
const exactText=(value:unknown,max:number,pattern?:RegExp):value is string=>
  typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!CONTROL.test(value)&&(!pattern||pattern.test(value));
const safeTime=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const strictUnit=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

function readPayload(record:Record<string,unknown>):SignedHostObservationReceiptPayload|null {
  const version=ownDataValue(record,'version');
  const issuerId=ownDataValue(record,'issuerId');
  const keyId=ownDataValue(record,'keyId');
  const deviceId=ownDataValue(record,'deviceId');
  const sessionId=ownDataValue(record,'sessionId');
  const nonce=ownDataValue(record,'nonce');
  const observationId=ownDataValue(record,'observationId');
  const modality=ownDataValue(record,'modality');
  const claim=ownDataValue(record,'claim');
  const confidence01=ownDataValue(record,'confidence01');
  const capturedAt=ownDataValue(record,'capturedAt');
  const issuedAt=ownDataValue(record,'issuedAt');
  const expiresAt=ownDataValue(record,'expiresAt');
  const consentTicketId=ownDataValue(record,'consentTicketId');
  const consentRevision=ownDataValue(record,'consentRevision');
  const captureDigest=ownDataValue(record,'captureDigest');

  if(version!==1||
    !exactText(issuerId,160,IDENTIFIER)||!exactText(keyId,160,IDENTIFIER)||
    !exactText(deviceId,180,IDENTIFIER)||!exactText(sessionId,128,IDENTIFIER)||
    !exactText(nonce,128,NONCE)||!exactText(observationId,180,IDENTIFIER)||
    typeof modality!=='string'||!MODALITIES.has(modality)||
    !exactText(claim,240)||!strictUnit(confidence01)||
    !safeTime(capturedAt)||!safeTime(issuedAt)||!safeTime(expiresAt)||
    !exactText(consentTicketId,180,IDENTIFIER)||
    typeof consentRevision!=='number'||!Number.isSafeInteger(consentRevision)||consentRevision<1||
    !exactText(captureDigest,64,/^[a-f0-9]{64}$/i))return null;

  return {version:1,issuerId,keyId,deviceId,sessionId,nonce,observationId,
    modality:modality as HostObservationModality,claim,confidence01,capturedAt,issuedAt,expiresAt,
    consentTicketId,consentRevision,captureDigest:captureDigest.toLowerCase()};
}

function verifyReceiptSignature(
  payload:SignedHostObservationReceiptPayload,
  algorithm:HostObservationSignatureAlgorithm,
  encodedSignature:string,
  material:HostObservationPublicKey,
):boolean {
  try {
    if(!exactText(encodedSignature,4096))return false;
    const signature=Buffer.from(encodedSignature,'base64');
    if(signature.length===0||signature.toString('base64')!==encodedSignature)return false;
    if(algorithm==='ed25519'&&signature.length!==64)return false;
    // createPublicKey() rejects an already-public KeyObject in Node. Reuse it
    // directly; parse PEM/DER material only when the host resolver returns bytes/text.
    const isPublicKeyObject=typeof material==='object'&&material!==null&&
      'type' in material&&(material as {type?:unknown}).type==='public'&&
      'asymmetricKeyType' in material;
    const key=isPublicKeyObject
      ?material as ReturnType<typeof createPublicKey>
      :createPublicKey(material as string|Buffer);
    if(key.type!=='public')return false;
    const keyType=key.asymmetricKeyType;
    if(algorithm==='ed25519'&&keyType!=='ed25519')return false;
    if(algorithm==='rsa-sha256'&&keyType!=='rsa')return false;
    if(algorithm==='ecdsa-sha256'&&keyType!=='ec')return false;
    const digestAlgorithm=algorithm==='ed25519'?null:'sha256';
    return verifySignature(digestAlgorithm,Buffer.from(stableJson(payload),'utf8'),key,signature);
  } catch { return false; }
}

/** True only for the exact, frozen token minted after every host check completed. */
export function isTrustedObservationAdmission(value:unknown):value is TrustedObservationAdmission {
  return Boolean(value&&typeof value==='object'&&trustedAdmissions.has(value as object));
}

/**
 * Host-owned G3 gate. Missing keys, consent authority or a durable atomic nonce
 * store result in rejection; no local fallback can silently grant observed status.
 */
export class SignedObservationAdmissionAuthority {
  private readonly expectedDeviceId:string;
  private readonly resolvePublicKey:SignedObservationAdmissionConfig['resolvePublicKey'];
  private readonly consentAuthority:HostObservationConsentAuthority;
  private readonly nonceStore:HostObservationNonceStore;
  private readonly clock:()=>number;
  private readonly maxCaptureAgeMs:number;
  private readonly maxFutureSkewMs:number;
  private readonly maxReceiptLifetimeMs:number;

  constructor(config:SignedObservationAdmissionConfig) {
    if(!config||!exactText(config.expectedDeviceId,180,IDENTIFIER))throw new Error('host-observation-expected-device-id-invalid');
    if(typeof config.resolvePublicKey!=='function'||!config.consentAuthority||
      typeof config.consentAuthority.isActive!=='function'||!config.nonceStore||
      typeof config.nonceStore.consume!=='function')throw new Error('host-observation-authority-dependencies-required');
    const maxCaptureAgeMs=config.maxCaptureAgeMs??120_000;
    const maxFutureSkewMs=config.maxFutureSkewMs??3_000;
    const maxReceiptLifetimeMs=config.maxReceiptLifetimeMs??300_000;
    if(!Number.isSafeInteger(maxCaptureAgeMs)||maxCaptureAgeMs<1_000||maxCaptureAgeMs>86_400_000||
      !Number.isSafeInteger(maxFutureSkewMs)||maxFutureSkewMs<0||maxFutureSkewMs>60_000||
      !Number.isSafeInteger(maxReceiptLifetimeMs)||maxReceiptLifetimeMs<1_000||maxReceiptLifetimeMs>86_400_000) {
      throw new Error('host-observation-time-policy-invalid');
    }
    this.expectedDeviceId=config.expectedDeviceId;
    this.resolvePublicKey=config.resolvePublicKey;
    this.consentAuthority=config.consentAuthority;
    this.nonceStore=config.nonceStore;
    this.clock=config.now??Date.now;
    this.maxCaptureAgeMs=maxCaptureAgeMs;
    this.maxFutureSkewMs=maxFutureSkewMs;
    this.maxReceiptLifetimeMs=maxReceiptLifetimeMs;
  }

  async admit(receipt:unknown):Promise<ObservationAdmissionResult> {
    if(!isPlainDataRecord(receipt))return reject('invalid-receipt');
    // Reject unknown fields so an unsigned extension cannot be mistaken for
    // authenticated data by a downstream adapter.
    for(const key of Object.keys(receipt))if(!RECEIPT_KEYS.has(key))return reject('invalid-receipt');
    const payload=readPayload(receipt);
    const algorithm=ownDataValue(receipt,'signatureAlgorithm');
    const signature=ownDataValue(receipt,'signature');
    if(!payload||typeof algorithm!=='string'||!ALGORITHMS.has(algorithm)||
      !exactText(signature,4096))return reject('invalid-receipt');
    if(payload.deviceId!==this.expectedDeviceId)return reject('device-mismatch');

    let now:number;
    try { now=this.clock(); } catch { return reject('receipt-time-invalid'); }
    if(!Number.isSafeInteger(now)||now<0||
      payload.issuedAt>now+this.maxFutureSkewMs||
      payload.issuedAt<now-this.maxCaptureAgeMs||
      payload.capturedAt>now+this.maxFutureSkewMs||
      payload.capturedAt<now-this.maxCaptureAgeMs||
      payload.capturedAt>payload.issuedAt+this.maxFutureSkewMs||
      payload.expiresAt<=now||payload.expiresAt<payload.issuedAt||
      payload.expiresAt-payload.issuedAt>this.maxReceiptLifetimeMs) {
      return reject('receipt-time-invalid');
    }

    let material:HostObservationPublicKey|null|undefined;
    try { material=await this.resolvePublicKey(payload.issuerId,payload.keyId); }
    catch { return reject('signing-key-unavailable'); }
    if(!material)return reject('signing-key-unavailable');
    if(!verifyReceiptSignature(payload,algorithm as HostObservationSignatureAlgorithm,signature,material)) {
      return reject('signature-invalid');
    }

    let consentActive:boolean;
    try {
      consentActive=await this.consentAuthority.isActive({
        ticketId:payload.consentTicketId,consentRevision:payload.consentRevision,
        deviceId:payload.deviceId,modality:payload.modality,capturedAt:payload.capturedAt,
      });
    } catch { return reject('consent-authority-unavailable'); }
    if(consentActive!==true)return reject('consent-not-active');

    let consumed:boolean;
    try {
      consumed=await this.nonceStore.consume({
        issuerId:payload.issuerId,deviceId:payload.deviceId,sessionId:payload.sessionId,
        nonce:payload.nonce,retainUntil:payload.expiresAt,
      });
    } catch { return reject('nonce-store-unavailable'); }
    if(consumed!==true)return reject('nonce-replayed');

    const admission:TrustedObservationAdmission=Object.freeze({
      observationId:payload.observationId,at:payload.capturedAt,expiresAt:payload.expiresAt,modality:payload.modality,
      claim:payload.claim,confidence01:payload.confidence01,deviceId:payload.deviceId,
      sessionId:payload.sessionId,consentTicketId:payload.consentTicketId,
      consentRevision:payload.consentRevision,captureDigest:payload.captureDigest,
      receiptDigest:sha256Stable(payload),issuerId:payload.issuerId,
    });
    trustedAdmissions.add(admission);
    return {accepted:true,reason:'accepted',admission};
  }
}
