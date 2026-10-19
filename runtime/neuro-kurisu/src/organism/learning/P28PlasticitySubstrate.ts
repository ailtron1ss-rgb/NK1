import type { ActionKind, OrganismState } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const MODALITIES = ['text','vision','audio','sensor','world'] as const;
const DIM = 16;
const MAX_PROTOTYPES = 96;
const MAX_TRACES = 192;
const MAX_ASSOCIATIONS = 768;
const clamp01 = (x:number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clampSigned = (x:number) => Math.max(-1, Math.min(1, Number.isFinite(x) ? x : 0));
const now = () => Date.now();

export type PlasticityModality = typeof MODALITIES[number];

export interface PlasticityPrototype {
  id:string;
  modality:PlasticityModality;
  vector:number[];
  count:number;
  strength01:number;
  confidence01:number;
  firstSeenAt:number;
  lastSeenAt:number;
  source:string;
}

export interface PlasticityEligibilityTrace {
  key:string;
  eligibility01:number;
  lastTick:number;
  action:ActionKind|null;
}

export interface PlasticityAssociation {
  key:string;
  weight:number;
  visits:number;
  lastUpdatedAt:number;
}

export interface P28PlasticityState {
  version:1;
  dimension:number;
  observations:number;
  trustedObservations:number;
  quarantinedObservations:number;
  prototypeUpdates:number;
  associationUpdates:number;
  creditEvents:number;
  rejectedUpdates:number;
  noveltyMean01:number;
  predictionErrorMean01:number;
  lastNovelty01:number;
  lastConfidence01:number;
  lastCredit01:number;
  lastAt:number;
  prototypes:PlasticityPrototype[];
  eligibility:PlasticityEligibilityTrace[];
  associations:PlasticityAssociation[];
  recentCredits:Array<{tick:number;reward01:number;surprise01:number;action:ActionKind|null;at:number}>;
}

export interface PlasticityObservation {
  vector:number[];
  modality:PlasticityModality;
  source:string;
  tick:number;
  trust01:number;
  predictionError01?:number;
  action?:ActionKind|null;
}

export interface PlasticityResult {
  label:string;
  prototypeId:string;
  novelty01:number;
  confidence01:number;
  learned:boolean;
  quarantined:boolean;
}

function norm(v:number[]):number[]{
  const out=new Array(DIM).fill(0);
  for(let i=0;i<Math.min(DIM,v.length);i++)out[i]=clampSigned(Number(v[i]));
  const n=Math.sqrt(out.reduce((s,x)=>s+x*x,0))||1;
  return out.map(x=>x/n);
}
function cosine(a:number[],b:number[]):number{
  const aa=norm(a),bb=norm(b);
  let dot=0; for(let i=0;i<DIM;i++) dot+=aa[i]*bb[i];
  return clampSigned(dot);
}
function pairKey(a:string,b:string):string{return a<b?`${a}|${b}`:`${b}|${a}`;}

export function defaultP28Plasticity():P28PlasticityState{
  return {
    version:1,dimension:DIM,observations:0,trustedObservations:0,quarantinedObservations:0,
    prototypeUpdates:0,associationUpdates:0,creditEvents:0,rejectedUpdates:0,
    noveltyMean01:0,predictionErrorMean01:0,lastNovelty01:0,lastConfidence01:0,lastCredit01:0,lastAt:0,
    prototypes:[],eligibility:[],associations:[],recentCredits:[],
  };
}

export class P28PlasticitySubstrate {
  private state=defaultP28Plasticity();

  restore(raw?:Partial<P28PlasticityState>|null){
    const d=defaultP28Plasticity();
    this.state={
      ...d,...(raw??{}),version:1,dimension:DIM,
      prototypes:Array.isArray(raw?.prototypes)?raw!.prototypes.slice(-MAX_PROTOTYPES).map(p=>({
        ...p,
        vector:Array.from({length:DIM},(_,i)=>clampSigned(Number(Array.isArray(p?.vector)?p.vector[i]:0))),
        count:Math.max(1,Number(p?.count??1)),
        strength01:clamp01(Number(p?.strength01??.25)),confidence01:clamp01(Number(p?.confidence01??.25)),
      })):[],
      eligibility:Array.isArray(raw?.eligibility)?raw!.eligibility.slice(-MAX_TRACES).map(t=>({...t,eligibility01:clamp01(Number(t?.eligibility01??0))})):[],
      associations:Array.isArray(raw?.associations)?raw!.associations.slice(-MAX_ASSOCIATIONS).map(a=>({...a,weight:clampSigned(Number(a?.weight??0)),visits:Math.max(0,Number(a?.visits??0))})):[],
      recentCredits:Array.isArray(raw?.recentCredits)?raw!.recentCredits.slice(-64):[],
    };
  }

  snapshot():P28PlasticityState{return structuredClone(this.state);}

  private decayTraces(tick:number){
    for(const t of this.state.eligibility){
      const dt=Math.max(0,Math.min(128,tick-t.lastTick));
      if(dt>0)t.eligibility01*=Math.pow(.84,Math.max(1,dt));
      t.lastTick=tick;
    }
    this.state.eligibility=this.state.eligibility.filter(t=>t.eligibility01>.01).slice(-MAX_TRACES);
  }

  private findPrototype(modality:PlasticityModality,vector:number[]):{p:PlasticityPrototype|null;sim:number}{
    let best:PlasticityPrototype|null=null,bestSim=-1;
    for(const p of this.state.prototypes){
      if(p.modality!==modality)continue;
      const sim=cosine(vector,p.vector);
      if(sim>bestSim){bestSim=sim;best=p;}
    }
    return {p:best,sim:bestSim};
  }

  private ensurePrototype(modality:PlasticityModality,vector:number[],source:string,trust01:number,at:number):{p:PlasticityPrototype;novelty01:number;created:boolean}{
    const v=norm(vector); const found=this.findPrototype(modality,v);
    if(found.p){
      const novelty=clamp01((1-found.sim)*.72);
      const threshold=.34;
      if(found.sim>=threshold){
        const lr=.045+.06*trust01;
        found.p.vector=norm(found.p.vector.map((x,i)=>x*(1-lr)+v[i]*lr));
        found.p.count+=1; found.p.strength01=clamp01(found.p.strength01*.992+.02*trust01);
        found.p.confidence01=clamp01(found.p.confidence01*.96+.04*trust01); found.p.lastSeenAt=at;
        return {p:found.p,novelty01:novelty,created:false};
      }
    }
    if(this.state.prototypes.length<MAX_PROTOTYPES){
      const p:PlasticityPrototype={id:`p28-${modality}-${this.state.prototypes.length}-${at}`,modality,vector:v,count:1,strength01:.25+.2*trust01,confidence01:.25+.45*trust01,firstSeenAt:at,lastSeenAt:at,source};
      this.state.prototypes.push(p);
      return {p,novelty01:.82,created:true};
    }
    const ranked=[...this.state.prototypes].sort((a,b)=>(a.strength01*.5+a.confidence01*.3+Math.min(1,a.count/80)*.2)-(b.strength01*.5+b.confidence01*.3+Math.min(1,b.count/80)*.2));
    const evict=ranked[0];
    if(evict){
      this.state.prototypes=this.state.prototypes.filter(p=>p.id!==evict.id);
      this.state.associations=this.state.associations.filter(a=>!a.key.includes(evict.id));
    }
    const p:PlasticityPrototype={id:`p28-${modality}-${at}`,modality,vector:v,count:1,strength01:.2+.18*trust01,confidence01:.24+.4*trust01,firstSeenAt:at,lastSeenAt:at,source};
    this.state.prototypes.push(p);
    return {p,novelty01:.78,created:true};
  }

  observe(input:PlasticityObservation):PlasticityResult{
    const at=now(); const tick=Math.max(0,input.tick); const trust=clamp01(input.trust01);
    this.decayTraces(tick); this.state.observations++;
    const quarantined=trust<.55;
    if(quarantined)this.state.quarantinedObservations++;
    else this.state.trustedObservations++;
    const existing=this.findPrototype(input.modality,input.vector);
    const novelty=existing.p?clamp01((1-existing.sim)*.72):.82;
    let p:PlasticityPrototype;
    let learned=false;
    if(quarantined){
      p=existing.p ?? {id:`quarantine-${input.modality}`,modality:input.modality,vector:norm(input.vector),count:0,strength01:0,confidence01:0,firstSeenAt:at,lastSeenAt:at,source:'quarantine'};
    }else{
      const ensured=this.ensurePrototype(input.modality,input.vector,input.source,trust,at); p=ensured.p; learned=true;
      if(learned)this.state.prototypeUpdates++;
    }
    const activation=`${input.modality}:${p.id}`;
    if(!quarantined){
      const action=input.action??null;
      const prior=this.state.eligibility.find(t=>t.key===activation && t.action===action);
      if(prior){prior.eligibility01=clamp01(prior.eligibility01*.86+.42*trust);prior.lastTick=tick;}
      else this.state.eligibility.push({key:activation,eligibility01:.42*trust,lastTick:tick,action});
      this.state.eligibility=this.state.eligibility.slice(-MAX_TRACES);
    }
    const pe=clamp01(input.predictionError01??0);
    this.state.lastNovelty01=novelty; this.state.lastConfidence01=p.confidence01;
    this.state.noveltyMean01=clamp01(this.state.noveltyMean01*.97+novelty*.03);
    this.state.predictionErrorMean01=clamp01(this.state.predictionErrorMean01*.97+pe*.03);
    this.state.lastAt=at;
    return {label:`${input.modality}:prototype:${p.id}`,prototypeId:p.id,novelty01:novelty,confidence01:p.confidence01,learned,quarantined};
  }

  bindAction(action:ActionKind,tick:number){
    this.decayTraces(tick);
    const candidates=this.state.eligibility.filter(t=>t.action===null && t.eligibility01>.03).slice(-24);
    for(const t of candidates)t.action=action;
    return candidates.length;
  }

  credit(reward01:number, surprise01:number, action:ActionKind|null, tick:number){
    this.decayTraces(tick);
    const reward=clampSigned(reward01-.5)*2;
    const surprise=clamp01(surprise01);
    let updates=0;
    const active=this.state.eligibility.filter(t=>t.eligibility01>.03 && (action==null || t.action===action)).slice(-48);
    for(const a of active){
      const delta=reward*a.eligibility01*(.022+.028*surprise);
      if(Math.abs(delta)<.0005)continue;
      const existing=this.state.associations.find(x=>x.key===`${a.key}|reward:${action??'none'}`);
      const key=existing?.key??`${a.key}|reward:${action??'none'}`;
      const assoc=existing??{key,weight:0,visits:0,lastUpdatedAt:now()};
      assoc.weight=clampSigned(assoc.weight+delta); assoc.visits+=1; assoc.lastUpdatedAt=now();
      if(!existing)this.state.associations.push(assoc);
      updates++;
      a.eligibility01*=.64;
    }
    this.state.associations=this.state.associations.slice(-MAX_ASSOCIATIONS);
    this.state.creditEvents++; this.state.associationUpdates+=updates; this.state.lastCredit01=clamp01(reward01);
    this.state.recentCredits=[...this.state.recentCredits.slice(-63),{tick,reward01:clamp01(reward01),surprise01:surprise,action,at:now()}];
    if(!updates && active.length===0 && Math.abs(reward)>.2)this.state.rejectedUpdates++;
    return {updates,rewardSignal:reward,activeTraces:active.length};
  }

  bias(action:ActionKind):number{
    const hits=this.state.associations.filter(a=>a.key.endsWith(`|reward:${action}`));
    if(!hits.length)return 0;
    let weighted=0,weight=0;
    for(const h of hits.slice(-24)){const w=Math.min(1,h.visits/12); weighted+=h.weight*w; weight+=w;}
    return Math.max(-.045,Math.min(.045,(weight?weighted/weight:0)*.18));
  }

  informationGainPerCost(action:ActionKind,cost01:number):number{
    const exploration=action==='explore'?1:action==='verify'?.85:action==='reflect'?.45:.15;
    const novelty=this.state.lastNovelty01*.7+this.state.noveltyMean01*.3;
    const uncertainty=this.state.predictionErrorMean01;
    return clamp01((exploration*(.55*novelty+.45*uncertainty)+.02)/(Math.max(.02,cost01)));
  }

  prioritizedCreditCandidates(limit=16){
    return [...this.state.recentCredits].map((c,i)=>({
      ...c,
      priority01:clamp01((c.surprise01*.55+c.reward01*.25+(i+1)/this.state.recentCredits.length*.2)),
    })).sort((a,b)=>b.priority01-a.priority01).slice(0,Math.max(1,Math.min(64,limit)));
  }

  diagnostics(){
    const prototypeCoverage=clamp01(this.state.prototypes.length/MAX_PROTOTYPES);
    const activeTraceMass=this.state.eligibility.reduce((s,t)=>s+t.eligibility01,0)/Math.max(1,this.state.eligibility.length);
    return {
      observations:this.state.observations,
      trustedObservations:this.state.trustedObservations,
      quarantinedObservations:this.state.quarantinedObservations,
      prototypes:this.state.prototypes.length,
      prototypeCoverage01:prototypeCoverage,
      eligibilityTraces:this.state.eligibility.length,
      activeTraceMass01:clamp01(activeTraceMass),
      associations:this.state.associations.length,
      lastNovelty01:this.state.lastNovelty01,
      lastConfidence01:this.state.lastConfidence01,
      predictionErrorMean01:this.state.predictionErrorMean01,
      rejectedUpdates:this.state.rejectedUpdates,
    };
  }
}
