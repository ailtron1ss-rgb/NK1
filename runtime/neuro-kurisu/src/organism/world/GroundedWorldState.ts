import type { WorldContext } from '../core/types.ts';
import type { P41PerceptionState } from '../cognition/P41SemanticPerception.ts';
import type { PerceptualEvidenceState } from '../body/PerceptualEvidenceCompiler.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const norm=(x:string)=>String(x??'').trim().toLowerCase().slice(0,120);
const stableHash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

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
export interface GroundedEvent { id:string; label:string; confidence01:number; lastAt:number; persistence01:number; }
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
  restore(raw?:Partial<GroundedWorldStateSnapshot>|null){
    const d=defaultGroundedWorldState(); const r=raw??{};
    this.state={...d,...r,
      entities:Array.isArray(r.entities)?r.entities.slice(0,128).map((e:any)=>({
        ...e,
        modalities:Array.isArray(e?.modalities)?[...new Set(e.modalities.filter((x:any)=>typeof x==='string'))]:[],
        trackAliases:Array.isArray(e?.trackAliases)?[...new Set(e.trackAliases.filter((x:any)=>typeof x==='string'))].slice(-16):[],
        sourceIds:Array.isArray(e?.sourceIds)?[...new Set(e.sourceIds.filter((x:any)=>typeof x==='string'))].slice(-16):[],
        modalityEvidenceKinds:e?.modalityEvidenceKinds&&typeof e.modalityEvidenceKinds==='object'?{...e.modalityEvidenceKinds}:{},
        presenceStatus:['visible','fading','unknown'].includes(e?.presenceStatus)?e.presenceStatus:'unknown',
        persistence01:clamp(Number(e?.persistence01??0)),
        absenceEvidence01:clamp(Number(e?.absenceEvidence01??0)),
        observationCount:Math.max(1,Math.floor(Number(e?.observationCount??1))),
        valueKnown:e?.valueKnown===true,
        visibilityKnown:e?.visibilityKnown===true,
        collectionKnown:e?.collectionKnown===true,
      })):[],
      relations:Array.isArray(r.relations)?r.relations.slice(0,256):[],
      events:Array.isArray(r.events)?r.events.slice(0,96):[],
      facts:Array.isArray(r.facts)?r.facts.slice(0,192):[],
      provenanceIds:Array.isArray(r.provenanceIds)?r.provenanceIds.slice(0,128):[],
    };
  }
  snapshot(){return structuredClone(this.state);}

  /** P2841: commit only externally evidenced consequences into the canonical grounded world. */
  integrateExternalOutcome(input:{
    at:number; action:string; status:string; proofClass:string; verified01:number; independent01:number;
    evidence01:number; consequence01:number; claim:string; provenanceId:string; divergence01:number;
  }){
    const at=input.at;
    const evidence=clamp(input.evidence01);
    const verified=clamp(input.verified01);
    const independent=clamp(input.independent01);
    const confidence=clamp(.48*evidence+.30*verified+.22*independent);
    const eventId=`gw-external-${stableHash(`${at}:${input.action}:${input.provenanceId}`)}`;
    const eventLabel=norm(`external:${input.action}:${input.status}:${input.proofClass}`);
    const fact=norm(`external-observed:${input.action}:${input.claim}`);
    const divergenceFact=norm(`shadow-divergence:${input.action}:${input.divergence01.toFixed(3)}`);
    const events=new Map(this.state.events.map(x=>[x.id,{...x}]));
    events.set(eventId,{
      id:eventId,label:eventLabel,confidence01:confidence,lastAt:at,
      persistence01:clamp(.12+.28*confidence+.18*input.consequence01),
    });
    const facts=[...this.state.facts,fact,divergenceFact].filter(Boolean);
    const provenance=[input.provenanceId,...this.state.provenanceIds].filter(Boolean);
    const eventRows=[...events.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const nextConfidence=clamp(this.state.confidence01*.82+confidence*.18);
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
      old.observationCount=Math.max(1,old.observationCount)+Math.max(1,incoming.observationCount);
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
      const sourceId=norm(o.sourceId||'world-context');
      const objectId=norm(o.id);
      const trackId=objectId?('world:'+sourceId+':'+objectId):undefined;
      const evidenceKind=normalizeEvidence(o.evidenceKind);
      const visibleKnown=o.visibilityKnown===true||typeof o.visible==='boolean';
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
        modalityEvidenceKinds:evidenceKinds,
        sourceIds:[...new Set(x.modalities)],
        visibilityKnown:true,
        presenceStatus:x.present01>.52?'visible':'fading',
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
      return `${kind}-relation:${x.from}:${x.relation}:${x.to}`;
    });
    const evidenceFacts=(e?.evidence??[]).slice(0,64).map(x=>{
      const kind=normalizeEvidence(x.kind);
      return `${kind}-evidence:${x.claim}`;
    });
    const baseFacts=[...(base?.facts??[]).slice(-96),...relationFacts,...evidenceFacts];
    const facts=[...new Set(baseFacts.map(norm).filter(Boolean))].slice(-192);

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
      const old=eventRows.get(x.id);
      eventRows.set(x.id,old?{...old,label:norm(x.label),confidence01:clamp(old.confidence01*.75+x.confidence01*.25),lastAt:x.lastAt,persistence01:clamp(old.persistence01*.85+.15)}:{id:x.id,label:norm(x.label),confidence01:clamp(x.confidence01),lastAt:x.lastAt,persistence01:clamp(x.persistence01)});
    }
    const eventList=[...eventRows.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const semanticConfidence=p?clamp(
      p.metrics.grounding01*.25+
      p.metrics.crossModalEvidenceCoverage01*.20+
      p.metrics.objectPermanence01*.10+
      (1-p.metrics.unresolvedRate01)*.15+
      p.scene.confidence01*.15+
      p.metrics.evidenceTraceability01*.15
    ):.25;
    const observedRatio=e?.evidence.length?clamp(e.evidence.filter(x=>x.kind==='observed').length/e.evidence.length):0;
    const confidence=clamp(semanticConfidence*.72+observedRatio*.28);
    const uncertainty=clamp(1-confidence);
    const location=norm(base?.location||p?.scene.label||this.state.location||'unknown');
    const provenance=[`grounded:${at}`,...(e?.evidence??[]).slice(0,16).map(x=>x.id)];
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
        };
      }),
      events:eventList.slice(0,32).map(x=>x.label),
    };
  }
  summary(){return {revision:this.state.revision,location:this.state.location,confidence01:this.state.confidence01,uncertainty01:this.state.uncertainty01,entities:this.state.entities.length,relations:this.state.relations.length,events:this.state.events.length,facts:this.state.facts.length,lastHash:this.state.lastHash,objectPermanence01:clamp(this.state.entities.length?this.state.entities.reduce((s,e)=>s+e.persistence01,0)/this.state.entities.length:0),liveEntities:this.state.entities.filter(e=>e.presenceStatus==='visible').length,fadingEntities:this.state.entities.filter(e=>e.presenceStatus==='fading').length,unknownPresenceEntities:this.state.entities.filter(e=>e.presenceStatus==='unknown').length};}
}
