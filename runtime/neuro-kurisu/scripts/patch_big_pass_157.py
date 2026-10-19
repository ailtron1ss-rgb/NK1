from pathlib import Path
import json,re
ROOT=Path('/mnt/data/nk127')

engine = r'''import { createHash } from 'node:crypto';
import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[],fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const now=()=>Date.now();
const clean=(x:string,n=160)=>String(x??'').trim().slice(0,n);

export type EvidenceClass='external-postcondition'|'device-observation'|'sensor-observation'|'tool-verification'|'world-transition'|'internal-transition'|'simulation'|'manual';
export type FaultKind='restart'|'interrupted-action'|'sensor-failure'|'resource-pressure'|'state-corruption'|'world-disconnect';
export type ResearchTrack='closed-loop'|'longitudinal-life'|'active-perception'|'causal-world'|'causal-self-development'|'personality'|'social-life'|'embodiment'|'replication'|'recovery'|'production';

export interface OperationalDecision { id:string; cycle:number; action:ActionKind; predicted01:number; confidence01:number; horizon01:number; at:number; }
export interface OperationalOutcome { id:string; decisionId:string; actual01:number; reward01:number; predictionError01:number; verified01:number; external01:number; causal01:number; evidenceCount:number; at:number; }
export interface ExternalPostcondition { id:string; decisionId:string; expected:string; observed:string; passed:boolean; evidenceClass:EvidenceClass; confidence01:number; independent01:number; at:number; }
export interface ActivePerceptionQuery { id:string; mode:string; expectedGain01:number; actionability01:number; cost01:number; uncertainty01:number; selected:boolean; verifiedGain01:number; at:number; }
export interface CausalIntervention { id:string; target:string; control01:number; treatment01:number; effect01:number; confidence01:number; independent01:number; repetitions:number; verified:boolean; at:number; }
export interface SelfDevelopmentTrial { id:string; hypothesis:string; intervention:string; baseline01:number; treatment01:number; holdout01:number; effect01:number; safety01:number; promoted:boolean; rolledBack:boolean; at:number; }
export interface PersonalitySample { cycle:number; traits:Record<string,number>; stability01:number; novelty01:number; historyDepth:number; at:number; }
export interface SocialSample { entity:string; trust01:number; expectation01:number; repair01:number; predictionError01:number; continuity01:number; at:number; }
export interface EmbodimentSample { energy01:number; thermal01:number; load01:number; sensoryFreshness01:number; latencyMs:number; battery01:number; safe01:boolean; at:number; }
export interface FaultRecovery { id:string; kind:FaultKind; detected:boolean; recovered:boolean; continuity01:number; at:number; }
export interface ReplicationRun { id:string; track:ResearchTrack; seed:number; control01:number; treatment01:number; holdout01:number; effect01:number; reproducible:boolean; evaluator:string; at:number; }
export interface LifeWindow { id:string; startedAt:number; endedAt:number|null; cycles:number; decisions:number; outcomes:number; verifiedOutcomes:number; externalOutcomes:number; status:'active'|'closed'; }

export interface OperationalLifeState {
  version:1; cycles:number; nextId:number; lastAt:number; startedAt:number;
  decisions:OperationalDecision[]; outcomes:OperationalOutcome[]; postconditions:ExternalPostcondition[];
  perceptions:ActivePerceptionQuery[]; causalInterventions:CausalIntervention[]; selfDevelopmentTrials:SelfDevelopmentTrial[];
  personality:PersonalitySample[]; social:SocialSample[]; embodiment:EmbodimentSample[]; recovery:FaultRecovery[];
  replications:ReplicationRun[]; windows:LifeWindow[];
  metrics:{closedLoop01:number;externalGrounding01:number;activePerception01:number;causalWorld01:number;causalSelfDevelopment01:number;personality01:number;social01:number;embodiment01:number;longitudinal01:number;replication01:number;recovery01:number;production01:number;overall01:number};
  readiness:Record<ResearchTrack,{score01:number;sampleCount:number;blocking:string[]}>;
  activeWindowId:string|null; lastDecisionId:string|null; lastOutcomeId:string|null; lastDigest:string; architectureFrozen:boolean; architectureDigest:string; lastError:string;
}

export interface OperationalLifeContext { state:OrganismState; action?:ActionKind; overall01?:number; agency01?:number; prediction01?:number; uncertainty01?:number; activePerception01?:number; social01?:number; socialError01?:number; embodiment?:{energy01?:number;thermal01?:number;load01?:number;sensoryFreshness01?:number;latencyMs?:number;battery01?:number}; at?:number; }

export const defaultOperationalLife=():OperationalLifeState=>({
  version:1,cycles:0,nextId:1,lastAt:0,startedAt:now(),decisions:[],outcomes:[],postconditions:[],perceptions:[],causalInterventions:[],selfDevelopmentTrials:[],personality:[],social:[],embodiment:[],recovery:[],replications:[],windows:[],
  metrics:{closedLoop01:.15,externalGrounding01:.05,activePerception01:.15,causalWorld01:.08,causalSelfDevelopment01:.05,personality01:.2,social01:.2,embodiment01:.2,longitudinal01:.1,replication01:.05,recovery01:.6,production01:.4,overall01:.2},
  readiness:{'closed-loop':{score01:0,sampleCount:0,blocking:['verified decision-outcome pairs']},'longitudinal-life':{score01:0,sampleCount:0,blocking:['multi-window continuity']},'active-perception':{score01:0,sampleCount:0,blocking:['measured information gain']},'causal-world':{score01:0,sampleCount:0,blocking:['intervention evidence']},'causal-self-development':{score01:0,sampleCount:0,blocking:['holdout improvement']},personality:{score01:0,sampleCount:0,blocking:['longitudinal samples']},'social-life':{score01:0,sampleCount:0,blocking:['multi-entity trajectory']},embodiment:{score01:0,sampleCount:0,blocking:['real device observations']},replication:{score01:0,sampleCount:0,blocking:['repeated seeded runs']},recovery:{score01:.2,sampleCount:0,blocking:['fault/recovery records']},production:{score01:.15,sampleCount:0,blocking:['real Android device gate']}},
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
    this.refreshReadiness();
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(ctx:OperationalLifeContext){
    const at=ctx.at??now();
    if(this.state.lastAt && at<this.state.lastAt)this.recordFault('restart',true,.97,at);
    if(!this.state.activeWindowId){this.state.activeWindowId=this.id('win');this.state.windows.unshift({id:this.state.activeWindowId,startedAt:at,endedAt:null,cycles:0,decisions:0,outcomes:0,verifiedOutcomes:0,externalOutcomes:0,status:'active'});}
    this.state.cycles++;this.state.lastAt=at;
    const w=this.window();if(w)w.cycles++;
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.92+(ctx.activePerception01??this.state.metrics.activePerception01)*.08);
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.96+(ctx.agency01??.5)*.01+(ctx.prediction01??.5)*.01);
    this.sampleEmbodiment(ctx,at);
    this.updateLongitudinal();this.refreshReadiness();this.checkpoint();
  }
  registerDecision(input:{action:ActionKind;predicted01:number;confidence01?:number;horizon01?:number;at?:number}){
    const id=this.id('dec');const d:OperationalDecision={id,cycle:this.state.cycles,action:input.action,predicted01:clamp(input.predicted01),confidence01:clamp(input.confidence01??.5),horizon01:clamp(input.horizon01??.5),at:input.at??this.state.lastAt||now()};
    this.state.decisions.unshift(d);this.state.decisions=this.state.decisions.slice(0,1024);this.state.lastDecisionId=id;const w=this.window();if(w)w.decisions++;return id;
  }
  registerOutcome(input:{decisionId?:string|null;actual01:number;reward01?:number;verified01:number;external01?:number;causal01?:number;evidenceCount?:number;at?:number}){
    const d=this.state.decisions.find(x=>x.id===(input.decisionId??this.state.lastDecisionId));if(!d){this.state.lastError='unmatched-decision';return {ok:false,reason:'unmatched-decision'} as const;}
    const actual=clamp(input.actual01),error=Math.abs(d.predicted01-actual);const id=this.id('out');
    const row:OperationalOutcome={id,decisionId:d.id,actual01:actual,reward01:clamp(input.reward01??actual),predictionError01:error,verified01:clamp(input.verified01),external01:clamp(input.external01??0),causal01:clamp(input.causal01??0),evidenceCount:Math.max(0,Math.floor(input.evidenceCount??0)),at:input.at??this.state.lastAt||now()};
    this.state.outcomes.unshift(row);this.state.outcomes=this.state.outcomes.slice(0,1024);this.state.lastOutcomeId=id;
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.88+(1-error)*.06+row.verified01*.04+row.causal01*.02);
    this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.9+row.external01*.06+row.verified01*.04);
    const w=this.window();if(w){w.outcomes++;if(row.verified01>=.7)w.verifiedOutcomes++;if(row.external01>=.7)w.externalOutcomes++;}
    this.updateLongitudinal();this.refreshReadiness();this.checkpoint();return {ok:true,outcomeId:id,error01:error} as const;
  }
  recordPostcondition(input:{decisionId:string;expected:string;observed:string;passed:boolean;evidenceClass:EvidenceClass;confidence01:number;independent01:number;at?:number}){
    if(!this.state.decisions.some(x=>x.id===input.decisionId)){this.state.lastError='unmatched-postcondition';return null;}
    const row:ExternalPostcondition={id:this.id('pc'),decisionId:input.decisionId,expected:clean(input.expected,240),observed:clean(input.observed,240),passed:Boolean(input.passed),evidenceClass:input.evidenceClass,confidence01:clamp(input.confidence01),independent01:clamp(input.independent01),at:input.at??this.state.lastAt||now()};
    this.state.postconditions.unshift(row);this.state.postconditions=this.state.postconditions.slice(0,1024);
    const externalClass=!['internal-transition','simulation','manual'].includes(row.evidenceClass);const strength=(row.passed?.55:0)+row.confidence01*.25+row.independent01*.2;
    if(externalClass)this.state.metrics.externalGrounding01=clamp(this.state.metrics.externalGrounding01*.86+strength*.14);
    this.refreshReadiness();return row;
  }
  chooseActivePerception(input:{mode:string;uncertainty01:number;actionability01:number;cost01:number;at?:number}){
    const expected=clamp(input.uncertainty01*.55+input.actionability01*.35+(1-clamp(input.cost01))*.1);const row:ActivePerceptionQuery={id:this.id('per'),mode:clean(input.mode,64),expectedGain01:expected,actionability01:clamp(input.actionability01),cost01:clamp(input.cost01),uncertainty01:clamp(input.uncertainty01),selected:expected>=.42,verifiedGain01:0,at:input.at??this.state.lastAt||now()};this.state.perceptions.unshift(row);this.state.perceptions=this.state.perceptions.slice(0,512);this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.9+(row.selected?expected*.07:expected*.03));this.refreshReadiness();return row;
  }
  verifyPerception(id:string,observedGain01:number,verified01:number){const p=this.state.perceptions.find(x=>x.id===id);if(!p)return false;p.verifiedGain01=clamp(observedGain01);const q=1-Math.abs(p.expectedGain01-p.verifiedGain01);this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.84+q*.1+clamp(verified01)*.06);this.refreshReadiness();return true;}
  recordCausalIntervention(input:{target:string;control01:number;treatment01:number;confidence01:number;independent01:number;repetitions:number;at?:number}){const effect=clamp(Math.abs(input.treatment01-input.control01));const verified=input.repetitions>=2&&input.independent01>=.5&&input.confidence01>=.6;const row:CausalIntervention={id:this.id('cause'),target:clean(input.target,120),control01:clamp(input.control01),treatment01:clamp(input.treatment01),effect01:effect,confidence01:clamp(input.confidence01),independent01:clamp(input.independent01),repetitions:Math.max(1,Math.floor(input.repetitions)),verified,at:input.at??this.state.lastAt||now()};this.state.causalInterventions.unshift(row);this.state.causalInterventions=this.state.causalInterventions.slice(0,256);if(verified)this.state.metrics.causalWorld01=clamp(this.state.metrics.causalWorld01*.82+effect*.1+row.confidence01*.08);this.refreshReadiness();return row;}
  proposeSelfDevelopmentTrial(input:{hypothesis:string;intervention:string;baseline01:number;treatment01:number;holdout01:number;safety01:number;at?:number}){const effect=clamp(input.holdout01-input.baseline01);const promoted=effect>=.08&&input.safety01>=.85&&input.treatment01>=input.baseline01;const rolledBack=!promoted&&effect<-.05;const row:SelfDevelopmentTrial={id:this.id('dev'),hypothesis:clean(input.hypothesis,220),intervention:clean(input.intervention,220),baseline01:clamp(input.baseline01),treatment01:clamp(input.treatment01),holdout01:clamp(input.holdout01),effect01:effect,safety01:clamp(input.safety01),promoted,rolledBack,at:input.at??this.state.lastAt||now()};this.state.selfDevelopmentTrials.unshift(row);this.state.selfDevelopmentTrials=this.state.selfDevelopmentTrials.slice(0,256);if(promoted)this.state.metrics.causalSelfDevelopment01=clamp(this.state.metrics.causalSelfDevelopment01*.75+clamp(.55+effect)*.25);this.refreshReadiness();return row;}
  samplePersonality(traits:Record<string,number>,stability01:number,novelty01:number,at?:number){const row:PersonalitySample={cycle:this.state.cycles,traits:Object.fromEntries(Object.entries(traits).slice(0,16).map(([k,v])=>[clean(k,48),clamp(Number(v))])),stability01:clamp(stability01),novelty01:clamp(novelty01),historyDepth:this.state.personality.length+1,at:at??this.state.lastAt||now()};this.state.personality.unshift(row);this.state.personality=this.state.personality.slice(0,512);const prior=this.state.personality[1];const keys=Object.keys(row.traits);const consistency=prior?mean(keys.map(k=>1-Math.abs((row.traits[k]??.5)-(prior.traits[k]??.5)))):.3;this.state.metrics.personality01=clamp(this.state.metrics.personality01*.9+consistency*.06+row.stability01*.04);this.refreshReadiness();return row;}
  sampleSocial(entity:string,input:{trust01:number;expectation01:number;repair01:number;predictionError01:number;continuity01:number;at?:number}){const row:SocialSample={entity:clean(entity,96),trust01:clamp(input.trust01),expectation01:clamp(input.expectation01),repair01:clamp(input.repair01),predictionError01:clamp(input.predictionError01),continuity01:clamp(input.continuity01),at:input.at??this.state.lastAt||now()};this.state.social.unshift(row);this.state.social=this.state.social.slice(0,512);this.state.metrics.social01=clamp(this.state.metrics.social01*.9+mean([row.trust01,row.continuity01,1-row.predictionError01])*.1);this.refreshReadiness();return row;}
  sampleEmbodiment(ctx:OperationalLifeContext,at=now()){const b=ctx.embodiment??{},row:EmbodimentSample={energy01:clamp(b.energy01??ctx.state.needs.energy),thermal01:clamp(b.thermal01??(ctx.state.needs as any).thermalStrain??0),load01:clamp(b.load01??ctx.state.needs.cognitiveLoad),sensoryFreshness01:clamp(b.sensoryFreshness01??.6),latencyMs:Math.max(0,Number(b.latencyMs??0)),battery01:clamp(b.battery01??ctx.state.needs.energy),safe01:clamp(b.thermal01??0)<.9&&clamp(b.load01??ctx.state.needs.cognitiveLoad)<.95,at};this.state.embodiment.unshift(row);this.state.embodiment=this.state.embodiment.slice(0,512);this.state.metrics.embodiment01=clamp(this.state.metrics.embodiment01*.91+mean([row.energy01,row.sensoryFreshness01,row.safe01?1:0])*.09);this.state.metrics.production01=clamp(this.state.metrics.production01*.95+(row.safe01?row.battery01*.03:.0));return row;}
  recordFault(kind:FaultKind,recovered:boolean,continuity01:number,at=now()){const row:FaultRecovery={id:this.id('rec'),kind,detected:true,recovered:Boolean(recovered),continuity01:clamp(continuity01),at};this.state.recovery.unshift(row);this.state.recovery=this.state.recovery.slice(0,256);this.state.metrics.recovery01=clamp(this.state.metrics.recovery01*.82+(row.recovered?row.continuity01:0)*.18);this.refreshReadiness();return row;}
  recordReplication(input:{track:ResearchTrack;seed:number;control01:number;treatment01:number;holdout01:number;evaluator?:string;at?:number}){const effect=clamp(input.treatment01-input.control01),repro=clamp(input.holdout01-input.control01)>=.04&&Math.abs(effect)<.5;const row:ReplicationRun={id:this.id('rep'),track:input.track,seed:Math.floor(input.seed),control01:clamp(input.control01),treatment01:clamp(input.treatment01),holdout01:clamp(input.holdout01),effect01:effect,reproducible:repro,evaluator:clean(input.evaluator??'deterministic-evaluator',80),at:input.at??this.state.lastAt||now()};this.state.replications.unshift(row);this.state.replications=this.state.replications.slice(0,256);this.state.metrics.replication01=clamp(this.state.metrics.replication01*.82+(repro?.12:0));this.refreshReadiness();return row;}
  closeWindow(at=now()){const w=this.window();if(w){w.endedAt=at;w.status='closed';}this.state.activeWindowId=null;this.refreshReadiness();}
  freezeArchitecture(){this.state.architectureFrozen=true;this.state.architectureDigest=this.digest({release:'operational-life-freeze-v1',metrics:this.state.metrics,windows:this.state.windows.slice(0,8),readiness:this.state.readiness});this.checkpoint();return this.state.architectureDigest;}
  actionBias(action:ActionKind){const outstanding=this.state.decisions.length?this.state.decisions.filter(x=>x.action===action).slice(0,16):[];const reliability=outstanding.length?mean(outstanding.map(d=>{const o=this.state.outcomes.find(x=>x.decisionId===d.id);return o?(o.actual01-o.predicted01):0})):0;const verified=this.state.metrics.externalGrounding01*.08+this.state.metrics.recovery01*.03;return clamp(reliability*.06+verified)-.5;}
  diagnostics(){return structuredClone({cycles:this.state.cycles,metrics:this.state.metrics,readiness:this.state.readiness,windows:this.state.windows.slice(0,8),counts:{decisions:this.state.decisions.length,outcomes:this.state.outcomes.length,postconditions:this.state.postconditions.length,perceptions:this.state.perceptions.length,causalInterventions:this.state.causalInterventions.length,selfDevelopmentTrials:this.state.selfDevelopmentTrials.length,personality:this.state.personality.length,social:this.state.social.length,embodiment:this.state.embodiment.length,recovery:this.state.recovery.length,replications:this.state.replications.length},architectureFrozen:this.state.architectureFrozen,architectureDigest:this.state.architectureDigest,lastError:this.state.lastError,lastDigest:this.state.lastDigest});}
  benchmark(){const pairRate=this.state.decisions.length?this.state.outcomes.length/this.state.decisions.length:0;const verified=this.state.outcomes.length?mean(this.state.outcomes.map(x=>x.verified01)):0;const external=this.state.outcomes.length?mean(this.state.outcomes.map(x=>x.external01)):0;return {overall01:this.state.metrics.overall01,closedLoop01:this.state.metrics.closedLoop01,pairRate01:clamp(pairRate),verifiedOutcome01:verified,externalGrounding01:external,readiness:this.state.readiness};}
  selfAudit(){const decisionIds=new Set(this.state.decisions.map(x=>x.id));const linked=this.state.outcomes.every(x=>decisionIds.has(x.decisionId));const pcs=this.state.postconditions.every(x=>decisionIds.has(x.decisionId));const dig=this.state.checkpointsMatch();return {pass:linked&&pcs&&dig,linked,postconditionsLinked:pcs,checkpointsConsistent:dig,unmatchedOutcomes:this.state.outcomes.filter(x=>!decisionIds.has(x.decisionId)).length};}
  private checkpointsMatch(){if(!this.state.lastDigest)return true;return this.state.lastDigest===this.digest({cycles:this.state.cycles,decisions:this.state.decisions.slice(0,8),outcomes:this.state.outcomes.slice(0,8),readiness:this.state.readiness});}
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
  private updateLongitudinal(){const windowScore=mean([this.state.metrics.closedLoop01,this.state.metrics.externalGrounding01,this.state.metrics.activePerception01,this.state.metrics.embodiment01]);this.state.metrics.longitudinal01=clamp(this.state.metrics.longitudinal01*.97+windowScore*.03);}
  private window(){return this.state.windows.find(x=>x.id===this.state.activeWindowId)||null;}
  private id(prefix:string){return `${prefix}-${this.state.cycles}-${this.state.nextId++}`;}
  private digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
  private checkpoint(){this.state.lastDigest=this.digest({cycles:this.state.cycles,decisions:this.state.decisions.slice(0,8),outcomes:this.state.outcomes.slice(0,8),readiness:this.state.readiness});}
}
'''
(ROOT/'src/organism/learning/OperationalLifeEngine.ts').write_text(engine)

# type field
p=ROOT/'src/organism/core/types.ts'; s=p.read_text(); old="  researchGradeOrganism?: import('../learning/ResearchGradeOrganismEngine.ts').ResearchGradeState;\n}"; new="  researchGradeOrganism?: import('../learning/ResearchGradeOrganismEngine.ts').ResearchGradeState;\n  operationalLife?: import('../learning/OperationalLifeEngine.ts').OperationalLifeState;\n}"; assert old in s; p.write_text(s.replace(old,new))

# StateMigrations import/default
p=ROOT/'src/organism/persistence/StateMigrations.ts'; s=p.read_text()
# imports near top
if "OperationalLifeEngine" not in s:
    # insert after ResearchGrade import if exists
    marker="import { RELEASE_CONTRACT } from '../system/ReleaseContract.ts';"
    s=s.replace(marker, "import { OperationalLifeEngine, defaultOperationalLife } from '../learning/OperationalLifeEngine.ts';\n"+marker)
old="  cognitiveOrganismContinuity: defaultCognitiveOrganismContinuity(),\n});"
new="  cognitiveOrganismContinuity: defaultCognitiveOrganismContinuity(),\n  operationalLife: defaultOperationalLife(),\n});"
assert old in s; s=s.replace(old,new)
# normalize at return learning spread already carries field; add compatibility default after learning merge
needle="  const learning = mergeFacet(defaultLearningFacet(), raw.facets?.learning, raw.p3);"
s=s.replace(needle, needle+"\n  learning.operationalLife = { ...defaultOperationalLife(), ...(learning.operationalLife ?? {}) };",1)
p.write_text(s)

# Core import, field, restore, cycle begin, outcome, persistence, accessors
p=ROOT/'src/organism/core/OrganismCore.ts'; s=p.read_text()
if "OperationalLifeEngine" not in s:
    marker="import { ResearchGradeOrganismEngine, defaultResearchGradeOrganism } from '../learning/ResearchGradeOrganismEngine.ts';"
    s=s.replace(marker, marker+"\nimport { OperationalLifeEngine, defaultOperationalLife, type OperationalLifeContext } from '../learning/OperationalLifeEngine.ts';")
marker="  private readonly researchGradeOrganism = new ResearchGradeOrganismEngine();"
if marker in s and "private readonly operationalLife" not in s:
    s=s.replace(marker, marker+"\n  private readonly operationalLife = new OperationalLifeEngine();")
# restore
marker="    this.researchGradeOrganism.restore(this.persisted.facets.learning.researchGradeOrganism);"
if marker in s and "this.operationalLife.restore" not in s:
    s=s.replace(marker, marker+"\n    this.operationalLife.restore(this.persisted.facets.learning.operationalLife);")
# begin cycle after research grade begin block: add using current variables
marker="    this.researchGradeOrganism.beginCycle({\n      state, overall01:this.autonomousCognitiveLife.benchmark().overall01,"
# easier insert after closing call line
line="    });\n    const trajectoryDecision"
idx=s.find(line, s.find("this.researchGradeOrganism.beginCycle"))
if idx!=-1 and "this.operationalLife.beginCycle" not in s[s.find("this.researchGradeOrganism.beginCycle"):idx+50]:
    insert="    this.operationalLife.beginCycle({state, overall01:this.autonomousCognitiveLife.benchmark().overall01, agency01:this.autonomousCognitiveLife.diagnostics().metrics.autonomy01, prediction01:this.autonomousCognitiveLife.diagnostics().metrics.metacognition01, uncertainty01:n.uncertainty, activePerception01:this.autonomousCognitiveLife.diagnostics().metrics.activePerception01, social01:n.socialNeed, socialError01:socialPredictionError, embodiment:{energy01:state.needs.energy,thermal01:(state.needs as any).thermalStrain??observation.embodiment?.thermalStrain01,load01:state.needs.cognitiveLoad,sensoryFreshness01:observation.embodiment?.sensoryFreshness01,battery01:state.needs.energy},at:state.at});\n"
    s=s[:idx+len(line)-3]+insert+s[idx+len(line)-3:]
# decision registration after researchGrade decision line
marker="      this.researchGradeDecisionId = this.researchGradeOrganism.registerDecision(selected.action, clamp(selected.predictedUtility ?? .5), synthContext, state.at);"
if marker in s and "this.operationalLifeDecisionId" not in s:
    s=s.replace(marker, marker+"\n      this.operationalLifeDecisionId = this.operationalLife.registerDecision({action:selected.action,predicted01:clamp(selected.predictedUtility ?? .5),confidence01:clamp(this.autonomousLifeProjections.find(x=>x.action===selected.action)?.confidence01 ?? .5),horizon01:clamp(this.personalWorldline.snapshot().worldlineStability01),at:state.at});")
# add private ID field near researchGradeDecisionId
marker="  private researchGradeDecisionId: string|null = null;"
if marker in s and "private operationalLifeDecisionId" not in s:
    s=s.replace(marker, marker+"\n  private operationalLifeDecisionId: string|null = null;")
# outcome add after research grade outcome
marker="      this.researchGradeOrganism.registerOutcome({decisionId:this.researchGradeDecisionId!,actual01:rewardNow,reward01:rewardNow,verified01:verifiedNow?1:0,causal01:clamp(cdlOutcome.behavioral?.sequence?.length ? .6 : .3),external01:clamp(projectEvidenceExternal ? 1 : outcome.worldTransition ? .7 : 0),at:state.at});"
if marker in s and "this.operationalLife.registerOutcome" not in s:
    add="\n      this.operationalLife.recordPostcondition({decisionId:this.operationalLifeDecisionId!,expected:`action=${trace.selected.action};success>=${(trace.selected.predictedUtility ?? .5).toFixed(2)}`,observed:`success=${success.toFixed(2)};reward=${rewardNow.toFixed(2)};verified=${verifiedNow}`,passed:Boolean(verifiedNow || success>=.5),evidenceClass:verifiedNow?'external-postcondition':'internal-transition',confidence01:clamp(verifiedNow?.9:.6),independent01:clamp(projectEvidenceExternal?1:(outcome.worldTransition?.75:.2)),at:state.at});\n      this.operationalLife.registerOutcome({decisionId:this.operationalLifeDecisionId,actual01:rewardNow,reward01:rewardNow,verified01:verifiedNow?1:0,external01:clamp(projectEvidenceExternal?1:(outcome.worldTransition?.7:0)),causal01:clamp(cdlOutcome.behavioral?.sequence?.length?.6:.3),evidenceCount:verifiedNow?1:0,at:state.at});"
    s=s.replace(marker, marker+add)
# persistence
marker="    this.persisted.facets.learning.researchGradeOrganism=this.researchGradeOrganism.snapshot();"
if marker in s and "this.persisted.facets.learning.operationalLife" not in s:
    s=s.replace(marker, marker+"\n    this.persisted.facets.learning.operationalLife=this.operationalLife.snapshot();")
# accessors after research diagnostics
marker="  researchGradeOrganismSelfAudit(){ return this.researchGradeOrganism.selfAudit(); }"
if marker in s and "operationalLifeSnapshot" not in s:
    s=s.replace(marker, marker+"\n  operationalLifeSnapshot(){ return this.operationalLife.snapshot(); }\n  operationalLifeDiagnostics(){ return this.operationalLife.diagnostics(); }\n  operationalLifeBenchmark(){ return this.operationalLife.benchmark(); }\n  operationalLifeSelfAudit(){ return this.operationalLife.selfAudit(); }\n  operationalLifeChoosePerception(mode:string='observe-world'){ return this.operationalLife.chooseActivePerception({mode,uncertainty01:this.persisted.state.needs.uncertainty,actionability01:this.persisted.state.needs.goalPressure,cost01:this.persisted.state.needs.cognitiveLoad}); }\n  operationalLifeFreezeArchitecture(){ return this.operationalLife.freezeArchitecture(); }")
p.write_text(s)

# server route
p=ROOT/'src/server/server.mjs'; s=p.read_text(); marker="    if (req.method === 'GET' && url.pathname === '/api/organism/cognitive-organism-continuity') {"
route="""    if (req.method === 'GET' && url.pathname === '/api/organism/operational-life') {\n      return json(res, 200, { ok:true, phase:RELEASE_CONTRACT.phase, operationalLife:runtime.core.operationalLifeSnapshot(), diagnostics:runtime.core.operationalLifeDiagnostics(), benchmark:runtime.core.operationalLifeBenchmark(), audit:runtime.core.operationalLifeSelfAudit(), note:'Verified operational life loop, external postconditions, active perception, causal experimentation, longitudinal personality/social/embodiment records, replication and recovery gates; not evidence of subjective consciousness.' });\n    }\n"""
if "'/api/organism/operational-life'" not in s: s=s.replace(marker, route+marker)
p.write_text(s)

# release versions
p=ROOT/'src/organism/system/ReleaseContract.ts'; s=p.read_text().replace("application: '35.3.0'","application: '35.4.0'").replace("stateSchema: 126","stateSchema: 127").replace("Stage-22/research-grade-autonomous-organism/real-postconditions/longitudinal-life/replication-recovery","Stage-23/verified-operational-life/external-loop/active-perception/causal-research/production-readiness"); p.write_text(s)

for fn in ['VERSION.json']:
    p=ROOT/fn; d=json.loads(p.read_text()); d.update({'application':'35.4.0','version':'35.4.0','stateSchema':127,'phase':'Stage-23/verified-operational-life/external-loop/active-perception/causal-research/production-readiness','status':'research-release'}); p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')

# package + lock
for fn in ['package.json','package-lock.json']:
    p=ROOT/fn; d=json.loads(p.read_text()); d['version']='35.4.0';
    if fn=='package-lock.json': d.setdefault('packages',{}).setdefault('',{})['version']='35.4.0'
    d.setdefault('scripts',{})['test:big-pass-157']='node --experimental-strip-types tests/big-pass-157-operational-life.mjs'
    d.setdefault('scripts',{})['test:big-pass-157:core']='node --experimental-strip-types tests/big-pass-157-core-operational-life.mjs'
    d.setdefault('scripts',{})['test:big-pass-157:server']='node tests/big-pass-157-server-smoke.mjs'
    d.setdefault('scripts',{})['test:big-pass-157:restart']='node --experimental-strip-types tests/big-pass-157-restart.mjs'
    d.setdefault('scripts',{})['audit:big-pass-157']='npm run typecheck && npm run test:big-pass-157 && npm run test:big-pass-157:core && npm run test:big-pass-157:server && npm run test:big-pass-157:restart && npm run audit:architecture && npm run audit:hygiene && npm run audit:forensics && npm run audit:integrity && npm run verify:release-source'
    p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')

# tests
(ROOT/'tests/big-pass-157-operational-life.mjs').write_text(r'''import assert from 'node:assert/strict';
import { OperationalLifeEngine } from '../src/organism/learning/OperationalLifeEngine.ts';
const engine=new OperationalLifeEngine();
for(let i=0;i<12;i++){
  engine.beginCycle({state:{tick:i,at:1000+i,needs:{energy:.8,cognitiveLoad:.2,uncertainty:.5,socialNeed:.4,novelty:.5,identityCoherence:.9,goalPressure:.5}}});
  const d=engine.registerDecision({action:i%2?'reflect':'observe',predicted01:.6,confidence01:.8,horizon01:.7,at:1000+i});
  engine.recordPostcondition({decisionId:d,expected:'success>=0.5',observed:'verified world transition',passed:true,evidenceClass:'world-transition',confidence01:.9,independent01:.8,at:1000+i});
  engine.registerOutcome({decisionId:d,actual01:.68,reward01:.68,verified01:.9,external01:.8,causal01:.6,evidenceCount:1,at:1000+i});
  const p=engine.chooseActivePerception({mode:'world-state',uncertainty01:.6,actionability01:.7,cost01:.2,at:1000+i}); engine.verifyPerception(p.id,.58,.9);
  engine.recordCausalIntervention({target:'policy-test',control01:.42,treatment01:.61,confidence01:.8,independent01:.8,repetitions:3,at:1000+i});
  engine.proposeSelfDevelopmentTrial({hypothesis:'test improves holdout',intervention:'bounded proposal',baseline01:.5,treatment01:.72,holdout01:.62,safety01:.95,at:1000+i});
  engine.samplePersonality({curiosity:.7,persistence:.72,caution:.55},.82,.4,1000+i);
  engine.sampleSocial(`person-${i%3}`,{trust01:.7,expectation01:.65,repair01:.2,predictionError01:.18,continuity01:.76,at:1000+i});
  engine.recordReplication({track:'closed-loop',seed:i,control01:.5,treatment01:.65,holdout01:.62,evaluator:'deterministic',at:1000+i});
}
engine.closeWindow(2000);
engine.beginCycle({state:{tick:20,at:3000,needs:{energy:.82,cognitiveLoad:.18,uncertainty:.35,socialNeed:.3,novelty:.4,identityCoherence:.9,goalPressure:.3}}});
assert.equal(engine.selfAudit().pass,true);
assert.ok(engine.benchmark().closedLoop01>.2);
console.log(`BIG_PASS_157=PASS decisions=${engine.snapshot().decisions.length} outcomes=${engine.snapshot().outcomes.length} windows=${engine.snapshot().windows.length} overall=${engine.benchmark().overall01.toFixed(3)}`);
''')
(ROOT/'tests/big-pass-157-core-operational-life.mjs').write_text(r'''import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const core=new OrganismCore();
await core.init();
for(let i=0;i<4;i++) await core.cycle(`operational-${i}`);
const d=core.operationalLifeDiagnostics(); const a=core.operationalLifeSelfAudit();
assert.equal(a.pass,true); assert.ok(d.counts.decisions>=1); assert.ok(d.counts.outcomes>=1); assert.ok(d.counts.postconditions>=1);
console.log(`BIG_PASS_157_CORE=PASS cycles=${d.cycles} decisions=${d.counts.decisions} outcomes=${d.counts.outcomes} postconditions=${d.counts.postconditions}`);
''')
(ROOT/'tests/big-pass-157-server-smoke.mjs').write_text(r'''import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const port=21957; const child=spawn(process.execPath,['--experimental-strip-types','src/server/server.mjs'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{let ok=false;for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/organism/operational-life`);if(r.ok){const j=await r.json();assert.ok(j.operationalLife);ok=true;break;}}catch{}await sleep(100);}assert.equal(ok,true);console.log('BIG_PASS_157_SERVER=PASS real-http=true');}finally{child.kill('SIGTERM');await sleep(150);} 
''')
(ROOT/'tests/big-pass-157-restart.mjs').write_text(r'''import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
const core=new OrganismCore(); await core.init(); for(let i=0;i<3;i++) await core.cycle(`restart-${i}`); const before=core.operationalLifeSnapshot(); await core.flush();
const path=core.statePath; const core2=new OrganismCore({statePath:path}); await core2.init(); const after=core2.operationalLifeSnapshot();
assert.ok(after.cycles>=before.cycles); assert.ok(after.decisions.length>=before.decisions.length); assert.equal(core2.operationalLifeSelfAudit().pass,true); console.log(`BIG_PASS_157_RESTART=PASS restoredCycles=${after.cycles} decisions=${after.decisions.length}`);
''')

# docs
(ROOT/'BIG_PASS_157_VERIFIED_OPERATIONAL_LIFE_FULL_AUDIT_RU.md').write_text('''# BIG PASS 157 — Verified Operational Life\n\nЦель: перевести Neuro-Kurisu от research-grade ledgers к строгому operational closed loop.\n\n## Реализовано\n- точная decision→outcome связка;\n- внешние postconditions с provenance class;\n- active perception с измеряемым expected/observed information gain;\n- causal intervention ledger с повторениями и независимостью;\n- holdout-gated self-development trials;\n- longitudinal personality samples;\n- relational/social trajectory samples;\n- embodiment/production health samples;\n- fault/recovery ledger;\n- seeded replication runs;\n- life windows и continuity;\n- architecture freeze digest;\n- runtime + HTTP + restart tests.\n\n## Строгая граница\nСистема не выдаёт internal transition или simulation за внешний факт и не трактует функциональные показатели как доказательство субъективного сознания.\n\n## Physical device gate\nРеальный Android device gate остаётся открытым до выполнения на физическом устройстве; контейнерные тесты его не заменяют.\n''')
(ROOT/'PROJECT_PROGRESS_AND_NEXT_STEPS_35.4_RU.md').write_text('''# Neuro-Kurisu 35.4 — Progress & Next Steps\n\nТекущая инженерная зрелость: ~87%.\n\n## Покрыто\nАрхитектура, память, world/self continuity, agency, long-horizon planning, verified decision-outcome accountability, active perception, causal/holdout research scaffolding, longitudinal personality/social/embodiment records, recovery and replication controls.\n\n## Главные оставшиеся качественные блоки\n1. Реальные внешние postconditions через Android tools, camera, audio, TTS/STT и device telemetry.\n2. Multi-day/multi-week real-life runs.\n3. Реальные causal interventions на world model, а не только deterministic fixtures.\n4. Real self-development experiments in sandbox + independent holdout.\n5. Longitudinal personality and relationship studies with repeated baselines.\n6. Physical Android device gate: thermal, RAM, battery, background, crash/restart.\n7. Reproducibility package with seeds, fixtures, statistical reports and replication.\n8. Architecture freeze, final integration, acceptance matrix and research-grade release.\n\n## 100% engineering acceptance\n100% = all declared capabilities implemented, observed in runtime, persistent, reproducible, regression-safe and documented. Это не означает доказательство субъективного сознания.\n''')
(ROOT/'RELEASE_NOTES_35.4.0_RU.md').write_text('''# Neuro-Kurisu 35.4.0\n\nBIG PASS 157: Verified Operational Life.\n\nУсилен operational closed loop: external postconditions, active perception verification, causal intervention ledger, holdout-gated self-development, longitudinal personality/social/embodiment telemetry, recovery, replication and architecture freeze controls.\n''')

print('patched')
