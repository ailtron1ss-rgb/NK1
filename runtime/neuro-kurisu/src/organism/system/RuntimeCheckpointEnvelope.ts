import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { OpenLoopRadarState } from '../cognition/evolution/OpenLoopRadar.ts';
import type { CognitiveSpineScheduleState } from './CognitiveSpineScheduler.ts';
import type { RiskAwareRecoveryControllerState } from '../cognition/RiskAwareRecoveryController.ts';
import type { PersistedWorld } from '../world/WorldEnvironment.ts';

export const RUNTIME_CHECKPOINT_OWNERS = ['world','openLoop','cognitiveSpine','riskAwareRecovery','cognitiveHealth'] as const;
export type RuntimeCheckpointOwnerName = typeof RUNTIME_CHECKPOINT_OWNERS[number];

export interface RuntimeCheckpointOwnerSnapshots {
  world: PersistedWorld;
  openLoop: OpenLoopRadarState;
  cognitiveSpine: CognitiveSpineScheduleState;
  riskAwareRecovery: RiskAwareRecoveryControllerState;
  cognitiveHealth: unknown | null;
}
export interface EncodedRuntimeCheckpointOwner {
  encoding:'deflate-raw+base64'; rawBytes:number; compressedBytes:number; payloadBase64:string;
}
export interface RuntimeCheckpointEnvelope {
  version:1; generation:number; checkpointId:string; coreTick:number; worldTick:number; createdAt:number;
  owners:Record<RuntimeCheckpointOwnerName,EncodedRuntimeCheckpointOwner>;
  ownerHashes:Record<RuntimeCheckpointOwnerName,string>; payloadBytes:number; compressedBytes:number;
}
export interface RuntimeCheckpointEnvelopeInput {
  generation:number; checkpointId:string; coreTick:number; createdAt:number; snapshots:RuntimeCheckpointOwnerSnapshots;
}
export type RuntimeCheckpointEnvelopeValidation =
  | {ok:true;envelope:RuntimeCheckpointEnvelope;snapshots:RuntimeCheckpointOwnerSnapshots}
  | {ok:false;reason:string};

const MAX_OWNER_RAW_BYTES=16*1024*1024;
const MAX_TOTAL_RAW_BYTES=24*1024*1024;
const MAX_TOTAL_COMPRESSED_BYTES=8*1024*1024;
const MAX_BASE64_LENGTH=Math.ceil(MAX_TOTAL_COMPRESSED_BYTES*4/3)+8;
type PlainRecord=Record<string,unknown>;

function isPlainRecord(value:unknown):value is PlainRecord {
  try { if(value===null||typeof value!=='object'||Array.isArray(value))return false;const p=Object.getPrototypeOf(value);return p===Object.prototype||p===null; }
  catch{return false;}
}
function ownData(record:PlainRecord,key:string):unknown {
  try { const d=Object.getOwnPropertyDescriptor(record,key);return d&&Object.prototype.hasOwnProperty.call(d,'value')?d.value:undefined; }
  catch{return undefined;}
}
function safeCounter(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function hasExactKeys(value:PlainRecord, expected:readonly string[]):boolean {
  const actual=Object.keys(value).sort();
  const wanted=[...expected].sort();
  return actual.length===wanted.length&&actual.every((key,index)=>key===wanted[index]);
}
function sha256(value:Buffer):string{return createHash('sha256').update(value).digest('hex');}
export function runtimeCheckpointOwnerHash(value:unknown):string {
  const json=JSON.stringify(value);
  if(typeof json!=='string')throw new Error('runtime-checkpoint-owner-not-json-serializable');
  return sha256(Buffer.from(json,'utf8'));
}
function encodeOwner(value:unknown):{encoded:EncodedRuntimeCheckpointOwner;hash:string;rawBytes:number}{
  const json=JSON.stringify(value);if(typeof json!=='string')throw new Error('runtime-checkpoint-owner-not-json-serializable');
  const raw=Buffer.from(json,'utf8');if(raw.byteLength>MAX_OWNER_RAW_BYTES)throw new Error('runtime-checkpoint-owner-size-limit-exceeded');
  const compressed=Buffer.from(deflateRawSync(raw));
  return {encoded:{encoding:'deflate-raw+base64',rawBytes:raw.byteLength,compressedBytes:compressed.byteLength,payloadBase64:compressed.toString('base64')},hash:sha256(raw),rawBytes:raw.byteLength};
}
function decodeOwner(value:unknown,expectedHash:unknown):
  {ok:true;snapshot:unknown;rawBytes:number;compressedBytes:number}|{ok:false;reason:string}{
  if(!isPlainRecord(value))return {ok:false,reason:'owner-payload-shape-invalid'};
  if(!hasExactKeys(value,['encoding','rawBytes','compressedBytes','payloadBase64']))return {ok:false,reason:'owner-payload-keys-invalid'};
  const encoding=ownData(value,'encoding'),rawBytes=ownData(value,'rawBytes'),compressedBytes=ownData(value,'compressedBytes'),payloadBase64=ownData(value,'payloadBase64');
  if(encoding!=='deflate-raw+base64'||!safeCounter(rawBytes)||rawBytes>MAX_OWNER_RAW_BYTES||!safeCounter(compressedBytes)||compressedBytes===0||
     typeof payloadBase64!=='string'||payloadBase64.length===0||payloadBase64.length>MAX_BASE64_LENGTH||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payloadBase64)||
     typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash))return {ok:false,reason:'owner-payload-metadata-invalid'};
  try {
    const compressed=Buffer.from(payloadBase64,'base64');
    if(compressed.byteLength!==compressedBytes||compressed.toString('base64')!==payloadBase64||compressed.byteLength>MAX_TOTAL_COMPRESSED_BYTES)return {ok:false,reason:'owner-payload-base64-invalid'};
    const raw=Buffer.from(inflateRawSync(compressed,{maxOutputLength:MAX_OWNER_RAW_BYTES}));
    if(raw.byteLength!==rawBytes)return {ok:false,reason:'owner-payload-size-mismatch'};
    if(sha256(raw)!==expectedHash)return {ok:false,reason:'owner-payload-hash-mismatch'};
    return {ok:true,snapshot:JSON.parse(raw.toString('utf8')),rawBytes:raw.byteLength,compressedBytes:compressed.byteLength};
  }catch{return {ok:false,reason:'owner-payload-decode-failed'};}
}
function validOwnerSnapshot(name:RuntimeCheckpointOwnerName,value:unknown,worldTick:number):boolean {
  if(name==='cognitiveHealth')return value===null||isPlainRecord(value);
  if(!isPlainRecord(value))return false;
  if(name==='world'){
    const snapshot=ownData(value,'snapshot'),transitions=ownData(value,'transitions');
    return ownData(value,'schemaVersion')===1&&isPlainRecord(snapshot)&&safeCounter(ownData(snapshot,'tick'))&&ownData(snapshot,'tick')===worldTick&&Array.isArray(transitions)&&transitions.length<=500;
  }
  if(name==='openLoop'){
    const records=ownData(value,'records');
    return ownData(value,'version')===1&&Array.isArray(records)&&records.length<=512&&safeCounter(ownData(value,'sequence'));
  }
  if(name==='cognitiveSpine'){
    const mode=ownData(value,'mode');
    return ownData(value,'version')===1&&(mode==='reflex'||mode==='balanced'||mode==='deep'||mode==='protect');
  }
  if(name==='riskAwareRecovery')return ownData(value,'version')===1&&safeCounter(ownData(value,'tick'))&&safeCounter(ownData(value,'decisions'));
  return false;
}
export function createRuntimeCheckpointEnvelope(input:RuntimeCheckpointEnvelopeInput):RuntimeCheckpointEnvelope {
  if(!safeCounter(input.generation)||input.generation<1||typeof input.checkpointId!=='string'||input.checkpointId.trim().length<16||
     !safeCounter(input.coreTick)||!safeCounter(input.createdAt))throw new Error('runtime-checkpoint-envelope-input-invalid');
  const worldTick=input.snapshots?.world?.snapshot?.tick;
  if(!safeCounter(worldTick))throw new Error('runtime-checkpoint-world-tick-invalid');
  const owners={} as Record<RuntimeCheckpointOwnerName,EncodedRuntimeCheckpointOwner>;
  const ownerHashes={} as Record<RuntimeCheckpointOwnerName,string>;
  let payloadBytes=0,compressedBytes=0;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){const result=encodeOwner(input.snapshots[name]);owners[name]=result.encoded;ownerHashes[name]=result.hash;payloadBytes+=result.rawBytes;compressedBytes+=result.encoded.compressedBytes;}
  if(payloadBytes>MAX_TOTAL_RAW_BYTES||compressedBytes>MAX_TOTAL_COMPRESSED_BYTES)throw new Error('runtime-checkpoint-envelope-size-limit-exceeded');
  const envelope:RuntimeCheckpointEnvelope={version:1,generation:input.generation,checkpointId:input.checkpointId,coreTick:input.coreTick,worldTick,createdAt:input.createdAt,owners,ownerHashes,payloadBytes,compressedBytes};
  const verified=validateRuntimeCheckpointEnvelope(envelope);if(!verified.ok)throw new Error('runtime-checkpoint-envelope-build-invalid:'+verified.reason);
  return envelope;
}
export function validateRuntimeCheckpointEnvelope(value:unknown):RuntimeCheckpointEnvelopeValidation {
  if(!isPlainRecord(value))return {ok:false,reason:'envelope-shape-invalid'};
  if(!hasExactKeys(value,['version','generation','checkpointId','coreTick','worldTick','createdAt','owners','ownerHashes','payloadBytes','compressedBytes']))
    return {ok:false,reason:'envelope-keys-invalid'};
  const version=ownData(value,'version'),generation=ownData(value,'generation'),checkpointId=ownData(value,'checkpointId'),coreTick=ownData(value,'coreTick'),
    worldTick=ownData(value,'worldTick'),createdAt=ownData(value,'createdAt'),ownerValues=ownData(value,'owners'),ownerHashValues=ownData(value,'ownerHashes'),
    declaredPayloadBytes=ownData(value,'payloadBytes'),declaredCompressedBytes=ownData(value,'compressedBytes');
  if(version!==1||!safeCounter(generation)||generation<1||typeof checkpointId!=='string'||checkpointId.trim().length<16||checkpointId.length>180||
     !safeCounter(coreTick)||!safeCounter(worldTick)||!safeCounter(createdAt)||!safeCounter(declaredPayloadBytes)||!safeCounter(declaredCompressedBytes)||
     !isPlainRecord(ownerValues)||!isPlainRecord(ownerHashValues)||
     !hasExactKeys(ownerValues,RUNTIME_CHECKPOINT_OWNERS)||!hasExactKeys(ownerHashValues,RUNTIME_CHECKPOINT_OWNERS))
    return {ok:false,reason:'envelope-metadata-invalid'};

  // Preflight all declared owner sizes before any base64 allocation or decompression.
  // This makes the aggregate 24 MiB raw / 8 MiB compressed budget a real memory guard.
  if(declaredPayloadBytes>MAX_TOTAL_RAW_BYTES||declaredCompressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
    return {ok:false,reason:'envelope-size-limit-exceeded'};
  let preflightRawBytes=0,preflightCompressedBytes=0;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){
    const owner=ownData(ownerValues,name);
    if(!isPlainRecord(owner)||!hasExactKeys(owner,['encoding','rawBytes','compressedBytes','payloadBase64']))
      return {ok:false,reason:name+':owner-payload-shape-invalid'};
    const rawBytes=ownData(owner,'rawBytes'),compressedBytes=ownData(owner,'compressedBytes');
    if(ownData(owner,'encoding')!=='deflate-raw+base64'||!safeCounter(rawBytes)||rawBytes>MAX_OWNER_RAW_BYTES||
       !safeCounter(compressedBytes)||compressedBytes===0||compressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
      return {ok:false,reason:name+':owner-payload-metadata-invalid'};
    preflightRawBytes+=rawBytes;
    preflightCompressedBytes+=compressedBytes;
    if(preflightRawBytes>MAX_TOTAL_RAW_BYTES||preflightCompressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
      return {ok:false,reason:'envelope-size-limit-exceeded'};
  }
  if(preflightRawBytes!==declaredPayloadBytes||preflightCompressedBytes!==declaredCompressedBytes)
    return {ok:false,reason:'envelope-size-accounting-invalid'};

  const snapshots={} as RuntimeCheckpointOwnerSnapshots;let payloadBytes=0,compressedBytes=0;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){
    const decoded=decodeOwner(ownData(ownerValues,name),ownData(ownerHashValues,name));
    if(!decoded.ok)return {ok:false,reason:name+':'+decoded.reason};
    if(!validOwnerSnapshot(name,decoded.snapshot,worldTick))return {ok:false,reason:name+':owner-snapshot-invalid'};
    (snapshots as any)[name]=decoded.snapshot;payloadBytes+=decoded.rawBytes;compressedBytes+=decoded.compressedBytes;
  }
  if(payloadBytes!==declaredPayloadBytes||compressedBytes!==declaredCompressedBytes)
    return {ok:false,reason:'envelope-size-accounting-invalid'};
  return {ok:true,envelope:structuredClone(value) as unknown as RuntimeCheckpointEnvelope,snapshots};
}
