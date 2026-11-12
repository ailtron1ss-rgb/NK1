import { createHash } from 'node:crypto';

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const now = () => Date.now();

export type P35Modality = 'text'|'vision'|'audio'|'sensor'|'world';
export type P35EntityKind = 'person'|'object'|'place'|'event'|'concept'|'body-part'|'unknown';
export type P35Relation = 'near'|'inside'|'supports'|'causes'|'observes'|'owns'|'part-of'|'before'|'after'|'conflicts-with'|'associated-with';

export interface P35Entity {
  id:string;
  label:string;
  kind:P35EntityKind;
  confidence01:number;
  salience01:number;
  modality:P35Modality;
  firstSeenAt:number;
  lastSeenAt:number;
  mentionCount:number;
  position:{x:number;y:number;z:number}|null;
}

export interface P35RelationRecord {
  id:string;
  from:string;
  relation:P35Relation;
  to:string;
  confidence01:number;
  source:P35Modality;
  at:number;
}

export interface P35PerceptionClaim {
  id:string;
  modality:P35Modality;
  claim:string;
  confidence01:number;
  evidenceIds:string[];
  semanticSource:'structured-hint'|'local-heuristic'|'world-context';
  at:number;
}

export interface P35SpatialSelfModel {
  frameId:string;
  location:string;
  x:number;
  y:number;
  z:number;
  orientationDeg:number;
  confidence01:number;
  lastAt:number;
}

export interface P35SemanticWorldBodyState {
  version:1;
  tick:number;
  entities:P35Entity[];
  relations:P35RelationRecord[];
  claims:P35PerceptionClaim[];
  scene:{label:string;confidence01:number;salience01:number;at:number};
  modalityReliability:Record<P35Modality,number>;
  spatialSelf:P35SpatialSelfModel;
  body:{energy01:number;thermal01:number;capacity01:number;awake:boolean;sensoryFreshness01:number;lastAt:number};
  affordances:Record<string,number>;
  conflicts:number;
  semanticUpdates:number;
  lastWorldHash:string;
  metrics:{sceneConfidence01:number;crossModalAgreement01:number;semanticCoverage01:number;spatialSelfConfidence01:number;bodyWorldCoherence01:number};
}

export interface P35SemanticInput {
  text?:string;
  vision?:{sceneLabel?:string;confidence01?:number;objects?:Array<{label:string;kind?:P35EntityKind;confidence01?:number;x?:number;y?:number;z?:number}>;relations?:Array<{from:string;relation:P35Relation;to:string;confidence01?:number}>};
  audio?:{events?:Array<{label:string;confidence01?:number}>};
  worldContext?:{location?:string;objects?:Array<{id:string;label:string;location:string;value:number;visible:boolean;collected:boolean}>;events?:string[]};
  body?:{location?:string;orientationDeg?:number;motion01?:number;proximity01?:number;ambientLight01?:number;energy01?:number;thermal01?:number;capacity01?:number;awake?:boolean;sensoryFreshness01?:number};
  at?:number;
}

export function defaultP35SemanticWorldBody():P35SemanticWorldBodyState {
  return {
    version:1,tick:0,entities:[],relations:[],claims:[],
    scene:{label:'unknown',confidence01:0.15,salience01:0.1,at:0},
    modalityReliability:{text:.55,vision:.35,audio:.28,sensor:.5,world:.62},
    spatialSelf:{frameId:'host-local',location:'unknown',x:0,y:0,z:0,orientationDeg:0,confidence01:.2,lastAt:0},
    body:{energy01:.78,thermal01:.12,capacity01:.84,awake:true,sensoryFreshness01:1,lastAt:0},
    affordances:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},
    conflicts:0,semanticUpdates:0,lastWorldHash:'',
    metrics:{sceneConfidence01:.15,crossModalAgreement01:.5,semanticCoverage01:0.08,spatialSelfConfidence01:.2,bodyWorldCoherence01:.35},
  };
}

function stableId(prefix:string, seed:string):string {
  const digest=createHash('sha256').update(seed).digest('hex').slice(0,14);
  return `${prefix}-${digest}`;
}

export class P35SemanticWorldBodyEngine {
  private state = defaultP35SemanticWorldBody();

  restore(value?:P35SemanticWorldBodyState|null):void {
    const d=defaultP35SemanticWorldBody();
    this.state={...d,...(value??{}),
      entities:Array.isArray(value?.entities)?value!.entities.slice(-160):[],
      relations:Array.isArray(value?.relations)?value!.relations.slice(-320):[],
      claims:Array.isArray(value?.claims)?value!.claims.slice(-256):[],
      modalityReliability:{...d.modalityReliability,...(value?.modalityReliability??{})},
      spatialSelf:{...d.spatialSelf,...(value?.spatialSelf??{})},
      body:{...d.body,...(value?.body??{})},
      affordances:{...d.affordances,...(value?.affordances??{})},
      scene:{...d.scene,...(value?.scene??{})},
      metrics:{...d.metrics,...(value?.metrics??{})},
    };
  }

  snapshot():P35SemanticWorldBodyState { return structuredClone(this.state); }

  ingest(input:P35SemanticInput):P35SemanticWorldBodyState {
    const at=input.at??now();
    if (input.text?.trim()) this.ingestText(input.text,at);
    if (input.vision) this.ingestVision(input.vision,at);
    if (input.audio) this.ingestAudio(input.audio,at);
    if (input.worldContext) this.ingestWorld(input.worldContext,at);
    if (input.body) this.ingestBody(input.body,at);
    this.reconcile(at);
    this.state.tick += 1;
    return this.snapshot();
  }

  ingestText(text:string, at=now()):void {
    const clean=String(text).trim().slice(0,800); if(!clean) return;
    const phrases = [...new Set(clean.toLowerCase().split(/[^a-zа-яё0-9_-]+/i).filter(Boolean))].slice(0,8);
    for (const label of phrases) {
      if (label.length < 4) continue;
      this.upsertEntity(label,label.includes('курис')?'person':'concept',.42,.28,'text',at,null);
      this.state.claims.unshift({id:stableId('claim',`text:${clean}:${label}`),modality:'text',claim:`text-mentioned:${label}`,confidence01:.42,evidenceIds:[],semanticSource:'local-heuristic',at});
    }
    this.state.claims=this.state.claims.slice(0,256);
    this.state.modalityReliability.text=clamp(this.state.modalityReliability.text*.94+.06);
    this.state.semanticUpdates++;
  }

  ingestVision(input:NonNullable<P35SemanticInput['vision']>, at=now()):void {
    const scene=String(input.sceneLabel??'').trim();
    if(scene) this.state.scene={label:scene.slice(0,120),confidence01:clamp(input.confidence01??.55),salience01:.58,at};
    for(const object of (input.objects??[]).slice(0,32)) {
      const label=String(object.label??'').trim().slice(0,120); if(!label) continue;
      const kind=object.kind??'object';
      const position=(object.x==null&&object.y==null&&object.z==null)?null:{x:Number(object.x??0),y:Number(object.y??0),z:Number(object.z??0)};
      this.upsertEntity(label,kind,clamp(object.confidence01??.5),.62,'vision',at,position);
    }
    for(const rel of (input.relations??[]).slice(0,32)) this.upsertRelation(rel.from,rel.relation,rel.to,clamp(rel.confidence01??.5),'vision',at);
    this.state.modalityReliability.vision=clamp(this.state.modalityReliability.vision*.9+(input.objects?.length? .1 : 0));
    this.state.semanticUpdates += (input.objects?.length??0)+(input.relations?.length??0);
  }

  ingestAudio(input:NonNullable<P35SemanticInput['audio']>, at=now()):void {
    for(const event of (input.events??[]).slice(0,16)) {
      const label=String(event.label??'').trim().slice(0,120); if(!label) continue;
      this.upsertEntity(label,'event',clamp(event.confidence01??.4),.55,'audio',at,null);
      this.state.claims.unshift({id:stableId('claim',`audio:${label}:${at}`),modality:'audio',claim:`audio-event:${label}`,confidence01:clamp(event.confidence01??.4),evidenceIds:[],semanticSource:'structured-hint',at});
    }
    this.state.claims=this.state.claims.slice(0,256);
    this.state.modalityReliability.audio=clamp(this.state.modalityReliability.audio*.92+(input.events?.length? .08 : 0));
    this.state.semanticUpdates += input.events?.length??0;
  }

  ingestWorld(input:NonNullable<P35SemanticInput['worldContext']>, at=now()):void {
    if(input.location) {
      this.state.spatialSelf.location=String(input.location).slice(0,120);
      this.state.spatialSelf.confidence01=clamp(this.state.spatialSelf.confidence01*.8+.2);
      this.state.spatialSelf.lastAt=at;
    }
    for(const object of (input.objects??[]).slice(0,32)) {
      const label=String(object.label??'').trim(); if(!label) continue;
      const entity=this.upsertEntity(label,'object',object.visible?.65:.35,.5,'world',at,null);
      if(entity && input.location) this.upsertRelation(label,'inside',input.location,.65,'world',at);
    }
    for(const event of (input.events??[]).slice(0,16)) {
      const label=String(event).trim(); if(label) this.upsertEntity(label,'event',.6,.62,'world',at,null);
    }
    this.state.modalityReliability.world=clamp(this.state.modalityReliability.world*.9+.1);
    this.state.semanticUpdates++;
  }

  ingestBody(input:NonNullable<P35SemanticInput['body']>, at=now()):void {
    if(input.location) this.state.spatialSelf.location=String(input.location).slice(0,120);
    if(input.orientationDeg!=null) this.state.spatialSelf.orientationDeg=Number(input.orientationDeg);
    const motion=clamp(input.motion01??0), proximity=clamp(input.proximity01??.5), light=clamp(input.ambientLight01??.5);
    this.state.body={energy01:clamp(input.energy01??this.state.body.energy01),thermal01:clamp(input.thermal01??this.state.body.thermal01),capacity01:clamp(input.capacity01??this.state.body.capacity01),awake:input.awake ?? this.state.body.awake,sensoryFreshness01:clamp(input.sensoryFreshness01??this.state.body.sensoryFreshness01),lastAt:at};
    this.state.spatialSelf.confidence01=clamp(this.state.spatialSelf.confidence01*.78+.22*(1-motion*.15));
    this.state.modalityReliability.sensor=clamp(this.state.modalityReliability.sensor*.9+.1);
    this.state.spatialSelf.lastAt=at;
    this.state.semanticUpdates++;
    if (proximity > .75) this.state.affordances.explore=clamp(this.state.affordances.explore*.92+.08*(1-proximity));
    if (light < .15) this.state.affordances.rest=clamp(this.state.affordances.rest*.96+.04);
    if (this.state.body.energy01 < .3 || this.state.body.thermal01 > .72 || this.state.body.capacity01 < .3) this.state.affordances.rest=clamp(this.state.affordances.rest*.8+.2);
    if (!this.state.body.awake) { this.state.affordances.rest=1; this.state.affordances.respond*=.7; this.state.affordances.explore*=.5; }
  }

  private upsertEntity(label:string, kind:P35EntityKind, confidence:number, salience:number, modality:P35Modality, at:number, position:P35Entity['position']):P35Entity {
    const key=label.toLowerCase();
    const existing=this.state.entities.find(e=>e.label.toLowerCase()===key && e.modality===modality);
    if(existing){
      existing.confidence01=clamp(existing.confidence01*.72+confidence*.28);
      existing.salience01=clamp(existing.salience01*.78+salience*.22);
      existing.lastSeenAt=at; existing.mentionCount+=1; if(position) existing.position=position;
      return existing;
    }
    const entity:P35Entity={id:stableId('entity',`${modality}:${key}`),label:label.slice(0,120),kind,confidence01:clamp(confidence),salience01:clamp(salience),modality,firstSeenAt:at,lastSeenAt:at,mentionCount:1,position};
    this.state.entities=[entity,...this.state.entities].slice(0,160);
    return entity;
  }

  private upsertRelation(fromLabel:string, relation:P35Relation, toLabel:string, confidence:number, source:P35Modality, at:number):void {
    const confidence01=clamp(confidence);
    const from=this.entityByLabel(fromLabel,source,at); const to=this.entityByLabel(toLabel,source,at); if(!from||!to) return;
    const id=stableId('rel',`${from.id}:${relation}:${to.id}`);
    const existing=this.state.relations.find(r=>r.id===id);
    if(existing){ existing.confidence01=clamp(existing.confidence01*.72+confidence01*.28); existing.at=at; return; }
    this.state.relations=[{id,from:from.id,relation,to:to.id,confidence01,source,at},...this.state.relations].slice(0,320);
  }

  private entityByLabel(label:string, modality:P35Modality, at:number):P35Entity|null {
    const found=this.state.entities.find(e=>e.label.toLowerCase()===String(label).toLowerCase() && e.modality===modality)
      ?? this.state.entities.find(e=>e.label.toLowerCase()===String(label).toLowerCase());
    return found ?? this.upsertEntity(label,'unknown',.35,.25,modality,at,null);
  }

  private reconcile(at:number):void {
    const byLabel=new Map<string,P35Entity[]>();
    for(const entity of this.state.entities){ const key=entity.label.toLowerCase(); const rows=byLabel.get(key)??[]; rows.push(entity); byLabel.set(key,rows); }
    let agreements=0, comparable=0;
    for(const rows of byLabel.values()) {
      const mods=new Set(rows.map(x=>x.modality));
      if(mods.size>=2){ comparable++; const spread=Math.max(...rows.map(x=>x.confidence01))-Math.min(...rows.map(x=>x.confidence01)); if(spread<.28) agreements++; else this.state.conflicts+=1; }
    }
    const agreement=comparable?agreements/comparable:.5;
    const coverage=clamp(Math.min(1,this.state.entities.length/24)*.6+Math.min(1,this.state.relations.length/32)*.4);
    this.state.metrics.crossModalAgreement01=clamp(this.state.metrics.crossModalAgreement01*.7+agreement*.3);
    this.state.metrics.semanticCoverage01=clamp(this.state.metrics.semanticCoverage01*.72+coverage*.28);
    this.state.metrics.sceneConfidence01=clamp(this.state.scene.confidence01*.7+Math.min(1,this.state.entities.length/12)*.3);
    this.state.metrics.spatialSelfConfidence01=this.state.spatialSelf.confidence01;
    this.state.metrics.bodyWorldCoherence01=clamp(.35+this.state.metrics.crossModalAgreement01*.35+this.state.metrics.spatialSelfConfidence01*.3);
    const hashMaterial={scene:this.state.scene,entities:this.state.entities.slice(0,32).map(e=>[e.id,e.confidence01,e.lastSeenAt]),relations:this.state.relations.slice(0,64).map(r=>[r.id,r.confidence01])};
    this.state.lastWorldHash=createHash('sha256').update(JSON.stringify(hashMaterial)).digest('hex').slice(0,32);
    this.state.affordances.verify=clamp(this.state.affordances.verify*.94+this.state.metrics.crossModalAgreement01*.06);
    this.state.affordances.explore=clamp(this.state.affordances.explore*.94+this.state.metrics.semanticCoverage01*.06);
    this.state.affordances.reflect=clamp(this.state.affordances.reflect*.95+this.state.metrics.bodyWorldCoherence01*.05);
    this.state.lastWorldHash=this.state.lastWorldHash;
    this.state.tick=this.state.tick;
    void at;
  }

  semanticSummary(){
    return {
      scene:this.state.scene,
      topEntities:this.state.entities.slice(0,12).map(e=>({id:e.id,label:e.label,kind:e.kind,confidence01:e.confidence01,modality:e.modality})),
      relations:this.state.relations.slice(0,16),
      spatialSelf:this.state.spatialSelf,
      conflicts:this.state.conflicts,
      metrics:this.state.metrics,
    };
  }

  affordance(action:string):number { return clamp(this.state.affordances[action]??.5); }
}
