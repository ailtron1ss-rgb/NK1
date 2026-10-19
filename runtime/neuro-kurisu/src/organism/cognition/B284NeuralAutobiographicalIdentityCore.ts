import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const DIM = 24;
const TRAITS = ['curiosity','truth-seeking','self-reflection','care','social-attunement','self-preservation','persistence','autonomy'] as const;
type Trait = typeof TRAITS[number];
const clamp01=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp01(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.08)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const matrix=(rows:number,cols:number,seed:number,scale=.05)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>rand(seed+i*97+j*17,scale)));

export interface B284Episode{tick:number;selfState:number[];worldState:number[];goalState:number[];memoryState:number[];outcome01:number;predictionError01:number;traitSnapshot:Record<Trait,number>;identitySimilarity01:number;}
export interface B284State {
  version:1;
  tick:number;
  steps:number;
  learningUpdates:number;
  replayUpdates:number;
  identityLatent:number[];
  identityWeights:number[][];
  recurrentWeights:number[][];
  valueWeights:number[][];
  traitValues:Record<Trait,number>;
  traitInertia:Record<Trait,number>;
  valueCoherence01:number;
  autobiographicalContinuity01:number;
  selfConsistency01:number;
  agency01:number;
  personalityGrounding01:number;
  goalAlignment01:number;
  relationshipStability01:number;
  identityStability01:number;
  lastIdentityPredictionError01:number;
  lastOutcomeReward01:number;
  identityAblationDrop01:number;
  episodes:B284Episode[];
  recentAssemblies:number[][];
  committedIdentityId:string;
  identityRevision:number;
  revisionEvidenceStreak:number;
  revisionIndependentEvidenceCount:number;
  revisionHoldoutReady:boolean;
  revisionCandidateReason:'major-outcome'|'contradiction'|'new-value'|null;
  lastRevisionEvidenceTick:number;
  lastRevisionContextKey:string;
  revisionCooldownUntilTick:number;
  history:Array<{tick:number;continuity:number;coherence:number;agency:number;revision:number}>;
}

export interface B284StepInput{tick:number;globalLatent?:number[];selfLatent?:number[];worldLatent?:number[];goalVector?:number[];memoryLatent?:number[];personalityVector?:number[];relationshipVector?:number[];reward01?:number;predictionError01?:number;agency01?:number;learningEnabled?:boolean;personalityLedgerEnabled?:boolean;}

export const defaultB284State=():B284State=>({
  version:1,tick:0,steps:0,learningUpdates:0,replayUpdates:0,
  identityLatent:new Array(DIM).fill(0),
  identityWeights:matrix(DIM,DIM,284001,.035),recurrentWeights:matrix(DIM,DIM,284101,.04),valueWeights:Array.from({length:TRAITS.length},(_,ti)=>Array.from({length:DIM},(_,j)=>rand(284201+ti*101+j*7,.09)+.035*Math.sin((ti+1)*(j+1)*.31))),
  traitValues:Object.fromEntries(TRAITS.map((t,i)=>[t,clamp01(.5+rand(284301+i,.08))])) as Record<Trait,number>,
  traitInertia:Object.fromEntries(TRAITS.map(t=>[t,.965])) as Record<Trait,number>,
  valueCoherence01:.5,autobiographicalContinuity01:.5,selfConsistency01:.5,agency01:.5,personalityGrounding01:.5,goalAlignment01:.5,relationshipStability01:.5,identityStability01:.5,lastIdentityPredictionError01:.5,lastOutcomeReward01:.5,identityAblationDrop01:0,
  episodes:[],recentAssemblies:[],committedIdentityId:'kurisu-self-core',identityRevision:0,revisionEvidenceStreak:0,revisionIndependentEvidenceCount:0,revisionHoldoutReady:false,revisionCandidateReason:null,lastRevisionEvidenceTick:-Infinity,lastRevisionContextKey:'',revisionCooldownUntilTick:0,history:[]
});

export class B284NeuralAutobiographicalIdentityCore{
  private state=B284NeuralAutobiographicalIdentityCore.create();
  static create(){return defaultB284State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw:unknown){
    const base=defaultB284State(); if(!raw||typeof raw!=='object'){this.state=base;return;}
    const r=raw as Partial<B284State>; const srcTraits=(r.traitValues??{}) as Record<string,number>;
    this.state={...base,...r,
      identityLatent:Array.isArray(r.identityLatent)?r.identityLatent.slice(0,DIM):base.identityLatent,
      identityWeights:Array.isArray(r.identityWeights)?r.identityWeights.slice(0,DIM):base.identityWeights,
      recurrentWeights:Array.isArray(r.recurrentWeights)?r.recurrentWeights.slice(0,DIM):base.recurrentWeights,
      valueWeights:Array.isArray(r.valueWeights)?r.valueWeights.slice(0,TRAITS.length):base.valueWeights,
      traitValues:Object.fromEntries(TRAITS.map((t)=>[t,clamp01(srcTraits[t]??base.traitValues[t])])) as Record<Trait,number>,
      traitInertia:Object.fromEntries(TRAITS.map((t)=>[t,clamp01(Number((r.traitInertia as any)?.[t]??.965))])) as Record<Trait,number>,
      episodes:Array.isArray(r.episodes)?r.episodes.slice(-192):[],
      recentAssemblies:Array.isArray(r.recentAssemblies)?r.recentAssemblies.slice(-32).map((x)=>Array.isArray(x)?x.slice(0,DIM):[]):[],
      history:Array.isArray(r.history)?r.history.slice(-256):[]
    };
  }

  step(input:B284StepInput){
    this.state.tick=input.tick;
    const combined=Array.from({length:DIM},(_,i)=>clamp11(
      (input.globalLatent?.[i%DIM]??0)*.22 +
      (input.selfLatent?.[i%(input.selfLatent?.length||1)]??0)*.22 +
      (input.worldLatent?.[i%(input.worldLatent?.length||1)]??0)*.16 +
      (input.goalVector?.[i%(input.goalVector?.length||1)]??0)*.14 +
      (input.memoryLatent?.[i%(input.memoryLatent?.length||1)]??0)*.14 +
      (input.relationshipVector?.[i%(input.relationshipVector?.length||1)]??0)*.07 +
      ((input.personalityLedgerEnabled===false?0:(input.personalityVector?.[i%(input.personalityVector?.length||1)]??0)))*.05
    ));
    const prev=this.state.identityLatent.slice();
    const next=new Array(DIM).fill(0);
    for(let i=0;i<DIM;i++){
      let s=0;for(let j=0;j<DIM;j++) s += this.state.identityWeights[i]![j]!*combined[j] + this.state.recurrentWeights[i]![j]!*(prev[j]??0)*.55;
      next[i]=tanh(s + combined[i]*.18);
    }
    const predictionError=1-cosine01(next,combined);
    const reward=clamp01(input.reward01??.5);
    const traitValues={...this.state.traitValues};
    for(let ti=0;ti<TRAITS.length;ti++){
      const neuralSignal=tanh(dot(this.state.valueWeights[ti]!,next)/Math.max(2,DIM*.35));
      const goalSignal=clamp11(input.goalVector?.[ti%(input.goalVector?.length||1)]??0);
      const activation=clamp01(.5+.5*neuralSignal);
      const drive=clamp11((reward-.5)*.5-(input.predictionError01??.5-.5)*.3+(activation-.5)*1.05+goalSignal*.72);
      const inertia=clamp01(this.state.traitInertia[TRAITS[ti]!]??.965);
      const updateRate=Math.max(.02,Math.min(.08,1-inertia+.02));
      traitValues[TRAITS[ti]!] = clamp01((this.state.traitValues[TRAITS[ti]!]??.5)*inertia + clamp01(.5+drive*.5)*updateRate);
    }
    this.state.identityLatent=next;
    this.state.traitValues=traitValues;
    this.state.valueCoherence01=clamp01(.4+.6*(1-Math.abs(this.traitSpread()-.25)));
    this.state.autobiographicalContinuity01=clamp01(.5+.5*cosine01(next,this.state.recentAssemblies[0]??next));
    this.state.selfConsistency01=clamp01(.5+.5*cosine01(next,input.selfLatent?.slice(0,DIM)??next));
    this.state.agency01=clamp01(.45+.55*(input.agency01??.5));
    this.state.personalityGrounding01=clamp01(.45+.55*this.traitCoherence(input.personalityVector));
    this.state.goalAlignment01=clamp01(.5+.5*cosine01(next,input.goalVector?.slice(0,DIM)??next));
    this.state.relationshipStability01=clamp01(.45+.55*cosine01(next,input.relationshipVector?.slice(0,DIM)??next));
    this.state.identityStability01=clamp01(.45+.55*cosine01(next,prev));
    this.state.lastIdentityPredictionError01=predictionError;
    this.state.lastOutcomeReward01=reward;
    this.state.steps++;
    this.state.recentAssemblies=[next,...this.state.recentAssemblies].slice(0,32);
    this.state.episodes.push({tick:input.tick,selfState:(input.selfLatent??[]).slice(0,DIM),worldState:(input.worldLatent??[]).slice(0,DIM),goalState:(input.goalVector??[]).slice(0,DIM),memoryState:(input.memoryLatent??[]).slice(0,DIM),outcome01:reward,predictionError01:predictionError,traitSnapshot:{...traitValues},identitySimilarity01:this.state.identityStability01});
    if(this.state.episodes.length>192)this.state.episodes.shift();
    if(input.learningEnabled!==false)this.learn(combined,next,reward,input.predictionError01??predictionError);
    if(input.tick%24===0)this.replay(6);
    this.state.history.push({tick:input.tick,continuity:this.state.autobiographicalContinuity01,coherence:this.state.valueCoherence01,agency:this.state.agency01,revision:this.state.identityRevision});
    if(this.state.history.length>256)this.state.history.shift();
    return this.diagnostics();
  }

  private learn(input:number[],next:number[],reward:number,predErr:number){
    const third=clamp11((reward-.5)*.9-predErr*.35);
    for(let i=0;i<DIM;i++)for(let j=0;j<DIM;j++){
      const hebb=(next[i]??0)*(input[j]??0);
      this.state.identityWeights[i]![j]=clamp11(this.state.identityWeights[i]![j]! + .0018*third*hebb);
      this.state.recurrentWeights[i]![j]=clamp11(this.state.recurrentWeights[i]![j]! + .0012*third*(next[i]??0)*(this.state.identityLatent[j]??0));
    }
    for(let ti=0;ti<TRAITS.length;ti++)for(let j=0;j<DIM;j++){
      const target=((this.state.traitValues[TRAITS[ti]!]??.5)-.5)*2;
      this.state.valueWeights[ti]![j]=clamp11(this.state.valueWeights[ti]![j]! + .0011*target*(next[j]??0) + .00055*third*(next[j]??0));
    }
    this.state.learningUpdates++;
  }

  replay(count=4){
    const recent=this.state.episodes.slice(-Math.max(1,count));
    for(const ep of recent){
      const signal=clamp11((ep.outcome01-.5)*.8-ep.predictionError01*.25);
      const src=ep.selfState.length?ep.selfState:ep.goalState;
      for(let i=0;i<DIM;i++)for(let j=0;j<DIM;j++)this.state.recurrentWeights[i]![j]=clamp11(this.state.recurrentWeights[i]![j]!+.0007*signal*(src[j]??0)*(this.state.identityLatent[i]??0));
      this.state.replayUpdates++;
    }
  }

  private applyIdentityRevision(reason:'major-outcome'|'contradiction'|'new-value',evidence01:number){
    const evidence=clamp01(evidence01); const old=this.state.identityRevision;
    if(evidence<.50)return {revised:false,revision:old};
    this.state.identityRevision++;
    for(let i=0;i<DIM;i++) this.state.recurrentWeights[i]![i]=clamp11(this.state.recurrentWeights[i]![i]!*.985 + (reason==='new-value'?0.01:0.004)*evidence);
    this.state.identityStability01=clamp01(this.state.identityStability01*.86+.14*(1-Math.min(1,Math.abs(this.state.identityRevision-old)*.08)));
    this.state.revisionCooldownUntilTick=this.state.tick+24;
    this.state.revisionEvidenceStreak=0;
    this.state.revisionIndependentEvidenceCount=0;
    this.state.revisionHoldoutReady=false;
    this.state.revisionCandidateReason=null;
    return {revised:true,revision:this.state.identityRevision};
  }

  reviseIdentity(reason:'major-outcome'|'contradiction'|'new-value',evidence01:number){
    return this.applyIdentityRevision(reason,evidence01);
  }

  observeVerifiedRevisionEvidence(input:{tick:number;reason:'major-outcome'|'contradiction'|'new-value';evidence01:number;verified01:number;independent01:number;contextKey:string;internalConsistency01?:number}){
    const evidence=clamp01(input.evidence01);
    const verified=clamp01(input.verified01);
    const independent=clamp01(input.independent01);
    const internalConsistency=clamp01(input.internalConsistency01??0);
    const previousTick=this.state.lastRevisionEvidenceTick;
    const previousContext=this.state.lastRevisionContextKey;
    if(input.tick<previousTick || input.tick-previousTick>48){
      this.state.revisionEvidenceStreak=0;
      this.state.revisionIndependentEvidenceCount=0;
      this.state.revisionHoldoutReady=false;
      this.state.revisionCandidateReason=null;
    }
    const evidenceAdmissible=(evidence>=.60 && verified>=.62) || (evidence>=.58 && internalConsistency>=.82);
    if(evidenceAdmissible){
      this.state.revisionEvidenceStreak=Math.min(8,this.state.revisionEvidenceStreak+1);
      this.state.revisionIndependentEvidenceCount=Math.min(8,this.state.revisionIndependentEvidenceCount+(independent>=.62?1:0));
      if(this.state.revisionEvidenceStreak>1 && previousContext && previousContext!==String(input.contextKey)) this.state.revisionHoldoutReady=true;
      this.state.revisionCandidateReason=input.reason;
      this.state.lastRevisionEvidenceTick=input.tick;
      this.state.lastRevisionContextKey=String(input.contextKey);
    } else if(evidence<.45){
      this.state.revisionEvidenceStreak=Math.max(0,this.state.revisionEvidenceStreak-1);
      this.state.revisionHoldoutReady=false;
    }
    const externallyReady=verified>=.62 && this.state.revisionIndependentEvidenceCount>=2;
    const internallyReady=internalConsistency>=.82 && this.state.revisionEvidenceStreak>=3;
    const ready=(externallyReady || internallyReady) && this.state.revisionHoldoutReady && input.tick>=this.state.revisionCooldownUntilTick;
    if(!ready) return {revised:false,revision:this.state.identityRevision,pendingEvidenceStreak:this.state.revisionEvidenceStreak,independentEvidenceCount:this.state.revisionIndependentEvidenceCount,holdoutReady:this.state.revisionHoldoutReady,mode:externallyReady?'external':internallyReady?'internal':'pending'};
    return {revised:true,revision:this.applyIdentityRevision(this.state.revisionCandidateReason??input.reason,evidence).revision,pendingEvidenceStreak:0,independentEvidenceCount:0,holdoutReady:false,mode:externallyReady?'external':'internal'};
  }

  actionBias(action:ActionKind){
    const idx=ACTIONS.indexOf(action); if(idx<0)return 0;
    const identitySignal=(this.state.identityLatent[(idx*3)%DIM]??0)*.024;
    const traitMap:Record<ActionKind,Trait>={respond:'care',explore:'curiosity',verify:'truth-seeking',rest:'self-preservation',reflect:'self-reflection',wait:'persistence',defer:'autonomy'};
    const trait=this.state.traitValues[traitMap[action]]??.5;
    return clamp11(identitySignal+(trait-.5)*.03)*clamp01(.5+this.state.identityStability01*.5);
  }

  traitSpread(){const vals=TRAITS.map(t=>this.state.traitValues[t]);const m=vals.reduce((a,b)=>a+b,0)/vals.length;return Math.sqrt(vals.reduce((s,v)=>s+(v-m)*(v-m),0)/vals.length);}
  traitCoherence(v?:number[]){if(!v?.length)return .5;const a=this.identityLatent();const b=v.slice(0,DIM);return cosine01(a,b);}
  identityLatent(){return this.state.identityLatent.slice();}
  symbolicLedgerFreeSnapshot(){return {identityLatent:this.state.identityLatent.slice(),traitValues:{...this.state.traitValues},identityRevision:this.state.identityRevision,continuity01:this.state.autobiographicalContinuity01};}
  symbolicLedgerFreeRecall(context:number[]){return cosine01(this.state.identityLatent,context.slice(0,DIM));}
  ablateIdentityContext(context:number[]){const before=this.symbolicLedgerFreeRecall(context);const backup=this.state.identityLatent.slice();this.state.identityLatent=new Array(DIM).fill(0);const after=this.symbolicLedgerFreeRecall(context);this.state.identityLatent=backup;this.state.identityAblationDrop01=clamp01(before-after);return this.state.identityAblationDrop01;}
  diagnostics(){
    return {
      version:1,
      steps:this.state.steps,
      learningUpdates:this.state.learningUpdates,
      replayUpdates:this.state.replayUpdates,
      identityRevision:this.state.identityRevision,
      revisionEvidenceStreak:this.state.revisionEvidenceStreak,
      revisionIndependentEvidenceCount:this.state.revisionIndependentEvidenceCount,
      revisionHoldoutReady:this.state.revisionHoldoutReady,
      revisionCooldownUntilTick:this.state.revisionCooldownUntilTick,
      identityLatent:this.state.identityLatent.slice(),
      traitValues:{...this.state.traitValues},
      valueCoherence01:this.state.valueCoherence01,
      autobiographicalContinuity01:this.state.autobiographicalContinuity01,
      selfConsistency01:this.state.selfConsistency01,
      agency01:this.state.agency01,
      personalityGrounding01:this.state.personalityGrounding01,
      goalAlignment01:this.state.goalAlignment01,
      relationshipStability01:this.state.relationshipStability01,
      identityStability01:this.state.identityStability01,
      lastIdentityPredictionError01:this.state.lastIdentityPredictionError01,
      lastOutcomeReward01:this.state.lastOutcomeReward01,
      identityAblationDrop01:this.state.identityAblationDrop01,
      episodeCount:this.state.episodes.length,
      traitSpread01:this.traitSpread(),
    };
  }
}
