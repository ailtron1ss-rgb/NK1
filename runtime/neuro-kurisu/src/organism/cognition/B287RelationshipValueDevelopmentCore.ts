/** B288 compatibility owner: canonical social-brain state is B288SocialPredictiveSelfOtherBrain. Keep this module until retirement criteria in reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md are satisfied. */
import type { ActionKind } from '../core/types.ts';

const DIM = 32;
const VALUES = ['curiosity','truth','care','social-attunement','autonomy','persistence','self-preservation','reciprocity'] as const;
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
type ValueName=typeof VALUES[number];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh=(x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot=(a:number[],b:number[])=>{let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=(a[i]??0)*(b[i]??0);return s;};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const norm=(v:number[])=>Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01=(a:number[],b:number[])=>clamp(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded=(seed:number)=>{let x=seed|0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>13))>>>0;};
const rand=(seed:number,scale=.05)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const vec=(seed:number,len=32,scale=.06)=>Array.from({length:len},(_,i)=>rand(seed+i*31,scale));
const matrix=(r:number,c:number,seed:number,scale=.03)=>Array.from({length:r},(_,i)=>Array.from({length:c},(_,j)=>rand(seed+i*97+j*17,scale)));

export interface B287RelationState{
  relationId:string; tick:number; latent:number[]; previousLatent:number[]; eligibility:number[];
  recurrent:number[][]; valueWeights:number[][]; actionWeights:number[][]; valueTrace:number[];
  trust01:number; attachment01:number; reciprocity01:number; predictability01:number; boundary01:number; commitment01:number;
  relationshipValue01:Record<ValueName,number>; predictedValence01:number; predictionError01:number; socialPredictionError01:number;
  identityInfluence01:number; repairReadiness01:number; conflict01:number; sharedGoalAlignment01:number; revisionPressure01:number; lastSelfInput:number[];
  successfulEpisodes:number; conflictEpisodes:number; repairEpisodes:number; transferUses:number; lastAction?:ActionKind; lastReward01:number;
  episodes:Array<{tick:number;action:ActionKind;reward01:number;surprise01:number;importance01:number;valueVector:number[]}>;
}

export interface B287State{
  version:1; tick:number; steps:number; learningUpdates:number; replayUpdates:number; relationCreations:number; relationRevisions:number; transferUses:number;
  relations:B287RelationState[]; globalIdentityInfluence01:number; socialValueCoherence01:number; relationshipDifferentiation01:number; hiddenGeneralization01:number; causalAblationDrop01:number;
}

export interface B287StepInput{
  tick:number; relationId:string; selfLatent:number[]; relationshipLatent:number[]; goalVector?:number[]; futureSelf?:number[]; personalityVector?:number[];
  socialState?:{trust01?:number;warmth01?:number;predictability01?:number;guardedness01?:number;agency01?:number;intentUncertainty01?:number;relationshipStrength01?:number};
  action?:ActionKind; reward01?:number; predictionError01?:number; surprise01?:number; importance01?:number; success01?:number; repairAttempted?:boolean; learningEnabled?:boolean;
}

export const defaultB287State=():B287State=>({version:1,tick:0,steps:0,learningUpdates:0,replayUpdates:0,relationCreations:0,relationRevisions:0,transferUses:0,relations:[],globalIdentityInfluence01:.5,socialValueCoherence01:.5,relationshipDifferentiation01:0,hiddenGeneralization01:0,causalAblationDrop01:0});

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const vecN=(v:unknown,len:number,lo:number,hi:number,fill:number):number[]=>Array.from({length:len},(_,i)=>{const x=Array.isArray(v)?(v as unknown[])[i]:undefined;const n=typeof x==='number'?x:Number(x);return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fill;});
const matN=(v:unknown,rows:number,cols:number,fb:number[][]):number[][]=>Array.from({length:rows},(_,i)=>{const row=Array.isArray(v)?(v as unknown[])[i]:undefined;const fbr=fb[i]??[];return Array.from({length:cols},(_,j)=>{const c=Array.isArray(row)?(row as unknown[])[j]:undefined;const n=typeof c==='number'?c:Number(c);return Number.isFinite(n)?Math.max(-1,Math.min(1,n)):(fbr[j]??0);});});
const sanValueMap=(x:unknown,fb:Record<ValueName,number>):Record<ValueName,number>=>{const r=(x&&typeof x==='object')?x as Record<string,unknown>:{};return Object.fromEntries(VALUES.map(v=>[v,clamp(finN(r[v],fb[v]))])) as Record<ValueName,number>;};
const sanEpisode=(x:unknown):{tick:number;action:ActionKind;reward01:number;surprise01:number;importance01:number;valueVector:number[]}|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {tick:cnt(r.tick,0),action:ACTIONS.includes(r.action as ActionKind)?r.action as ActionKind:ACTIONS[0]!,reward01:clamp(finN(r.reward01,.5)),surprise01:clamp(finN(r.surprise01,0)),importance01:clamp(finN(r.importance01,.5)),valueVector:vecN(r.valueVector,VALUES.length,0,1,0)};};
function freshRelation(relationId:string,seed:number):B287RelationState{
  return {
    relationId,
    tick: 0,
    latent: new Array(DIM).fill(0),
    previousLatent: new Array(DIM).fill(0),
    eligibility: new Array(DIM).fill(0),
    recurrent: matrix(DIM, DIM, seed, .026),
    valueWeights: VALUES.map((_, i) => vec(seed + 1000 + i * 83, DIM, .055)),
    actionWeights: ACTIONS.map((_, i) => vec(seed + 2000 + i * 71, DIM, .08)),
    valueTrace: new Array(VALUES.length).fill(0),
    trust01: .5,
    attachment01: .18,
    reciprocity01: .5,
    predictability01: .5,
    boundary01: .35,
    commitment01: .1,
    relationshipValue01: Object.fromEntries(
      VALUES.map((v, i) => [v, clamp(.5 + rand(seed + 3000 + i, .025))]),
    ) as Record<ValueName, number>,
    predictedValence01: .5,
    predictionError01: .5,
    socialPredictionError01: .5,
    identityInfluence01: 0,
    repairReadiness01: .2,
    conflict01: 0,
    sharedGoalAlignment01: .5,
    revisionPressure01: 0,
    lastSelfInput: new Array(DIM).fill(0),
    successfulEpisodes: 0,
    conflictEpisodes: 0,
    repairEpisodes: 0,
    transferUses: 0,
    lastReward01: .5,
    episodes: [],
  };
}

export class B287RelationshipValueDevelopmentCore{
  private state=B287RelationshipValueDevelopmentCore.create();
  static create(){return defaultB287State();}
  snapshot(){return structuredClone(this.state);}
  restore(raw: unknown) {
    const base = defaultB287State();
    const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
    const relRaw=read('relations');
    const relations=Array.isArray(relRaw)?(relRaw as unknown[]).slice(0,32).filter(x=>x&&typeof x==='object').map((x,i)=>{
      const r=x as Record<string,unknown>;
      const fb=freshRelation(str(r.relationId,`rel-${i}`,160),287001+i*97);
      const epRaw=r.episodes;
      return {relationId:str(r.relationId,fb.relationId,160),tick:cnt(r.tick,0),latent:vecN(r.latent,DIM,-1,1,0),previousLatent:vecN(r.previousLatent,DIM,-1,1,0),eligibility:vecN(r.eligibility,DIM,-1,1,0),recurrent:matN(r.recurrent,DIM,DIM,fb.recurrent),valueWeights:matN(r.valueWeights,VALUES.length,DIM,fb.valueWeights),actionWeights:matN(r.actionWeights,ACTIONS.length,DIM,fb.actionWeights),valueTrace:vecN(r.valueTrace,VALUES.length,-1,1,0),trust01:clamp(finN(r.trust01,fb.trust01)),attachment01:clamp(finN(r.attachment01,fb.attachment01)),reciprocity01:clamp(finN(r.reciprocity01,fb.reciprocity01)),predictability01:clamp(finN(r.predictability01,fb.predictability01)),boundary01:clamp(finN(r.boundary01,fb.boundary01)),commitment01:clamp(finN(r.commitment01,fb.commitment01)),relationshipValue01:sanValueMap(r.relationshipValue01,fb.relationshipValue01),predictedValence01:clamp(finN(r.predictedValence01,fb.predictedValence01)),predictionError01:clamp(finN(r.predictionError01,fb.predictionError01)),socialPredictionError01:clamp(finN(r.socialPredictionError01,fb.socialPredictionError01)),identityInfluence01:clamp(finN(r.identityInfluence01,fb.identityInfluence01)),repairReadiness01:clamp(finN(r.repairReadiness01,fb.repairReadiness01)),conflict01:clamp(finN(r.conflict01,fb.conflict01)),sharedGoalAlignment01:clamp(finN(r.sharedGoalAlignment01,fb.sharedGoalAlignment01)),revisionPressure01:clamp(finN(r.revisionPressure01,fb.revisionPressure01)),lastSelfInput:vecN(r.lastSelfInput,DIM,-1,1,0),successfulEpisodes:cnt(r.successfulEpisodes,0),conflictEpisodes:cnt(r.conflictEpisodes,0),repairEpisodes:cnt(r.repairEpisodes,0),transferUses:cnt(r.transferUses,0),lastReward01:clamp(finN(r.lastReward01,fb.lastReward01)),episodes:Array.isArray(epRaw)?(epRaw as unknown[]).slice(-128).map(sanEpisode).filter((e):e is {tick:number;action:ActionKind;reward01:number;surprise01:number;importance01:number;valueVector:number[]}=>e!==null):[],...(ACTIONS.includes(r.lastAction as ActionKind)?{lastAction:r.lastAction as ActionKind}:{})} as B287RelationState;
    }):[];
    this.state={version:1,tick:cnt(read('tick'),base.tick),steps:cnt(read('steps'),base.steps),learningUpdates:cnt(read('learningUpdates'),base.learningUpdates),replayUpdates:cnt(read('replayUpdates'),base.replayUpdates),relationCreations:cnt(read('relationCreations'),base.relationCreations),relationRevisions:cnt(read('relationRevisions'),base.relationRevisions),transferUses:cnt(read('transferUses'),base.transferUses),relations,globalIdentityInfluence01:clamp(finN(read('globalIdentityInfluence01'),base.globalIdentityInfluence01)),socialValueCoherence01:clamp(finN(read('socialValueCoherence01'),base.socialValueCoherence01)),relationshipDifferentiation01:clamp(finN(read('relationshipDifferentiation01'),base.relationshipDifferentiation01)),hiddenGeneralization01:clamp(finN(read('hiddenGeneralization01'),base.hiddenGeneralization01)),causalAblationDrop01:clamp(finN(read('causalAblationDrop01'),base.causalAblationDrop01))};
  }
  private ensureRelation(id:string){let r=this.state.relations.find(x=>x.relationId===id);if(!r){r=freshRelation(id,287001+this.state.relationCreations*193);this.state.relations.unshift(r);this.state.relationCreations++;}return r;}
  private actionIndex(action?:ActionKind){const i=action?ACTIONS.indexOf(action):-1;return i<0?0:i;}
  private context(input:B287StepInput){const social=input.socialState??{};const socialVec=[social.trust01??.5,social.warmth01??.5,social.predictability01??.5,1-(social.guardedness01??.35),social.agency01??.5,1-(social.intentUncertainty01??.65),social.relationshipStrength01??.15];const raw=[...input.selfLatent,...input.relationshipLatent,...(input.futureSelf??[]),...(input.goalVector??[]),...(input.personalityVector??[]),...socialVec];return Array.from({length:DIM},(_,i)=>clamp11((raw.length?raw[i%raw.length]:0)*.34+(input.selfLatent[i%Math.max(1,input.selfLatent.length)]??0)*.22));}
  private recurrentApply(r:B287RelationState,ctx:number[]){return Array.from({length:DIM},(_,i)=>{let s=ctx[i]??0;for(let j=0;j<DIM;j++)s+=(r.recurrent[i]?.[j]??0)*(r.latent[j]??0);return tanh(s*.62+(r.latent[i]??0)*.18);});}
  step(input:B287StepInput){
    this.state.tick=input.tick;this.state.steps++;const r=this.ensureRelation(String(input.relationId||'user'));const ctx=this.context(input);r.previousLatent=r.latent.slice();
    const next=this.recurrentApply(r,ctx); r.lastSelfInput=Array.from({length:DIM},(_,i)=>Number(input.selfLatent[i%Math.max(1,input.selfLatent.length)]??0)); const social=input.socialState??{};const actionIdx=this.actionIndex(input.action);
    const predicted=clamp(.5+dot(r.actionWeights[actionIdx]!,next)/Math.max(1,DIM*.18));const reward=clamp(input.reward01??.5);const pe=clamp(input.predictionError01??Math.abs(reward-predicted));const surprise=clamp(input.surprise01??pe);const importance=clamp(input.importance01??(.35+Math.abs(reward-.5)*1.25));
    const socialPreferenceSignals=[
      clamp((social.warmth01??.5)*.55+(social.relationshipStrength01??.15)*.45),
      clamp((social.predictability01??.5)*.68+(1-(social.intentUncertainty01??.65))*.32),
      clamp((social.warmth01??.5)*.55+r.attachment01*.45),
      clamp((social.relationshipStrength01??.15)*.62+(social.agency01??.5)*.18+(1-(social.intentUncertainty01??.65))*.20),
      clamp((social.guardedness01??.35)*.62+r.boundary01*.38),
      clamp(r.commitment01*.65+r.reciprocity01*.35),
      clamp((social.guardedness01??.35)*.72+(1-(social.predictability01??.5))*.28),
      clamp(r.reciprocity01*.72+(social.relationshipStrength01??.15)*.28),
    ];
    const valueVector=VALUES.map((v,i)=>clamp(.5+.5*tanh(dot(r.valueWeights[i]!,next)/Math.max(2,DIM*.2))*.72+.28*(socialPreferenceSignals[i]??.5)));
    const identityInfluence=clamp(1-cosine01(next,input.selfLatent));r.latent=next;r.identityInfluence01=clamp(r.identityInfluence01*.94+identityInfluence*.06);
    const socialMismatch=clamp(Math.abs((social.predictability01??.5)-predicted)*.5+surprise*.5);r.socialPredictionError01=clamp(r.socialPredictionError01*.90+socialMismatch*.10);r.predictionError01=clamp(r.predictionError01*.92+pe*.08);r.predictedValence01=clamp(r.predictedValence01*.90+predicted*.10);
    r.trust01=clamp(r.trust01*.92+reward*.08);r.predictability01=clamp(r.predictability01*.90+(1-socialMismatch)*.10);r.reciprocity01=clamp(r.reciprocity01*.92+((reward*.6)+(1-pe)*.4)*.08);r.attachment01=clamp(r.attachment01*.97+(r.trust01*.45+r.sharedGoalAlignment01*.35+r.reciprocity01*.20)*.03);r.boundary01=clamp(r.boundary01*.95+(pe>.6?.08:0)+((actionIdx===0&&reward<.4)?.03:0));
    r.conflict01=clamp(Math.abs(r.trust01-r.predictability01)*.35+Math.abs(r.boundary01-r.attachment01)*.25+socialMismatch*.4);r.revisionPressure01=clamp(r.conflict01*.55+importance*.25+pe*.20);r.repairReadiness01=clamp(r.repairReadiness01*.94+(pe>.55?.09:0)+(input.repairAttempted?.18:0));
    if(reward>=.62)r.successfulEpisodes++; if(pe>.55)r.conflictEpisodes++; if(input.repairAttempted)r.repairEpisodes++;
    const modulation=clamp11((reward-.5)*.7+(1-pe)*.22-(r.conflict01-.5)*.12);const lr=.0022*(.35+importance*.65)*(input.learningEnabled===false?0:1);
    for(let i=0;i<DIM;i++){r.eligibility[i]=clamp11(r.eligibility[i]*.92+next[i]*.08);}
    for(let i=0;i<VALUES.length;i++){const dir=clamp11((valueVector[i]??.5)-(r.relationshipValue01[VALUES[i]!]??.5));r.valueTrace[i]=clamp11(r.valueTrace[i]*.9+dir*.1);r.relationshipValue01[VALUES[i]!] = clamp(.985*(r.relationshipValue01[VALUES[i]!]??.5)+.015*(valueVector[i]??.5)+.008*modulation*(i%2===0?1:-1));for(let j=0;j<DIM;j++){r.valueWeights[i]![j]=clamp11(r.valueWeights[i]![j]!+lr*modulation*r.eligibility[j]!*(.7+Math.abs(r.valueTrace[i])*.3));}}
      for(let j=0;j<DIM;j++){const pre=r.previousLatent[j]??0;for(let i=0;i<DIM;i++){const post=next[i]??0;r.recurrent[i]![j]=clamp11(r.recurrent[i]![j]!+lr*modulation*(pre*post)*.035);}}
    for(let j=0;j<DIM;j++)r.actionWeights[actionIdx]![j]=clamp11(r.actionWeights[actionIdx]![j]!+lr*modulation*r.eligibility[j]!*.20);
    if(importance>.72 && pe<.3){r.commitment01=clamp(r.commitment01*.96+.04*(.6+r.trust01*.4));r.sharedGoalAlignment01=clamp(r.sharedGoalAlignment01*.95+.05*(input.goalVector?.length?mean(input.goalVector.map(v=>Math.abs(v))):.5));}
    if(r.conflict01>.62){r.commitment01=clamp(r.commitment01*.985);this.state.relationRevisions++;}
    r.lastAction=input.action;r.lastReward01=reward;r.tick=input.tick;r.episodes=[{tick:input.tick,action:input.action??'wait',reward01:reward,surprise01:surprise,importance01:importance,valueVector},...r.episodes].slice(0,128);
    this.state.learningUpdates+=input.learningEnabled===false?0:1;
    if(input.action && r.successfulEpisodes===4) { r.transferUses++; this.state.transferUses++; }
    this.updateGlobal();
    return {relationId:r.relationId,trust01:r.trust01,attachment01:r.attachment01,reciprocity01:r.reciprocity01,predictability01:r.predictability01,boundary01:r.boundary01,relationshipValue01:{...r.relationshipValue01},commitment01:r.commitment01,conflict01:r.conflict01,revisionPressure01:r.revisionPressure01,predictedValence01:r.predictedValence01,predictionError01:r.predictionError01,socialPredictionError01:r.socialPredictionError01,identityInfluence01:r.identityInfluence01};
  }
  replay(count=8){for(const r of this.state.relations){for(const e of r.episodes.slice(-count)){const signal=(e.reward01-.5)*.45+(1-e.surprise01)*.3+e.importance01*.25;for(let j=0;j<DIM;j++)r.recurrent[j]![j]=clamp11(r.recurrent[j]![j]!+0.0005*signal*(r.latent[j]??0));this.state.replayUpdates++;}}this.updateGlobal();}
  private actionBiasForVector(r:B287RelationState,action:ActionKind,latent:number[]){const idx=this.actionIndex(action);const neural=(cosine01(r.actionWeights[idx]!,latent)-.5)*2;const value=((r.relationshipValue01['care']??.5)-.5)*(.35)+((r.relationshipValue01['truth']??.5)-.5)*(.28)+((r.relationshipValue01['reciprocity']??.5)-.5)*(.22);const boundaryPenalty=(action==='respond'?0:r.boundary01-.5)*.018;const socialNeed=(r.attachment01-.5)*.018;return clamp11(neural*.032+value*.055+socialNeed-boundaryPenalty);}
  actionBias(action:ActionKind,relationId='user'){const r=this.state.relations.find(x=>x.relationId===relationId)??this.state.relations[0];if(!r)return 0;return this.actionBiasForVector(r,action,r.latent);}
  goalBias(goalTitle:string,relationId='user'){const r=this.state.relations.find(x=>x.relationId===relationId)??this.state.relations[0];if(!r)return 0;const t=goalTitle.toLowerCase();const relMatch=(t.includes('care')||t.includes('help')||t.includes('connection'))?((r.relationshipValue01['care']??.5)-.5):(t.includes('truth')||t.includes('verify'))?((r.relationshipValue01['truth']??.5)-.5):(t.includes('autonomy')?((r.relationshipValue01['autonomy']??.5)-.5):0);return clamp11(relMatch*.08+(r.sharedGoalAlignment01-.5)*.04+(r.commitment01-.5)*.03);}
  personalityEvidence(){const out:any[]=[];for(const r of this.state.relations){for(const v of VALUES){const val=r.relationshipValue01[v];out.push({relationId:r.relationId,trait:v,value01:val,evidence01:clamp(.44+Math.abs(val-.5)*.65+r.attachment01*.18+r.predictability01*.12),confidence01:clamp(.52+r.successfulEpisodes/80*.25+(1-r.socialPredictionError01)*.18),support:val>=.5});}}return out;}
  relationshipSnapshot(id:string){const r=this.state.relations.find(x=>x.relationId===id);return r?structuredClone(r):null;}
  identityAblation(relationId='user'){const r=this.state.relations.find(x=>x.relationId===relationId)??this.state.relations[0];if(!r)return 0;const ablatedLatent=r.latent.map((v,i)=>tanh(v-(r.lastSelfInput[i]??0)*.28));const actions=r.lastAction?[r.lastAction,...ACTIONS.filter(a=>a!==r.lastAction)]:ACTIONS;const normal=Math.max(...actions.map(a=>this.actionBiasForVector(r,a,r.latent)));const ablated=Math.max(...actions.map(a=>this.actionBiasForVector(r,a,ablatedLatent)));const drop=clamp(Math.abs(normal-ablated)/(Math.abs(normal)+.05));this.state.causalAblationDrop01=drop;return drop;}
  diagnostics() {
    this.updateGlobal();
    return {
      version: 1,
      tick: this.state.tick,
      steps: this.state.steps,
      learningUpdates: this.state.learningUpdates,
      replayUpdates: this.state.replayUpdates,
      relationCreations: this.state.relationCreations,
      relationRevisions: this.state.relationRevisions,
      transferUses: this.state.transferUses,
      relationCount: this.state.relations.length,
      globalIdentityInfluence01: this.state.globalIdentityInfluence01,
      socialValueCoherence01: this.state.socialValueCoherence01,
      relationshipDifferentiation01: this.state.relationshipDifferentiation01,
      hiddenGeneralization01: this.state.hiddenGeneralization01,
      causalAblationDrop01: this.state.causalAblationDrop01,
      relations: this.state.relations.map((r) => ({
        relationId: r.relationId,
        trust01: r.trust01,
        attachment01: r.attachment01,
        reciprocity01: r.reciprocity01,
        predictability01: r.predictability01,
        boundary01: r.boundary01,
        commitment01: r.commitment01,
        conflict01: r.conflict01,
        revisionPressure01: r.revisionPressure01,
        identityInfluence01: r.identityInfluence01,
        successfulEpisodes: r.successfulEpisodes,
        revisions: r.conflictEpisodes,
        relationshipValue01: { ...r.relationshipValue01 },
      })),
    };
  }
  private updateGlobal(){if(!this.state.relations.length)return;this.state.globalIdentityInfluence01=mean(this.state.relations.map(r=>r.identityInfluence01));this.state.socialValueCoherence01=1-mean(this.state.relations.map(r=>Math.abs((r.relationshipValue01['care']??.5)-(r.relationshipValue01['reciprocity']??.5))));if(this.state.relations.length>1){const means=VALUES.map(v=>mean(this.state.relations.map(r=>r.relationshipValue01[v])));const pair=this.state.relations.map(r=>VALUES.reduce((s,v,i)=>s+Math.abs((r.relationshipValue01[v]??.5)-(means[i]??.5)),0)/VALUES.length);this.state.relationshipDifferentiation01=clamp(mean(pair)*3.2);}else this.state.relationshipDifferentiation01=0;}
}
