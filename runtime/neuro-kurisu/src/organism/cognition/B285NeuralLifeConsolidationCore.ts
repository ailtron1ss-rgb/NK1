import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const DIM = 24;
const REL = 6;
const HORIZONS = [1, 8, 32] as const;
const TRAITS = ['curiosity','truth-seeking','self-reflection','care','social-attunement','self-preservation','persistence','autonomy'] as const;
type Trait = typeof TRAITS[number];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp01(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.06)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const matrix=(rows:number,cols:number,seed:number,scale=.04)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>rand(seed+i*97+j*17,scale)));
const vec=(seed:number,len:number,scale=.08)=>Array.from({length:len},(_,i)=>rand(seed+i*31,scale));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

export interface B285Episode{tick:number;relationId:string;self:number[];world:number[];goal:number[];identity:number[];outcome01:number;predictionError01:number;importance01:number;futureError01:number;traits:Record<Trait,number>;}
export interface B285RelationTrace{relationId:string;latent:number[];trust01:number;attachment01:number;boundary01:number;predictionError01:number;interactionCount:number;lastTick:number;}
export interface B285State{
  version:1;tick:number;steps:number;learningUpdates:number;replayUpdates:number;consolidationCount:number;activeScarContextKey:string;
  negativeScar01:number;negativeScarConfidence01:number;negativeScarCount:number;recovery01:number;recoveryCount:number;lastScarTick:number;scarActionBiases:Record<ActionKind,number>;scarContextStates:Record<string,{negative01:number;recovery01:number;count:number;lastTick:number;actionNegative01:Record<ActionKind,number>}>;scarHistory:Array<{tick:number;action:ActionKind;severity01:number;evidence01:number;recovered01:number;contextKey:string}>;
  identityProjection:number[][];relationWeights:number[][];futureWeights:number[][];valueWeights:number[][];actionWeights:number[][];
  identityLatent:number[];futureSelf:[number[],number[],number[]];relationshipStates:B285RelationTrace[];traitValues:Record<Trait,number>;
  lifeValues:number[];committedValues:number[];valueDrift01:number;futureConsistency01:number;relationshipStability01:number;autobiographicalCompression01:number;goalPreferenceInfluence01:number;futureIdentityAlignment01:number;developmentalMomentum01:number;identityStability01:number;causalAblationDrop01:number;lastFutureError01:number;
  episodes:B285Episode[];chapters:Array<{id:number;startTick:number;endTick:number;centroid:number[];relationId:string;valueSignature:number[];importance01:number;}>;activeChapterId:number;committedIdentityVersion:number;
}
export interface B285StepInput{tick:number;identityLatent?:number[];selfLatent?:number[];worldLatent?:number[];goalVector?:number[];memoryLatent?:number[];relationshipVector?:number[];relationshipId?:string;personalityVector?:number[];reward01?:number;predictionError01?:number;agency01?:number;learningEnabled?:boolean;importance01?:number;}

export const defaultB285State=():B285State=>({
  version:1,tick:0,steps:0,learningUpdates:0,replayUpdates:0,consolidationCount:0,activeScarContextKey:'',
  negativeScar01:0,negativeScarConfidence01:0,recovery01:0,recoveryCount:0,negativeScarCount:0,lastScarTick:-1,
  scarActionBiases:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,scarContextStates:{},scarHistory:[],
  identityProjection:matrix(DIM,DIM,285001,.035),relationWeights:matrix(REL,DIM,285101,.055),futureWeights:Array.from({length:3},(_,h)=>Array.from({length:DIM},(_,j)=>rand(285201+h*97+j*11,.18))),valueWeights:Array.from({length:TRAITS.length},(_,ti)=>vec(285301+ti*101,DIM,.08)),actionWeights:Array.from({length:ACTIONS.length},(_,ai)=>vec(285401+ai*103,DIM,.05)),
  identityLatent:new Array(DIM).fill(0),futureSelf:[new Array(DIM).fill(0),new Array(DIM).fill(0),new Array(DIM).fill(0)],relationshipStates:[],traitValues:Object.fromEntries(TRAITS.map((t,i)=>[t,clamp01(.5+rand(285501+i,.07))])) as Record<Trait,number>,
  lifeValues:new Array(REL).fill(.5),committedValues:new Array(REL).fill(.5),valueDrift01:0,futureConsistency01:.5,relationshipStability01:.5,autobiographicalCompression01:.5,goalPreferenceInfluence01:.5,futureIdentityAlignment01:.5,developmentalMomentum01:0,identityStability01:.5,causalAblationDrop01:0,lastFutureError01:.5,episodes:[],chapters:[],activeChapterId:0,committedIdentityVersion:0,
});

export class B285NeuralLifeConsolidationCore{
  private state=B285NeuralLifeConsolidationCore.create();
  private scarLesioned=false;
  private activeScarContextKey='';
  static create(){return defaultB285State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw:unknown){
    const base=defaultB285State();if(!raw||typeof raw!=='object'){this.state=base;return;}
    const r=raw as Partial<B285State>;const tv=(r.traitValues??{}) as Record<string,number>;
    this.state={...base,...r,
      identityProjection:Array.isArray(r.identityProjection)?r.identityProjection.slice(0,DIM):base.identityProjection,
      relationWeights:Array.isArray(r.relationWeights)?r.relationWeights.slice(0,REL):base.relationWeights,
      futureWeights:Array.isArray(r.futureWeights)?r.futureWeights.slice(0,3):base.futureWeights,
      valueWeights:Array.isArray(r.valueWeights)?r.valueWeights.slice(0,TRAITS.length):base.valueWeights,
      actionWeights:Array.isArray(r.actionWeights)?r.actionWeights.slice(0,ACTIONS.length):base.actionWeights,
      identityLatent:Array.isArray(r.identityLatent)?r.identityLatent.slice(0,DIM):base.identityLatent,
      futureSelf:Array.isArray(r.futureSelf)?([0,1,2].map(i=>Array.isArray(r.futureSelf?.[i])?r.futureSelf[i]!.slice(0,DIM):base.futureSelf[i]) as [number[],number[],number[]]):base.futureSelf,
      traitValues:Object.fromEntries(TRAITS.map(t=>[t,clamp01(tv[t]??base.traitValues[t])])) as Record<Trait,number>,
      activeScarContextKey:String((r as any).activeScarContextKey??base.activeScarContextKey),
      lifeValues:Array.isArray(r.lifeValues)?r.lifeValues.slice(0,REL):base.lifeValues,
      committedValues:Array.isArray(r.committedValues)?r.committedValues.slice(0,REL):base.committedValues,
      relationshipStates:Array.isArray(r.relationshipStates)?r.relationshipStates.slice(-32).map((x:any)=>({...x,latent:Array.isArray(x?.latent)?x.latent.slice(0,DIM):new Array(DIM).fill(0)})):[],
      episodes:Array.isArray(r.episodes)?r.episodes.slice(-384):[],chapters:Array.isArray(r.chapters)?r.chapters.slice(-24):[],
      negativeScar01:clamp01(r.negativeScar01??base.negativeScar01),negativeScarConfidence01:clamp01(r.negativeScarConfidence01??base.negativeScarConfidence01),
      negativeScarCount:Math.max(0,Math.floor(Number(r.negativeScarCount??base.negativeScarCount))),recovery01:clamp01(r.recovery01??base.recovery01),
      recoveryCount:Math.max(0,Math.floor(Number(r.recoveryCount??base.recoveryCount))),lastScarTick:Math.max(-1,Math.floor(Number(r.lastScarTick??base.lastScarTick))),
      scarActionBiases:Object.fromEntries(ACTIONS.map(a=>[a,clamp11(Number((r.scarActionBiases as any)?.[a]??0))])) as Record<ActionKind,number>,
      scarContextStates:Object.fromEntries(Object.entries((r as any).scarContextStates??{}).slice(0,64).map(([k,v]:any)=>[String(k),{negative01:clamp01(Number(v?.negative01??0)),recovery01:clamp01(Number(v?.recovery01??0)),count:Math.max(0,Math.floor(Number(v?.count??0))),lastTick:Math.max(-1,Math.floor(Number(v?.lastTick??-1))),actionNegative01:Object.fromEntries(ACTIONS.map(a=>[a,clamp01(Number(v?.actionNegative01?.[a]??0))])) as Record<ActionKind,number>}])) ,
      scarHistory:Array.isArray(r.scarHistory)?r.scarHistory.slice(-96).map((x:any)=>({tick:Math.max(0,Math.floor(Number(x?.tick??0))),action:ACTIONS.includes(x?.action)?x.action:'wait',severity01:clamp01(x?.severity01??0),evidence01:clamp01(x?.evidence01??0),recovered01:clamp01(x?.recovered01??0),contextKey:String(x?.contextKey??'')})):[],
    };
    this.scarLesioned=false; this.activeScarContextKey=this.state.activeScarContextKey;
  }
  private relationId(input:B285StepInput){return String(input.relationshipId??'self-general');}
  private relationIndex(id:string){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h%REL;}
  private buildContext(input:B285StepInput){
    const g=input.goalVector??[],s=input.selfLatent??input.identityLatent??[],w=input.worldLatent??[],m=input.memoryLatent??[],r=input.relationshipVector??[],p=input.personalityVector??[];
    return Array.from({length:DIM},(_,i)=>clamp11((s[i%(s.length||1)]??0)*.22+(w[i%(w.length||1)]??0)*.16+(g[i%(g.length||1)]??0)*.16+(m[i%(m.length||1)]??0)*.16+(r[i%(r.length||1)]??0)*.12+(p[i%(p.length||1)]??0)*.08+(this.state.identityLatent[i]??0)*.10));
  }
  private ensureRelation(id:string,latent:number[],tick:number){
    let r=this.state.relationshipStates.find(x=>x.relationId===id);if(!r){r={relationId:id,latent:latent.slice(0,DIM),trust01:.5,attachment01:.5,boundary01:.5,predictionError01:.5,interactionCount:0,lastTick:tick};this.state.relationshipStates.push(r);}return r;
  }
  step(input:B285StepInput){
    this.state.tick=input.tick;const ctx=this.buildContext(input);const relId=this.relationId(input);const rel=this.ensureRelation(relId,input.relationshipVector?.slice(0,DIM)??ctx,input.tick);const relIdx=this.relationIndex(relId);const prev=this.state.identityLatent.slice();
    const next=new Array(DIM).fill(0);
    for(let i=0;i<DIM;i++){let s=0;for(let j=0;j<DIM;j++)s+=this.state.identityProjection[i]![j]!*(ctx[j]??0);s+=this.state.relationWeights[relIdx]![i%DIM]!*rel.trust01*.18;s+=prev[i]*.42;next[i]=tanh(s);}
    const future=[0,1,2].map(h=>{const f=new Array(DIM).fill(0);for(let i=0;i<DIM;i++)f[i]=tanh((next[i]??0)*.40+(this.state.futureWeights[h]![i]??0)*.55+(ctx[i]??0)*.05);return f;}) as [number[],number[],number[]];
    const target=ctx;const futureError=mean(future.map(f=>1-cosine01(f,target)));const reward=clamp01(input.reward01??.5);const importance=clamp01(input.importance01??clamp01(.35+Math.abs(reward-.5)*1.4+(1-(input.predictionError01??futureError))*.25));
    const relationOutcome=clamp11((reward-.5)*1.6-(input.predictionError01??futureError)*.35);rel.trust01=clamp01(rel.trust01*.992+clamp01(.5+relationOutcome*.5)*.008);rel.attachment01=clamp01(rel.attachment01*.994+importance*.006);rel.boundary01=clamp01(rel.boundary01*.996+(1-Math.abs(relationOutcome))*.004);rel.predictionError01=futureError;rel.interactionCount++;rel.lastTick=input.tick;rel.latent=Array.from({length:DIM},(_,i)=>clamp11((rel.latent[i]??0)*.98+(ctx[i]??0)*.02));
    const traits={...this.state.traitValues};
    for(let ti=0;ti<TRAITS.length;ti++){
      const neuralSignal=tanh(dot(this.state.valueWeights[ti]!,next)/Math.max(2,DIM*.35));
      const relationSignal=tanh(dot(this.state.relationWeights[relIdx]!,next)/(DIM*.8));
      const futureSignal=tanh(dot(this.state.futureWeights[ti%3]!,future[ti%3]!)/Math.max(2,DIM*.35));
      const goalSignal=clamp11(input.goalVector?.[ti%(input.goalVector?.length||1)]??0);
      const traitContext=clamp11((ctx[(ti*3)%DIM]??0)*.65+(ctx[(ti*3+5)%DIM]??0)*.35);
      const traitTension=clamp11(((ti%2===0?1:-1)*(reward-.5))*.45+traitContext*.55);
      const drive=clamp11(neuralSignal*.50+relationSignal*.12+futureSignal*.12+goalSignal*.22+traitTension*.65+(reward-.5)*.18-(input.predictionError01??.5-.5)*.22);
      traits[TRAITS[ti]!] = clamp01((this.state.traitValues[TRAITS[ti]!]??.5)*.988+clamp01(.5+drive*.5)*.012);
    }
    this.state.identityLatent=next;this.state.futureSelf=future;this.state.traitValues=traits;this.state.lastFutureError01=clamp01(futureError);this.state.futureConsistency01=clamp01(1-futureError);this.state.futureIdentityAlignment01=clamp01(cosine01(future[1]!,next));this.state.relationshipStability01=clamp01(mean(this.state.relationshipStates.map(r=>.35+.65*(r.trust01*.55+r.attachment01*.45))));this.state.goalPreferenceInfluence01=clamp01(.5+.5*cosine01(next,input.goalVector?.slice(0,DIM)??next));this.state.identityStability01=clamp01(.5+.5*cosine01(next,prev));
    this.state.steps++;const ep:B285Episode={tick:input.tick,relationId:relId,self:(input.selfLatent??[]).slice(0,DIM),world:(input.worldLatent??[]).slice(0,DIM),goal:(input.goalVector??[]).slice(0,DIM),identity:next.slice(),outcome01:reward,predictionError01:input.predictionError01??futureError,importance01:importance,futureError01:futureError,traits:{...traits}};this.state.episodes.push(ep);if(this.state.episodes.length>384)this.state.episodes.shift();
    if(input.learningEnabled!==false)this.learn(ctx,next,future,reward,importance,relIdx);if(this.state.steps%16===0)this.consolidateChapter();if(input.tick%48===0)this.replay(8);this.state.autobiographicalCompression01=clamp01(.45+.55*Math.min(1,this.state.chapters.length/8)*.75+Math.min(1,this.state.episodes.length/192)*.25);this.state.developmentalMomentum01=clamp11((reward-.5)*.8+(this.state.futureIdentityAlignment01-.5)*.5);
    return this.diagnostics();
  }
  private learn(
    ctx:number[],
    next:number[],
    future:[number[],number[],number[]],
    reward:number,
    importance:number,
    relIdx:number,
  ){
    const third=clamp11((reward-.5)*.9+(importance-.5)*.25-this.state.lastFutureError01*.25);
    for(let i=0;i<DIM;i++){
      for(let j=0;j<DIM;j++){
        const hebb=(next[i]??0)*(ctx[j]??0);
        this.state.identityProjection[i]![j]=clamp11(this.state.identityProjection[i]![j]!+.0014*third*hebb);
        if(i===j)this.state.identityProjection[i]![j]=clamp11(this.state.identityProjection[i]![j]!*.999+.0002*third);
        this.state.relationWeights[relIdx]![j]=clamp11(this.state.relationWeights[relIdx]![j]!+.0007*third*(next[j]??0));
      }
    }
    for(let h=0;h<3;h++)for(let j=0;j<DIM;j++)
      this.state.futureWeights[h]![j]=clamp11(this.state.futureWeights[h]![j]!+.0022*(h===1?.95:1)*third*(future[h]![j]??0));
    this.state.learningUpdates++;
  }
  setScarContext(contextKey:string){this.activeScarContextKey=String(contextKey??'');this.state.activeScarContextKey=this.activeScarContextKey;return {contextKey:this.activeScarContextKey};}
  clearScarContext(){this.activeScarContextKey='';this.state.activeScarContextKey='';}
  private scarContextGeneralized(action:ActionKind){
    const key=this.activeScarContextKey;if(!key)return 0;
    const parts=(key.match(/[a-z]\d+/g)??[]).map((x:string)=>Number(x.slice(1)));
    if(parts.length!==6)return 0;
    let best=0;
    for(const [k,v] of Object.entries(this.state.scarContextStates)){
      const p=(k.match(/[a-z]\d+/g)??[]).map((x:string)=>Number(x.slice(1)));if(p.length!==6 || !v || v.count<1)continue;
      const d=parts.reduce((n:number,x:number,i:number)=>n+(x===p[i]?0:1),0);if(d>2)continue;
      const w=d===0?1:d===1?.55:.18;
      const actionScar=clamp11((this.state.scarActionBiases[action]??0));
      const local=clamp11(-(v.actionNegative01?.[action]??0)*.13 - v.negative01*.018 + v.recovery01*.012);
      best=Math.min(0,Math.max(best,local*w)) + actionScar*.04*w;
    }
    return clamp11(best);
  }
  lesionScar(enabled=true){this.scarLesioned=Boolean(enabled);return {lesioned:this.scarLesioned};}
  clearScarLesion(){this.scarLesioned=false;}
  recordNegativeOutcome(input:{tick:number;action:ActionKind;severity01:number;evidence01:number;verified:boolean;predictionError01:number;importance01:number}){
    if(this.scarLesioned)return {applied:false,blockedByLesion:true,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    if(!input.verified)return {applied:false,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    const severity=clamp01(.52*input.severity01+.22*input.predictionError01+.26*input.importance01);
    const evidence=clamp01(input.evidence01);
    if(severity<.50 || evidence<.54)return {applied:false,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    const gain=clamp01(severity*evidence*.10);
    this.state.negativeScar01=clamp01(this.state.negativeScar01*.90+gain);
    const contextKey=this.activeScarContextKey;
    if(contextKey){const prev=this.state.scarContextStates[contextKey]??{negative01:0,recovery01:0,count:0,lastTick:-1,actionNegative01:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>};const action=input.action;this.state.scarContextStates[contextKey]={negative01:clamp01(prev.negative01*.90+gain),recovery01:clamp01(prev.recovery01*.92),count:prev.count+1,lastTick:Math.max(prev.lastTick,Math.floor(input.tick)),actionNegative01:{...prev.actionNegative01,[action]:clamp01((prev.actionNegative01?.[action]??0)*.88+gain)}};}

    this.state.negativeScarConfidence01=clamp01(this.state.negativeScarConfidence01*.92+evidence*.08);
    this.state.negativeScarCount++;
    this.state.lastScarTick=Math.max(this.state.lastScarTick,Math.floor(input.tick));
    const action=ACTIONS.includes(input.action)?input.action:'wait';
    this.state.scarActionBiases[action]=clamp11((this.state.scarActionBiases[action]??0)-gain*(.10+.14*evidence));
    this.state.scarHistory.unshift({tick:Math.max(0,Math.floor(input.tick)),action,severity01:severity,evidence01:evidence,recovered01:0,contextKey});
    if(this.state.scarHistory.length>96)this.state.scarHistory=this.state.scarHistory.slice(0,96);
    return {applied:true,scar01:this.state.negativeScar01,recovery01:this.state.recovery01,actionBias11:this.state.scarActionBiases[action]};
  }
  recordRecovery(input:{tick:number;action:ActionKind;reward01:number;correctiveEvidence01:number;futureConsistency01:number;verified:boolean}){
    if(this.scarLesioned)return {applied:false,blockedByLesion:true,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    if(!input.verified)return {applied:false,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    const corrective=clamp01((input.reward01-.5)*2)*clamp01(input.correctiveEvidence01)*clamp01(input.futureConsistency01);
    if(corrective<.18)return {applied:false,scar01:this.state.negativeScar01,recovery01:this.state.recovery01};
    this.state.recoveryCount++;
    this.state.recovery01=clamp01(this.state.recovery01*.90+corrective*.18);
    const contextKey=this.activeScarContextKey;
    if(contextKey){const prev=this.state.scarContextStates[contextKey]??{negative01:0,recovery01:0,count:0,lastTick:-1,actionNegative01:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>};const action=input.action;this.state.scarContextStates[contextKey]={negative01:clamp01(prev.negative01*(1-corrective*.06)),recovery01:clamp01(prev.recovery01*.90+corrective*.14),count:prev.count,lastTick:Math.max(prev.lastTick,Math.floor(input.tick)),actionNegative01:Object.fromEntries(ACTIONS.map(a=>[a,clamp01((prev.actionNegative01?.[a]??0)*(a===action?(1-corrective*.11):1))])) as Record<ActionKind,number>};}

    const release=clamp01(corrective*.07);
    this.state.negativeScar01=clamp01(this.state.negativeScar01*(1-release));
    const action=ACTIONS.includes(input.action)?input.action:'wait';
    this.state.scarActionBiases[action]=clamp11((this.state.scarActionBiases[action]??0)*(1-release*.85));
    const latest=this.state.scarHistory[0]; if(latest) latest.recovered01=clamp01(latest.recovered01+release);
    return {applied:true,scar01:this.state.negativeScar01,recovery01:this.state.recovery01,actionBias11:this.state.scarActionBiases[action]};
  }
  replay(count=8){
    for(const ep of this.state.episodes.slice(-count)){
      const signal=clamp11((ep.outcome01-.5)*.75-ep.futureError01*.25+ep.importance01*.2-.1);
      const rIdx=this.relationIndex(ep.relationId);
      for(let j=0;j<DIM;j++)this.state.relationWeights[rIdx]![j]=clamp11(this.state.relationWeights[rIdx]![j]!+.0005*signal*(ep.identity[j]??0));
      this.state.replayUpdates++;
    }
  }
  consolidateChapter(){
    const recent=this.state.episodes.slice(-32);
    if(recent.length<8)return;
    const centroid=Array.from({length:DIM},(_,i)=>mean(recent.map(e=>e.identity[i]??0)));
    const importance=mean(recent.map(e=>e.importance01));
    const relationId=recent[recent.length-1]!.relationId;
    const values=TRAITS.map(t=>mean(recent.map(e=>e.traits[t])));
    this.state.chapters.push({id:this.state.chapters.length+1,startTick:recent[0]!.tick,endTick:recent[recent.length-1]!.tick,centroid,valueSignature:values,relationId,importance01:importance});
    if(this.state.chapters.length>24)this.state.chapters.shift();
    this.state.consolidationCount++;
    if(importance>.74)this.state.committedValues=values.slice(0,REL).map((v,i)=>clamp01((this.state.committedValues[i]??.5)*.98+v*.02));
    this.state.committedIdentityVersion++;
  }
  predictFuture(horizon:1|8|32){const idx=HORIZONS.indexOf(horizon);return this.state.futureSelf[Math.max(0,idx)]!.slice();}
  relationshipSnapshot(relationId:string){const r=this.state.relationshipStates.find(x=>x.relationId===relationId);return r?structuredClone(r):null;}
  futureSelfAblation(context:number[]){
    const base=this.state.identityLatent.slice();
    const normal=this.state.futureWeights[1]!.map((w,i)=>tanh((base[i]??0)*.40+w*.55+(context[i]??0)*.05));
    const backup=this.state.futureWeights.map(x=>x.slice());
    this.state.futureWeights=this.state.futureWeights.map(row=>row.map(()=>0));
    const ablated=base.map((v,i)=>tanh(v*.40+(context[i]??0)*.05));
    this.state.futureWeights=backup;
    const delta=mean(normal.map((v,i)=>Math.abs(v-(ablated[i]??0))));
    this.state.causalAblationDrop01=clamp01(delta*2.5);
    return this.state.causalAblationDrop01;
  }
  actionBias(action:ActionKind){const idx=ACTIONS.indexOf(action);if(idx<0)return 0;const w=dot(this.state.actionWeights[idx]!,this.state.identityLatent)/Math.max(1,DIM);const future=dot(this.state.futureSelf[1]!,this.state.actionWeights[idx]!)/Math.max(1,DIM);const relation=this.state.relationshipStability01-.5;const scarBias=this.scarLesioned?0:clamp11((this.state.scarActionBiases[action]??0)*(.45+.55*this.state.negativeScarConfidence01)+this.scarContextGeneralized(action));return clamp11(w*.022+future*.018+relation*.012+(this.state.futureIdentityAlignment01-.5)*.018+scarBias*.22);}
  identityToPersonalityEvidence(){return TRAITS.map((trait,i)=>({trait,traitValue:this.state.traitValues[trait],stability01:this.state.identityStability01,futureConsistency01:this.state.futureConsistency01,evidence01:clamp01(.42+Math.abs(this.state.traitValues[trait]-.5)*.6+this.state.futureConsistency01*.2+this.state.autobiographicalCompression01*.18),support:this.state.traitValues[trait]>=.5}));}
  diagnostics(){
    return {
      version:1,
      steps:this.state.steps,
      learningUpdates:this.state.learningUpdates,
      replayUpdates:this.state.replayUpdates,
      consolidationCount:this.state.consolidationCount,
      identityLatent:this.state.identityLatent.slice(),
      futureSelf:this.state.futureSelf.map(x=>x.slice()),
      traitValues:{...this.state.traitValues},
      relationshipCount:this.state.relationshipStates.length,
      relationshipStability01:this.state.relationshipStability01,
      futureConsistency01:this.state.futureConsistency01,
      futureIdentityAlignment01:this.state.futureIdentityAlignment01,
      autobiographicalCompression01:this.state.autobiographicalCompression01,
      goalPreferenceInfluence01:this.state.goalPreferenceInfluence01,
      developmentalMomentum01:this.state.developmentalMomentum01,
      identityStability01:this.state.identityStability01,
      causalAblationDrop01:this.state.causalAblationDrop01,
      episodeCount:this.state.episodes.length,
      chapterCount:this.state.chapters.length,
      committedIdentityVersion:this.state.committedIdentityVersion,
      traitSpread01:this.traitSpread(),
      futureError01:this.state.lastFutureError01,
      committedValues:this.state.committedValues.slice(),
      negativeScar01:this.state.negativeScar01,negativeScarConfidence01:this.state.negativeScarConfidence01,negativeScarCount:this.state.negativeScarCount,scarLesioned:this.scarLesioned,activeScarContextKey:this.activeScarContextKey,scarContextCount:Object.keys(this.state.scarContextStates).length,scarContextStates:{...this.state.scarContextStates},
      recovery01:this.state.recovery01,recoveryCount:this.state.recoveryCount,lastScarTick:this.state.lastScarTick,scarActionBiases:{...this.state.scarActionBiases},scarHistoryCount:this.state.scarHistory.length,
    };
  }
  traitSpread(){const v=TRAITS.map(t=>this.state.traitValues[t]);const m=mean(v);return Math.sqrt(mean(v.map(x=>(x-m)*(x-m))));}
}
