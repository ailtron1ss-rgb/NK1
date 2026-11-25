import type { WorldContext } from '../core/types.ts';
import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { PerceptualEvidenceState } from '../body/PerceptualEvidenceCompiler.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
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
const safeUnit=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)?clamp(value):fallback;
const safeInteger=(value:unknown,fallback=0,max=1_000_000):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,max):fallback;
const safeTimestamp=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:fallback;
const safeText=(value:unknown,max=180,fallback=''):string=>{
  if(typeof value!=='string')return fallback;
  const normalized=value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim();
  return normalized&&normalized.length<=max?normalized:fallback;
};
const safeStrings=(value:unknown,maxItems:number,maxLength:number):string[]=>{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter((item):item is string=>typeof item==='string')
    .map(item=>safeText(item,maxLength)).filter(Boolean))].slice(0,maxItems);
};
const safeVec3=(value:unknown):{x:number;y:number;z:number}|null=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(![v.x,v.y,v.z].every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1_000_000))return null;
  return {x:Number(v.x),y:Number(v.y),z:Number(v.z)};
};
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
  provenanceIds:string[];
  lastHash:string;
}
export const defaultGroundedWorldState=():GroundedWorldStateSnapshot=>({version:1,revision:0,lastAt:0,location:'unknown',uncertainty01:.5,confidence01:0,entities:[],relations:[],events:[],facts:[],provenanceIds:[],lastHash:''});

export interface ExternalWorldOutcomeInput {
  at:number; action:string; status:string; proofClass:string; verified01:number; independent01:number;
  evidence01:number; consequence01:number; claim:string; provenanceId:string; divergence01:number;
}
export type ExternalWorldOutcomeVerifier=(input:Readonly<ExternalWorldOutcomeInput>)=>boolean;
export interface GroundedWorldStateOptions {
  /** Injected by trusted runtime composition; never supplied as per-event caller metadata. */
  verifyExternalOutcome?:ExternalWorldOutcomeVerifier;
}

export class GroundedWorldState {
  private state=defaultGroundedWorldState();
  private readonly verifyExternalOutcome?:ExternalWorldOutcomeVerifier;
  constructor(options:GroundedWorldStateOptions={}){
    this.verifyExternalOutcome=typeof options.verifyExternalOutcome==='function'?options.verifyExternalOutcome:undefined;
  }
  restore(raw?:Partial<GroundedWorldStateSnapshot>|null){
    const d=defaultGroundedWorldState();
    const r=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as Partial<GroundedWorldStateSnapshot> & Record<string,unknown>;
    const lastAt=safeTimestamp(r.lastAt,0);
    const entities=Array.isArray(r.entities)?r.entities.slice(0,128).flatMap((value:any)=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return [];
      const id=safeText(value.id,180);
      const label=safeText(value.label,180);
      const kind=safeText(value.kind,60,'unknown');
      if(!id||!label)return [];
      const firstSeenAt=safeTimestamp(value.firstSeenAt,0);
      const lastSeenAt=Math.max(firstSeenAt,safeTimestamp(value.lastSeenAt,firstSeenAt));
      const modalities=safeStrings(value.modalities,8,24).filter(x=>['text','vision','audio','sensor','world'].includes(x));
      const trackId=safeText(value.trackId,120);
      const trackAliases=safeStrings(value.trackAliases,16,120);
      const sourceIds=safeStrings(value.sourceIds,16,120);
      const position=safeVec3(value.position);
      const velocity=safeVec3(value.velocity);
      const imageBox=normalizeImageBox(value.imageBox);
      const imageBoxCameraId=Number.isSafeInteger(value.imageBoxCameraId)&&Number(value.imageBoxCameraId)>=0?Number(value.imageBoxCameraId):undefined;
      const imageBoxAt=safeTimestamp(value.imageBoxAt,-1);
      const imageBoxConfidence01=typeof value.imageBoxConfidence01==='number'&&Number.isFinite(value.imageBoxConfidence01)&&value.imageBoxConfidence01>=.42&&value.imageBoxConfidence01<=1?value.imageBoxConfidence01:undefined;
      const validImageEvidence=Boolean(imageBox&&imageBoxCameraId!==undefined&&imageBoxAt>=0&&imageBoxAt<=lastSeenAt&&imageBoxConfidence01!==undefined);
      const valueKnown=value.valueKnown===true&&typeof value.value==='number'&&Number.isFinite(value.value);
      const positionFrameId=safeText(value.positionFrameId,120);
      return [{
        id,label,kind,
        confidence01:safeUnit(value.confidence01,0),
        present01:safeUnit(value.present01,0),
        firstSeenAt,lastSeenAt,
        modalities,
        ...(trackId?{trackId}:{}),
        trackAliases,
        ...(positionFrameId?{positionFrameId}:{}),
        position,velocity,
        ...(validImageEvidence?{imageBox,imageBoxCameraId,imageBoxAt,imageBoxConfidence01}:{}),
        modalityEvidenceKinds:restoredModalityEvidence(value.modalityEvidenceKinds),
        sourceIds,
        ...(typeof value.value==='number'&&Number.isFinite(value.value)?{value:value.value}:{}),
        valueKnown,
        visibilityKnown:value.visibilityKnown===true,
        collectionKnown:value.collectionKnown===true,
        presenceStatus:['visible','fading','unknown'].includes(value.presenceStatus)?value.presenceStatus:'unknown',
        persistence01:safeUnit(value.persistence01,0),
        absenceEvidence01:safeUnit(value.absenceEvidence01,0),
        observationCount:Math.max(1,safeInteger(value.observationCount,1)),
      } satisfies GroundedEntity];
    }):[];
    const relations=Array.isArray(r.relations)?r.relations.slice(0,256).flatMap((value:any)=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return [];
      const id=safeText(value.id,180),from=safeText(value.from,120),relation=safeText(value.relation,120),to=safeText(value.to,120);
      if(!id||!from||!relation||!to)return [];
      const fromEntityId=safeText(value.fromEntityId,180),toEntityId=safeText(value.toEntityId,180);
      return [{
        id,from,relation,to,
        ...(fromEntityId?{fromEntityId}:{}),...(toEntityId?{toEntityId}:{}),
        confidence01:safeUnit(value.confidence01,0),
        at:safeTimestamp(value.at,0),
      } satisfies GroundedRelation];
    }):[];
    const events=Array.isArray(r.events)?r.events.slice(0,96).flatMap((value:any)=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return [];
      const id=safeText(value.id,180),label=safeText(value.label,180);
      if(!id||!label)return [];
      return [{
        id,label,
        confidence01:safeUnit(value.confidence01,0),
        lastAt:safeTimestamp(value.lastAt,0),
        persistence01:safeUnit(value.persistence01,0),
        evidenceKind:restoredEvidenceKind(value.evidenceKind),
        modalityEvidenceKinds:restoredModalityEvidence(value.modalityEvidenceKinds),
      } satisfies GroundedEvent];
    }):[];
    const facts=safeStrings(r.facts,192,512);
    const provenanceIds=safeStrings(r.provenanceIds,128,180);
    this.state={
      version:1,
      revision:safeInteger(r.revision,0,Number.MAX_SAFE_INTEGER),
      lastAt,
      location:safeText(r.location,256,'unknown'),
      uncertainty01:safeUnit(r.uncertainty01,.5),
      confidence01:safeUnit(r.confidence01,0),
      entities,relations,events,facts,provenanceIds,lastHash:'',
    };
    // Never trust a checkpoint-supplied digest. Recompute over the sanitized state.
    this.state.lastHash=stableHash(JSON.stringify({...this.state,lastHash:''}));
  }
  snapshot(){return structuredClone(this.state);}

  /** P2841: commit only externally evidenced consequences into the canonical grounded world. */
  integrateExternalOutcome(input:ExternalWorldOutcomeInput){
    const row=input&&typeof input==='object'?input as Record<string,unknown>:{};
    const at=safeTimestamp(row.at,Date.now());
    const action=safeText(row.action,128,'unknown-action');
    const status=safeText(row.status,48,'unknown');
    const proofClass=safeText(row.proofClass,64,'unverified');
    const claim=safeText(row.claim,180,'');
    const provenanceId=safeText(row.provenanceId,180,'missing-provenance');
    const eventId=`gw-external-${stableHash(provenanceId)}`;
    // Provenance IDs are one-use receipts. A repeated ID cannot reapply a consequence,
    // even when a caller changes the timestamp/action/claim on replay.
    if(this.state.provenanceIds.includes(provenanceId)){
      const prior=this.state.events.find(event=>event.id===eventId);
      const previouslyVerified=Boolean(prior?.label.startsWith('external-observed:'));
      return {
        revision:this.state.revision,eventId,
        confidence01:prior?.confidence01??0,
        verified01:previouslyVerified?1:0,
        independent01:previouslyVerified?1:0,
        lastHash:this.state.lastHash,
      };
    }
    const evidence01=safeUnit(row.evidence01,0);
    const requestedVerified01=safeUnit(row.verified01,0);
    const requestedIndependent01=safeUnit(row.independent01,0);
    const consequence01=safeUnit(row.consequence01,0);
    const divergence01=safeUnit(row.divergence01,0);
    const verifierInput=Object.freeze({
      at,action,status,proofClass,
      verified01:requestedVerified01,independent01:requestedIndependent01,
      evidence01,consequence01,claim,provenanceId,divergence01,
    }) satisfies Readonly<ExternalWorldOutcomeInput>;
    let hostVerified=false;
    try { hostVerified=this.verifyExternalOutcome?.(verifierInput)===true; }
    catch { hostVerified=false; }
    // Caller-provided labels and scalar scores are not credentials. Without the
    // constructor-injected host verifier, treat the event as an audit-only receipt.
    const verifiedWorldEffect=hostVerified&&proofClass==='independent-observation'
      &&requestedVerified01>=.8&&requestedIndependent01>=.8;
    const verified=verifiedWorldEffect?requestedVerified01:0;
    const independent=verifiedWorldEffect?requestedIndependent01:0;
    const confidence=verifiedWorldEffect?clamp(.48*evidence01+.30*verified+.22*independent):0;
    const eventLabel=norm(`${verifiedWorldEffect?'external-observed':'external-receipt'}:${action}:${status}:${proofClass}`);
    const fact=verifiedWorldEffect?norm(`external-observed:${action}:${claim}`):'';
    const divergenceFact=verifiedWorldEffect?norm(`shadow-divergence:${action}:${divergence01.toFixed(3)}`):'';
    const events=new Map(this.state.events.map(x=>[x.id,{...x}]));
    events.set(eventId,{
      id:eventId,label:eventLabel,confidence01:confidence,lastAt:at,
      persistence01:verifiedWorldEffect?clamp(.12+.28*confidence+.18*consequence01):0,
    });
    const facts=[...this.state.facts,fact,divergenceFact].filter(Boolean);
    const provenance=[provenanceId,...this.state.provenanceIds].filter(Boolean);
    const eventRows=[...events.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const nextConfidence=verifiedWorldEffect?clamp(this.state.confidence01*.82+confidence*.18):this.state.confidence01;
    this.state={...this.state,revision:this.state.revision+1,lastAt:at,confidence01:nextConfidence,uncertainty01:clamp(1-nextConfidence),events:eventRows,facts:[...new Set(facts)].slice(-192),provenanceIds:[...new Set(provenance)].slice(0,128)};
    const digest=`${this.state.location}|${this.state.revision}|${this.state.facts.slice(-24).join('|')}|${this.state.events.slice(0,8).map(x=>x.id).join('|')}`;
    this.state.lastHash=stableHash(digest);
    return {revision:this.state.revision,eventId,confidence01:confidence,verified01:verified,independent01:independent,lastHash:this.state.lastHash};
  }

  integrate(input:{at:number;base?:WorldContext|null;perception?:P41PerceptionState|null;evidence?:PerceptualEvidenceState|null;}):WorldContext{
    const at=input.at; const base=input.base; const p=input.perception; const e=input.evidence;
    const rows:GroundedEntity[]=this.state.entities.map(row=>({...row,modalities:[...row.modalities],trackAliases:[...(row.trackAliases??[])],sourceIds:[...(row.sourceIds??[])],modalityEvidenceKinds:{...(row.modalityEvidenceKinds??{})}}));
    const normalizeEvidence=(value:unknown):'observed'|'model-output'|'derived'|'conflict'|'unresolved'=>{
      return value==='observed'||value==='model-output'||value==='derived'||value==='conflict'||value==='unresolved'?value:'unresolved';
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
      const sourceId=cleanIdentity(o.sourceId)||'world-context';
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
        sourceIds:sourceId?[sourceId]:[],
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
      const evidenceKind: 'observed'|'model-output'|'derived'|'conflict'|'unresolved'=allKinds.includes('conflict')?'conflict':allKinds.includes('observed')?'observed':allKinds.includes('model-output')?'model-output':allKinds.includes('derived')?'derived':'unresolved';
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
        sourceIds:[...new Set(x.modalities)],
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
      const evidenceKind: 'observed'|'model-output'|'derived'|'conflict'|'unresolved'=allEventKinds.includes('conflict')?'conflict':allEventKinds.includes('observed')?'observed':allEventKinds.includes('model-output')?'model-output':allEventKinds.includes('derived')?'derived':normalizeEvidence(x.evidenceKind);
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
    this.state={version:1,revision:this.state.revision+1,lastAt:at,location,uncertainty01:uncertainty,confidence01:confidence,entities,relations,events:eventList,facts,provenanceIds:[...new Set(provenance)].slice(0,128),lastHash:stableHash(digest)};
    return {
      tick:base?.tick??0,location,energy:base?.energy??.8,attention:base?.attention??.7,
      uncertainty,facts,
      objects:entities.filter(x=>x.kind!=='event'&&x.kind!=='concept').slice(0,64).map(x=>{
        const evidenceKinds=Object.values(x.modalityEvidenceKinds??{}).map(normalizeEvidence);
        const canonicalKind: 'observed'|'model-output'|'derived'|'conflict'|'unresolved'=evidenceKinds.includes('conflict')?'conflict':evidenceKinds.includes('observed')?'observed':evidenceKinds.includes('model-output')?'model-output':evidenceKinds.includes('derived')?'derived':'unresolved';
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
          sourceId:x.sourceIds?.[0]??x.id,
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
  summary(){return {revision:this.state.revision,location:this.state.location,confidence01:this.state.confidence01,uncertainty01:this.state.uncertainty01,entities:this.state.entities.length,relations:this.state.relations.length,events:this.state.events.length,facts:this.state.facts.length,lastHash:this.state.lastHash,objectPermanence01:clamp(this.state.entities.length?this.state.entities.reduce((s,e)=>s+e.persistence01,0)/this.state.entities.length:0),liveEntities:this.state.entities.filter(e=>e.presenceStatus==='visible').length,fadingEntities:this.state.entities.filter(e=>e.presenceStatus==='fading').length,unknownPresenceEntities:this.state.entities.filter(e=>e.presenceStatus==='unknown').length};}
}
