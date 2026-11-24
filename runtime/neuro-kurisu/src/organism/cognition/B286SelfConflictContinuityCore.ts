import type { ActionKind } from '../core/types.ts';

const DIM=24;
const HORIZONS=[1,8,32,128] as const;
const TRAITS=['curiosity','truth-seeking','self-reflection','care','social-attunement','self-preservation','persistence','autonomy'] as const;
type Trait=typeof TRAITS[number];
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp01(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.06)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const vec=(seed:number,len:number,scale=.08)=>Array.from({length:len},(_,i)=>rand(seed+i*31,scale));
const matrix=(r:number,c:number,seed:number,scale=.04)=>Array.from({length:r},(_,i)=>Array.from({length:c},(_,j)=>rand(seed+i*97+j*17,scale)));

export interface B286ValueConflict{trait:Trait;present01:number;future01:number;pastCommitment01:number;conflict01:number;resolution01:number;}
export interface B286RelationSelf{relationId:string;trust01:number;attachment01:number;boundary01:number;role01:number;identityDelta01:number;}
export interface B286State{
  version:1;tick:number;steps:number;learningUpdates:number;replayUpdates:number;revisionCount:number;
  identity:number[];pastIdentity:number[];presentIdentity:number[];futureIdentities:number[][];
  futureWeights:number[][];futureTraitWeights:number[][];commitmentWeights:number[][];conflictWeights:number[][];relationWeights:number[][];actionWeights:number[][];
  valueMemory:number[];commitments:number[];identityAnchor:number[];
  traitValues:Record<Trait,number>;conflicts:B286ValueConflict[];relations:B286RelationSelf[];
  activeFutureIndex:number;futureHorizonWeights:number[];selfContinuity01:number;futureCoherence01:number;identityConflict01:number;relationshipConflict01:number;valueIntegrity01:number;resolutionQuality01:number;autonomy01:number;personalityInfluence01:number;causalAblationDrop01:number;
  lastAction?:ActionKind;lastReward01:number;lastPredictionError01:number;episodes:Array<{tick:number;identity:number[];future:number[];relationId:string;reward01:number;importance01:number;conflict01:number}>;commitmentsHistory:Array<{tick:number;trait:Trait;value01:number;strength01:number}>;
}
export interface B286StepInput{tick:number;identityLatent:number[];pastIdentityLatent?:number[];futureHintLatent?:number[];worldLatent?:number[];goalVector?:number[];memoryLatent?:number[];personalityVector?:number[];relationshipVector?:number[];relationshipId?:string;reward01?:number;predictionError01?:number;action?:ActionKind;importance01?:number;learningEnabled?:boolean;}

export const defaultB286State=():B286State=>({
  version:1,tick:0,steps:0,learningUpdates:0,replayUpdates:0,revisionCount:0,
  identity:new Array(DIM).fill(0),pastIdentity:vec(286001,DIM,.02),presentIdentity:new Array(DIM).fill(0),futureIdentities:HORIZONS.map((h,i)=>vec(286101+i*79,DIM,.04)),
  futureWeights:HORIZONS.map((h,i)=>vec(286201+i*97,DIM,.11)),futureTraitWeights:TRAITS.map((_,i)=>vec(286151+i*83,DIM,.10)),commitmentWeights:matrix(TRAITS.length,DIM,286301,.045),conflictWeights:matrix(TRAITS.length,DIM,286401,.045),relationWeights:matrix(6,DIM,286501,.04),actionWeights:ACTIONS.map((_,i)=>vec(286601+i*71,DIM,.035)),
  valueMemory:new Array(TRAITS.length).fill(.5),commitments:new Array(TRAITS.length).fill(.5),identityAnchor:new Array(DIM).fill(0),
  traitValues:Object.fromEntries(TRAITS.map((t,i)=>[t,clamp01(.5+rand(286701+i,.05))])) as Record<Trait,number>,conflicts:[],relations:[],activeFutureIndex:1,futureHorizonWeights:[.24,.34,.26,.16],selfContinuity01:.5,futureCoherence01:.5,identityConflict01:.5,relationshipConflict01:.5,valueIntegrity01:.5,resolutionQuality01:.5,autonomy01:.5,personalityInfluence01:.5,causalAblationDrop01:0,lastReward01:.5,lastPredictionError01:.5,episodes:[],commitmentsHistory:[]
});

export class B286SelfConflictContinuityCore{
  private state=B286SelfConflictContinuityCore.create();
  static create(){return defaultB286State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw:unknown){const base=defaultB286State();if(!raw||typeof raw!=='object'){this.state=base;return;}const r=raw as Partial<B286State>;const tv=(r.traitValues??{}) as Record<string,number>;this.state={...base,...r,
    identity:Array.isArray(r.identity)?r.identity.slice(0,DIM):base.identity,
    pastIdentity:Array.isArray(r.pastIdentity)?r.pastIdentity.slice(0,DIM):base.pastIdentity,
    presentIdentity:Array.isArray(r.presentIdentity)?r.presentIdentity.slice(0,DIM):base.presentIdentity,
    futureIdentities:Array.isArray(r.futureIdentities)?r.futureIdentities.slice(0,HORIZONS.length).map((x)=>Array.isArray(x)?x.slice(0,DIM):new Array(DIM).fill(0)):base.futureIdentities,
    futureWeights:Array.isArray(r.futureWeights)?r.futureWeights.slice(0,HORIZONS.length).map((x)=>Array.isArray(x)?x.slice(0,DIM):new Array(DIM).fill(0)):base.futureWeights,
    futureTraitWeights:Array.isArray(r.futureTraitWeights)?r.futureTraitWeights.slice(0,TRAITS.length).map((x)=>Array.isArray(x)?x.slice(0,DIM):new Array(DIM).fill(0)):base.futureTraitWeights,
    commitmentWeights:Array.isArray(r.commitmentWeights)?r.commitmentWeights.slice(0,TRAITS.length):base.commitmentWeights,
    conflictWeights:Array.isArray(r.conflictWeights)?r.conflictWeights.slice(0,TRAITS.length):base.conflictWeights,
    relationWeights:Array.isArray(r.relationWeights)?r.relationWeights.slice(0,6):base.relationWeights,
    actionWeights:Array.isArray(r.actionWeights)?r.actionWeights.slice(0,ACTIONS.length):base.actionWeights,
    valueMemory:Array.isArray(r.valueMemory)?r.valueMemory.slice(0,TRAITS.length):base.valueMemory,
    commitments:Array.isArray(r.commitments)?r.commitments.slice(0,TRAITS.length):base.commitments,
    identityAnchor:Array.isArray(r.identityAnchor)?r.identityAnchor.slice(0,DIM):base.identityAnchor,
    traitValues:Object.fromEntries(TRAITS.map(t=>[t,clamp01(tv[t]??base.traitValues[t])])) as Record<Trait,number>,
    conflicts:Array.isArray(r.conflicts)?r.conflicts.slice(-TRAITS.length*2):[],relations:Array.isArray(r.relations)?r.relations.slice(-16):[],episodes:Array.isArray(r.episodes)?r.episodes.slice(-256):[],commitmentsHistory:Array.isArray(r.commitmentsHistory)?r.commitmentsHistory.slice(-128):[]
  };}
  private relationIndex(id:string){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h%6;}
  private buildContext(input:B286StepInput){const base=[...input.identityLatent,...(input.worldLatent??[]),...(input.goalVector??[]),...(input.memoryLatent??[]),...(input.personalityVector??[]),...(input.relationshipVector??[])];return Array.from({length:DIM},(_,i)=>clamp11((base.length?base[i%base.length]:0)*.42+(this.state.identity[i]??0)*.18+(this.state.identityAnchor[i]??0)*.16+(this.state.presentIdentity[i]??0)*.24));}
  private ensureRelation(id:string,ctx:number[]){let r=this.state.relations.find(x=>x.relationId===id);if(!r){r={relationId:id,trust01:.5,attachment01:.5,boundary01:.5,role01:.5,identityDelta01:0};this.state.relations.push(r);}r.identityDelta01=1-cosine01(ctx,this.state.identity);return r;}
  step(input:B286StepInput){
    this.state.tick=input.tick;this.state.steps++;const ctx=this.buildContext(input);const relId=input.relationshipId??'self-general';const rel=this.ensureRelation(relId,ctx);const relIdx=this.relationIndex(relId);const reward=clamp01(input.reward01??.5);const pe=clamp01(input.predictionError01??.5);const importance=clamp01(input.importance01??(.35+Math.abs(reward-.5)*1.4));
    this.state.pastIdentity=this.state.presentIdentity.slice();
    const next=ctx.map((v,i)=>tanh(v*.46+(this.state.identity[i]??0)*.38+(this.state.relationWeights[relIdx]![i]??0)*rel.trust01*.12));
    this.state.presentIdentity=next;this.state.identity=next.slice();
    const futureIdentities=HORIZONS.map((h,hi)=>Array.from({length:DIM},(_,i)=>tanh(next[i]*.44+(this.state.futureWeights[hi]![i]??0)*.52+(this.state.identityAnchor[i]??0)*.04))) as number[][];
    this.state.futureIdentities=futureIdentities;
    const conflicts:B286ValueConflict[]=[];
    for(let ti=0;ti<TRAITS.length;ti++){
      const current=this.state.traitValues[TRAITS[ti]!]??.5;const goalSignal=clamp11(input.goalVector?.[ti%(input.goalVector?.length||1)]??0);const future=tanh(dot(this.state.futureWeights[ti%HORIZONS.length]!,futureIdentities[ti%HORIZONS.length]!)/Math.max(2,DIM*.4));const past=this.state.commitments[ti]??.5;const commitment=tanh(dot(this.state.commitmentWeights[ti]!,next)/Math.max(2,DIM*.35));const tension=tanh(dot(this.state.conflictWeights[ti]!,next)/Math.max(2,DIM*.35));
      const learnedFuture01=clamp01(.5+future*.5);const desiredFuture01=clamp01(.5+goalSignal*.46+((rel.identityDelta01-.5)*.16));const future01=clamp01(learnedFuture01*.58+desiredFuture01*.42);const pastCommitment01=clamp01(.5+commitment*.5);const present01=current;const conflict=clamp01(Math.abs(present01-desiredFuture01)*.52+Math.abs(pastCommitment01-desiredFuture01)*.34+Math.abs(tension)*.09+Math.abs(learnedFuture01-desiredFuture01)*.05);const resolution=clamp01(1-conflict*(.55+pe*.25));
      conflicts.push({trait:TRAITS[ti]!,present01,future01,pastCommitment01,conflict01:conflict,resolution01:resolution});
      const directional=clamp11((reward-.5)*.25 + (future01-current)*.18 + (pastCommitment01-current)*.22 + ((ti%2===0?1:-1)*rel.identityDelta01*.12));
      this.state.traitValues[TRAITS[ti]!] = clamp01(current*(1-.004)+(current+directional*.5)*.004);
      this.state.commitments[ti]=clamp01((this.state.commitments[ti]??.5)*.996+(future01*.002+pastCommitment01*.002));
    }
    this.state.conflicts=conflicts;this.state.identityConflict01=mean(conflicts.map(x=>x.conflict01));this.state.resolutionQuality01=mean(conflicts.map(x=>x.resolution01));
    const relationConflict=clamp01(rel.identityDelta01*.65+Math.abs(rel.trust01-rel.attachment01)*.35); this.state.relationshipConflict01=relationConflict; rel.trust01=clamp01(rel.trust01*.995+clamp01(.5+(reward-.5)*.6-pe*.25)*.005); rel.attachment01=clamp01(rel.attachment01*.997+importance*.003);
    this.state.selfContinuity01=cosine01(this.state.pastIdentity,next);this.state.futureCoherence01=mean(futureIdentities.map(f=>cosine01(f,next)));this.state.valueIntegrity01=clamp01(1-this.state.identityConflict01*.6-this.state.relationshipConflict01*.2+this.state.resolutionQuality01*.2);
    this.state.autonomy01=clamp01(.35+this.state.valueIntegrity01*.28+this.state.selfContinuity01*.22+this.state.futureCoherence01*.15+.10*importance);this.state.personalityInfluence01=clamp01(.35+this.traitSpread()*.85+this.state.identityConflict01*.2);
    const weightedFuture=futureIdentities.reduce((acc,f,i)=>acc.map((v,j)=>v+(f[j]??0)*(this.state.futureHorizonWeights[i]??0)),new Array(DIM).fill(0));
    for(let i=0;i<DIM;i++) this.state.identityAnchor[i]=clamp11((this.state.identityAnchor[i]??0)*.995+(next[i]??0)*.005+(weightedFuture[i]??0)*.002);
    if(input.learningEnabled!==false){
      const third=clamp11((reward-.5)*.8+(importance-.5)*.2-pe*.25+this.state.resolutionQuality01*.15);
      for(let ti=0;ti<TRAITS.length;ti++) for(let j=0;j<DIM;j++){
        this.state.commitmentWeights[ti]![j]=clamp11(this.state.commitmentWeights[ti]![j]!+.0011*third*(next[j]??0));
        this.state.conflictWeights[ti]![j]=clamp11(this.state.conflictWeights[ti]![j]!+.0008*(this.state.conflicts[ti]?.conflict01??.5)*third*(next[j]??0));
      }
      for(let hi=0;hi<HORIZONS.length;hi++) for(let j=0;j<DIM;j++) this.state.futureWeights[hi]![j]=clamp11(this.state.futureWeights[hi]![j]!+.0015*third*(futureIdentities[hi]?.[j]??0));
      for(let ti=0;ti<TRAITS.length;ti++) for(let j=0;j<DIM;j++) this.state.futureTraitWeights[ti]![j]=clamp11(this.state.futureTraitWeights[ti]![j]!+.0018*third*(futureIdentities[ti%HORIZONS.length]?.[j]??0)*(ti%2===0?1:-1));
      this.state.learningUpdates++;
    }
    const strongestConflict=conflicts.slice().sort((a,b)=>b.conflict01-a.conflict01)[0]; if(importance>.58 && (strongestConflict?.conflict01??0)>.008 && input.tick-(this.state.commitmentsHistory.at(-1)?.tick??-999)>=12){this.state.revisionCount++; const rt=strongestConflict!.trait; this.state.commitmentsHistory.push({tick:input.tick,trait:rt,value01:this.state.traitValues[rt]??.5,strength01:strongestConflict!.conflict01});}
    this.state.episodes.push({tick:input.tick,identity:next.slice(),future:futureIdentities[1]!.slice(),relationId:relId,reward01:reward,importance01:importance,conflict01:this.state.identityConflict01});if(this.state.episodes.length>256)this.state.episodes.shift();
    this.state.lastReward01=reward;this.state.lastPredictionError01=pe;this.state.lastAction=input.action;return this.diagnostics();
  }
  replay(count=8){for(const e of this.state.episodes.slice(-count)){const signal=clamp11((e.reward01-.5)*.55+e.conflict01*.25+e.importance01*.18-.1);for(let j=0;j<DIM;j++){this.state.identityAnchor[j]=clamp11(this.state.identityAnchor[j]!+.0004*signal*(e.identity[j]??0));}this.state.replayUpdates++;}}
  actionBias(action:ActionKind){const idx=ACTIONS.indexOf(action);if(idx<0)return 0;const a=dot(this.state.identity,this.state.actionWeights[idx]!)/Math.max(1,DIM);const f=dot(this.state.futureIdentities[1]!,this.state.actionWeights[idx]!)/Math.max(1,DIM);const conflict=this.state.identityConflict01-.5;const integrity=this.state.valueIntegrity01-.5;return clamp11(a*.03+f*.025+integrity*.03-conflict*.025);}
  identityAblation(context:number[]){const normal=this.state.futureIdentities[1]!.map((v,i)=>tanh(v*.65+(context[i]??0)*.12));const ablated=this.state.pastIdentity.map((v,i)=>tanh(v*.65+(context[i]??0)*.12));const d=mean(normal.map((v,i)=>Math.abs(v-(ablated[i]??0))));this.state.causalAblationDrop01=clamp01(d*2.2);return this.state.causalAblationDrop01;}
  diagnostics(){
    return {
      version:1, steps:this.state.steps, learningUpdates:this.state.learningUpdates, replayUpdates:this.state.replayUpdates,
      revisionCount:this.state.revisionCount, identity:this.state.identity.slice(), pastIdentity:this.state.pastIdentity.slice(),
      presentIdentity:this.state.presentIdentity.slice(), futureIdentities:this.state.futureIdentities.map(x=>x.slice()),
      selfContinuity01:this.state.selfContinuity01, futureCoherence01:this.state.futureCoherence01,
      identityConflict01:this.state.identityConflict01, relationshipConflict01:this.state.relationshipConflict01,
      valueIntegrity01:this.state.valueIntegrity01, resolutionQuality01:this.state.resolutionQuality01,
      autonomy01:this.state.autonomy01, personalityInfluence01:this.state.personalityInfluence01,
      causalAblationDrop01:this.state.causalAblationDrop01, traitValues:{...this.state.traitValues},
      traitSpread01:this.traitSpread(), relationCount:this.state.relations.length,
      commitmentCount:this.state.commitmentsHistory.length, lastReward01:this.state.lastReward01,
      lastPredictionError01:this.state.lastPredictionError01,
    };
  }
  personalityEvidence(){return TRAITS.map(t=>({trait:t,value01:this.state.traitValues[t],evidence01:clamp01(.38+Math.abs(this.state.traitValues[t]-.5)*.7+this.state.valueIntegrity01*.2),confidence01:clamp01(.5+this.state.selfContinuity01*.25+this.state.futureCoherence01*.25),support:this.state.traitValues[t]>=.5}));}
  traitSpread(){const v=TRAITS.map(t=>this.state.traitValues[t]);const m=mean(v);return Math.sqrt(mean(v.map(x=>(x-m)*(x-m))));}
}
