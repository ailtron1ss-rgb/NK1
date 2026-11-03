import { createHash } from 'node:crypto';
import type { GroundedEntity, GroundedWorldStateSnapshot } from '../world/GroundedWorldState.ts';
import type { MemoryFabric, MemoryLifecycleEncodeInput } from './MemoryFabric.ts';
import type { MemoryOS2 } from '../developmental/MemoryOS2.ts';

export const GROUNDED_SPATIAL_MEMORY_SOURCE='grounded-world-spatial-observation';
export const GROUNDED_SPATIAL_MEMORY_TTL_MS=90_000;
const MAX_COORDINATE=1_000_000;
const clamp01=(value:number)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const digest=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,40);
const finiteCoordinate=(value:unknown):number|null=>
 typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=MAX_COORDINATE?value:null;

function observedSpatialModality(entity:GroundedEntity):'vision'|'world'|null{
 if(!Array.isArray(entity.modalities))return null;
 const spatialModalities=(['vision','world'] as const).filter(modality=>entity.modalities.includes(modality));
 if(!spatialModalities.length)return null;
 // If a second spatial-capable modality contributes model output/conflict to the
 // same fused track, its shared position cannot be attributed to the observed one.
 if(spatialModalities.some(modality=>entity.modalityEvidenceKinds?.[modality]!=='observed'))return null;
 return spatialModalities.includes('vision')?'vision':'world';
}

function validateGroundedEntity(entity:GroundedEntity,at:number):{
 modality:'vision'|'world';frameId:string;x:number;y:number;z:number;
 observedAt:number;expiresAt:number;confidence01:number;
}|null{
 if(!entity||typeof entity!=='object'||typeof entity.id!=='string'||!entity.id.trim()||
    entity.id.length>120||entity.kind==='event'||entity.kind==='concept'||
    entity.presenceStatus!=='visible'||entity.visibilityKnown!==true)return null;
 const modality=observedSpatialModality(entity);
 if(!modality)return null;
 const frameId=typeof entity.positionFrameId==='string'
  ?entity.positionFrameId.normalize('NFKC').trim().slice(0,64):'';
 if(!frameId||/[\u0000-\u001f\u007f]/u.test(frameId))return null;
 const x=finiteCoordinate(entity.position?.x),y=finiteCoordinate(entity.position?.y),z=finiteCoordinate(entity.position?.z);
 if(x===null||y===null||z===null)return null;
 const observedAt=Number(entity.lastSeenAt),confidence01=clamp01(Number(entity.confidence01));
 if(!Number.isFinite(observedAt)||observedAt<=0||observedAt>at||
    at-observedAt>GROUNDED_SPATIAL_MEMORY_TTL_MS||confidence01<.68)return null;
 return {modality,frameId,x,y,z,observedAt,expiresAt:observedAt+GROUNDED_SPATIAL_MEMORY_TTL_MS,confidence01};
}

function buildMemoryInput(entity:GroundedEntity,point:NonNullable<ReturnType<typeof validateGroundedEntity>>):MemoryLifecycleEncodeInput{
 const lineageKey='grounded-spatial:'+digest(entity.id+'\0'+point.modality);
 const label=String(entity.label??'').normalize('NFKC').trim().slice(0,120)||'unknown';
 const sourceIds=Array.isArray(entity.sourceIds)
  ?[...new Set(entity.sourceIds.filter(value=>typeof value==='string').map(value=>value.slice(0,120)))].slice(0,8):[];
 return {
  content:'Grounded spatial position for entity '+entity.id+'.',
  kind:'episodic',
  source:GROUNDED_SPATIAL_MEMORY_SOURCE,
  tags:['grounded-world','spatial-observation',point.modality],
  entities:[entity.id,label].filter(Boolean),
  context:{
   spatialFrameId:point.frameId,
   spatialX:String(point.x),spatialY:String(point.y),spatialZ:String(point.z),
   groundedEntityId:entity.id,groundedEntityLabel:label,
   groundedPositionAt:String(point.observedAt),groundedPositionExpiresAt:String(point.expiresAt),
   groundedEvidenceModality:point.modality,groundedEvidenceKind:'observed',
   groundedSourceIds:sourceIds.join(',').slice(0,480),
   groundedWorldObservationCount:String(Math.max(1,Math.floor(Number(entity.observationCount)||1))),
  },
  salience:clamp01(.35+point.confidence01*.25),emotionalWeight:.04,
  identityRelevance:.02,goalRelevance:.06,socialRelevance:.02,predictionError:.08,
  confidence:point.confidence01,epistemicStatus:'belief',
  semanticLinks:[],temporalLinks:[],causalLinks:[],
  validFromAt:point.observedAt,validUntilAt:point.expiresAt,observedAt:point.observedAt,
  provenanceClass:'device',sourceAuthority01:Math.min(.94,point.confidence01),
  independenceKey:lineageKey,evidenceFreshnessAt:point.observedAt,
  evidenceSources:[{
   source:'grounded-world:'+point.modality,provenanceClass:'device',
   sourceAuthority01:Math.min(.94,point.confidence01),independenceKey:lineageKey,
   observedAt:point.observedAt,evidenceFreshnessAt:point.observedAt,
  }],
 };
}

function samePoint(existing:ReturnType<MemoryOS2['snapshot']>['items'][number],input:MemoryLifecycleEncodeInput,at:number):boolean{
 const current=existing.context??{},expected=input.context??{};
 return !existing.dormant&&existing.epistemicStatus!=='quarantined'&&
  Number(existing.validUntilAt)>at&&Number(existing.observedAt??existing.createdAt)===Number(input.observedAt)&&
  ['spatialFrameId','spatialX','spatialY','spatialZ','groundedPositionAt','groundedEvidenceModality'].every(key=>current[key]===expected[key]);
}

export interface GroundedSpatialMemorySyncResult{
 considered:number;accepted:number;written:number;unchanged:number;rejected:number;
 staleSkipped:number;conflictSkipped:number;memoryIds:string[];
}

/**
 * Projects only recent, visible and explicitly observed spatial positions into
 * canonical MemoryOS2. P41 model-output coordinates and mixed-provenance tracks
 * are rejected; the derived MemorySpatialIndex remains owned by MemoryOS2.
 */
export function synchronizeGroundedSpatialMemories(input:{
 fabric:MemoryFabric;memoryOS:MemoryOS2;snapshot:GroundedWorldStateSnapshot;at:number;tick:number;
}):GroundedSpatialMemorySyncResult{
 const at=Number(input.at),tick=Number(input.tick),snapshot=input.snapshot;
 const result:GroundedSpatialMemorySyncResult={
  considered:Array.isArray(snapshot?.entities)?Math.min(128,snapshot.entities.length):0,
  accepted:0,written:0,unchanged:0,rejected:0,staleSkipped:0,conflictSkipped:0,memoryIds:[],
 };
 if(!Number.isFinite(at)||at<=0||!Number.isSafeInteger(tick)||tick<0||
    !snapshot||!Array.isArray(snapshot.entities))return {...result,rejected:result.considered};

 const existingByEntity=new Map<string,ReturnType<MemoryOS2['snapshot']>['items'][number]>();
 for(const row of input.memoryOS.snapshot({clone:false}).items){
  if(row.source!==GROUNDED_SPATIAL_MEMORY_SOURCE)continue;
  const entityId=row.context?.groundedEntityId;if(!entityId)continue;
  const prior=existingByEntity.get(entityId);
  if(!prior||Number(row.observedAt??row.createdAt)>Number(prior.observedAt??prior.createdAt))existingByEntity.set(entityId,row);
 }
 for(const entity of snapshot.entities.slice(0,128)){
  const point=validateGroundedEntity(entity,at);
  if(!point){result.rejected++;continue;}
  result.accepted++;
  const memoryInput=buildMemoryInput(entity,point),existing=existingByEntity.get(entity.id);
  if(existing){
   const existingAt=Number(existing.observedAt??existing.createdAt);
   if(existingAt>point.observedAt){result.staleSkipped++;result.memoryIds.push(existing.id);continue;}
   if(existingAt===point.observedAt){
    if(samePoint(existing,memoryInput,at)){result.unchanged++;result.memoryIds.push(existing.id);}
    else{result.conflictSkipped++;result.memoryIds.push(existing.id);}
    continue;
   }
  }
  const commandId='gsp:'+digest([
   entity.id,point.frameId,point.x,point.y,point.z,point.observedAt,point.modality,tick,
  ].join('\0'));
  const stored=input.fabric.applyLifecycleCommand({
   action:'encode',input:memoryInput,commandId,tick,emitEvent:true,syncCompatibility:false,
  });
  if(stored&&typeof stored==='object'&&'id'in stored&&typeof stored.id==='string'){
   result.written++;result.memoryIds.push(stored.id);
  }else result.rejected++;
 }
 return result;
}
