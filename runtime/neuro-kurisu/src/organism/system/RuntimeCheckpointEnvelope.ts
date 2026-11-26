import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { OperationalJournalCursor } from '../persistence/OperationalJournal.ts';
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
  journalOffset: OperationalJournalCursor;
}
export interface EncodedRuntimeCheckpointOwner {
  encoding:'deflate-raw+base64'; rawBytes:number; compressedBytes:number; payloadBase64:string;
}
interface RuntimeCheckpointEnvelopeBase {
  generation:number; checkpointId:string; coreTick:number; worldTick:number; createdAt:number;
  owners:Record<RuntimeCheckpointOwnerName,EncodedRuntimeCheckpointOwner>;
  ownerHashes:Record<RuntimeCheckpointOwnerName,string>; payloadBytes:number; compressedBytes:number;
}
export interface LegacyRuntimeCheckpointEnvelope extends RuntimeCheckpointEnvelopeBase { version:1; }
export interface RuntimeCheckpointEnvelope extends RuntimeCheckpointEnvelopeBase {
  version:2; journalOffset:OperationalJournalCursor; manifestHash:string;
}
export type AnyRuntimeCheckpointEnvelope = LegacyRuntimeCheckpointEnvelope | RuntimeCheckpointEnvelope;
export interface RuntimeCheckpointEnvelopeInput {
  generation:number; checkpointId:string; coreTick:number; createdAt:number;
  snapshots:RuntimeCheckpointOwnerSnapshots;
}
export type RuntimeCheckpointEnvelopeValidation =
  | {ok:true;envelope:AnyRuntimeCheckpointEnvelope;snapshots:RuntimeCheckpointOwnerSnapshots}
  | {ok:false;reason:string};

const MAX_OWNER_RAW_BYTES=16*1024*1024;
const MAX_TOTAL_RAW_BYTES=24*1024*1024;
const MAX_TOTAL_COMPRESSED_BYTES=8*1024*1024;
const MAX_BASE64_LENGTH=Math.ceil(MAX_TOTAL_COMPRESSED_BYTES*4/3)+8;
const LEGACY_EMPTY_JOURNAL_OFFSET:OperationalJournalCursor={
  version:1,retainedSegments:0,retainedBytes:0,activeSegmentId:null,activeSegmentBytes:0,
  activeSegmentRecords:0,activeSegmentTailSha256:null,fileSynced:true,directorySynced:false,
};
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
  try {
    const actual=Object.keys(value).sort();
    const wanted=[...expected].sort();
    return actual.length===wanted.length&&actual.every((key,index)=>key===wanted[index]);
  } catch {
    // A Proxy can pass the prototype check and still throw during own-key
    // enumeration. Treat hostile/exotic input as invalid checkpoint data.
    return false;
  }
}
function sha256(value:Buffer):string{return createHash('sha256').update(value).digest('hex');}
export function runtimeCheckpointOwnerHash(value:unknown):string {
  const json=JSON.stringify(value);
  if(typeof json!=='string')throw new Error('runtime-checkpoint-owner-not-json-serializable');
  return sha256(Buffer.from(json,'utf8'));
}
function validJournalOffset(value:unknown):value is OperationalJournalCursor {
  if(!isPlainRecord(value)||!hasExactKeys(value,[
    'version','retainedSegments','retainedBytes','activeSegmentId','activeSegmentBytes',
    'activeSegmentRecords','activeSegmentTailSha256','fileSynced','directorySynced',
  ]))return false;
  const version=ownData(value,'version'),retainedSegments=ownData(value,'retainedSegments'),
    retainedBytes=ownData(value,'retainedBytes'),activeSegmentBytes=ownData(value,'activeSegmentBytes'),
    activeSegmentRecords=ownData(value,'activeSegmentRecords'),activeSegmentId=ownData(value,'activeSegmentId'),
    activeSegmentTailSha256=ownData(value,'activeSegmentTailSha256'),fileSynced=ownData(value,'fileSynced'),
    directorySynced=ownData(value,'directorySynced');
  const explicitNonDurableStub=fileSynced===false&&directorySynced===false&&retainedSegments===0&&
    retainedBytes===0&&activeSegmentBytes===0&&activeSegmentRecords===0&&activeSegmentId===null&&activeSegmentTailSha256===null;
  if(version!==1||!safeCounter(retainedSegments)||retainedSegments>6||!safeCounter(retainedBytes)||retainedBytes>600*1024*1024||
     !safeCounter(activeSegmentBytes)||activeSegmentBytes>100*1024*1024||!safeCounter(activeSegmentRecords)||
     (fileSynced!==true&&!explicitNonDurableStub)||typeof directorySynced!=='boolean'||retainedBytes<activeSegmentBytes||
     retainedSegments<(activeSegmentBytes>0?1:0))return false;
  const validHash=(item:unknown):boolean=>typeof item==='string'&&/^[a-f0-9]{64}$/.test(item);
  if(activeSegmentBytes===0)return activeSegmentRecords===0&&activeSegmentId===null&&activeSegmentTailSha256===null;
  return activeSegmentRecords>=1&&validHash(activeSegmentId)&&validHash(activeSegmentTailSha256);
}
function checkpointManifestDigest(input:{
  generation:number;checkpointId:string;coreTick:number;worldTick:number;createdAt:number;
  journalOffset:OperationalJournalCursor;
  owners:Record<RuntimeCheckpointOwnerName,{encoding:unknown;rawBytes:unknown;compressedBytes:unknown}>;
  ownerHashes:Record<RuntimeCheckpointOwnerName,unknown>;
  payloadBytes:number;compressedBytes:number;
}):string {
  const material={
    schema:'nk1-runtime-checkpoint-manifest-v2',
    version:2,
    generation:input.generation,
    checkpointId:input.checkpointId,
    coreTick:input.coreTick,
    worldTick:input.worldTick,
    createdAt:input.createdAt,
    journalOffset:input.journalOffset,
    owners:RUNTIME_CHECKPOINT_OWNERS.map(name=>({
      name,
      encoding:input.owners[name].encoding,
      rawBytes:input.owners[name].rawBytes,
      compressedBytes:input.owners[name].compressedBytes,
      sha256:input.ownerHashes[name],
    })),
    payloadBytes:input.payloadBytes,
    compressedBytes:input.compressedBytes,
  };
  return sha256(Buffer.from(JSON.stringify(material),'utf8'));
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
     !safeCounter(input.coreTick)||!safeCounter(input.createdAt)||!validJournalOffset(input.snapshots?.journalOffset))
    throw new Error('runtime-checkpoint-envelope-input-invalid');
  const worldTick=input.snapshots?.world?.snapshot?.tick;
  if(!safeCounter(worldTick))throw new Error('runtime-checkpoint-world-tick-invalid');
  const owners={} as Record<RuntimeCheckpointOwnerName,EncodedRuntimeCheckpointOwner>;
  const ownerHashes={} as Record<RuntimeCheckpointOwnerName,string>;
  let payloadBytes=0,compressedBytes=0;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){const result=encodeOwner(input.snapshots[name]);owners[name]=result.encoded;ownerHashes[name]=result.hash;payloadBytes+=result.rawBytes;compressedBytes+=result.encoded.compressedBytes;}
  if(payloadBytes>MAX_TOTAL_RAW_BYTES||compressedBytes>MAX_TOTAL_COMPRESSED_BYTES)throw new Error('runtime-checkpoint-envelope-size-limit-exceeded');
  const base={
    version:2 as const,generation:input.generation,checkpointId:input.checkpointId,coreTick:input.coreTick,
    worldTick,createdAt:input.createdAt,journalOffset:input.snapshots.journalOffset,owners,ownerHashes,payloadBytes,compressedBytes,
  };
  const envelope:RuntimeCheckpointEnvelope={...base,manifestHash:checkpointManifestDigest({
    generation:base.generation,checkpointId:base.checkpointId,coreTick:base.coreTick,worldTick:base.worldTick,
    createdAt:base.createdAt,journalOffset:base.journalOffset,
    owners:owners as Record<RuntimeCheckpointOwnerName,{encoding:unknown;rawBytes:unknown;compressedBytes:unknown}>,
    ownerHashes,payloadBytes,compressedBytes,
  })};
  const verified=validateRuntimeCheckpointEnvelope(envelope);if(!verified.ok)throw new Error('runtime-checkpoint-envelope-build-invalid:'+verified.reason);
  return envelope;
}
export function validateRuntimeCheckpointEnvelope(value:unknown):RuntimeCheckpointEnvelopeValidation {
  if(!isPlainRecord(value))return {ok:false,reason:'envelope-shape-invalid'};
  const version=ownData(value,'version');
  const legacyV1=version===1&&hasExactKeys(value,['version','generation','checkpointId','coreTick','worldTick','createdAt','owners','ownerHashes','payloadBytes','compressedBytes']);
  const currentV2=version===2&&hasExactKeys(value,['version','generation','checkpointId','coreTick','worldTick','createdAt','journalOffset','owners','ownerHashes','payloadBytes','compressedBytes','manifestHash']);
  if(!legacyV1&&!currentV2)return {ok:false,reason:'envelope-keys-invalid'};
  const generation=ownData(value,'generation'),checkpointId=ownData(value,'checkpointId'),coreTick=ownData(value,'coreTick'),
    worldTick=ownData(value,'worldTick'),createdAt=ownData(value,'createdAt'),ownerValues=ownData(value,'owners'),ownerHashValues=ownData(value,'ownerHashes'),
    declaredPayloadBytes=ownData(value,'payloadBytes'),declaredCompressedBytes=ownData(value,'compressedBytes');
  const journalOffset=currentV2?ownData(value,'journalOffset'):undefined;
  const manifestHash=currentV2?ownData(value,'manifestHash'):undefined;
  if(!safeCounter(generation)||generation<1||typeof checkpointId!=='string'||checkpointId.trim().length<16||checkpointId.length>180||
     !safeCounter(coreTick)||!safeCounter(worldTick)||!safeCounter(createdAt)||!safeCounter(declaredPayloadBytes)||!safeCounter(declaredCompressedBytes)||
     !isPlainRecord(ownerValues)||!isPlainRecord(ownerHashValues)||
     !hasExactKeys(ownerValues,RUNTIME_CHECKPOINT_OWNERS)||!hasExactKeys(ownerHashValues,RUNTIME_CHECKPOINT_OWNERS))
    return {ok:false,reason:'envelope-metadata-invalid'};
  if(currentV2&&(!validJournalOffset(journalOffset)||typeof manifestHash!=='string'||!/^[a-f0-9]{64}$/.test(manifestHash)))
    return {ok:false,reason:'envelope-journal-offset-invalid'};
  if(declaredPayloadBytes>MAX_TOTAL_RAW_BYTES||declaredCompressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
    return {ok:false,reason:'envelope-size-limit-exceeded'};
  let preflightRawBytes=0,preflightCompressedBytes=0;
  const manifestOwners={} as Record<RuntimeCheckpointOwnerName,{encoding:unknown;rawBytes:unknown;compressedBytes:unknown}>;
  const manifestOwnerHashes={} as Record<RuntimeCheckpointOwnerName,unknown>;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){
    const owner=ownData(ownerValues,name);
    if(!isPlainRecord(owner)||!hasExactKeys(owner,['encoding','rawBytes','compressedBytes','payloadBase64']))
      return {ok:false,reason:name+':owner-payload-shape-invalid'};
    const rawBytes=ownData(owner,'rawBytes'),ownerCompressedBytes=ownData(owner,'compressedBytes');
    const payloadBase64=ownData(owner,'payloadBase64');
    manifestOwners[name]={encoding:ownData(owner,'encoding'),rawBytes,compressedBytes:ownerCompressedBytes};
    manifestOwnerHashes[name]=ownData(ownerHashValues,name);
    if(ownData(owner,'encoding')!=='deflate-raw+base64'||!safeCounter(rawBytes)||rawBytes>MAX_OWNER_RAW_BYTES||
       !safeCounter(ownerCompressedBytes)||ownerCompressedBytes===0||ownerCompressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
      return {ok:false,reason:name+':owner-payload-metadata-invalid'};
    const expectedBase64Length=Math.ceil(ownerCompressedBytes/3)*4;
    if(typeof payloadBase64!=='string'||payloadBase64.length!==expectedBase64Length||payloadBase64.length>MAX_BASE64_LENGTH)
      return {ok:false,reason:name+':owner-payload-base64-length-invalid'};
    preflightRawBytes+=rawBytes;preflightCompressedBytes+=ownerCompressedBytes;
    if(preflightRawBytes>MAX_TOTAL_RAW_BYTES||preflightCompressedBytes>MAX_TOTAL_COMPRESSED_BYTES)
      return {ok:false,reason:'envelope-size-limit-exceeded'};
  }
  if(preflightRawBytes!==declaredPayloadBytes||preflightCompressedBytes!==declaredCompressedBytes)
    return {ok:false,reason:'envelope-size-accounting-invalid'};
  if(currentV2){
    try {
      const expectedManifestHash=checkpointManifestDigest({
        generation,checkpointId,coreTick,worldTick,createdAt,journalOffset:journalOffset as OperationalJournalCursor,
        owners:manifestOwners,ownerHashes:manifestOwnerHashes,payloadBytes:declaredPayloadBytes,compressedBytes:declaredCompressedBytes,
      });
      if(expectedManifestHash!==manifestHash)return {ok:false,reason:'envelope-manifest-hash-mismatch'};
    } catch { return {ok:false,reason:'envelope-manifest-invalid'}; }
  }
  const snapshots={} as RuntimeCheckpointOwnerSnapshots;let payloadBytes=0,compressedBytes=0;
  for(const name of RUNTIME_CHECKPOINT_OWNERS){
    const decoded=decodeOwner(ownData(ownerValues,name),ownData(ownerHashValues,name));
    if(!decoded.ok)return {ok:false,reason:name+':'+decoded.reason};
    if(!validOwnerSnapshot(name,decoded.snapshot,worldTick))return {ok:false,reason:name+':owner-snapshot-invalid'};
    (snapshots as any)[name]=decoded.snapshot;payloadBytes+=decoded.rawBytes;compressedBytes+=decoded.compressedBytes;
  }
  if(payloadBytes!==declaredPayloadBytes||compressedBytes!==declaredCompressedBytes)
    return {ok:false,reason:'envelope-size-accounting-invalid'};
  snapshots.journalOffset=currentV2?(journalOffset as OperationalJournalCursor):LEGACY_EMPTY_JOURNAL_OFFSET;
  return {ok:true,envelope:structuredClone(value) as unknown as AnyRuntimeCheckpointEnvelope,snapshots};
}
