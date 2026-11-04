import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const hash=(xs:number[])=>{let h=2166136261>>>0;for(const x of xs){const q=Math.round(clamp(x,-1,1)*1000)|0;h^=q;h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const C01=(v:unknown,f:number):number=>Math.max(0,Math.min(1,finN(v,f)));
const vec24=(v:unknown):number[]=>Array.isArray(v)?Array.from({length:24},(_,i)=>Math.max(-1,Math.min(1,finN((v as unknown[])[i],0)))):new Array(24).fill(0);
const actOr=(v:unknown,f:ActionKind):ActionKind=>ACTIONS.includes(v as ActionKind)?v as ActionKind:f;
const strList=(v:unknown,n:number):string[]=>Array.isArray(v)?(v as unknown[]).filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,n):[];
export interface B2512Episode{
  id:string;tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;informationGain01:number;novelty01:number;uncertainty01:number;salience01:number;source:string;selfLatent:number[];worldLatent:number[];goalLatent:number[];memoryLatent:number[];traitVector:number[];
}
export interface B2512SemanticFact{
  key:string;value01:number;confidence01:number;support01:number;contradiction01:number;count:number;verifiedCount:number;lastTick:number;provenance:string[];
}
export interface B2512State{
  version:1;enabled:boolean;tick:number;episodes:number;learningUpdates:number;consolidationCycles:number;facts:Record<string,B2512SemanticFact>;semanticLatent:number[];semanticConfidence01:number;memoryIntegrity01:number;identityFirewall01:number;semanticUtility01:number;gatedRate01:number;contradictions01:number;rawRetentionCount:number;lastConsolidationTick:number;maxEpisodes:number;maxFacts:number;identityRevisionAtStart:number;identityRevisionObserved:number;rawEpisodes:B2512Episode[];
}
export interface B2512Input{
  tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;informationGain01:number;novelty01:number;uncertainty01:number;source?:string;selfLatent?:number[];worldLatent?:number[];goalLatent?:number[];memoryLatent?:number[];traitVector?:number[];identityRevision?:number;
}
export interface B2512Output{
  semanticBias:Record<ActionKind,number>;semanticLatent:number[];semanticConfidence01:number;memoryIntegrity01:number;identityFirewall01:number;informationPriority01:number;consolidate01:number;factCount:number;
}

const sanFact=(key:string,x:unknown):B2512SemanticFact|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {key:(typeof r.key==='string'&&r.key?r.key.slice(0,160):key).slice(0,160),value01:C01(r.value01,.5),confidence01:C01(r.confidence01,.2),support01:C01(r.support01,0),contradiction01:C01(r.contradiction01,0),count:cnt(r.count,0),verifiedCount:cnt(r.verifiedCount,0),lastTick:cnt(r.lastTick,0),provenance:strList(r.provenance,8)};};
const sanEpisode=(x:unknown):B2512Episode|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const tick=cnt(r.tick,0);const id=typeof r.id==='string'&&r.id?r.id.slice(0,160):`ep:${tick}`;return {id,tick,action:actOr(r.action,'wait'),reward01:C01(r.reward01,.5),predictionError01:C01(r.predictionError01,.5),verified01:C01(r.verified01,0),autonomous01:C01(r.autonomous01,0),informationGain01:C01(r.informationGain01,0),novelty01:C01(r.novelty01,.5),uncertainty01:C01(r.uncertainty01,.5),salience01:C01(r.salience01,.5),source:typeof r.source==='string'?r.source.slice(0,160):'',selfLatent:vec24(r.selfLatent),worldLatent:vec24(r.worldLatent),goalLatent:vec24(r.goalLatent),memoryLatent:vec24(r.memoryLatent),traitVector:vec24(r.traitVector)};};
export const defaultB2512State=():B2512State=>({version:1,enabled:true,tick:0,episodes:0,learningUpdates:0,consolidationCycles:0,facts:{},semanticLatent:new Array(24).fill(0),semanticConfidence01:.2,memoryIntegrity01:1,identityFirewall01:1,semanticUtility01:0,gatedRate01:.5,contradictions01:0,rawRetentionCount:0,lastConsolidationTick:0,maxEpisodes:192,maxFacts:64,identityRevisionAtStart:0,identityRevisionObserved:0,rawEpisodes:[]});

export class B2512EpistemicSemanticAutobiographicalConsolidator{
  readonly systemName='cognition:b2512-epistemic-semantic-autobiographical-consolidator' as const;
  private state=defaultB2512State();
  private last:B2512Output|null=null;
  snapshot(){return structuredClone(this.state);}
  restore(raw?:any){
    const d=defaultB2512State();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const factsRaw=read('facts');const facts:Record<string,B2512SemanticFact>={};
    if(factsRaw&&typeof factsRaw==='object'&&!Array.isArray(factsRaw)){const entries=Object.entries(factsRaw as Record<string,unknown>).slice(0,64);for(const [k,v] of entries){const f=sanFact(k,v);if(f)facts[k.slice(0,160)]=f;}}
    const epRaw=read('rawEpisodes');
    const rawEpisodes=Array.isArray(epRaw)?epRaw.slice(-d.maxEpisodes).map(sanEpisode).filter((x):x is B2512Episode=>x!==null):[];
    this.state={version:1,enabled:read('enabled')!==false,tick:cnt(read('tick'),d.tick),episodes:rawEpisodes.length,learningUpdates:cnt(read('learningUpdates'),d.learningUpdates),consolidationCycles:cnt(read('consolidationCycles'),d.consolidationCycles),facts,semanticLatent:vec24(read('semanticLatent')),semanticConfidence01:C01(read('semanticConfidence01'),d.semanticConfidence01),memoryIntegrity01:C01(read('memoryIntegrity01'),d.memoryIntegrity01),identityFirewall01:C01(read('identityFirewall01'),d.identityFirewall01),semanticUtility01:C01(read('semanticUtility01'),d.semanticUtility01),gatedRate01:C01(read('gatedRate01'),d.gatedRate01),contradictions01:C01(read('contradictions01'),d.contradictions01),rawRetentionCount:rawEpisodes.length,lastConsolidationTick:cnt(read('lastConsolidationTick'),d.lastConsolidationTick),maxEpisodes:d.maxEpisodes,maxFacts:d.maxFacts,identityRevisionAtStart:cnt(read('identityRevisionAtStart'),d.identityRevisionAtStart),identityRevisionObserved:cnt(read('identityRevisionObserved'),d.identityRevisionObserved),rawEpisodes};
  }

  setEnabled(x:boolean){this.state.enabled=!!x;}
  beforeDecision(i:{tick:number;uncertainty01:number;novelty01:number;predictionError01:number;goalPressure01:number;actionLatent?:Record<ActionKind,number>;}):B2512Output{
    const latent=this.state.semanticLatent.slice();
    const confidence=this.state.semanticConfidence01;
    const informationPriority=clamp(.36*i.uncertainty01+.26*i.novelty01+.20*i.predictionError01+.18*(1-confidence));
    const actionBias:Record<ActionKind,number>=Object.fromEntries(ACTIONS.map((a,k)=>[a,clamp(((this.state.facts[`action:${a}`]?.value01??.5)-.5)*.16*confidence + (i.actionLatent?.[a]??0)*.08)])) as Record<ActionKind,number>;
    const consolidate01=clamp(.35*informationPriority+.35*(1-this.state.memoryIntegrity01)+.30*(this.state.rawRetentionCount/Math.max(1,this.state.maxEpisodes)));
    this.last={semanticBias:actionBias,semanticLatent:latent,semanticConfidence01:confidence,memoryIntegrity01:this.state.memoryIntegrity01,identityFirewall01:this.state.identityFirewall01,informationPriority01:informationPriority,consolidate01,factCount:Object.keys(this.state.facts).length};
    this.state.tick=i.tick;return structuredClone(this.last);
  }
  observe(i:B2512Input){
    if(!this.state.enabled)return;
    const self=(i.selfLatent??[]).slice(0,24),world=(i.worldLatent??[]).slice(0,24),goal=(i.goalLatent??[]).slice(0,24),memory=(i.memoryLatent??[]).slice(0,24),traits=(i.traitVector??[]).slice(0,8);
    const salience=clamp(.22*i.predictionError01+.20*i.informationGain01+.18*i.novelty01+.16*i.uncertainty01+.14*i.verified01+.10*i.autonomous01);
    const id=`e${i.tick.toString(36)}-${hash([...self.slice(0,6),...world.slice(0,6),i.reward01,i.predictionError01])}`;
    this.state.rawEpisodes.push({id,tick:i.tick,action:i.action,reward01:clamp(i.reward01),predictionError01:clamp(i.predictionError01),verified01:clamp(i.verified01),autonomous01:clamp(i.autonomous01),informationGain01:clamp(i.informationGain01),novelty01:clamp(i.novelty01),uncertainty01:clamp(i.uncertainty01),salience01:salience,source:i.source??'runtime',selfLatent:self,worldLatent:world,goalLatent:goal,memoryLatent:memory,traitVector:traits});
    if(this.state.rawEpisodes.length>this.state.maxEpisodes)this.state.rawEpisodes.shift();
    this.state.episodes=this.state.rawEpisodes.length;this.state.rawRetentionCount=this.state.rawEpisodes.length;this.state.tick=i.tick;this.state.identityRevisionObserved=Number(i.identityRevision??this.state.identityRevisionObserved);
    if(this.state.identityRevisionAtStart===0)this.state.identityRevisionAtStart=this.state.identityRevisionObserved;
    this.state.learningUpdates++;
    if(i.verified01>.5 && (this.state.learningUpdates%4===0 || salience>.62))this.consolidate(i.tick,Math.max(2,Math.min(8,Math.round(2+salience*7))));
  }
  consolidate(tick:number,limit=4){
    const candidates=[...this.state.rawEpisodes].sort((a,b)=>b.salience01-a.salience01).slice(0,Math.max(1,limit));
    let applied=0,contradictions=0;
    for(const ep of candidates){
      const key=`action:${ep.action}`;
      const old=this.state.facts[key]??{key,value01:.5,confidence01:.18,support01:0,contradiction01:0,count:0,verifiedCount:0,lastTick:0,provenance:[]};
      const evidence=clamp(.20+ep.verified01*.38+ep.autonomous01*.15+ep.informationGain01*.16+(1-ep.predictionError01)*.11);
      const target=clamp(.5+(ep.reward01-.5)*.9);
      const contradiction=Math.abs(target-old.value01)>.28 && old.count>=3;
      if(contradiction)contradictions++;
      const lr=clamp(.035+evidence*.075);
      const trust=contradiction?.35:1;
      const nextValue=clamp(old.value01*(1-lr*trust)+target*(lr*trust));
      const nextConf=clamp(old.confidence01*(1-lr*.55)+evidence*lr*.75-(contradiction?.03:0));
      const nextSupport=clamp(old.support01*.93+evidence*.07);
      const nextContr=clamp(old.contradiction01*.90+(contradiction?.10:0));
      const prov=[...old.provenance,ep.id].slice(-12);
      this.state.facts[key]={key,value01:nextValue,confidence01:nextConf,support01:nextSupport,contradiction01:nextContr,count:old.count+1,verifiedCount:old.verifiedCount+(ep.verified01>.5?1:0),lastTick:ep.tick,provenance:prov};
      const src=[...ep.selfLatent,...ep.worldLatent,...ep.goalLatent];
      for (let j=0;j<24;j++){
        const v=src[j%Math.max(1,src.length)]??0;
        this.state.semanticLatent[j]=clamp(this.state.semanticLatent[j]!*0.985 + clamp(v,-1,1)*evidence*.015);
      }
      applied++;
    }
    const confidenceVals=Object.values(this.state.facts).map(f=>f.confidence01);const contradictions01=Object.values(this.state.facts).length?Object.values(this.state.facts).reduce((s,f)=>s+f.contradiction01,0)/Math.max(1,Object.values(this.state.facts).length):0;
    this.state.semanticConfidence01=confidenceVals.length?confidenceVals.reduce((a,b)=>a+b,0)/confidenceVals.length:.2;
    this.state.contradictions01=clamp(contradictions01);
    this.state.memoryIntegrity01=clamp(1-this.state.contradictions01*.65-Math.min(.15,this.state.episodes/this.state.maxEpisodes*.12));
    this.state.gatedRate01=clamp(this.state.consolidationCycles?this.state.consolidationCycles/Math.max(1,this.state.learningUpdates/2):.5);
    this.state.semanticUtility01=clamp(.42*this.state.semanticConfidence01+.30*this.state.memoryIntegrity01+.18*(1-this.state.contradictions01)+.10*Math.min(1,Object.keys(this.state.facts).length/16));
    this.state.identityFirewall01=clamp(1-Math.abs(this.state.identityRevisionObserved-this.state.identityRevisionAtStart)*.05);
    this.state.consolidationCycles++;this.state.lastConsolidationTick=tick;this.state.learningUpdates+=applied;
    if(Object.keys(this.state.facts).length>this.state.maxFacts){const keep=Object.values(this.state.facts).sort((a,b)=>(b.confidence01+b.support01)-(a.confidence01+a.support01)).slice(0,this.state.maxFacts);this.state.facts=Object.fromEntries(keep.map(f=>[f.key,f]));}
    return {applied,contradictions,semanticConfidence01:this.state.semanticConfidence01,memoryIntegrity01:this.state.memoryIntegrity01};
  }
  afterOutcome(i:{tick:number;action:ActionKind;reward01:number;predictionError01:number;verified01:number;autonomous01:number;informationGain01:number;novelty01:number;uncertainty01:number;selfLatent?:number[];worldLatent?:number[];goalLatent?:number[];memoryLatent?:number[];traitVector?:number[];identityRevision?:number;source?:string}){this.observe(i);}
  semanticActionBias(action:ActionKind){const f=this.state.facts[`action:${action}`];return f?clamp((f.value01-.5)*.09*f.confidence01,-.07,.07):0;}
  semanticVector(){return this.state.semanticLatent.slice();}
  diagnostics(){return {version:1,episodes:this.state.episodes,learningUpdates:this.state.learningUpdates,consolidationCycles:this.state.consolidationCycles,factCount:Object.keys(this.state.facts).length,semanticConfidence01:this.state.semanticConfidence01,memoryIntegrity01:this.state.memoryIntegrity01,identityFirewall01:this.state.identityFirewall01,semanticUtility01:this.state.semanticUtility01,gatedRate01:this.state.gatedRate01,contradictions01:this.state.contradictions01,rawRetentionCount:this.state.rawRetentionCount,lastConsolidationTick:this.state.lastConsolidationTick,identityRevisionAtStart:this.state.identityRevisionAtStart,identityRevisionObserved:this.state.identityRevisionObserved,protectedIdentityDrift01:clamp(1-this.state.identityFirewall01)};}
  lesion(fraction01=.5){const f=clamp(fraction01);const before=this.state.semanticUtility01;const hypotheticalConfidence=clamp(this.state.semanticConfidence01*(1-f));const hypothetical=clamp(.42*hypotheticalConfidence+.30*this.state.memoryIntegrity01+.18*(1-this.state.contradictions01)+.10*Math.min(1,Object.keys(this.state.facts).length/16));return {effect01:clamp(Math.abs(before-hypothetical)),fraction01:f};}
}
