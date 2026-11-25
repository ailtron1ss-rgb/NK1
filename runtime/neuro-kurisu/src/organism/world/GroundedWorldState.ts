import type { WorldContext } from '../core/types.ts';
import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { PerceptualEvidenceState } from '../body/PerceptualEvidenceCompiler.ts';
import type { OutcomeVerification } from '../system/OutcomeVerificationService.ts';
import { isTrustedEmbodiedOutcomeVerification } from '../system/ExternalPostconditionVerifier.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const safeUnit=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
const safeInteger=(value:unknown,fallback=0,min=0,max=Number.MAX_SAFE_INTEGER):number=>
  typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max?value:fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>{
  const n=safeInteger(value,fallback,0,Number.MAX_SAFE_INTEGER);
  return n>Date.now()+5*60_000?fallback:n;
};
const safeText=(value:unknown,max:number):string|undefined=>{
  if(typeof value!=='string')return undefined;
  const text=value.normalize('NFKC').trim();
  return text&&text.length<=max&&!/[\x00-\x1f\x7f-\x9f]/u.test(text)?text:undefined;
};
const safeStringArray=(value:unknown,maxItems:number,maxLength:number):string[]=>{
  if(!Array.isArray(value))return [];
  const out:string[]=[];
  for(const item of value){
    const text=safeText(item,maxLength);
    if(text&&!out.includes(text))out.push(text);
    if(out.length>=maxItems)break;
  }
  return out;
};
const safeVector=(value:unknown):{x:number;y:number;z:number}|null=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(![v.x,v.y,v.z].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1_000_000))return null;
  return {x:Number(v.x),y:Number(v.y),z:Number(v.z)};
};
const consumedWorldOutcomeVerifications=new WeakSet<object>();
type GroundedEvidenceKind='observed'|'model-output'|'derived'|'conflict'|'unresolved';
const restoredEvidenceKind=(value:unknown):GroundedEvidenceKind=>{
  // Persisted snapshots are data, not a live host attestation.
  if(value==='observed')return 'model-output';
  return value==='model-output'||value==='derived'||value==='conflict'||value==='unresolved'?value:'unresolved';
};
const restoredModalityEvidence=(value:unknown):Partial<Record<string,GroundedEvidenceKind>>=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value as Record<string,unknown>)
    .filter(([key])=>/^[a-z][a-z0-9_-]{0,31}$/i.test(key))
    .slice(0,12)
    .map(([key,kind])=>[key,restoredEvidenceKind(kind)]));
};
const norm=(x:string)=>String(x??'').trim().toLowerCase().slice(0,120);
// Match P41 cleanTrackId: identity tokens retain case and only normalize Unicode/whitespace.
const cleanIdentity=(value:unknown)=>{
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').trim().slice(0,120);
};
const stableHash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
const normalizeImageBox=(value:unknown)=>{
  if(!value||typeof value!=='object')return undefined;
  const box=value as Record<string,unknown>;
  if(![box.x,box.y,box.width,box.height].every(v=>typeof v==='number'&&Number.isFinite(v)))return undefined;
  const x=Number(box.x),y=Number(box.y),width=Number(box.width),height=Number(box.height);
  if(x<0||y<0||width<=0||height<=0||x+width>1.000001||y+height>1.000001)return undefined;
  return {x,y,width,height};
};

export interface GroundedEntity {
  id:string;
  label:string;
  kind:string;
  confidence01:number;
  present01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  modalities:string[];
  /** Stable provider/world track identity. Labels are never used as an identity when this exists. */
  trackId?:string;
  trackAliases?:string[];
  positionFrameId?:string;
  position?:{x:number;y:number;z:number}|null;
  velocity?:{x:number;y:number;z:number}|null;
  /** Latest camera-space box; explicitly distinct from calibrated world position. */
  imageBox?:{x:number;y:number;width:number;height:number};
  imageBoxCameraId?:number;
  imageBoxAt?:number;
  imageBoxConfidence01?:number;
  /** Per-modality provenance is retained across world-model consolidation. */
  modalityEvidenceKinds?:Partial<Record<string,'observed'|'model-output'|'derived'|'conflict'|'unresolved'>>;
  sourceIds?:string[];
  value?:number;
  valueKnown?:boolean;
  visibilityKnown?:boolean;
  collectionKnown?:boolean;
  presenceStatus:'visible'|'fading'|'unknown';
  persistence01:number;
  absenceEvidence01:number;
  observationCount:number;
}
export interface GroundedRelation { id:string; from:string; relation:string; to:string; fromEntityId?:string; toEntityId?:string; confidence01:number; at:number; }
export interface GroundedEvent { id:string; label:string; confidence01:number; lastAt:number; persistence01:number; evidenceKind?:'observed'|'model-output'|'derived'|'conflict'|'unresolved'; modalityEvidenceKinds?:Partial<Record<string,'observed'|'model-output'|'derived'|'conflict'|'unresolved'>>; }
export interface GroundedQuarantinedOutcome { id:string; label:string; at:number; }
export interface GroundedWorldStateSnapshot {
  version:1;
  revision:number;
  lastAt:number;
  location:string;
  uncertainty01:number;
  confidence01:number;
  entities:GroundedEntity[];
  relations:GroundedRelation[];
  events:GroundedEvent[];
  facts:string[];
  /** Persisted facts cannot retain live verifier authority across process restarts. */
  quarantinedFacts?:string[];
  /** Unverified external receipts are diagnostic only and never enter canonical world events. */
  quarantinedOutcomes?:GroundedQuarantinedOutcome[];
  provenanceIds:string[];
  lastHash:string;
}
export const defaultGroundedWorldState=():GroundedWorldStateSnapshot=>({version:1,revision:0,lastAt:0,location:'unknown',uncertainty01:.5,confidence01:0,entities:[],relations:[],events:[],facts:[],quarantinedFacts:[],quarantinedOutcomes:[],provenanceIds:[],lastHash:''});

export class GroundedWorldState {
  private state=defaultGroundedWorldState();
  restore(raw?:Partial<GroundedWorldStateSnapshot>|null){
    const d=defaultGroundedWorldState();
    const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
    const lastAt=safeTimestamp(r.lastAt,0);
    const revision=safeInteger(r.revision,0);
    const location=safeText(r.location,256)??'unknown';
    const entities:Array<GroundedEntity>=[];
    if(Array.isArray(r.entities)){
      for(const rawEntity of r.entities.slice(0,128)){
        if(!rawEntity||typeof rawEntity!=='object'||Array.isArray(rawEntity))continue;
        const e=rawEntity as Record<string,unknown>;
        const id=safeText(e.id,128),label=safeText(e.label,120),kind=safeText(e.kind,64);
        if(!id||!label||!kind)continue;
        const lastSeenAt=Math.min(safeTimestamp(e.lastSeenAt,lastAt),lastAt);
        const firstSeenAt=Math.min(safeTimestamp(e.firstSeenAt,lastSeenAt),lastSeenAt);
        const imageBox=normalizeImageBox(e.imageBox);
        const imageBoxCameraId=safeInteger(e.imageBoxCameraId,-1,0,1_000_000);
        const imageBoxAt=safeTimestamp(e.imageBoxAt,-1);
        const imageBoxConfidence01=safeUnit(e.imageBoxConfidence01,-1);
        const validImageEvidence=Boolean(imageBox&&imageBoxCameraId>=0&&imageBoxAt>=0&&imageBoxAt<=lastAt&&imageBoxConfidence01>=.42);
        const value=typeof e.value==='number'&&Number.isFinite(e.value)&&Math.abs(e.value)<=1_000_000_000?e.value:undefined;
        const trackId=safeText(e.trackId,180);
        const positionFrameId=safeText(e.positionFrameId,120);
        const position=safeVector(e.position);
        const velocity=safeVector(e.velocity);
        const presenceStatus=e.presenceStatus==='visible'||e.presenceStatus==='fading'||e.presenceStatus==='unknown'?e.presenceStatus:'unknown';
        entities.push({
          id,label,kind,
          confidence01:safeUnit(e.confidence01),
          present01:safeUnit(e.present01),
          firstSeenAt,lastSeenAt,
          modalities:safeStringArray(e.modalities,12,32),
          ...(trackId?{trackId}:{}),
          trackAliases:safeStringArray(e.trackAliases,16,180),
          ...(positionFrameId?{positionFrameId}:{}),
          position,velocity,
          ...(validImageEvidence?{imageBox,imageBoxCameraId,imageBoxAt,imageBoxConfidence01}:{}),
          modalityEvidenceKinds:restoredModalityEvidence(e.modalityEvidenceKinds),
          sourceIds:safeStringArray(e.sourceIds,16,180).filter(sourceId=>!['text','vision','audio','sensor','world'].includes(sourceId.trim().toLowerCase())),
          ...(value!==undefined?{value}:{}),
          valueKnown:e.valueKnown===true&&value!==undefined,
          visibilityKnown:e.visibilityKnown===true,
          collectionKnown:e.collectionKnown===true,
          presenceStatus,
          persistence01:safeUnit(e.persistence01),
          absenceEvidence01:safeUnit(e.absenceEvidence01),
          observationCount:safeInteger(e.observationCount,1,1,10_000),
        });
      }
    }
    const relations:GroundedRelation[]=[];
    if(Array.isArray(r.relations)){
      for(const rawRelation of r.relations.slice(0,256)){
        if(!rawRelation||typeof rawRelation!=='object'||Array.isArray(rawRelation))continue;
        const row=rawRelation as Record<string,unknown>;
        const id=safeText(row.id,160),from=safeText(row.from,160),relation=safeText(row.relation,120),to=safeText(row.to,160);
        const at=safeTimestamp(row.at,-1);
        if(!id||!from||!relation||!to||at<0||at>lastAt)continue;
        const fromEntityId=safeText(row.fromEntityId,128),toEntityId=safeText(row.toEntityId,128);
        relations.push({id,from,relation,to,...(fromEntityId?{fromEntityId}:{}),...(toEntityId?{toEntityId}:{}),confidence01:safeUnit(row.confidence01),at});
      }
    }
    const events:GroundedEvent[]=[];
    const quarantinedOutcomes:GroundedQuarantinedOutcome[]=[];
    const quarantinedOutcomeIds=new Set<string>();
    if(Array.isArray(r.quarantinedOutcomes)){
      for(const rawOutcome of r.quarantinedOutcomes.slice(0,96)){
        if(!rawOutcome||typeof rawOutcome!=='object'||Array.isArray(rawOutcome))continue;
        const item=rawOutcome as Record<string,unknown>;
        const id=safeText(item.id,160),label=safeText(item.label,240);
        if(!id||!label||quarantinedOutcomeIds.has(id))continue;
        quarantinedOutcomeIds.add(id);
        quarantinedOutcomes.push({id,label,at:Math.min(safeTimestamp(item.at,lastAt),lastAt)});
      }
    }
    if(Array.isArray(r.events)){
      for(const rawEvent of r.events.slice(0,96)){
        if(!rawEvent||typeof rawEvent!=='object'||Array.isArray(rawEvent))continue;
        const event=rawEvent as Record<string,unknown>;
        const id=safeText(event.id,160),label=safeText(event.label,240);
        if(!id||!label)continue;
        const eventAt=Math.min(safeTimestamp(event.lastAt,lastAt),lastAt);
        if(label.startsWith('external-receipt:')||label.startsWith('external-observation-receipt:')){
          if(!quarantinedOutcomeIds.has(id)){
            quarantinedOutcomeIds.add(id);
            quarantinedOutcomes.push({id,label:`restored-unverified:${label}`.slice(0,240),at:eventAt});
          }
          continue;
        }
        events.push({
          id,label,confidence01:safeUnit(event.confidence01),lastAt:eventAt,
          persistence01:safeUnit(event.persistence01),
          ...(event.evidenceKind!==undefined?{evidenceKind:restoredEvidenceKind(event.evidenceKind)}:{}),
          ...(event.modalityEvidenceKinds!==undefined?{modalityEvidenceKinds:restoredModalityEvidence(event.modalityEvidenceKinds)}:{}),
        });
      }
    }
    const restoredFacts=safeStringArray(r.facts,192,512);
    const quarantinedFacts=[...new Set([
      ...safeStringArray(r.quarantinedFacts,192,512),
      ...restoredFacts.map(fact=>`restored-unverified:${fact}`.slice(0,512)),
    ])].slice(-192);
    this.state={
      ...d,version:1,revision,lastAt,location,
      // Persisted aggregate confidence is not a current observation receipt.
      // Start conservatively and let fresh, live inputs rebuild the world signal.
      uncertainty01:Math.max(.5,safeUnit(r.uncertainty01,.5)),
      confidence01:0,
      entities,relations,events,
      facts:[],
      quarantinedFacts,
      quarantinedOutcomes:quarantinedOutcomes.slice(-96),
      provenanceIds:safeStringArray(r.provenanceIds,128,256),
      lastHash:'',
    };
    const digest=`${this.state.location}|${this.state.revision}|${this.state.facts.slice(-24).join('|')}|${this.state.events.slice(0,8).map(x=>x.id).join('|')}`;
    this.state.lastHash=stableHash(digest);
  }
  snapshot(){return structuredClone(this.state);}

  /**
   * Record an embodied outcome only from the exact executor result and the
   * decision-bound OutcomeVerificationService token. A device sample is a
   * traceable observation receipt, not permission to invent semantic world facts.
   */
  integrateExternalOutcome(input:{result:unknown;verification:unknown}){
    const rawResult=input?.result&&typeof input.result==='object'&&!Array.isArray(input.result)
      ?input.result as Record<string,unknown>:{};
    const trusted=isTrustedEmbodiedOutcomeVerification(input?.verification,input?.result);
    const verification=trusted?input.verification as OutcomeVerification:null;
    const action=safeText(rawResult.action,64)??'unknown';
    const status=safeText(rawResult.status,32)??'unverified';
    const realityClass=safeText(rawResult.realityClass,48)??'untrusted';
    const eventAt=safeTimestamp(rawResult.at,this.state.lastAt);
    const executionId=safeText(rawResult.executionId,100);
    const observationId=trusted?safeText(verification?.observationId,180):undefined;
    const eventIdentity=trusted
      ? `trusted:${observationId??executionId??`${eventAt}:${action}`}`
      : `untrusted:${executionId??`${eventAt}:${action}:${status}:${realityClass}`}`;
    const eventId=`gw-external-${stableHash(eventIdentity)}`;

    if(!trusted){
      const existing=this.state.quarantinedOutcomes??[];
      if(existing.some(item=>item.id===eventId)){
        return {revision:this.state.revision,eventId,confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash,duplicate:true,quarantined:true};
      }
      const label=`external-receipt:${action}:${status}:${realityClass}`.slice(0,240);
      this.state={...this.state,quarantinedOutcomes:[{id:eventId,label,at:Math.min(eventAt,Date.now())},...existing].slice(0,96)};
      return {revision:this.state.revision,eventId,confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash,duplicate:false,quarantined:true};
    }

    if(input.verification&&typeof input.verification==='object'&&consumedWorldOutcomeVerifications.has(input.verification as object)){
      return {revision:this.state.revision,eventId,confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash,duplicate:true,quarantined:false};
    }
    if(this.state.events.some(event=>event.id===eventId)){
      return {revision:this.state.revision,eventId,confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash,duplicate:true,quarantined:false};
    }
    if(input.verification&&typeof input.verification==='object')consumedWorldOutcomeVerifications.add(input.verification as object);
    const event:GroundedEvent={
      id:eventId,label:`external-observation-receipt:${action}`,confidence01:safeUnit(verification?.confidence01),lastAt:eventAt,
      persistence01:safeUnit(verification?.confidence01),evidenceKind:'observed',
    };
    this.state={
      ...this.state,
      revision:this.state.revision+1,
      lastAt:Math.max(this.state.lastAt,eventAt),
      events:[event,...this.state.events].slice(0,96),
      provenanceIds:observationId?[observationId,...this.state.provenanceIds.filter(value=>value!==observationId)].slice(0,128):this.state.provenanceIds,
    };
    const digest=`${this.state.location}|${this.state.revision}|${this.state.facts.slice(-24).join('|')}|${this.state.events.slice(0,8).map(x=>x.id).join('|')}`;
    this.state.lastHash=stableHash(digest);
    return {
      revision:this.state.revision,eventId,
      confidence01:safeUnit(verification?.confidence01),
      verified01:1,independent01:1,lastHash:this.state.lastHash,duplicate:false,quarantined:false,
    };
  }
  integrate(input:{at:number;base?:WorldContext|null;perception?:P41PerceptionState|null;evidence?:PerceptualEvidenceState|null;}):WorldContext{
    const at=input.at; const base=input.base; const p=input.perception; const e=input.evidence;
    const rows:GroundedEntity[]=this.state.entities.map(row=>({...row,modalities:[...row.modalities],trackAliases:[...(row.trackAliases??[])],sourceIds:[...(row.sourceIds??[])],modalityEvidenceKinds:{...(row.modalityEvidenceKinds??{})}}));
    const normalizeEvidence=(value:unknown):'observed'|'model-output'|'derived'|'conflict'|'unresolved'=>{
      return value==='observed'||value==='model-output'||value==='derived'||value==='conflict'||value==='unresolved'?value:'unresolved';
    };
    // An aggregate may be no more certain than its least-certain modality.
    // Keep per-modality provenance intact; expose a conservative summary only.
    const aggregateEvidence=(values:unknown[]):'observed'|'model-output'|'derived'|'conflict'|'unresolved'=>{
      const kinds=values.map(normalizeEvidence);
      return kinds.includes('conflict')?'conflict'
        :kinds.includes('unresolved')?'unresolved'
        :kinds.includes('model-output')?'model-output'
        :kinds.includes('derived')?'derived'
        :kinds.includes('observed')?'observed'
        :'unresolved';
    };
    const trackTokens=(entity:Pick<GroundedEntity,'id'|'trackId'|'trackAliases'>):string[]=>{
      const values:string[]=[];
      if(entity.id)values.push('id:'+entity.id);
      if(entity.trackId)values.push('track:'+entity.trackId);
      for(const alias of entity.trackAliases??[])if(alias)values.push('track:'+alias);
      return [...new Set(values)];
    };
    const findMatch=(incoming:GroundedEntity):GroundedEntity|undefined=>{
      const incomingTokens=new Set(trackTokens(incoming));
      const hasStrongIdentity=Boolean(incoming.trackId||(incoming.trackAliases?.length??0)>0);
      if(incomingTokens.size>0){
        const matches=rows.filter(row=>trackTokens(row).some(token=>incomingTokens.has(token)));
        if(matches.length===1)return matches[0];
        if(matches.length>1)return undefined;
      }
      // Label fallback is intentionally restricted to legacy, untracked entities.
      // Repeated objects ("two chairs") remain separate when identity is ambiguous.
      if(!hasStrongIdentity){
        const matches=rows.filter(row=>row.kind===incoming.kind&&norm(row.label)===norm(incoming.label)&&!row.trackId&&!(row.trackAliases?.length));
        if(matches.length===1)return matches[0];
      }
      return undefined;
    };
    const mergeEntity=(incoming:GroundedEntity)=>{
      const old=findMatch(incoming);
      if(!old){rows.push({...incoming,modalities:[...incoming.modalities],trackAliases:[...(incoming.trackAliases??[])],sourceIds:[...(incoming.sourceIds??[])],modalityEvidenceKinds:{...(incoming.modalityEvidenceKinds??{})}});return;}
      const previousLastSeenAt=old.lastSeenAt;
      const previousFrame=old.positionFrameId;
      const nextFrame=incoming.positionFrameId;
      const frameChanged=Boolean(previousFrame&&nextFrame&&previousFrame!==nextFrame);
      old.lastSeenAt=Math.max(old.lastSeenAt,incoming.lastSeenAt);
      old.firstSeenAt=Math.min(old.firstSeenAt,incoming.firstSeenAt);
      old.present01=clamp(old.present01*.68+incoming.present01*.32);
      old.confidence01=clamp(old.confidence01*.68+incoming.confidence01*.32);
      old.modalities=[...new Set([...old.modalities,...incoming.modalities])];
      old.trackId=old.trackId??incoming.trackId;
      old.trackAliases=[...new Set([...(old.trackAliases??[]),...(incoming.trackAliases??[]),...(incoming.trackId&&old.trackId!==incoming.trackId?[incoming.trackId]:[])])].filter(Boolean).slice(-16);
      old.sourceIds=[...new Set([...(old.sourceIds??[]),...(incoming.sourceIds??[])])].slice(-16);
      old.modalityEvidenceKinds={...(old.modalityEvidenceKinds??{}),...(incoming.modalityEvidenceKinds??{})};
      if(incoming.imageBox&&Number.isFinite(incoming.imageBoxAt)&&(incoming.imageBoxAt??-1)>=(old.imageBoxAt??-1)){
        old.imageBox={...incoming.imageBox};
        old.imageBoxCameraId=incoming.imageBoxCameraId;
        old.imageBoxAt=incoming.imageBoxAt;
        old.imageBoxConfidence01=incoming.imageBoxConfidence01;
      }
      old.observationCount=incoming.lastSeenAt>previousLastSeenAt
        ?Math.max(old.observationCount+1,incoming.observationCount)
        :Math.max(old.observationCount,incoming.observationCount);
      if(incoming.lastSeenAt>=previousLastSeenAt){
        old.presenceStatus=incoming.presenceStatus;
        old.visibilityKnown=incoming.visibilityKnown??old.visibilityKnown;
      }
      old.absenceEvidence01=incoming.presenceStatus==='visible'?clamp(old.absenceEvidence01*.8):clamp(Math.max(old.absenceEvidence01,incoming.absenceEvidence01));
      old.persistence01=clamp(old.persistence01*.9+incoming.persistence01*.1);
      if(frameChanged){
        old.position=incoming.position??null;
        old.velocity=null;
        old.positionFrameId=nextFrame;
      }else{
        if(incoming.position){old.position=incoming.position;old.positionFrameId=nextFrame??previousFrame;}
        if(incoming.velocity)old.velocity=incoming.velocity;
      }
      if(incoming.valueKnown===true&&Number.isFinite(incoming.value)){old.value=incoming.value;old.valueKnown=true;}
      if(incoming.collectionKnown===true)old.collectionKnown=true;
      if(incoming.sourceIds?.length)old.sourceIds=[...new Set([...(old.sourceIds??[]),...incoming.sourceIds])].slice(-16);
    };

    // Canonical world-context objects preserve their own IDs and their actual
    // knowledge flags. A confidence score is not a resource value or a grasp.
    for(const o of (base?.objects??[])){
      const suppliedSourceId=cleanIdentity(o.sourceId);
      const sourceId=suppliedSourceId||'world-context';
      const objectId=cleanIdentity(o.id);
      const trackId=objectId?('world:'+sourceId+':'+objectId):undefined;
      const evidenceKind=normalizeEvidence(o.evidenceKind);
      const visibleKnown=o.visibilityKnown===false?false:(o.visibilityKnown===true||typeof o.visible==='boolean');
      const coordinateFrameId=cleanIdentity(o.coordinateFrameId);
      const hasPosition=Boolean(coordinateFrameId)&&[o.x,o.y,o.z].every(value=>typeof value==='number'&&Number.isFinite(value));
      const imageBox=o.bbox2D;
      const imageBoxCameraId=Number.isFinite(o.bboxCameraId)&&Number(o.bboxCameraId)>=0?Math.floor(Number(o.bboxCameraId)):-1;
      const imageBoxAt=Number.isFinite(o.bboxAt)&&Number(o.bboxAt)>=0?Number(o.bboxAt):-1;
      const imageBoxConfidence01=clamp(Number(o.bboxConfidence01??0));
      const hasImageBox=Boolean(imageBox&&imageBoxCameraId>=0&&imageBoxAt>=0&&imageBoxConfidence01>0
        &&[imageBox.x,imageBox.y,imageBox.width,imageBox.height].every(value=>typeof value==='number'&&Number.isFinite(value))
        &&imageBox.x>=0&&imageBox.y>=0&&imageBox.width>0&&imageBox.height>0
        &&imageBox.x+imageBox.width<=1.000001&&imageBox.y+imageBox.height<=1.000001);
      const incoming:GroundedEntity={
        id:objectId?('world-'+stableHash(sourceId+':'+objectId)):'world-'+stableHash(o.label+':'+at),
        label:norm(o.label)||'unknown',kind:'object',
        confidence01:clamp(o.confidence01??(o.valueKnown?o.value:.35)),
        present01:visibleKnown?(o.visible?1:.35):.5,
        firstSeenAt:at,lastSeenAt:at,
        modalities:['world'],
        ...(trackId?{trackId}:{}),
        modalityEvidenceKinds:{world:evidenceKind},
        sourceIds:suppliedSourceId?[suppliedSourceId]:[],
        ...(hasPosition?{position:{x:Number(o.x),y:Number(o.y),z:Number(o.z)},positionFrameId:coordinateFrameId}:{position:null}),
        ...(hasImageBox?{imageBox:{x:Number(imageBox!.x),y:Number(imageBox!.y),width:Number(imageBox!.width),height:Number(imageBox!.height)},imageBoxCameraId,imageBoxAt,imageBoxConfidence01}:{}),
        value:Number.isFinite(o.value)?o.value:0,
        valueKnown:o.valueKnown===true,
        visibilityKnown:visibleKnown,
        collectionKnown:o.collectionKnown===true,
        presenceStatus:!visibleKnown?'unknown':o.visible?'visible':'fading',
        persistence01:.12,absenceEvidence01:0,observationCount:1,
      };
      mergeEntity(incoming);
    }

    // P41 is the canonical semantic/identity layer. Keep every tracked instance,
    // including same-label entities, and carry each modality's own evidence kind.
    for(const x of (p?.entities??[]).filter(x=>x.present01>.2).slice(0,96)){
      const evidenceKinds:Record<string,'observed'|'model-output'|'derived'|'conflict'|'unresolved'>={};
      for(const modality of x.modalities)evidenceKinds[modality]=normalizeEvidence(x.modalityEvidenceKinds?.[modality]);
      const allKinds=Object.values(evidenceKinds);
      const evidenceKind=aggregateEvidence(allKinds);
      const incoming:GroundedEntity={
        id:x.id,label:norm(x.label)||'unknown',kind:x.kind,
        confidence01:clamp(x.confidence01),present01:clamp(x.present01),
        firstSeenAt:x.firstSeenAt,lastSeenAt:x.lastSeenAt,
        modalities:[...x.modalities],
        ...(x.trackId?{trackId:x.trackId}:{}),
        trackAliases:[...(x.trackAliases??[])],
        positionFrameId:x.positionFrameId,
        position:x.position?{...x.position}:null,
        velocity:x.velocity?{...x.velocity}:null,
        ...(x.imageBox?{imageBox:{...x.imageBox},imageBoxCameraId:x.imageBoxCameraId,imageBoxAt:x.imageBoxAt,imageBoxConfidence01:x.imageBoxConfidence01}:{}),
        modalityEvidenceKinds:evidenceKinds,
        // Modality names describe channels, not source identity. Preserve only
        // provider/source IDs explicitly carried by the corresponding modality.
        sourceIds:[...new Set(Object.values(x.modalitySourceIds??{}).flatMap(ids=>Array.isArray(ids)?ids:[])
          .filter(sourceId=>typeof sourceId==='string'&&sourceId.trim().length>0&&sourceId.length<=180
            &&!['text','vision','audio','sensor','world'].includes(sourceId.trim().toLowerCase())))].slice(-16),
        visibilityKnown:x.modalities.includes('vision'),
        presenceStatus:x.modalities.includes('vision')?(x.present01>.52?'visible':'fading'):'unknown',
        persistence01:clamp(Math.min(1,x.observations/12)),
        absenceEvidence01:clamp(1-x.present01),
        observationCount:Math.max(1,x.observations),
      };
      // Keep the combined kind available even for entities restored from older
      // snapshots that do not yet contain per-modality provenance.
      if(!Object.keys(evidenceKinds).length)incoming.modalityEvidenceKinds={world:evidenceKind};
      mergeEntity(incoming);
    }

    const rel=new Map(this.state.relations.map(x=>[x.id,{...x}]));
    const perceptionRelations=new Map((p?.relations??[]).map(r=>[r.id,r]));
    for(const r of (p?.relations??[]).slice(0,128)){
      rel.set(r.id,{
        id:r.id,from:norm(r.from),relation:norm(r.relation),to:norm(r.to),
        ...(r.fromEntityId?{fromEntityId:r.fromEntityId}:{}),
        ...(r.toEntityId?{toEntityId:r.toEntityId}:{}),
        confidence01:clamp(r.confidence01),at:r.at
      });
    }
    const relationFacts=[...rel.values()].slice(0,128).map(x=>{
      const src=perceptionRelations.get(x.id);
      const kind=normalizeEvidence(src?.evidenceKind);
      const fresh=Boolean(src&&Number.isFinite(src.at)&&src.at<=at&&at-src.at<=5_000);
      return `${fresh?kind:'historical-'+kind}-relation:${x.from}:${x.relation}:${x.to}`;
    });
    const evidenceFacts=(e?.evidence??[]).slice(0,64).map(x=>{
      const kind=normalizeEvidence(x.kind);
      const fresh=Number.isFinite(x.at)&&x.at<=at&&at-x.at<=5_000;
      return `${fresh?kind:'historical-'+kind}-evidence:${x.claim}`;
    });
    for(const entity of rows){
      const age=Math.max(0,at-entity.lastSeenAt);
      if(age>90000){
        entity.presenceStatus=entity.present01>.18?'fading':'unknown';
        entity.visibilityKnown=false;
        entity.absenceEvidence01=clamp(Math.max(entity.absenceEvidence01,(1-entity.present01)*.12));
      }
      entity.persistence01=clamp(entity.persistence01*.99+Math.min(1,entity.observationCount/12)*.01);
    }
    const entities=rows.sort((a,b)=>b.confidence01-a.confidence01||b.lastSeenAt-a.lastSeenAt).slice(0,128);
    const relations=[...rel.values()].sort((a,b)=>b.confidence01-a.confidence01||b.at-a.at).slice(0,256);
    const eventRows=new Map(this.state.events.map(x=>[x.id,{...x}]));
    for(const x of (p?.events??[]).slice(0,64)){
      const modalityEvidenceKinds={...(x.modalityEvidenceKinds??{})};
      const allEventKinds=Object.values(modalityEvidenceKinds).map(normalizeEvidence);
      const evidenceKind=aggregateEvidence(allEventKinds.length?allEventKinds:[x.evidenceKind]);
      const old=eventRows.get(x.id);
      eventRows.set(x.id,old?{
        ...old,label:norm(x.label),
        confidence01:clamp(old.confidence01*.75+x.confidence01*.25),
        lastAt:Math.max(old.lastAt,x.lastAt),
        persistence01:clamp(old.persistence01*.85+.15),
        evidenceKind,
        modalityEvidenceKinds:{...(old.modalityEvidenceKinds??{}),...modalityEvidenceKinds},
      }:{
        id:x.id,label:norm(x.label),confidence01:clamp(x.confidence01),
        lastAt:x.lastAt,persistence01:clamp(x.persistence01),
        evidenceKind,modalityEvidenceKinds,
      });
    }
    const eventList=[...eventRows.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const eventFacts=eventList.slice(0,64).map(x=>{
      const fresh=x.lastAt<=at&&at-x.lastAt<=5_000;
      const kind=normalizeEvidence(x.evidenceKind);
      return `${fresh?kind:'historical-'+kind}-event:${x.label}`;
    });
    const baseFacts=[...(base?.facts??[]).slice(-96),...relationFacts,...evidenceFacts,...eventFacts];
    const facts=[...new Set(baseFacts.map(norm).filter(Boolean))].slice(-192);
    const semanticConfidence=p?clamp(
      p.metrics.grounding01*.25+
      p.metrics.crossModalEvidenceCoverage01*.20+
      p.metrics.objectPermanence01*.10+
      (1-p.metrics.unresolvedRate01)*.15+
      p.scene.confidence01*.15+
      p.metrics.evidenceTraceability01*.15
    ):.25;
    const freshEvidence=(e?.evidence??[]).filter(x=>Number.isFinite(x.at)&&x.at<=at&&at-x.at<=5_000);
    const observedRatio=freshEvidence.length?clamp(freshEvidence.filter(x=>x.kind==='observed').length/freshEvidence.length):0;
    const confidence=clamp(semanticConfidence*.72+observedRatio*.28);
    const uncertainty=clamp(1-confidence);
    const location=norm(base?.location||p?.scene.label||this.state.location||'unknown');
    const provenance=[`grounded:${at}`,...freshEvidence.slice(0,16).map(x=>x.id)];
    const digest=`${location}|${uncertainty.toFixed(3)}|${entities.slice(0,24).map(x=>`${x.id}:${x.kind}:${x.label}:${x.confidence01.toFixed(2)}`).join('|')}|${relations.slice(0,16).map(x=>x.id).join('|')}|${eventList.slice(0,8).map(x=>x.id).join('|')}`;
    this.state={version:1,revision:this.state.revision+1,lastAt:at,location,uncertainty01:uncertainty,confidence01:confidence,entities,relations,events:eventList,facts,quarantinedFacts:this.state.quarantinedFacts??[],quarantinedOutcomes:this.state.quarantinedOutcomes??[],provenanceIds:[...new Set(provenance)].slice(0,128),lastHash:stableHash(digest)};
    return {
      tick:base?.tick??0,location,energy:base?.energy??.8,attention:base?.attention??.7,
      uncertainty,facts,
      objects:entities.filter(x=>x.kind!=='event'&&x.kind!=='concept').slice(0,64).map(x=>{
        const evidenceKinds=Object.values(x.modalityEvidenceKinds??{}).map(normalizeEvidence);
        const canonicalKind=aggregateEvidence(evidenceKinds);
        return {
          id:x.id,label:x.label,location,
          value:x.valueKnown&&Number.isFinite(x.value)?Number(x.value):0,
          valueKnown:x.valueKnown===true,
          visible:x.presenceStatus==='visible',
          visibilityKnown:x.visibilityKnown===true,
          collected:false,
          collectionKnown:x.collectionKnown===true,
          confidence01:clamp(x.confidence01),
          evidenceKind:canonicalKind,
          ...(x.sourceIds?.[0]?{sourceId:x.sourceIds[0]}:{}),
          ...(x.position&&x.positionFrameId?{
            x:x.position.x,y:x.position.y,z:x.position.z,coordinateFrameId:x.positionFrameId,
          }:{ }),
          ...(x.imageBox?{
            bbox2D:{...x.imageBox},bboxCameraId:x.imageBoxCameraId,bboxAt:x.imageBoxAt,bboxConfidence01:x.imageBoxConfidence01,
          }:{ }),
        };
      }),
      events:eventList.slice(0,32).map(x=>x.label),
    };
  }
  summary(){return {revision:this.state.revision,location:this.state.location,confidence01:this.state.confidence01,uncertainty01:this.state.uncertainty01,entities:this.state.entities.length,relations:this.state.relations.length,events:this.state.events.length,facts:this.state.facts.length,quarantinedFacts:this.state.quarantinedFacts?.length??0,quarantinedOutcomes:this.state.quarantinedOutcomes?.length??0,lastHash:this.state.lastHash,objectPermanence01:clamp(this.state.entities.length?this.state.entities.reduce((s,e)=>s+e.persistence01,0)/this.state.entities.length:0),liveEntities:this.state.entities.filter(e=>e.presenceStatus==='visible').length,fadingEntities:this.state.entities.filter(e=>e.presenceStatus==='fading').length,unknownPresenceEntities:this.state.entities.filter(e=>e.presenceStatus==='unknown').length};}
}
