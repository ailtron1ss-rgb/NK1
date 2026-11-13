import { createHash } from 'node:crypto';

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const now = () => Date.now();
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const MODALITIES:readonly P37Modality[]=['text','vision','audio','sensor','world'];
const KINDS:readonly P37SemanticKind[]=['person','object','place','event','concept','body','unknown'];
const mod=(v:unknown):P37Modality=>MODALITIES.includes(v as P37Modality)?v as P37Modality:'world';
const kind=(v:unknown):P37SemanticKind=>KINDS.includes(v as P37SemanticKind)?v as P37SemanticKind:'unknown';
const s=(v:unknown,cap=200):string=>typeof v==='string'?v.slice(0,cap):'';
const modArr=(v:unknown,cap:number):P37Modality[]=>Array.isArray(v)?v.filter((x):x is P37Modality=>MODALITIES.includes(x as P37Modality)).slice(0,cap):[];
const sanClaim=(x:unknown):P37ObservationClaim|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,180),modality:mod(r.modality),label:s(r.label),kind:kind(r.kind),confidence01:clamp(finN(r.confidence01,0)),salience01:clamp(finN(r.salience01,0)),at:Math.max(0,finN(r.at,0)),source:r.source==='derived'?'derived':'structured'};};
const sanEntity=(x:unknown):P37EntityTrack|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;const opt=(v:unknown):number|null=>v==null?null:finN(v,0);return {id:r.id.slice(0,180),label:s(r.label),kind:kind(r.kind),confidence01:clamp(finN(r.confidence01,0)),salience01:clamp(finN(r.salience01,0)),firstSeenAt:Math.max(0,finN(r.firstSeenAt,0)),lastSeenAt:Math.max(0,finN(r.lastSeenAt,0)),seenCount:Math.max(1,cnt(r.seenCount,1)),present01:clamp(finN(r.present01,0)),x:opt(r.x),y:opt(r.y),z:opt(r.z),modalities:modArr(r.modalities,5),presenceStatus:['visible','fading','unknown'].includes(r.presenceStatus as string)?r.presenceStatus as P37EntityTrack['presenceStatus']:'unknown',persistence01:clamp(finN(r.persistence01,0)),absenceEvidence01:clamp(finN(r.absenceEvidence01,0))};};
const sanEvent=(x:unknown):P37EventTrack|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.id!=='string'||!r.id)return null;return {id:r.id.slice(0,180),label:s(r.label),confidence01:clamp(finN(r.confidence01,0)),at:Math.max(0,finN(r.at,0)),persistence01:clamp(finN(r.persistence01,0)),sources:modArr(r.sources,5)};};
const sanEdge=(x:unknown):P37SemanticWorldState['relationEdges'][number]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;if(typeof r.from!=='string'||!r.from||typeof r.to!=='string'||!r.to)return null;return {from:r.from.slice(0,180),relation:s(r.relation,64),to:r.to.slice(0,180),confidence01:clamp(finN(r.confidence01,0)),at:Math.max(0,finN(r.at,0))};};
const sanActive=(x:unknown):P37ActivePerceptionRequest|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {modality:mod(r.modality),reason:s(r.reason,240),expectedInformationGain01:clamp(finN(r.expectedInformationGain01,0)),estimatedCost01:clamp(finN(r.estimatedCost01,0)),priority01:clamp(finN(r.priority01,0)),createdAt:Math.max(0,finN(r.createdAt,0))};};
const sanSensors=(v:unknown,d:Record<P37Modality,P37SensorHealth>):Record<P37Modality,P37SensorHealth>=>{const out={...d};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const m of MODALITIES){const x=r[m];if(x&&typeof x==='object'){const e=x as Record<string,unknown>;out[m]={reliability01:clamp(finN(e.reliability01,d[m].reliability01)),freshness01:clamp(finN(e.freshness01,d[m].freshness01)),conflict01:clamp(finN(e.conflict01,d[m].conflict01)),samples:cnt(e.samples,d[m].samples)};}}return out;};
const sanAffordance=(v:unknown,d:P37SemanticWorldState['affordance']):P37SemanticWorldState['affordance']=>{const out={...d};if(!v||typeof v!=='object')return out;const r=v as Record<string,unknown>;for(const k of Object.keys(d) as (keyof typeof d)[])if(k in r)out[k]=clamp(finN(r[k],d[k]));return out;};
const mapBounded=<T,>(v:unknown,cap:number,fn:(x:unknown)=>T|null):T[]=>{if(!Array.isArray(v))return [];const out:T[]=[];for(const x of v.slice(0,cap)){try{const r=fn(x);if(r!==null)out.push(r);}catch{/* drop malformed row */}}return out;};

export type P37Modality = 'text'|'vision'|'audio'|'sensor'|'world';
export type P37SemanticKind = 'person'|'object'|'place'|'event'|'concept'|'body'|'unknown';

export interface P37ObservationClaim {
  id:string;
  modality:P37Modality;
  label:string;
  kind:P37SemanticKind;
  confidence01:number;
  salience01:number;
  at:number;
  source:'structured'|'derived';
}

export interface P37EntityTrack {
  id:string;
  label:string;
  kind:P37SemanticKind;
  confidence01:number;
  salience01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  seenCount:number;
  present01:number;
  x:number|null;
  y:number|null;
  z:number|null;
  modalities:P37Modality[];
  presenceStatus:'visible'|'fading'|'unknown';
  persistence01:number;
  absenceEvidence01:number;
}

export interface P37EventTrack {
  id:string;
  label:string;
  confidence01:number;
  at:number;
  persistence01:number;
  sources:P37Modality[];
}

export interface P37SensorHealth {
  reliability01:number;
  freshness01:number;
  conflict01:number;
  samples:number;
}

export interface P37ActivePerceptionRequest {
  modality:P37Modality;
  reason:string;
  expectedInformationGain01:number;
  estimatedCost01:number;
  priority01:number;
  createdAt:number;
}

export interface P37SemanticWorldState {
  version:1;
  tick:number;
  scene:{label:string;confidence01:number;stability01:number;at:number};
  claims:P37ObservationClaim[];
  entities:P37EntityTrack[];
  events:P37EventTrack[];
  relationEdges:Array<{from:string;relation:string;to:string;confidence01:number;at:number}>;
  spatialSelf:{location:string;x:number;y:number;z:number;orientationDeg:number;confidence01:number;at:number};
  body:{energy01:number;thermal01:number;capacity01:number;awake:boolean;motion01:number;sensoryFreshness01:number;at:number};
  sensors:Record<P37Modality,P37SensorHealth>;
  activePerception:P37ActivePerceptionRequest[];
  affordance:{respond:number;explore:number;verify:number;rest:number;reflect:number;wait:number;defer:number};
  semanticMemoryBudget01:number;
  worldTransitionError01:number;
  crossModalAgreement01:number;
  objectPermanence01:number;
  selfLocationConfidence01:number;
  bodyWorldCoherence01:number;
  episodeKey:string;
  episodeBoundary01:number;
  crossModalEntityBinding01:number;
  lastHash:string;
}

export interface P37Input {
  text?:string;
  vision?:{sceneLabel?:string;confidence01?:number;objects?:Array<{label:string;kind?:P37SemanticKind;confidence01?:number;x?:number;y?:number;z?:number}>;relations?:Array<{from:string;relation:string;to:string;confidence01?:number}>};
  audio?:{events?:Array<{label:string;confidence01?:number}>};
  worldContext?:{location?:string;objects?:Array<{id:string;label:string;location:string;value:number;visible:boolean;collected:boolean}>;events?:string[]};
  body?:{location?:string;x?:number;y?:number;z?:number;orientationDeg?:number;motion01?:number;energy01?:number;thermal01?:number;capacity01?:number;awake?:boolean;sensoryFreshness01?:number};
  at?:number;
}

export function defaultP37EmbodiedSensorium():P37SemanticWorldState {
  const sensor=(reliability01:number):P37SensorHealth=>({reliability01,freshness01:1,conflict01:0,samples:0});
  return {version:1,tick:0,scene:{label:'unknown',confidence01:.1,stability01:.1,at:0},claims:[],entities:[],events:[],relationEdges:[],spatialSelf:{location:'unknown',x:0,y:0,z:0,orientationDeg:0,confidence01:.15,at:0},body:{energy01:.78,thermal01:.12,capacity01:.84,awake:true,motion01:0,sensoryFreshness01:1,at:0},sensors:{text:sensor(.65),vision:sensor(.35),audio:sensor(.28),sensor:sensor(.55),world:sensor(.62)},activePerception:[],affordance:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},semanticMemoryBudget01:.82,worldTransitionError01:0,crossModalAgreement01:.5,objectPermanence01:.2,selfLocationConfidence01:.15,bodyWorldCoherence01:.4,episodeKey:'episode:unknown',episodeBoundary01:.15,crossModalEntityBinding01:0,lastHash:''};
}

function fastHash(input:string){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function id(prefix:string,seed:string){return `${prefix}-${fastHash(seed)}`;}

export class P37EmbodiedSensoriumEngine {
  private state=defaultP37EmbodiedSensorium();

  restore(raw?:P37SemanticWorldState|null){
    const d=defaultP37EmbodiedSensorium();
    const src:Record<string,unknown>=(raw&&typeof raw==='object')?raw as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const sc=(read('scene')&&typeof read('scene')==='object')?read('scene') as Record<string,unknown>:{};
    const ss=(read('spatialSelf')&&typeof read('spatialSelf')==='object')?read('spatialSelf') as Record<string,unknown>:{};
    const bd=(read('body')&&typeof read('body')==='object')?read('body') as Record<string,unknown>:{};
    this.state={
      version:1,
      tick:cnt(read('tick'),d.tick),
      scene:{label:typeof sc.label==='string'?sc.label.slice(0,200):d.scene.label,confidence01:clamp(finN(sc.confidence01,d.scene.confidence01)),stability01:clamp(finN(sc.stability01,d.scene.stability01)),at:Math.max(0,finN(sc.at,d.scene.at))},
      claims:mapBounded(read('claims'),384,sanClaim),
      entities:mapBounded(read('entities'),192,sanEntity),
      events:mapBounded(read('events'),128,sanEvent),
      relationEdges:mapBounded(read('relationEdges'),384,sanEdge),
      spatialSelf:{location:typeof ss.location==='string'?ss.location.slice(0,200):d.spatialSelf.location,x:finN(ss.x,d.spatialSelf.x),y:finN(ss.y,d.spatialSelf.y),z:finN(ss.z,d.spatialSelf.z),orientationDeg:finN(ss.orientationDeg,d.spatialSelf.orientationDeg),confidence01:clamp(finN(ss.confidence01,d.spatialSelf.confidence01)),at:Math.max(0,finN(ss.at,d.spatialSelf.at))},
      body:{energy01:clamp(finN(bd.energy01,d.body.energy01)),thermal01:clamp(finN(bd.thermal01,d.body.thermal01)),capacity01:clamp(finN(bd.capacity01,d.body.capacity01)),awake:bd.awake===true,motion01:clamp(finN(bd.motion01,d.body.motion01)),sensoryFreshness01:clamp(finN(bd.sensoryFreshness01,d.body.sensoryFreshness01)),at:Math.max(0,finN(bd.at,d.body.at))},
      sensors:sanSensors(read('sensors'),d.sensors),
      activePerception:mapBounded(read('activePerception'),16,sanActive),
      affordance:sanAffordance(read('affordance'),d.affordance),
      semanticMemoryBudget01:clamp(finN(read('semanticMemoryBudget01'),d.semanticMemoryBudget01)),
      worldTransitionError01:clamp(finN(read('worldTransitionError01'),d.worldTransitionError01)),
      crossModalAgreement01:clamp(finN(read('crossModalAgreement01'),d.crossModalAgreement01)),
      objectPermanence01:clamp(finN(read('objectPermanence01'),d.objectPermanence01)),
      selfLocationConfidence01:clamp(finN(read('selfLocationConfidence01'),d.selfLocationConfidence01)),
      bodyWorldCoherence01:clamp(finN(read('bodyWorldCoherence01'),d.bodyWorldCoherence01)),
      episodeKey:typeof read('episodeKey')==='string'?String(read('episodeKey')).slice(0,200):d.episodeKey,
      episodeBoundary01:clamp(finN(read('episodeBoundary01'),d.episodeBoundary01)),
      crossModalEntityBinding01:clamp(finN(read('crossModalEntityBinding01'),d.crossModalEntityBinding01)),
      lastHash:typeof read('lastHash')==='string'?String(read('lastHash')).slice(0,128):'',
    };
  }

  snapshot(){return structuredClone(this.state);}

  ingest(input:P37Input, returnSnapshot=true):P37SemanticWorldState|void{
    const at=input.at??now();
    const before=structuredClone(this.state);
    if(input.text?.trim()) this.text(input.text,at);
    if(input.vision) this.vision(input.vision,at);
    if(input.audio) this.audio(input.audio,at);
    if(input.worldContext) this.world(input.worldContext,at);
    if(input.body) this.body(input.body,at);
    this.decayPresence(at);
    this.reconcile(at,before);
    this.state.tick+=1;
    return returnSnapshot ? this.snapshot() : undefined;
  }

  private addClaim(modality:P37Modality,label:string,kind:P37SemanticKind,confidence01:number,salience01:number,source:'structured'|'derived',at:number){
    this.state.claims.push({id:id('claim',`${modality}:${label}:${at}:${this.state.tick}`),modality,label:label.slice(0,160),kind,confidence01:clamp(confidence01),salience01:clamp(salience01),at,source});
    if(this.state.claims.length>384)this.state.claims.splice(0,this.state.claims.length-384);
    const health=this.state.sensors[modality];
    health.samples+=1; health.freshness01=1; health.reliability01=clamp(health.reliability01*.96+.04*confidence01);
  }

  private upsertEntity(modality:P37Modality,label:string,kind:P37SemanticKind,confidence01:number,salience01:number,at:number,pos:{x:number;y:number;z:number}|null){
    const key=label.trim().toLowerCase(); if(!key) return null;
    let e=this.state.entities.find(x=>x.label.toLowerCase()===key&&x.kind===kind);
    const oldPresent=e?.present01??0;
    if(!e){e={id:id('entity',`${kind}:${key}`),label:key,kind,confidence01:clamp(confidence01),salience01:clamp(salience01),firstSeenAt:at,lastSeenAt:at,seenCount:1,present01:1,x:pos?.x??null,y:pos?.y??null,z:pos?.z??null,modalities:[modality],presenceStatus:'visible',persistence01:.12,absenceEvidence01:0};this.state.entities.unshift(e);} else {e.confidence01=clamp(e.confidence01*.72+confidence01*.28);e.salience01=clamp(e.salience01*.72+salience01*.28);e.lastSeenAt=at;e.seenCount+=1;e.present01=clamp(e.present01*.55+.45);e.presenceStatus='visible';e.persistence01=clamp(e.persistence01*.88+Math.min(1,e.seenCount/12)*.12);e.absenceEvidence01=clamp(e.absenceEvidence01*.8);if(pos){e.x=pos.x;e.y=pos.y;e.z=pos.z;}if(!e.modalities.includes(modality))e.modalities.push(modality);}
    this.state.objectPermanence01=clamp(this.state.objectPermanence01*.94+Math.min(1,e.seenCount/8)*.06+Math.min(1,oldPresent)*.03);
    return e;
  }

  private text(text:string,at:number){
    for(const token of [...new Set(text.toLowerCase().split(/[^a-zа-яё0-9_-]+/i).filter(x=>x.length>=4))].slice(0,12)){
      this.upsertEntity('text',token,token.includes('курис')?'person':'concept',.38,.25,at,null);
      this.addClaim('text',`mentioned:${token}`,token.includes('курис')?'person':'concept',.38,.25,'derived',at);
    }
    this.state.scene={label:'language-context',confidence01:clamp(this.state.scene.confidence01*.8+.2*.48),stability01:clamp(this.state.scene.stability01*.94+.06),at};
  }

  private vision(v:NonNullable<P37Input['vision']>,at:number){
    if(v.sceneLabel)this.state.scene={label:String(v.sceneLabel).slice(0,120),confidence01:clamp(v.confidence01??.55),stability01:clamp(this.state.scene.label===v.sceneLabel?this.state.scene.stability01+.08:.4),at};
    for(const o of (v.objects??[]).slice(0,32)) this.upsertEntity('vision',String(o.label),o.kind??'object',Number(o.confidence01??.5),.62,at,(o.x==null&&o.y==null&&o.z==null)?null:{x:Number(o.x??0),y:Number(o.y??0),z:Number(o.z??0)});
    for(const r of (v.relations??[]).slice(0,32)){this.state.relationEdges.unshift({from:String(r.from),relation:String(r.relation),to:String(r.to),confidence01:clamp(r.confidence01??.5),at});}
    this.state.relationEdges=this.state.relationEdges.slice(0,384);
    this.addClaim('vision',`scene:${v.sceneLabel??'unknown'}`,'place',Number(v.confidence01??.35),.58,'structured',at);
  }

  private audio(a:NonNullable<P37Input['audio']>,at:number){
    for(const ev of (a.events??[]).slice(0,16)){const label=String(ev.label);if(!label)continue;this.upsertEntity('audio',label,'event',Number(ev.confidence01??.4),.55,at,null);this.state.events.unshift({id:id('event',`${label}:${at}`),label:label.slice(0,120),confidence01:clamp(ev.confidence01??.4),at,persistence01:.5,sources:['audio']});}
    this.state.events=this.state.events.slice(0,128); this.addClaim('audio','audio-events','event',clamp(.28+(a.events?.length??0)*.05),.5,'structured',at);
  }

  private world(w:NonNullable<P37Input['worldContext']>,at:number){
    if(w.location){this.state.spatialSelf.location=String(w.location).slice(0,120);this.state.spatialSelf.confidence01=clamp(this.state.spatialSelf.confidence01*.75+.25);this.state.spatialSelf.at=at;}
    for(const o of (w.objects??[]).slice(0,32)){this.upsertEntity('world',o.label,'object',o.visible?.68:.32,.52,at,null);if(w.location)this.state.relationEdges.unshift({from:o.label,relation:'inside',to:w.location,confidence01:o.visible?.65:.35,at});}
    for(const e of (w.events??[]).slice(0,16)){const label=String(e).trim();if(label)this.state.events.unshift({id:id('event',`${label}:${at}:world`),label,confidence01:.6,at,persistence01:.6,sources:['world']});}
    this.state.events=this.state.events.slice(0,128);this.addClaim('world',`location:${w.location??'unknown'}`,'place',.65,.6,'structured',at);
  }

  private body(b:NonNullable<P37Input['body']>,at:number){
    this.state.body={energy01:clamp(b.energy01??this.state.body.energy01),thermal01:clamp(b.thermal01??this.state.body.thermal01),capacity01:clamp(b.capacity01??this.state.body.capacity01),awake:b.awake??this.state.body.awake,motion01:clamp(b.motion01??this.state.body.motion01),sensoryFreshness01:clamp(b.sensoryFreshness01??this.state.body.sensoryFreshness01),at};
    if(b.x!=null)this.state.spatialSelf.x=Number(b.x);if(b.y!=null)this.state.spatialSelf.y=Number(b.y);if(b.z!=null)this.state.spatialSelf.z=Number(b.z);if(b.orientationDeg!=null)this.state.spatialSelf.orientationDeg=Number(b.orientationDeg);
    this.addClaim('sensor',`body-energy:${this.state.body.energy01.toFixed(2)}`,'body',.9,.45,'derived',at);
  }

  private decayPresence(at:number){for(const e of this.state.entities){const age=Math.max(0,at-e.lastSeenAt);e.present01=clamp(e.present01*Math.exp(-Math.min(age,300000)/180000));e.presenceStatus=e.present01>.52?'visible':e.present01>.18?'fading':'unknown';e.persistence01=clamp(e.persistence01*.985+Math.min(1,e.seenCount/12)*.015);e.absenceEvidence01=clamp(e.presenceStatus==='unknown' ? Math.max(e.absenceEvidence01,(1-e.present01)*.18) : e.absenceEvidence01*.97);}for(const h of Object.values(this.state.sensors)){h.freshness01=clamp(h.freshness01*.92);h.conflict01=clamp(h.conflict01*.9);}}

  private reconcile(at:number,before:P37SemanticWorldState){
    const active=this.state.claims.slice(0,32);const byMod=new Map<P37Modality,number[]>();for(const c of active){const arr=byMod.get(c.modality)??[];arr.push(c.confidence01);byMod.set(c.modality,arr);}const modalityMeans=[...byMod.values()].map(a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length));
    const spread=modalityMeans.length>1?Math.max(...modalityMeans)-Math.min(...modalityMeans):0;
    const modalityLabels=new Map<P37Modality,Set<string>>();
    for(const c of active){const set=modalityLabels.get(c.modality)??new Set<string>();set.add(c.label.toLowerCase());modalityLabels.set(c.modality,set);}
    let overlap=1; if(modalityLabels.size>1){const sets=[...modalityLabels.values()]; const union=new Set<string>(); const intersection=new Set<string>(sets[0]); for(const set of sets){for(const x of set) union.add(x); if(set!==sets[0]) for(const x of [...intersection]) if(!set.has(x)) intersection.delete(x);} overlap=union.size?intersection.size/union.size:0;}
    const crossModalEntities=this.state.entities.filter(e=>e.modalities.length>=2).length;
    const entityAgreement=this.state.entities.length?clamp(crossModalEntities/Math.min(this.state.entities.length,24)):0;
    this.state.crossModalAgreement01=clamp(.42+overlap*.28+entityAgreement*.2+(1-spread)*.1);
    this.state.sensors.vision.conflict01=clamp(this.state.sensors.vision.conflict01*.8+spread*.2);this.state.sensors.audio.conflict01=clamp(this.state.sensors.audio.conflict01*.8+spread*.2);
    this.state.activePerception=[];
    const candidates:Array<[P37Modality,string,number,number]>=[['vision','clarify scene/object ambiguity',clamp((1-this.state.sensors.vision.reliability01)+this.state.scene.confidence01*.3),.45],['audio','clarify unresolved event',clamp((1-this.state.sensors.audio.reliability01)+this.state.sensors.audio.conflict01),.25],['world','refresh external world state',clamp((1-this.state.sensors.world.reliability01)+this.state.worldTransitionError01),.3],['sensor','refresh body state',clamp((1-this.state.sensors.sensor.reliability01)+this.state.body.sensoryFreshness01),.12],['text','request clarification from user',clamp(this.state.sensors.text.conflict01+(.5-this.state.scene.confidence01)*.5),.08]];
    for(const [modality,reason,gain,cost] of candidates){const priority=clamp(gain/(.1+cost));if(priority>.5)this.state.activePerception.push({modality,reason,expectedInformationGain01:gain,estimatedCost01:cost,priority01:priority,createdAt:at});}
    const rest=clamp((1-this.state.body.energy01)*.7+this.state.body.thermal01*.5+(1-this.state.body.capacity01)*.4);this.state.affordance.rest=clamp(.4+rest*.55);this.state.affordance.explore=clamp(.68-this.state.crossModalAgreement01*.2-this.state.body.motion01*.1);this.state.affordance.verify=clamp(.45+(1-this.state.crossModalAgreement01)*.6+this.state.worldTransitionError01*.35);this.state.affordance.respond=clamp(.5+this.state.sensors.text.reliability01*.25);this.state.affordance.reflect=clamp(.35+(1-this.state.scene.stability01)*.25);this.state.affordance.wait=clamp(.28+(this.state.body.sensoryFreshness01<.3?.15:0));this.state.affordance.defer=clamp(rest*.5);
    const sceneJump=this.state.scene.label===before.scene.label?0:1;
    const currentTopEntities=this.state.entities.filter(e=>e.present01>.45).slice(0,8).map(e=>`${e.kind}:${e.label}`).sort().join('|');
    const priorTopEntities=before.entities.filter(e=>e.present01>.45).slice(0,8).map(e=>`${e.kind}:${e.label}`).sort().join('|');
    const entityJaccard=(()=>{const a=new Set(currentTopEntities?currentTopEntities.split('|'):[]);const b=new Set(priorTopEntities?priorTopEntities.split('|'):[]);const union=new Set([...a,...b]);const inter=[...a].filter(x=>b.has(x)).length;return union.size?inter/union.size:1;})();
    const eventShift=this.state.events[0]?.label!==before.events[0]?.label?1:0;
    const boundary=clamp(sceneJump*.48+(1-entityJaccard)*.32+eventShift*.12+(1-this.state.crossModalAgreement01)*.08);
    const episodeSeed=`${this.state.scene.label}|${this.state.spatialSelf.location}|${currentTopEntities}|${this.state.events[0]?.label??''}`;
    this.state.episodeKey=`episode:${fastHash(episodeSeed)}`;
    this.state.episodeBoundary01=boundary;
    this.state.crossModalEntityBinding01=clamp(this.state.entities.length ? this.state.entities.filter(e=>e.modalities.length>=2).length/Math.min(this.state.entities.length,16) : 0);
    this.state.worldTransitionError01=clamp(before.worldTransitionError01*.8+sceneJump*.08+(1-this.state.crossModalAgreement01)*.16);
    this.state.bodyWorldCoherence01=clamp(.45+this.state.body.capacity01*.2+this.state.body.sensoryFreshness01*.15+this.state.spatialSelf.confidence01*.2);
    this.state.selfLocationConfidence01=this.state.spatialSelf.confidence01;
    this.state.semanticMemoryBudget01=clamp(.86-this.state.entities.length/240-this.state.claims.length/640);
    this.state.tick+=1;
  }

  sealHash(){ this.state.lastHash=createHash('sha256').update(JSON.stringify(this.state)).digest('hex'); return this.state.lastHash; }
  nextPerception(){return this.snapshot().activePerception[0]??null;}
  affordance(action:string){return clamp(Number((this.state.affordance as any)[action]??.25));}
  observeOutcome(success01:number,surprise01:number){this.state.worldTransitionError01=clamp(this.state.worldTransitionError01*.74+(1-success01)*.18+surprise01*.15);if(success01>.7)this.state.crossModalAgreement01=clamp(this.state.crossModalAgreement01+.02);else if(success01<.3)this.state.crossModalAgreement01=clamp(this.state.crossModalAgreement01-.03);return this.snapshot();}
  semanticSummary(){return {scene:this.state.scene,entities:this.state.entities.slice(0,12),nextPerception:this.nextPerception(),selfLocation:this.state.spatialSelf,body:this.state.body,agreement01:this.state.crossModalAgreement01,objectPermanence01:this.state.objectPermanence01,liveEntities:this.state.entities.filter(e=>e.presenceStatus==='visible').length,fadingEntities:this.state.entities.filter(e=>e.presenceStatus==='fading').length,unknownPresenceEntities:this.state.entities.filter(e=>e.presenceStatus==='unknown').length,bodyWorldCoherence01:this.state.bodyWorldCoherence01,episodeKey:this.state.episodeKey,episodeBoundary01:this.state.episodeBoundary01,crossModalEntityBinding01:this.state.crossModalEntityBinding01};}
}
