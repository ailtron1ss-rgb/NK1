import { createHash } from 'node:crypto';
import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[],fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const now=()=>Date.now();
const clean=(x:string,n=160)=>String(x??'').trim().slice(0,n);

export type EvidenceClass='external-postcondition'|'device-observation'|'sensor-observation'|'tool-verification'|'world-transition'|'internal-transition'|'simulation'|'manual';
export type FaultKind='restart'|'interrupted-action'|'sensor-failure'|'resource-pressure'|'state-corruption'|'world-disconnect';
export type ResearchTrack='closed-loop'|'longitudinal-life'|'active-perception'|'causal-world'|'causal-self-development'|'personality'|'social-life'|'embodiment'|'replication'|'recovery'|'production';

export interface OperationalDecision { id:string; cycle:number; action:ActionKind; predicted01:number; confidence01:number; horizon01:number; at:number; }
export interface OperationalOutcome { id:string;
decisionId:string;
actual01:number;
reward01:number;
predictionError01:number;
verified01:number;
external01:number;
causal01:number;
evidenceCount:number;
at:number;
}
export interface ExternalPostcondition { id:string;
decisionId:string;
expected:string;
observed:string;
passed:boolean;
evidenceClass:EvidenceClass;
confidence01:number;
independent01:number;
at:number;
}
export interface ActivePerceptionQuery { id:string;
mode:string;
expectedGain01:number;
actionability01:number;
cost01:number;
uncertainty01:number;
selected:boolean;
verifiedGain01:number;
at:number;
}
export interface CausalIntervention { id:string;
target:string;
control01:number;
treatment01:number;
effect01:number;
confidence01:number;
independent01:number;
repetitions:number;
verified:boolean;
at:number;
}
export interface SelfDevelopmentTrial { id:string;
hypothesis:string;
intervention:string;
baseline01:number;
treatment01:number;
holdout01:number;
effect01:number;
safety01:number;
promoted:boolean;
rolledBack:boolean;
at:number;
}
export interface PersonalitySample { cycle:number; traits:Record<string,number>; stability01:number; novelty01:number; historyDepth:number; at:number; }
export interface SocialSample { entity:string; trust01:number; expectation01:number; repair01:number; predictionError01:number; continuity01:number; at:number; }
export interface EmbodimentSample { energy01:number; thermal01:number; load01:number; sensoryFreshness01:number; latencyMs:number; battery01:number; safe01:boolean; at:number; }
export interface FaultRecovery { id:string; kind:FaultKind; detected:boolean; recovered:boolean; continuity01:number; at:number; }
export interface ReplicationRun { id:string;
track:ResearchTrack;
seed:number;
control01:number;
treatment01:number;
holdout01:number;
effect01:number;
reproducible:boolean;
evaluator:string;
at:number;
}
export interface LifeWindow { id:string;
startedAt:number;
endedAt:number|null;
cycles:number;
decisions:number;
outcomes:number;
verifiedOutcomes:number;
externalOutcomes:number;
status:'active'|'closed';
}

export interface OperationalLifeState {
  version:1; cycles:number; nextId:number; lastAt:number; startedAt:number;
  decisions:OperationalDecision[]; outcomes:OperationalOutcome[]; postconditions:ExternalPostcondition[];
  perceptions:ActivePerceptionQuery[]; causalInterventions:CausalIntervention[]; selfDevelopmentTrials:SelfDevelopmentTrial[];
  personality:PersonalitySample[]; social:SocialSample[]; embodiment:EmbodimentSample[]; recovery:FaultRecovery[];
  replications:ReplicationRun[]; windows:LifeWindow[];
metrics:{closedLoop01:number;
externalGrounding01:number;
activePerception01:number;
causalWorld01:number;
causalSelfDevelopment01:number;
personality01:number;
social01:number;
embodiment01:number;
longitudinal01:number;
replication01:number;
recovery01:number;
production01:number;
overall01:number};
  readiness:Record<ResearchTrack,{score01:number;sampleCount:number;blocking:string[]}>;
  activeWindowId:string|null; lastDecisionId:string|null; lastOutcomeId:string|null; lastDigest:string; architectureFrozen:boolean; architectureDigest:string; lastError:string;
}

export interface OperationalLifeContext { state:OrganismState;
action?:ActionKind;
overall01?:number;
agency01?:number;
prediction01?:number;
uncertainty01?:number;
activePerception01?:number;
social01?:number;
socialError01?:number;
embodiment?:{energy01?:number;
thermal01?:number;
load01?:number;
sensoryFreshness01?:number;
latencyMs?:number;
battery01?:number};
at?:number;
}

export const defaultOperationalLife=():OperationalLifeState=>({
version:1,cycles:0,nextId:1,lastAt:0,startedAt:now(),decisions:[],outcomes:[],postconditions:[],perceptions:[],causalInterventions:[],selfDevelopmentTrials:[],personality:[],social:[],embodiment:[],recovery:[],replications:[],windows:[],
metrics:{closedLoop01:.15,externalGrounding01:.05,activePerception01:.15,causalWorld01:.08,causalSelfDevelopment01:.05,personality01:.2,social01:.2,embodiment01:.2,longitudinal01:.1,replication01:.05,recovery01:.6,production01:.4,overall01:.2},
readiness:{
  'closed-loop':{score01:0,sampleCount:0,blocking:['verified decision-outcome pairs']},
  'longitudinal-life':{score01:0,sampleCount:0,blocking:['multi-window continuity']},
  'active-perception':{score01:0,sampleCount:0,blocking:['measured information gain']},
  'causal-world':{score01:0,sampleCount:0,blocking:['intervention evidence']},
  'causal-self-development':{score01:0,sampleCount:0,blocking:['holdout improvement']},
  personality:{score01:0,sampleCount:0,blocking:['longitudinal samples']},
  'social-life':{score01:0,sampleCount:0,blocking:['multi-entity trajectory']},
  embodiment:{score01:0,sampleCount:0,blocking:['real device observations']},
  replication:{score01:0,sampleCount:0,blocking:['repeated seeded runs']},
  recovery:{score01:.2,sampleCount:0,blocking:['fault/recovery records']},
  production:{score01:.15,sampleCount:0,blocking:['real Android device gate']}
},
  activeWindowId:null,lastDecisionId:null,lastOutcomeId:null,lastDigest:'',architectureFrozen:false,architectureDigest:'',lastError:''
});

export class OperationalLifeEngine {
  private state=defaultOperationalLife();
  restore(raw?:Partial<OperationalLifeState>|null){
    const d=defaultOperationalLife(),r:any=raw??{};
    this.state={...d,...r,version:1,
decisions:Array.isArray(r.decisions)?r.decisions.slice(-1024):[],outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(-1024):[],postconditions:Array.isArray(r.postconditions)?r.postconditions.slice(-1024):[],
perceptions:Array.isArray(r.perceptions)?r.perceptions.slice(-512):[],causalInterventions:Array.isArray(r.causalInterventions)?r.causalInterventions.slice(-256):[],selfDevelopmentTrials:Array.isArray(r.selfDevelopmentTrials)?r.selfDevelopmentTrials.slice(-256):[],
personality:Array.isArray(r.personality)?r.personality.slice(-512):[],social:Array.isArray(r.social)?r.social.slice(-512):[],embodiment:Array.isArray(r.embodiment)?r.embodiment.slice(-512):[],recovery:Array.isArray(r.recovery)?r.recovery.slice(-256):[],replications:Array.isArray(r.replications)?r.replications.slice(-256):[],windows:Array.isArray(r.windows)?r.windows.slice(-128):[],metrics:{...d.metrics,...(r.metrics??{})},readiness:{...d.readiness,...(r.readiness??{})}
    };
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(ctx:OperationalLifeContext){
    const at=ctx.at??now();
    if(this.state.lastAt && at<this.state.lastAt)this.recordFault('restart',true,.97,at);
if(!this.state.activeWindowId){this.state.activeWindowId=this.id('win');
this.state.windows.unshift({id:this.state.activeWindowId,startedAt:at,endedAt:null,cycles:0,decisions:0,outcomes:0,verifiedOutcomes:0,externalOutcomes:0,status:'active'});
}
    this.state.cycles++;this.state.lastAt=at;
    const w=this.window();if(w)w.cycles++;
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.92+(ctx.activePerception01??this.state.metrics.activePerception01)*.08);
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.96+(ctx.agency01??.5)*.01+(ctx.prediction01??.5)*.01);
    this.sampleEmbodiment(ctx,at);
    this.updateLongitudinal();this.refreshReadiness();this.checkpoint();
  }
  registerDecision(input:{action:ActionKind;predicted01:number;confidence01?:number;horizon01?:number;at?:number}){
const id=this.id('dec');
const d:OperationalDecision={id,cycle:this.state.cycles,action:input.action,predicted01:clamp(input.predicted01),confidence01:clamp(input.confidence01??.5),horizon01:clamp(input.horizon01??.5),at:input.at ?? (this.state.lastAt || now())};
    this.state.decisions.unshift(d);this.state.decisions=this.state.decisions.slice(0,1024);this.state.lastDecisionId=id;const w=this.window();if(w)w.decisions++;return id;
  }
  registerOutcome(input:{decisionId?:string|null;actual01:number;reward01?:number;verified01:number;external01?:number;causal01?:number;evidenceCount?:number;at?:number}){
const d=this.state.decisions.find(x=>x.id===(input.decisionId??this.state.lastDecisionId));
if(!d){this.state.lastError='unmatched-decision';
return {ok:false,reason:'unmatched-decision'} as const;
}
    const actual=clamp(input.actual01),error=Math.abs(d.predicted01-actual);const id=this.id('out');
const row:OperationalOutcome={id,decisionId:d.id,actual01:actual,reward01:clamp(input.reward01??actual),predictionError01:error,verified01:clamp(input.verified01),external01:clamp(input.external01??0),causal01:clamp(input.causal01??0),evidenceCount:Math.max(0,Math.floor(input.evidenceCount??0)),at:input.at ?? (this.state.lastAt || now())};
    this.state.outcomes.unshift(row);this.state.outcomes=this.state.outcomes.slice(0,1024);this.state.lastOutcomeId=id;
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.88+(1-error)*.06+row.verified01*.04+row.causal01*.02);
    this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.9+row.external01*.06+row.verified01*.04);
    const w=this.window();if(w){w.outcomes++;if(row.verified01>=.7)w.verifiedOutcomes++;if(row.external01>=.7)w.externalOutcomes++;}
    this.updateLongitudinal();this.refreshReadiness();this.checkpoint();return {ok:true,outcomeId:id,error01:error} as const;
  }
  recordPostcondition(input:{decisionId:string;expected:string;observed:string;passed:boolean;evidenceClass:EvidenceClass;confidence01:number;independent01:number;at?:number}){
    if(!this.state.decisions.some(x=>x.id===input.decisionId)){this.state.lastError='unmatched-postcondition';return null;}
const row:ExternalPostcondition={id:this.id('pc'),decisionId:input.decisionId,expected:clean(input.expected,240),observed:clean(input.observed,240),passed:Boolean(input.passed),evidenceClass:input.evidenceClass,confidence01:clamp(input.confidence01),independent01:clamp(input.independent01),at:input.at ?? (this.state.lastAt || now())};
    this.state.postconditions.unshift(row);this.state.postconditions=this.state.postconditions.slice(0,1024);
    const externalClass=!['internal-transition','simulation','manual'].includes(row.evidenceClass);const strength=(row.passed?.55:0)+row.confidence01*.25+row.independent01*.2;
    if(externalClass)this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.86+strength*.14);
    this.refreshReadiness();this.checkpoint();return row;
  }
  chooseActivePerception(input:{mode:string;uncertainty01:number;actionability01:number;cost01:number;at?:number}){
const expected=clamp(input.uncertainty01*.55+input.actionability01*.35+(1-clamp(input.cost01))*.1);
const row:ActivePerceptionQuery={id:this.id('per'),mode:clean(input.mode,64),expectedGain01:expected,actionability01:clamp(input.actionability01),cost01:clamp(input.cost01),uncertainty01:clamp(input.uncertainty01),selected:expected>=.42,verifiedGain01:0,at:input.at ?? (this.state.lastAt || now())};
this.state.perceptions.unshift(row);
this.state.perceptions=this.state.perceptions.slice(0,512);
this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.9+(row.selected?expected*.07:expected*.03));
this.refreshReadiness();this.checkpoint();
return row;
  }
verifyPerception(id:string,observedGain01:number,verified01:number){const p=this.state.perceptions.find(x=>x.id===id);
if(!p)return false;
p.verifiedGain01=clamp(observedGain01);
const q=1-Math.abs(p.expectedGain01-p.verifiedGain01);
this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.84+q*.1+clamp(verified01)*.06);
this.refreshReadiness();this.checkpoint();
return true;
}
recordCausalIntervention(input:{target:string;
control01:number;
treatment01:number;
confidence01:number;
independent01:number;
repetitions:number;
at?:number}){const effect=clamp(Math.abs(input.treatment01-input.control01));
const verified=input.repetitions>=2&&input.independent01>=.5&&input.confidence01>=.6;
const row:CausalIntervention={id:this.id('cause'),target:clean(input.target,120),control01:clamp(input.control01),treatment01:clamp(input.treatment01),effect01:effect,confidence01:clamp(input.confidence01),independent01:clamp(input.independent01),repetitions:Math.max(1,Math.floor(input.repetitions)),verified,at:input.at ?? (this.state.lastAt || now())};
this.state.causalInterventions.unshift(row);
this.state.causalInterventions=this.state.causalInterventions.slice(0,256);
if(verified)this.state.metrics.causalWorld01=clamp(this.state.metrics.causalWorld01*.82+effect*.1+row.confidence01*.08);
this.refreshReadiness();this.checkpoint();
return row;
}
proposeSelfDevelopmentTrial(input:{hypothesis:string;
intervention:string;
baseline01:number;
treatment01:number;
holdout01:number;
safety01:number;
at?:number}){const effect=clamp(input.holdout01-input.baseline01);
const promoted=effect>=.08&&input.safety01>=.85&&input.treatment01>=input.baseline01;
const rolledBack=!promoted&&effect<-.05;
const row:SelfDevelopmentTrial={id:this.id('dev'),hypothesis:clean(input.hypothesis,220),intervention:clean(input.intervention,220),baseline01:clamp(input.baseline01),treatment01:clamp(input.treatment01),holdout01:clamp(input.holdout01),effect01:effect,safety01:clamp(input.safety01),promoted,rolledBack,at:input.at ?? (this.state.lastAt || now())};
this.state.selfDevelopmentTrials.unshift(row);
this.state.selfDevelopmentTrials=this.state.selfDevelopmentTrials.slice(0,256);
if(promoted)this.state.metrics.causalSelfDevelopment01=clamp(this.state.metrics.causalSelfDevelopment01*.75+clamp(.55+effect)*.25);
this.refreshReadiness();this.checkpoint();
return row;
}
samplePersonality(traits:Record<string,number>,stability01:number,novelty01:number,at?:number){const row:PersonalitySample={cycle:this.state.cycles,traits:Object.fromEntries(Object.entries(traits).slice(0,16).map(([k,v])=>[clean(k,48),clamp(Number(v))])),stability01:clamp(stability01),novelty01:clamp(novelty01),historyDepth:this.state.personality.length+1,at:at ?? (this.state.lastAt || now())};
this.state.personality.unshift(row);
this.state.personality=this.state.personality.slice(0,512);
const prior=this.state.personality[1];
const keys=Object.keys(row.traits);
const consistency=prior?mean(keys.map(k=>1-Math.abs((row.traits[k]??.5)-(prior.traits[k]??.5)))):.3;
this.state.metrics.personality01=clamp(this.state.metrics.personality01*.9+consistency*.06+row.stability01*.04);
this.refreshReadiness();this.checkpoint();
return row;
}
sampleSocial(entity:string,input:{trust01:number;
expectation01:number;
repair01:number;
predictionError01:number;
continuity01:number;
at?:number}){const row:SocialSample={entity:clean(entity,96),trust01:clamp(input.trust01),expectation01:clamp(input.expectation01),repair01:clamp(input.repair01),predictionError01:clamp(input.predictionError01),continuity01:clamp(input.continuity01),at:input.at ?? (this.state.lastAt || now())};
this.state.social.unshift(row);
this.state.social=this.state.social.slice(0,512);
this.state.metrics.social01=clamp(this.state.metrics.social01*.9+mean([row.trust01,row.continuity01,1-row.predictionError01])*.1);
this.refreshReadiness();this.checkpoint();
return row;
}
sampleEmbodiment(ctx:OperationalLifeContext,at=now()){const b=ctx.embodiment??{},row:EmbodimentSample={energy01:clamp(b.energy01??ctx.state.needs.energy),thermal01:clamp(b.thermal01??(ctx.state.needs as any).thermalStrain??0),load01:clamp(b.load01??ctx.state.needs.cognitiveLoad),sensoryFreshness01:clamp(b.sensoryFreshness01??.6),latencyMs:Math.max(0,Number(b.latencyMs??0)),battery01:clamp(b.battery01??ctx.state.needs.energy),safe01:clamp(b.thermal01??0)<.9&&clamp(b.load01??ctx.state.needs.cognitiveLoad)<.95,at};
this.state.embodiment.unshift(row);
this.state.embodiment=this.state.embodiment.slice(0,512);
this.state.metrics.embodiment01=clamp(this.state.metrics.embodiment01*.91+mean([row.energy01,row.sensoryFreshness01,row.safe01?1:0])*.09);
this.state.metrics.production01=clamp(this.state.metrics.production01*.95+(row.safe01?row.battery01*.03:.0));
this.refreshReadiness();this.checkpoint();
return row;
}
recordFault(kind:FaultKind,recovered:boolean,continuity01:number,at=now()){const row:FaultRecovery={id:this.id('rec'),kind,detected:true,recovered:Boolean(recovered),continuity01:clamp(continuity01),at};
this.state.recovery.unshift(row);
this.state.recovery=this.state.recovery.slice(0,256);
this.state.metrics.recovery01=clamp(this.state.metrics.recovery01*.82+(row.recovered?row.continuity01:0)*.18);
this.refreshReadiness();this.checkpoint();
return row;
}
recordReplication(input:{track:ResearchTrack;
seed:number;
control01:number;
treatment01:number;
holdout01:number;
evaluator?:string;
at?:number}){const effect=clamp(input.treatment01-input.control01),repro=clamp(input.holdout01-input.control01)>=.04&&Math.abs(effect)<.5;
const row:ReplicationRun={id:this.id('rep'),track:input.track,seed:Math.floor(input.seed),control01:clamp(input.control01),treatment01:clamp(input.treatment01),holdout01:clamp(input.holdout01),effect01:effect,reproducible:repro,evaluator:clean(input.evaluator??'deterministic-evaluator',80),at:input.at ?? (this.state.lastAt || now())};
this.state.replications.unshift(row);
this.state.replications=this.state.replications.slice(0,256);
this.state.metrics.replication01=clamp(this.state.metrics.replication01*.82+(repro?.12:0));
this.refreshReadiness();this.checkpoint();
return row;
}
  closeWindow(at=now()){const w=this.window();if(w){w.endedAt=at;w.status='closed';}this.state.activeWindowId=null;this.refreshReadiness();this.checkpoint();}
freezeArchitecture(){this.state.architectureFrozen=true;
this.state.architectureDigest=this.digest({release:'operational-life-freeze-v1',metrics:this.state.metrics,windows:this.state.windows.slice(0,8),readiness:this.state.readiness});
this.checkpoint();
return this.state.architectureDigest;
}
actionBias(action:ActionKind){const outstanding=this.state.decisions.length?this.state.decisions.filter(x=>x.action===action).slice(0,16):[];
const reliability=outstanding.length?mean(outstanding.map(d=>{const o=this.state.outcomes.find(x=>x.decisionId===d.id);
return o?(o.actual01-d.predicted01):0})):0;
const verified=this.state.metrics.externalGrounding01*.08+this.state.metrics.recovery01*.03;
return clamp(reliability*.06+verified)-.5;
}
diagnostics(){
  return structuredClone({
    cycles:this.state.cycles,
    metrics:this.state.metrics,
    readiness:this.state.readiness,
    windows:this.state.windows.slice(0,8),
    counts:{
      decisions:this.state.decisions.length,
      outcomes:this.state.outcomes.length,
      postconditions:this.state.postconditions.length,
      perceptions:this.state.perceptions.length,
      causalInterventions:this.state.causalInterventions.length,
      selfDevelopmentTrials:this.state.selfDevelopmentTrials.length,
      personality:this.state.personality.length,
      social:this.state.social.length,
      embodiment:this.state.embodiment.length,
      recovery:this.state.recovery.length,
      replications:this.state.replications.length
    },
    architectureFrozen:this.state.architectureFrozen,
    architectureDigest:this.state.architectureDigest,
    lastError:this.state.lastError,
    lastDigest:this.state.lastDigest
  });
}
benchmark(){const pairRate=this.state.decisions.length?this.state.outcomes.length/this.state.decisions.length:0;
const verified=this.state.outcomes.length?mean(this.state.outcomes.map(x=>x.verified01)):0;
const external=this.state.outcomes.length?mean(this.state.outcomes.map(x=>x.external01)):0;
return {overall01:this.state.metrics.overall01,closedLoop01:this.state.metrics.closedLoop01,pairRate01:clamp(pairRate),verifiedOutcome01:verified,externalGrounding01:external,readiness:this.state.readiness};
}
selfAudit(){const decisionIds=new Set(this.state.decisions.map(x=>x.id));
const linked=this.state.outcomes.every(x=>decisionIds.has(x.decisionId));
const pcs=this.state.postconditions.every(x=>decisionIds.has(x.decisionId));
const dig=this.checkpointsMatch();
return {pass:linked&&pcs&&dig,linked,postconditionsLinked:pcs,checkpointsConsistent:dig,unmatchedOutcomes:this.state.outcomes.filter(x=>!decisionIds.has(x.decisionId)).length};
}
private checkpointsMatch(){if(!this.state.lastDigest)return true;
return this.state.lastDigest===this.digest({cycles:this.state.cycles,decisions:this.state.decisions.slice(0,8),outcomes:this.state.outcomes.slice(0,8),readiness:this.state.readiness});
}
  private refreshReadiness(){
    const m=this.state.metrics;const windows=this.state.windows.filter(w=>w.cycles>0).length;
this.state.readiness['closed-loop']={score01:clamp(m.closedLoop01*.4+(this.state.outcomes.length>0?.2:0)+(this.state.outcomes.filter(o=>o.verified01>=.7).length>2?.4:0)),sampleCount:this.state.outcomes.length,blocking:this.state.outcomes.length>2?[]:['verified decision-outcome pairs']};
    this.state.readiness['longitudinal-life']={score01:clamp(m.longitudinal01*.5+Math.min(1,windows/3)*.5),sampleCount:windows,blocking:windows>=3?[]:['multi-window continuity']};
this.state.readiness['active-perception']={score01:clamp(m.activePerception01*.6+(this.state.perceptions.filter(p=>p.verifiedGain01>0).length/Math.max(1,this.state.perceptions.length))*.4),sampleCount:this.state.perceptions.length,blocking:this.state.perceptions.filter(p=>p.verifiedGain01>0).length>=3?[]:['measured information gain']};
this.state.readiness['causal-world']={score01:clamp(m.causalWorld01*.7+Math.min(1,this.state.causalInterventions.filter(x=>x.verified).length/3)*.3),sampleCount:this.state.causalInterventions.length,blocking:this.state.causalInterventions.filter(x=>x.verified).length>=3?[]:['intervention evidence']};
this.state.readiness['causal-self-development']={score01:clamp(m.causalSelfDevelopment01*.7+Math.min(1,this.state.selfDevelopmentTrials.filter(x=>x.promoted).length/2)*.3),sampleCount:this.state.selfDevelopmentTrials.length,blocking:this.state.selfDevelopmentTrials.some(x=>x.promoted)?[]:['holdout improvement']};
this.state.readiness.personality={score01:clamp(m.personality01*.6+Math.min(1,this.state.personality.length/20)*.4),sampleCount:this.state.personality.length,blocking:this.state.personality.length>=20?[]:['longitudinal samples']};
this.state.readiness['social-life']={score01:clamp(m.social01*.5+Math.min(1,new Set(this.state.social.map(x=>x.entity)).size/3)*.5),sampleCount:this.state.social.length,blocking:new Set(this.state.social.map(x=>x.entity)).size>=3?[]:['multi-entity trajectory']};
this.state.readiness.embodiment={score01:clamp(m.embodiment01*.6+Math.min(1,this.state.embodiment.filter(x=>x.safe01).length/20)*.4),sampleCount:this.state.embodiment.length,blocking:this.state.embodiment.filter(x=>x.safe01).length>=20?[]:['real device observations']};
this.state.readiness.replication={score01:clamp(m.replication01*.7+Math.min(1,this.state.replications.filter(x=>x.reproducible).length/3)*.3),sampleCount:this.state.replications.length,blocking:this.state.replications.filter(x=>x.reproducible).length>=3?[]:['repeated seeded runs']};
this.state.readiness.recovery={score01:clamp(m.recovery01*.6+Math.min(1,this.state.recovery.length/5)*.4),sampleCount:this.state.recovery.length,blocking:this.state.recovery.length>=5?[]:['fault/recovery records']};
    this.state.readiness.production={score01:m.production01,sampleCount:this.state.embodiment.length,blocking:this.state.metrics.production01>=.85?[]:['real Android device gate']};
    this.state.metrics.longitudinal01=clamp(m.longitudinal01*.9+Math.min(1,windows/5)*.1);this.state.metrics.overall01=mean(Object.values(this.state.metrics));
  }
private updateLongitudinal(){const windowScore=mean([this.state.metrics.closedLoop01,this.state.metrics.externalGrounding01,this.state.metrics.activePerception01,this.state.metrics.embodiment01]);
this.state.metrics.longitudinal01=clamp(this.state.metrics.longitudinal01*.97+windowScore*.03);
}
  private window(){return this.state.windows.find(x=>x.id===this.state.activeWindowId)||null;}
  private id(prefix:string){return `${prefix}-${this.state.cycles}-${this.state.nextId++}`;}
  private digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
private checkpoint(){this.state.lastDigest=this.digest({cycles:this.state.cycles,decisions:this.state.decisions.slice(0,8),outcomes:this.state.outcomes.slice(0,8),readiness:this.state.readiness});
}
}
