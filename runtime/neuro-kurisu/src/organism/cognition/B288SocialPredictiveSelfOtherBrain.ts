import type { ActionKind } from '../core/types.ts';
import type { SocialMindState } from './SocialMindKernel.ts';
import type { B287RelationshipValueDevelopmentCore } from './B287RelationshipValueDevelopmentCore.ts';
import type { SocialPredictiveState } from './SocialPredictiveNeuralSubstrate.ts';
import type { RelationshipSelfState } from '../developmental/RelationshipSelf.ts';
import type { LongTermSocialMindState } from '../developmental/LongTermSocialMind.ts';
import type { SocialDevelopmentState } from '../developmental/SocialDevelopmentSystem.ts';
import type { RelationshipState } from '../system/AutonomousRelationshipManager.ts';
import type { SocialInitiativeState } from '../system/AutonomousSocialInitiativeEngine.ts';

const DIM = 32;
const EXC = 24;
const INH = 8;
const ACTIONS: ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const clamp = (x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11 = (x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const tanh = (x:number)=>Math.tanh(Math.max(-6,Math.min(6,x)));
const dot = (a:number[],b:number[]) => { let s=0; for(let i=0;i<Math.min(a.length,b.length);i++) s+=(a[i]??0)*(b[i]??0); return s; };
const norm = (v:number[]) => Math.sqrt(Math.max(1e-9,dot(v,v)));
const cosine01 = (a:number[],b:number[]) => clamp(.5+.5*dot(a,b)/(norm(a)*norm(b)));
const seeded = (seed:number)=>{ let x=seed|0; x=Math.imul(x^(x>>>16),0x9e3779b9); x=Math.imul(x^(x>>>13),0x85ebca6b); return (x^(x>>>16))>>>0; };
const rand=(seed:number,scale=.04)=>((seeded(seed)/0xffffffff)*2-1)*scale;
const vec=(seed:number,len:number,scale=.06)=>Array.from({length:len},(_,i)=>rand(seed+i*37,scale));
const matrix=(r:number,c:number,seed:number,scale=.02)=>Array.from({length:r},(_,i)=>Array.from({length:c},(_,j)=>rand(seed+i*97+j*19,scale)));

export interface B288SocialBrainContext {
  selfLatent:number[];
  worldLatent:number[];
  goalVector:number[];
  futureSelf:number[];
  personalityVector:number[];
  relationshipLatent:number[];
  action?:ActionKind;
  reward01?:number;
  predictionError01?:number;
  surprise01?:number;
  importance01?:number;
  socialPredictionError01?:number;
  socialState?:{trust01?:number; warmth01?:number; predictability01?:number; guardedness01?:number; agency01?:number; intentUncertainty01?:number; relationshipStrength01?:number};
}

interface PersonBrain {
  personId:string;
  latent:number[];
  previousLatent:number[];
  recurrent:number[][];
  excitatory:number[];
  inhibitory:number[];
  actionWeights:number[][];
  contextWeights:number[][];
  valueWeights:number[][];
  eligibility:number[];
  synapticAvailability:number;
  shortTermDepression:number;
  predictionError01:number;
  socialUncertainty01:number;
  trust01:number;
  warmth01:number;
  predictability01:number;
  boundary01:number;
  commitment01:number;
  interactionCount:number;
  successfulInteractions:number;
  repairCount:number;
  stableEpisodes:number;
  lastAction?:ActionKind;
  lastReward01:number;
  recentErrors:number[];
}

export interface B288State {
  version:2;
  tick:number;
  steps:number;
  learningUpdates:number;
  replayUpdates:number;
  persons:PersonBrain[];
  activePersonId:string|null;
  meanPrediction01:number;
  meanUncertainty01:number;
  relationshipDifferentiation01:number;
  crossContextDivergence01:number;
  actionInfluence01:number;
  socialCausalLesionDrop01:number;
  neuralActivity01:number;
  inhibitoryBalance01:number;
  deduplicatedSources:string[];
  canonicalOwner:string;
  legacyAdapterCoverage01:number;
  legacyConflict01:number;
  lastConsolidationAt:number;
}

export const defaultB288State=():B288State=>({version:2,tick:0,steps:0,learningUpdates:0,replayUpdates:0,persons:[],activePersonId:null,meanPrediction01:.5,meanUncertainty01:.5,relationshipDifferentiation01:0,crossContextDivergence01:0,actionInfluence01:0,socialCausalLesionDrop01:0,neuralActivity01:0,inhibitoryBalance01:.5,canonicalOwner:'B288SocialPredictiveSelfOtherBrain',legacyAdapterCoverage01:0,legacyConflict01:0,lastConsolidationAt:0,deduplicatedSources:['SocialMindKernel','SocialPredictiveNeuralSubstrate','SocialWorldModel','RelationshipSelf','LongTermSocialMind','SocialDevelopmentSystem','AutonomousRelationshipManager','AutonomousSocialInitiativeEngine','B287RelationshipValueDevelopmentCore']});

function freshPerson(personId:string,seed:number):PersonBrain{
  return {
    personId,
    latent:new Array(DIM).fill(0),
    previousLatent:new Array(DIM).fill(0),
    recurrent:matrix(DIM,DIM,seed,.018),
    excitatory:new Array(EXC).fill(0),
    inhibitory:new Array(INH).fill(0),
    actionWeights:ACTIONS.map((_,i)=>vec(seed+1000+i*61,DIM,.055)),
    contextWeights:Array.from({length:DIM},(_,i)=>vec(seed+2000+i*71,DIM,.035)),
    valueWeights:Array.from({length:6},(_,i)=>vec(seed+3000+i*83,DIM,.045)),
    eligibility:new Array(DIM).fill(0),
    synapticAvailability:.92,
    shortTermDepression:1,
    predictionError01:.5,
    socialUncertainty01:.55,
    trust01:.5,
    warmth01:.5,
    predictability01:.5,
    boundary01:.35,
    commitment01:.1,
    interactionCount:0,
    successfulInteractions:0,
    repairCount:0,
    stableEpisodes:0,
    lastReward01:.5,
    recentErrors:[],
  };
}

function featureVector(ctx:B288SocialBrainContext):number[]{
  const s=[...ctx.selfLatent,...ctx.worldLatent,...ctx.goalVector,...ctx.futureSelf,...ctx.personalityVector,...ctx.relationshipLatent];
  return Array.from({length:DIM},(_,i)=>tanh((s[i%(s.length||1)]??0)*.32+(s[(i*7+5)%(s.length||1)]??0)*.11));
}

export class B288SocialPredictiveSelfOtherBrain {
  private state=B288SocialPredictiveSelfOtherBrain.create();
  static create(){ return defaultB288State(); }
  snapshot(){ return structuredClone(this.state); }
  restore(raw:unknown){
    const base=defaultB288State();
    if(!raw || typeof raw!=='object'){ this.state=base; return; }
    const r=raw as Partial<B288State>;
    const persons=Array.isArray(r.persons)?r.persons.slice(0,64).map((x:any,i:number)=>{
      const fallback=freshPerson(String(x?.personId??`person-${i}`),288001+i*193);
      return {
        ...fallback,...x,
        latent:Array.isArray(x?.latent)?x.latent.slice(0,DIM):fallback.latent,
        previousLatent:Array.isArray(x?.previousLatent)?x.previousLatent.slice(0,DIM):fallback.previousLatent,
        recurrent:Array.isArray(x?.recurrent)?x.recurrent.slice(0,DIM).map((row:any,j:number)=>Array.isArray(row)?row.slice(0,DIM):fallback.recurrent[j]!):fallback.recurrent,
        excitatory:Array.isArray(x?.excitatory)?x.excitatory.slice(0,EXC):fallback.excitatory,
        inhibitory:Array.isArray(x?.inhibitory)?x.inhibitory.slice(0,INH):fallback.inhibitory,
        actionWeights:Array.isArray(x?.actionWeights)?x.actionWeights.slice(0,ACTIONS.length).map((row:any,j:number)=>Array.isArray(row)?row.slice(0,DIM):fallback.actionWeights[j]!):fallback.actionWeights,
        contextWeights:Array.isArray(x?.contextWeights)?x.contextWeights.slice(0,DIM).map((row:any,j:number)=>Array.isArray(row)?row.slice(0,DIM):fallback.contextWeights[j]!):fallback.contextWeights,
        valueWeights:Array.isArray(x?.valueWeights)?x.valueWeights.slice(0,6).map((row:any,j:number)=>Array.isArray(row)?row.slice(0,DIM):fallback.valueWeights[j]!):fallback.valueWeights,
        eligibility:Array.isArray(x?.eligibility)?x.eligibility.slice(0,DIM):fallback.eligibility,
        recentErrors:Array.isArray(x?.recentErrors)?x.recentErrors.slice(-32):[],
      } as PersonBrain;
    }):[];
    this.state={...base,...r,version:2,persons,canonicalOwner:'B288SocialPredictiveSelfOtherBrain'};
  }
  private ensurePerson(id:string){
    let p=this.state.persons.find(x=>x.personId===id);
    if(!p){ p=freshPerson(id,288001+this.state.persons.length*193); this.state.persons.unshift(p); }
    return p;
  }
  private actionIndex(action:ActionKind|undefined){ const i=ACTIONS.indexOf(action??'wait'); return i<0?0:i; }
  private dynamics(p:PersonBrain,input:number[]):number[]{
    const recurrent=p.recurrent;
    const out=Array.from({length:DIM},(_,i)=>{
      let z=(input[i]??0)*.46;
      for(let j=0;j<DIM;j++) z+=(recurrent[i]?.[j]??0)*(p.latent[j]??0);
      z+=(p.excitatory[i%EXC]??0)*.12-(p.inhibitory[i%INH]??0)*.18;
      return tanh(z*p.shortTermDepression);
    });
    for(let i=0;i<EXC;i++) p.excitatory[i]=clamp(p.excitatory[i]*.82+Math.abs(out[i%DIM]??0)*.18);
    for(let i=0;i<INH;i++) p.inhibitory[i]=clamp(p.inhibitory[i]*.84+(i<EXC?Math.abs(out[i]??0):0)*.16);
    return out;
  }
  step(personId:string,ctx:B288SocialBrainContext,legacy?:{socialMindState?:SocialMindState;relationshipCore?:B287RelationshipValueDevelopmentCore}){
    const p=this.ensurePerson(personId); this.state.tick++; this.state.steps++; this.state.activePersonId=personId; p.previousLatent=p.latent.slice();
    const input=featureVector(ctx);
    const next=this.dynamics(p,input); p.latent=next;
    const social=ctx.socialState??{};
    const actionIdx=this.actionIndex(ctx.action);
    const prediction=clamp(.5+.5*tanh(dot(p.contextWeights[actionIdx]??p.contextWeights[0]!,next)/Math.max(2,DIM*.16)));
    const reward=clamp(ctx.reward01??.5);
    const explicitPe=clamp(ctx.predictionError01??Math.abs(reward-prediction));
    const socialPe=clamp(ctx.socialPredictionError01??(Math.abs(prediction-(social.predictability01??.5))*.55+explicitPe*.45));
    p.predictionError01=clamp(p.predictionError01*.88+explicitPe*.12);
    p.socialUncertainty01=clamp(p.socialUncertainty01*.90+socialPe*.10);
    p.trust01=clamp(p.trust01*.93+reward*.07);
    p.predictability01=clamp(p.predictability01*.92+(1-socialPe)*.08);
    p.warmth01=clamp(p.warmth01*.94+(social.warmth01??.5)*.06);
    p.boundary01=clamp(p.boundary01*.95+(social.guardedness01??p.boundary01)*.05);
    p.commitment01=clamp(p.commitment01*.97+(reward>.68?(social.relationshipStrength01??.2)*.05:0));
    p.interactionCount++;
    if(reward>.62)p.successfulInteractions++;
    if(ctx.action==='respond' && reward<.35)p.repairCount++;
    if(explicitPe<.25 && reward>.62)p.stableEpisodes++;
    p.shortTermDepression=clamp(p.shortTermDepression*.94+0.06*(1-clamp(p.excitatory.reduce((a,b)=>a+b,0)/EXC)));
    p.synapticAvailability=clamp(p.synapticAvailability*.97+.03*(.75+p.stableEpisodes/100));
    const neuromod=clamp11((reward-.5)*.75+(1-socialPe)*.25);
    const lr=.0018*(.4+(ctx.importance01??.5)*.6);
    for(let i=0;i<DIM;i++){
      p.eligibility[i]=clamp11(p.eligibility[i]*.90+next[i]*.10);
      for(let j=0;j<DIM;j++) p.recurrent[i]![j]=clamp11(p.recurrent[i]![j]!+lr*neuromod*(p.previousLatent[j]??0)*(next[i]??0)*.045);
      p.contextWeights[actionIdx]![i]=clamp11(p.contextWeights[actionIdx]![i]!+lr*neuromod*p.eligibility[i]!*.18);
    }
    p.actionWeights[actionIdx]=p.actionWeights[actionIdx]!.map((w,i)=>clamp11(w+lr*neuromod*(p.eligibility[i]??0)*.12));
    p.recentErrors=[socialPe,...p.recentErrors].slice(0,32);
    this.state.learningUpdates++;
    this.state.activePersonId=personId;
    this.updateDiagnostics();
    return {
      personId,
      neuralState:next.slice(),
      predictedResponse01:prediction,
      predictionError01:p.predictionError01,
      socialUncertainty01:p.socialUncertainty01,
      actionBias:this.actionBias(ctx.action??'wait',personId),
      goalBias:this.goalBias(ctx.goalVector,personId),
      trust01:p.trust01,
      warmth01:p.warmth01,
      predictability01:p.predictability01,
      boundary01:p.boundary01,
      commitment01:p.commitment01,
      neuralActivity01:this.activity(p),
      inhibitoryBalance01:this.inhibitoryBalance(p),
      legacySourcesUsed:legacy?['SocialMindKernel','B287RelationshipValueDevelopmentCore']:[],
    };
  }
  replay(count=8){
    for(const p of this.state.persons){
      const signal=clamp11((p.lastReward01-.5)*.5+(1-p.predictionError01)*.2);
      for(let i=0;i<DIM;i++)for(let j=0;j<DIM;j++)p.recurrent[i]![j]=clamp11(p.recurrent[i]![j]!+0.0004*signal*(p.latent[j]??0));
      p.shortTermDepression=clamp(p.shortTermDepression*.98+.02);
      this.state.replayUpdates++;
      if(this.state.replayUpdates>=count*this.state.persons.length) break;
    }
    this.updateDiagnostics();
  }
  actionBias(action:ActionKind,personId='user'){
    const p=this.state.persons.find(x=>x.personId===personId)??this.state.persons[0]; if(!p)return 0;
    const idx=this.actionIndex(action); const sim=(cosine01(p.actionWeights[idx]!,p.latent)-.5)*2;
    const trustValue=(p.trust01-.5)*.18+(p.warmth01-.5)*.12+(p.commitment01-.5)*.10-(p.boundary01-.5)*.08;
    return clamp11(sim*.06+trustValue*.04);
  }
  goalBias(goalVector:number[],personId='user'){
    const p=this.state.persons.find(x=>x.personId===personId)??this.state.persons[0]; if(!p)return 0;
    return clamp11((cosine01(goalVector,p.latent)-.5)*.10+(p.commitment01-.5)*.05-(p.socialUncertainty01-.5)*.03);
  }
  ingestLegacySources(personId:string,sources:{
    socialMindState?:SocialMindState;
    relationshipCore?:B287RelationshipValueDevelopmentCore;
    socialPredictiveNeural?:SocialPredictiveState;
    relationshipSelfState?:RelationshipSelfState;
    longTermSocialMind?:LongTermSocialMindState;
    socialDevelopment?:SocialDevelopmentState;
    autonomousRelationships?:RelationshipState;
    autonomousSocialInitiative?:SocialInitiativeState;
  }={}){
    const p=this.ensurePerson(personId);
    const signals:number[]=[];
    const legacyPerson=sources.socialMindState?.persons?.find(x=>x.id===personId);
    if(legacyPerson){
      const trust=legacyPerson.trust01??.5, warmth=legacyPerson.warmth01??.5, predict=legacyPerson.predictability01??.5, boundary=legacyPerson.guardedness01??.35;
      p.trust01=clamp(p.trust01*.82+trust*.18); p.warmth01=clamp(p.warmth01*.82+warmth*.18); p.predictability01=clamp(p.predictability01*.82+predict*.18); p.boundary01=clamp(p.boundary01*.82+boundary*.18);
      signals.push(trust,warmth,predict,1-boundary);
    }
    if(sources.relationshipCore){
      const b=sources.relationshipCore.relationshipSnapshot(personId);
      if(b){p.trust01=clamp(p.trust01*.84+b.trust01*.16);p.warmth01=clamp(p.warmth01*.84+b.attachment01*.16);p.predictability01=clamp(p.predictability01*.84+b.predictability01*.16);signals.push(b.trust01,b.attachment01,b.predictability01);}
    }
    const relSelf=sources.relationshipSelfState?.models?.find(m=>m.person===personId);
    if(relSelf){p.trust01=clamp(p.trust01*.88+relSelf.trust*.12);p.warmth01=clamp(p.warmth01*.88+relSelf.warmth*.12);p.predictability01=clamp(p.predictability01*.88+relSelf.predictability*.12);p.boundary01=clamp(p.boundary01*.88+relSelf.guardedness*.12);signals.push(relSelf.trust,relSelf.warmth,relSelf.predictability,1-relSelf.guardedness);}
    const ltm=sources.longTermSocialMind;
    const ltmRel=ltm?.relationships?.models?.find(m=>m.person===personId);
    if(ltmRel){p.trust01=clamp(p.trust01*.91+ltmRel.trust*.09);p.warmth01=clamp(p.warmth01*.91+ltmRel.warmth*.09);p.predictability01=clamp(p.predictability01*.91+ltmRel.predictability*.09);signals.push(ltmRel.trust,ltmRel.warmth,ltmRel.predictability);}
    const sd=sources.socialDevelopment?.persons?.find(x=>x.id===personId);
    if(sd){p.trust01=clamp(p.trust01*.9+sd.trust*.1);p.warmth01=clamp(p.warmth01*.9+sd.warmth*.1);p.predictability01=clamp(p.predictability01*.9+sd.predictability*.1);p.boundary01=clamp(p.boundary01*.9+(sd.guardedness??p.boundary01)*.1);signals.push(sd.trust,sd.warmth,sd.predictability,1-(sd.guardedness??p.boundary01));}
    const ar=sources.autonomousRelationships?.contacts?.[personId];
    if(ar){p.trust01=clamp(p.trust01*.94+ar.trust01*.06);signals.push(ar.trust01,ar.familiarity01);}
    const si=sources.autonomousSocialInitiative;
    if(si){signals.push(si.reciprocity01,si.initiative01);}
    if(sources.socialPredictiveNeural){signals.push(1-clamp(sources.socialPredictiveNeural.meanPredictionError01??.5),1-clamp(sources.socialPredictiveNeural.meanUncertainty01??.5),clamp(sources.socialPredictiveNeural.higherOrderBelief01??.5));}
    const canonical=[p.trust01,p.warmth01,p.predictability01,1-p.boundary01];
    const mean=signals.length?signals.reduce((a,b)=>a+b,0)/signals.length:canonical.reduce((a,b)=>a+b,0)/canonical.length;
    const canonicalMean=canonical.reduce((a,b)=>a+b,0)/canonical.length;
    const conflict=signals.length?signals.reduce((a,b)=>a+Math.abs(b-canonicalMean),0)/signals.length:0;
    const covered=['SocialMindKernel','B287RelationshipValueDevelopmentCore','SocialPredictiveNeuralSubstrate','RelationshipSelf','LongTermSocialMind','SocialDevelopmentSystem','AutonomousRelationshipManager','AutonomousSocialInitiativeEngine'].filter(name=>({
      SocialMindKernel:Boolean(sources.socialMindState),B287RelationshipValueDevelopmentCore:Boolean(sources.relationshipCore),SocialPredictiveNeuralSubstrate:Boolean(sources.socialPredictiveNeural),RelationshipSelf:Boolean(sources.relationshipSelfState),LongTermSocialMind:Boolean(sources.longTermSocialMind),SocialDevelopmentSystem:Boolean(sources.socialDevelopment),AutonomousRelationshipManager:Boolean(sources.autonomousRelationships),AutonomousSocialInitiativeEngine:Boolean(sources.autonomousSocialInitiative),
    } as Record<string,boolean>)[name]).length;
    this.state.legacyAdapterCoverage01=clamp(covered/8);
    this.state.legacyConflict01=clamp(conflict*1.7);
    this.state.lastConsolidationAt=Date.now();
    // A low-weight consensus pull gives adapters a common canonical attractor without erasing B288's own learned state.
    const consensusPull=.035; p.trust01=clamp(p.trust01*(1-consensusPull)+mean*consensusPull); p.warmth01=clamp(p.warmth01*(1-consensusPull)+mean*consensusPull); p.predictability01=clamp(p.predictability01*(1-consensusPull)+mean*consensusPull);
    this.updateDiagnostics();
  }
  personalityEvidence(personId='user'){
    const p=this.state.persons.find(x=>x.personId===personId); if(!p)return [];
    const traits=[
      ['care',p.warmth01],['social-attunement',p.commitment01],['truth',p.predictability01],
      ['autonomy',1-p.boundary01],['persistence',p.successfulInteractions/Math.max(1,p.interactionCount)],
      ['self-preservation',p.boundary01],
    ] as const;
    const confidence=clamp(.46+p.interactionCount/120*.22+(1-p.socialUncertainty01)*.20);
    return traits.map(([trait,value01])=>({personId,trait,value01:clamp(value01),support:value01>=.5,evidence01:clamp(.42+Math.abs(value01-.5)*.72+p.stableEpisodes/100*.12),confidence01:confidence,source:'B288-social-predictive-brain'}));
  }

  personSnapshot(personId='user'){ const p=this.state.persons.find(x=>x.personId===personId); return p?structuredClone(p):null; }
  lesion(personId='user',fraction01=.5){
    const p=this.state.persons.find(x=>x.personId===personId)??this.state.persons[0]; if(!p)return 0;
    const original=p.latent.slice();
    const actions=ACTIONS;
    const normal=Math.max(...actions.map(a=>Math.abs(this.actionBias(a,personId))));
    p.latent=p.latent.map(v=>v*(1-fraction01));
    const lesioned=Math.max(...actions.map(a=>Math.abs(this.actionBias(a,personId))));
    p.latent=original;
    const drop=Math.abs(normal-lesioned)+Math.abs(this.meanLatentEnergy(original)-this.meanLatentEnergy(p.latent.map(v=>v*(1-fraction01))));
    this.state.socialCausalLesionDrop01=clamp(drop*2.4); return this.state.socialCausalLesionDrop01;
  }
  private meanLatentEnergy(v:number[]){ return v.reduce((s,x)=>s+x*x,0)/Math.max(1,v.length); }
  diagnostics(){ this.updateDiagnostics(); return structuredClone(this.state); }
  private activity(p:PersonBrain){ return clamp(p.excitatory.reduce((a,b)=>a+b,0)/EXC); }
  private inhibitoryBalance(p:PersonBrain){ const e=p.excitatory.reduce((a,b)=>a+b,0)/EXC; const i=p.inhibitory.reduce((a,b)=>a+b,0)/INH; return clamp(.5+.5*(e-i)); }
  private updateDiagnostics(){
    if(!this.state.persons.length)return;
    this.state.meanPrediction01=clamp(this.state.persons.reduce((s,p)=>s+1-p.predictionError01,0)/this.state.persons.length);
    this.state.meanUncertainty01=clamp(this.state.persons.reduce((s,p)=>s+p.socialUncertainty01,0)/this.state.persons.length);
    this.state.neuralActivity01=clamp(this.state.persons.reduce((s,p)=>s+this.activity(p),0)/this.state.persons.length);
    this.state.inhibitoryBalance01=clamp(this.state.persons.reduce((s,p)=>s+this.inhibitoryBalance(p),0)/this.state.persons.length);
    if(this.state.persons.length>1){
      let total=0,count=0;
      for(let i=0;i<this.state.persons.length;i++)for(let j=i+1;j<this.state.persons.length;j++){ total+=1-cosine01(this.state.persons[i]!.latent,this.state.persons[j]!.latent); count++; }
      this.state.relationshipDifferentiation01=clamp((count?total/count:0)*2);
      this.state.crossContextDivergence01=this.state.relationshipDifferentiation01;
    }
    this.state.actionInfluence01=clamp(this.state.persons.reduce((s,p)=>s+Math.abs(this.actionBias('respond',p.personId)-this.actionBias('verify',p.personId)),0)/this.state.persons.length*8);
  }
}
