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
  presenceStatus:'visible'|'fading'|'unknown';
  persistence01:number;
  absenceEvidence01:number;
  observationCount:number;
}
export interface GroundedRelation { id:string; from:string; relation:string; to:string; confidence01:number; at:number; }
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
      entities:Array.isArray(r.entities)?r.entities.slice(0,128).map((e:any)=>({...e,presenceStatus:['visible','fading','unknown'].includes(e?.presenceStatus)?e.presenceStatus:'unknown',persistence01:clamp(Number(e?.persistence01??0)),absenceEvidence01:clamp(Number(e?.absenceEvidence01??0)),observationCount:Math.max(1,Math.floor(Number(e?.observationCount??1)))})):[],
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
    const at=input.at; const base=input.base;
    const p=input.perception; const e=input.evidence;
    const byLabel=new Map<string,GroundedEntity>();
    for(const row of this.state.entities) byLabel.set(`${row.kind}|${row.label}`,{...row,modalities:[...row.modalities]});
    for(const o of (base?.objects??[])){
      const key=`object|${norm(o.label)}`; const old=byLabel.get(key);
      byLabel.set(key,old?{...old,lastSeenAt:at,present01:clamp(old.present01*.82+.18),confidence01:clamp(old.confidence01*.86+(o.visible?.72:.42)*.14),modalities:[...new Set([...old.modalities,'world'])],presenceStatus:o.visible?'visible':'fading',persistence01:clamp((old.persistence01??0)*.88+Math.min(1,(old.observationCount??1)/12)*.12),absenceEvidence01:o.visible?clamp((old.absenceEvidence01??0)*.8):clamp(Math.max(old.absenceEvidence01??0,.08)),observationCount:(old.observationCount??1)+1}:{id:`gw-${stableHash(key)}`,label:norm(o.label),kind:'object',confidence01:o.visible?.72:.42,present01:o.visible?1:.35,firstSeenAt:at,lastSeenAt:at,modalities:['world'],presenceStatus:o.visible?'visible':'unknown',persistence01:.12,absenceEvidence01:o.visible?0:.12,observationCount:1});
    }
    for(const x of (p?.entities??[]).filter(x=>x.present01>.2).slice(0,96)){
      const key=`${x.kind}|${norm(x.label)}`; const old=byLabel.get(key);
      byLabel.set(key,old?{...old,lastSeenAt:Math.max(old.lastSeenAt,x.lastSeenAt),present01:clamp(old.present01*.7+x.present01*.3),confidence01:clamp(old.confidence01*.7+x.confidence01*.3),modalities:[...new Set([...old.modalities,...x.modalities])],presenceStatus:x.present01>.52?'visible':'fading',persistence01:clamp((old.persistence01??0)*.9+Math.min(1,(old.observationCount??1)/12)*.1),absenceEvidence01:clamp((old.absenceEvidence01??0)*.85),observationCount:(old.observationCount??1)+1}:{id:x.id,label:norm(x.label),kind:x.kind,confidence01:clamp(x.confidence01),present01:clamp(x.present01),firstSeenAt:x.firstSeenAt,lastSeenAt:x.lastSeenAt,modalities:[...x.modalities],presenceStatus:'visible',persistence01:.12,absenceEvidence01:0,observationCount:1});
    }
    const rel=new Map(this.state.relations.map(x=>[x.id,{...x}]));
    const perceptionRelations=new Map((p?.relations??[]).map(r=>[r.id,r]));
    for(const r of (p?.relations??[]).slice(0,128)) rel.set(r.id,{id:r.id,from:norm(r.from),relation:norm(r.relation),to:norm(r.to),confidence01:clamp(r.confidence01),at:r.at});
    const events=new Map(this.state.events.map(x=>[x.id,{...x}]));
    for(const x of (p?.events??[]).slice(0,64)){const old=events.get(x.id);events.set(x.id,old?{...old,label:norm(x.label),confidence01:clamp(old.confidence01*.75+x.confidence01*.25),lastAt:x.lastAt,persistence01:clamp(old.persistence01*.85+.15)}:{id:x.id,label:norm(x.label),confidence01:clamp(x.confidence01),lastAt:x.lastAt,persistence01:clamp(x.persistence01)});}
    const relationFacts=[...rel.values()].slice(0,128).map(x=>{const src=perceptionRelations.get(x.id);return `${src?.evidenceKind==='observed'?'observed-relation':'hypothesis-relation'}:${x.from}:${x.relation}:${x.to}`;});
    const evidenceFacts=(e?.evidence??[]).slice(0,64).filter(x=>x.confidence01>=.62).map(x=>`${x.kind==='observed'?'observed-evidence':'hypothesis-evidence'}:${x.claim}`);
    const baseFacts=[...(base?.facts??[]).slice(-96),...relationFacts,...evidenceFacts];
    const facts=[...new Set(baseFacts.map(norm).filter(Boolean))].slice(-192);
    const perceptionEntities=new Map((p?.entities??[]).map(x=>[x.id,x]));
    for(const entity of byLabel.values()){const age=Math.max(0,at-entity.lastSeenAt);if(age>90000){entity.presenceStatus=entity.present01>.18?'fading':'unknown';entity.absenceEvidence01=clamp(Math.max(entity.absenceEvidence01,(1-entity.present01)*.12));}entity.persistence01=clamp((entity.persistence01??0)*.99+Math.min(1,(entity.observationCount??1)/12)*.01);}
    const entities=[...byLabel.values()].sort((a,b)=>b.confidence01-a.confidence01||b.lastSeenAt-a.lastSeenAt).slice(0,128);
    const relations=[...rel.values()].sort((a,b)=>b.confidence01-a.confidence01||b.at-a.at).slice(0,256);
    const eventRows=[...events.values()].sort((a,b)=>b.lastAt-a.lastAt).slice(0,96);
    const semanticConfidence=p?clamp((p.metrics.grounding01*.3+p.metrics.crossModalAgreement01*.25+p.metrics.objectPermanence01*.15+(1-p.metrics.unresolvedRate01)*.15+p.scene.confidence01*.15)):.35;
    const observedRatio=e?.evidence.length?clamp(e.evidence.filter(x=>x.kind==='observed').length/e.evidence.length):0;
    const confidence=clamp(semanticConfidence*.72+observedRatio*.28);
    const uncertainty=clamp(1-confidence);
    const location=norm(base?.location||p?.scene.label||this.state.location||'unknown');
    const provenance=[`grounded:${at}`,...(e?.evidence??[]).slice(0,16).map(x=>x.id)];
    this.state={version:1,revision:this.state.revision+1,lastAt:at,location,uncertainty01:uncertainty,confidence01:confidence,entities,relations,events:eventRows,facts,provenanceIds:[...new Set(provenance)].slice(0,128),lastHash:''};
    const digest=`${location}|${uncertainty.toFixed(3)}|${entities.slice(0,24).map(x=>`${x.kind}:${x.label}:${x.confidence01.toFixed(2)}`).join('|')}|${relations.slice(0,16).map(x=>`${x.from}:${x.relation}:${x.to}`).join('|')}|${eventRows.slice(0,8).map(x=>x.label).join('|')}`;
    this.state.lastHash=stableHash(digest);
    return {
      tick:base?.tick??0,location,energy:base?.energy??.8,attention:base?.attention??.7,
      uncertainty, facts, objects:entities.filter(x=>x.kind!=='event'&&x.kind!=='concept').slice(0,64).map(x=>({id:x.id,label:x.label,location,value:clamp(x.confidence01),visible:x.presenceStatus==='visible',collected:false,confidence01:clamp(x.confidence01),evidenceKind:(perceptionEntities.get(x.id)?.modalities.includes('sensor')?'observed':'model-output'),sourceId:x.id})),
      events:eventRows.slice(0,32).map(x=>x.label),
    };
  }
  summary(){return {revision:this.state.revision,location:this.state.location,confidence01:this.state.confidence01,uncertainty01:this.state.uncertainty01,entities:this.state.entities.length,relations:this.state.relations.length,events:this.state.events.length,facts:this.state.facts.length,lastHash:this.state.lastHash,objectPermanence01:clamp(this.state.entities.length?this.state.entities.reduce((s,e)=>s+e.persistence01,0)/this.state.entities.length:0),liveEntities:this.state.entities.filter(e=>e.presenceStatus==='visible').length,fadingEntities:this.state.entities.filter(e=>e.presenceStatus==='fading').length,unknownPresenceEntities:this.state.entities.filter(e=>e.presenceStatus==='unknown').length};}
}
