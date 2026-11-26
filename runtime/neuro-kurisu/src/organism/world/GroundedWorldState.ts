import type { WorldContext } from '../core/types.ts';
import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { PerceptualEvidenceState } from '../body/PerceptualEvidenceCompiler.ts';
import type { EmbodiedActionResult } from '../body/EmbodiedActionExecutor.ts';
import { countOr, isPlainDataArray, isPlainDataRecord, ownDataValue, stringOr, timestampOr, unitOr } from '../body/RestoreSanitizers.ts';
import { isTrustedEmbodiedOutcomeVerification } from '../system/ExternalPostconditionVerifier.ts';
import type { OutcomeVerification } from '../system/OutcomeVerificationService.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const admittedWorldEvidenceKind=(value:unknown):'observed'|'model-output'|'derived'|'conflict'|'unresolved'=>{
  if(value==='model-output'||value==='derived'||value==='conflict'||value==='unresolved')return value;
  // External data/state is not an admission receipt, including during restore.
  return value==='observed'?'derived':'unresolved';
};
const sanitizeWorldModalityEvidence=(value:unknown):Record<string,'observed'|'model-output'|'derived'|'conflict'|'unresolved'>=>{
  if(!isPlainDataRecord(value))return {};
  const out:Record<string,'observed'|'model-output'|'derived'|'conflict'|'unresolved'>={};
  for(const key of Object.keys(value).slice(0,8)){
    out[key.slice(0,32)]=admittedWorldEvidenceKind(ownDataValue(value,key));
  }
  return out;
};
const norm=(x:string)=>String(x??'').trim().toLowerCase().slice(0,120);
// Match P41 cleanTrackId: identity tokens retain case and only normalize Unicode/whitespace.
const cleanIdentity=(value:unknown)=>{
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').trim().slice(0,120);
};
const stableHash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
const normalizeImageBox=(value:unknown)=>{
  if(!isPlainDataRecord(value))return undefined;
  const x=ownDataValue(value,'x'),y=ownDataValue(value,'y'),width=ownDataValue(value,'width'),height=ownDataValue(value,'height');
  if(![x,y,width,height].every(v=>typeof v==='number'&&Number.isFinite(v)))return undefined;
  const nx=Number(x),ny=Number(y),nw=Number(width),nh=Number(height);
  if(nx<0||ny<0||nw<=0||nh<=0||nx+nw>1.000001||ny+nh>1.000001)return undefined;
  return {x:nx,y:ny,width:nw,height:nh};
};
const restoreVector=(value:unknown):{x:number;y:number;z:number}|null=>{
  if(!isPlainDataRecord(value))return null;
  const x=ownDataValue(value,'x'),y=ownDataValue(value,'y'),z=ownDataValue(value,'z');
  if(![x,y,z].every(v=>typeof v==='number'&&Number.isFinite(v)))return null;
  return {x:Number(x),y:Number(y),z:Number(z)};
};
const restoreStringList=(value:unknown,maxItems:number,maxLength:number):string[]=>{
  if(!isPlainDataArray(value,maxItems*4))return [];
  return [...new Set(value
    .filter((item):item is string=>typeof item==='string'&&Boolean(item.trim()))
    .map(item=>item.trim().slice(0,maxLength)))].slice(-maxItems);
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

export class GroundedWorldState {
  private state=defaultGroundedWorldState();

  private refreshHash(){
    const digest=[this.state.location,this.state.revision,this.state.facts.slice(-24).join('|'),this.state.events.slice(0,8).map(row=>row.id).join('|')].join('|');
    this.state.lastHash=stableHash(digest);
  }

  restore(raw?:Partial<GroundedWorldStateSnapshot>|null){
    const d=defaultGroundedWorldState();
    // Treat persisted state as untrusted input. Reject accessors/proxies before
    // reading any property so restore never executes caller-defined code.
    const r=isPlainDataRecord(raw)?raw:{};
    const lastAt=timestampOr(ownDataValue(r,'lastAt'),0);
    const revision=countOr(ownDataValue(r,'revision'),0);

    const rawEntities=ownDataValue(r,'entities');
    const entities:GroundedEntity[]=isPlainDataArray(rawEntities,512)
      ?rawEntities.slice(0,128).flatMap((value,index)=>{
        if(!isPlainDataRecord(value))return [];
        const id=stringOr(ownDataValue(value,'id'),'',180).trim();
        const label=stringOr(ownDataValue(value,'label'),'',180).trim();
        if(!id||!label)return [];
        const entityLastAt=Math.min(timestampOr(ownDataValue(value,'lastSeenAt'),lastAt),lastAt||timestampOr(ownDataValue(value,'lastSeenAt'),0));
        const firstSeenAt=Math.min(timestampOr(ownDataValue(value,'firstSeenAt'),entityLastAt),entityLastAt);
        const positionFrameId=stringOr(ownDataValue(value,'positionFrameId'),'',120).trim();
        const position=positionFrameId?restoreVector(ownDataValue(value,'position')):null;
        const velocity=positionFrameId?restoreVector(ownDataValue(value,'velocity')):null;
        const box=normalizeImageBox(ownDataValue(value,'imageBox'));
        const cameraId=ownDataValue(value,'imageBoxCameraId');
        const imageAt=ownDataValue(value,'imageBoxAt');
        const boxConfidence=ownDataValue(value,'imageBoxConfidence01');
        const validImage=Boolean(
          box&&typeof cameraId==='number'&&Number.isSafeInteger(cameraId)&&cameraId>=0
          &&typeof imageAt==='number'&&Number.isSafeInteger(imageAt)&&imageAt>=0&&imageAt<=lastAt
          &&typeof boxConfidence==='number'&&Number.isFinite(boxConfidence)&&boxConfidence>=.42&&boxConfidence<=1
        );
        const valueRaw=ownDataValue(value,'value');
        const entity:GroundedEntity={
          id,label,kind:stringOr(ownDataValue(value,'kind'),'unknown',48),
          confidence01:unitOr(ownDataValue(value,'confidence01'),0),
          present01:unitOr(ownDataValue(value,'present01'),0),
          firstSeenAt,lastSeenAt:entityLastAt,
          modalities:restoreStringList(ownDataValue(value,'modalities'),8,32),
          trackAliases:restoreStringList(ownDataValue(value,'trackAliases'),16,120),
          sourceIds:restoreStringList(ownDataValue(value,'sourceIds'),16,120),
          modalityEvidenceKinds:sanitizeWorldModalityEvidence(ownDataValue(value,'modalityEvidenceKinds')),
          presenceStatus:(['visible','fading','unknown'] as const).includes(ownDataValue(value,'presenceStatus') as 'visible'|'fading'|'unknown')
            ?ownDataValue(value,'presenceStatus') as 'visible'|'fading'|'unknown':'unknown',
          persistence01:unitOr(ownDataValue(value,'persistence01'),0),
          absenceEvidence01:unitOr(ownDataValue(value,'absenceEvidence01'),0),
          observationCount:Math.max(1,countOr(ownDataValue(value,'observationCount'),1)),
          valueKnown:ownDataValue(value,'valueKnown')===true,
          visibilityKnown:ownDataValue(value,'visibilityKnown')===true,
          collectionKnown:ownDataValue(value,'collectionKnown')===true,
          position,velocity,
          ...(positionFrameId?{positionFrameId}:{}),
          ...(stringOr(ownDataValue(value,'trackId'),'',120).trim()?{trackId:stringOr(ownDataValue(value,'trackId'),'',120).trim()}:{}),
          ...(validImage?{imageBox:box!,imageBoxCameraId:Number(cameraId),imageBoxAt:Number(imageAt),imageBoxConfidence01:Number(boxConfidence)}:{}),
          ...(typeof valueRaw==='number'&&Number.isFinite(valueRaw)?{value:valueRaw}:{}),
        };
        return [entity];
      })
      :[];

    const rawRelations=ownDataValue(r,'relations');
    const relations:GroundedRelation[]=isPlainDataArray(rawRelations,1024)
      ?rawRelations.slice(0,256).flatMap(value=>{
        if(!isPlainDataRecord(value))return [];
        const id=stringOr(ownDataValue(value,'id'),'',180).trim();
        const from=stringOr(ownDataValue(value,'from'),'',180).trim();
        const relation=stringOr(ownDataValue(value,'relation'),'',100).trim();
        const to=stringOr(ownDataValue(value,'to'),'',180).trim();
        if(!id||!from||!relation||!to)return [];
        const fromEntityId=stringOr(ownDataValue(value,'fromEntityId'),'',180).trim();
        const toEntityId=stringOr(ownDataValue(value,'toEntityId'),'',180).trim();
        return [{
          id,from,relation,to,confidence01:unitOr(ownDataValue(value,'confidence01'),0),
          at:Math.min(timestampOr(ownDataValue(value,'at'),lastAt),lastAt),
          ...(fromEntityId?{fromEntityId}:{}),...(toEntityId?{toEntityId}:{}),
        }];
      })
      :[];

    const rawEvents=ownDataValue(r,'events');
    const events:GroundedEvent[]=isPlainDataArray(rawEvents,384)
      ?rawEvents.slice(0,96).flatMap(value=>{
        if(!isPlainDataRecord(value))return [];
        const id=stringOr(ownDataValue(value,'id'),'',180).trim();
        const originalLabel=stringOr(ownDataValue(value,'label'),'',240).trim();
        if(!id||!originalLabel)return [];
        const revoked=originalLabel.startsWith('external-observed:');
        return [{
          id,label:revoked?'external-receipt:'+originalLabel.slice('external-observed:'.length):originalLabel,
          confidence01:revoked?0:unitOr(ownDataValue(value,'confidence01'),0),
          lastAt:Math.min(timestampOr(ownDataValue(value,'lastAt'),lastAt),lastAt),
          persistence01:revoked?0:unitOr(ownDataValue(value,'persistence01'),0),
          evidenceKind:admittedWorldEvidenceKind(ownDataValue(value,'evidenceKind')),
          modalityEvidenceKinds:sanitizeWorldModalityEvidence(ownDataValue(value,'modalityEvidenceKinds')),
        }];
      })
      :[];

    const rawFacts=ownDataValue(r,'facts');
    const facts=isPlainDataArray(rawFacts,1024)
      ?rawFacts.filter((fact):fact is string=>typeof fact==='string'&&Boolean(fact.trim())
        &&!fact.startsWith('external-observed:')&&!fact.startsWith('shadow-divergence:'))
        .slice(-192).map(fact=>fact.trim().slice(0,240))
      :[];
    const rawProvenance=ownDataValue(r,'provenanceIds');
    const provenanceIds=isPlainDataArray(rawProvenance,512)
      ?rawProvenance.filter((id):id is string=>typeof id==='string'&&Boolean(id.trim())
        &&!id.startsWith('external-postcondition:'))
        .slice(0,128).map(id=>id.trim().slice(0,192))
      :[];

    this.state={
      version:1,
      revision,
      lastAt,
      location:stringOr(ownDataValue(r,'location'),d.location,120),
      uncertainty01:unitOr(ownDataValue(r,'uncertainty01'),d.uncertainty01),
      confidence01:unitOr(ownDataValue(r,'confidence01'),d.confidence01),
      entities,relations,events,facts,provenanceIds,lastHash:'',
    };
    // Never trust the persisted digest; derive it from the sanitized state.
    this.refreshHash();
  }

  snapshot(){return structuredClone(this.state);}

  /**
   * Commit a world consequence only when the exact executor result and exact
   * verifier token are still trusted in this process. Numeric flags, labels,
   * copied JSON and persisted receipts cannot authorize canonical world facts.
   */
  integrateExternalOutcome(input:{
    embodiedAction:EmbodiedActionResult;
    postconditionVerification:OutcomeVerification;
    divergence01?:number;
  }){
    // This public boundary may receive caller-controlled JavaScript values.
    // Inspect own data descriptors first; a Proxy/accessor can never become
    // an executable evidence source merely because it resembles a host receipt.
    if(!isPlainDataRecord(input)){
      return {revision:this.state.revision,eventId:'',confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash};
    }
    const rawAction=ownDataValue(input,'embodiedAction');
    const actionResult=isPlainDataRecord(rawAction)?rawAction as unknown as EmbodiedActionResult:null;
    if(!actionResult){
      return {revision:this.state.revision,eventId:'',confidence01:0,verified01:0,independent01:0,lastHash:this.state.lastHash};
    }
    const rawVerification=ownDataValue(input,'postconditionVerification');
    const verification=isPlainDataRecord(rawVerification)?rawVerification as unknown as OutcomeVerification:null;
    const atRaw=actionResult?ownDataValue(actionResult,'at'):undefined;
    const at=typeof atRaw==='number'&&Number.isSafeInteger(atRaw)&&atRaw>=0?atRaw:this.state.lastAt;
    const rawActionName=actionResult?ownDataValue(actionResult,'action'):undefined;
    const action=typeof rawActionName==='string'?rawActionName.trim().slice(0,80)||'unknown':'unknown';
    const rawStatus=actionResult?ownDataValue(actionResult,'status'):undefined;
    const status=typeof rawStatus==='string'?rawStatus.slice(0,32):'unknown';
    const rawRealityClass=actionResult?ownDataValue(actionResult,'realityClass'):undefined;
    const realityClass=typeof rawRealityClass==='string'?rawRealityClass.slice(0,40):'unknown';
    const rawExecutionId=actionResult?ownDataValue(actionResult,'executionId'):undefined;
    const executionId=typeof rawExecutionId==='string'?rawExecutionId.slice(0,100):'unbound';
    const trusted=Boolean(actionResult&&verification&&isTrustedEmbodiedOutcomeVerification(verification,actionResult));
    const verifiedWorldEffect=Boolean(
      trusted&&verification
      &&ownDataValue(verification,'verified')===true
      &&ownDataValue(verification,'externalObservation')===true
      &&ownDataValue(verification,'basis')==='external-postcondition',
    );
    const confidence=verifiedWorldEffect&&verification?clamp(Number(ownDataValue(verification,'confidence01')??0)):0;
    const divergence=clamp(Number(ownDataValue(input,'divergence01')??0));
    // The executor ID is the idempotency key; timestamps are metadata, not identity.
    const eventId='gw-external-'+stableHash(executionId==='unbound'?at+':'+action:executionId);
    const existing=this.state.events.find(row=>row.id===eventId);
    // Replays cannot advance the world revision or re-apply learning evidence.
    // A prior diagnostic receipt may be upgraded once when the exact trusted
    // verifier token subsequently becomes available for the same execution.
    if(existing&&(!verifiedWorldEffect||existing.label.startsWith('external-observed:'))){
      const previouslyVerified=existing.label.startsWith('external-observed:');
      return {
        revision:this.state.revision,eventId,confidence01:existing.confidence01,
        verified01:previouslyVerified?1:0,independent01:previouslyVerified?1:0,lastHash:this.state.lastHash,
      };
    }
    const eventLabel=norm((verifiedWorldEffect?'external-observed':'external-receipt')+':'+action+':'+status+':'+realityClass);
    const observedPostcondition=verification?ownDataValue(verification,'observedPostcondition'):undefined;
    const fact=verifiedWorldEffect?norm('external-observed:'+action+':'+(typeof observedPostcondition==='string'?observedPostcondition:'postcondition')):'';
    const divergenceFact=verifiedWorldEffect?norm('shadow-divergence:'+action+':'+divergence.toFixed(3)):'';
    const events=new Map(this.state.events.map(row=>[row.id,{...row}]));
    events.set(eventId,{
      id:eventId,label:eventLabel,confidence01:confidence,lastAt:at,
      persistence01:verifiedWorldEffect?clamp(.12+.28*confidence):0,
    });
    const facts=[...this.state.facts,fact,divergenceFact].filter(Boolean);
    const provenance=verifiedWorldEffect?['external-postcondition:'+executionId,...this.state.provenanceIds]:[...this.state.provenanceIds];
    const eventRows=[...events.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const nextConfidence=verifiedWorldEffect?clamp(this.state.confidence01*.82+confidence*.18):this.state.confidence01;
    this.state={...this.state,revision:this.state.revision+1,lastAt:Math.max(this.state.lastAt,at),confidence01:nextConfidence,uncertainty01:clamp(1-nextConfidence),events:eventRows,facts:[...new Set(facts)].slice(-192),provenanceIds:[...new Set(provenance)].slice(0,128)};
    this.refreshHash();
    return {revision:this.state.revision,eventId,confidence01:confidence,verified01:verifiedWorldEffect?1:0,independent01:verifiedWorldEffect?1:0,lastHash:this.state.lastHash};
  }

  integrate(input:{at:number;base?:WorldContext|null;perception?:P41PerceptionState|null;evidence?:PerceptualEvidenceState|null;}):WorldContext{
    const at=input.at; const base=input.base; const p=input.perception; const e=input.evidence;
    const rows:GroundedEntity[]=this.state.entities.map(row=>({...row,modalities:[...row.modalities],trackAliases:[...(row.trackAliases??[])],sourceIds:[...(row.sourceIds??[])],modalityEvidenceKinds:{...(row.modalityEvidenceKinds??{})}}));
    const normalizeEvidence=(value:unknown):'observed'|'model-output'|'derived'|'conflict'|'unresolved'=>admittedWorldEvidenceKind(value);
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
