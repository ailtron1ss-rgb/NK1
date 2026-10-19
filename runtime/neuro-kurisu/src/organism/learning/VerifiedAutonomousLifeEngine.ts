import { createHash } from 'node:crypto';
import type { ActionKind, OrganismState } from '../core/types.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const mean=(xs:number[],fallback=.5)=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback;
const now=()=>Date.now();

export type VerificationBasis='tool-contract'|'external-postcondition'|'internal-transition'|'simulation'|'none';
export interface VerifiedDecision { id:string; cycle:number; action:ActionKind; predicted01:number; confidence01:number; contextKey:string; at:number; resolved:boolean; }
export interface VerifiedOutcome { decisionId:string; actual01:number; error01:number; reward01:number; verified01:number; causal01:number; basis:VerificationBasis; at:number; stateAfterDigest:string; }
export interface PerceptionObservation { id:string; cycle:number; mode:string; expectedGain01:number; observedGain01:number; verified01:number; at:number; }
export interface CausalLink { decisionId:string; outcomeId:string; action:ActionKind; effect01:number; confidence01:number; evidence01:number; at:number; }
export interface IntegrityCheckpoint { cycle:number; digest:string; decisions:number; outcomes:number; at:number; }
export interface VerifiedLongitudinalPoint { cycle:number; overall01:number; loop01:number; agency01:number; prediction01:number; verification01:number; recovery01:number; at:number; }
export interface VerifiedAutonomousLifeState {
  version:1;
  cycles:number;
  lastAt:number;
  nextId:number;
  decisions:VerifiedDecision[];
  outcomes:VerifiedOutcome[];
  perceptions:PerceptionObservation[];
  causalLinks:CausalLink[];
  checkpoints:IntegrityCheckpoint[];
  longitudinal:VerifiedLongitudinalPoint[];
  metrics:{closedLoop01:number;decisionOutcomeMatch01:number;predictionCalibration01:number;verification01:number;causalAccountability01:number;activePerception01:number;recovery01:number;longHorizon01:number;interaction01:number;integrity01:number;};
  recoveryCount:number;
  unresolvedDecisions:number;
  lastDecisionId:string|null;
  lastOutcomeAt:number;
  lastDigest:string;
}

export interface VerifiedAutonomousLifeContext {
  state:OrganismState;
  overall01:number;
  agency01:number;
  prediction01:number;
  verification01:number;
  recovery01:number;
  activePerception01:number;
  longHorizon01:number;
  interaction01:number;
  contextKey?:string;
  at?:number;
}

export const defaultVerifiedAutonomousLife=():VerifiedAutonomousLifeState=>({
  version:1,cycles:0,lastAt:0,nextId:1,decisions:[],outcomes:[],perceptions:[],causalLinks:[],checkpoints:[],longitudinal:[],
  metrics:{closedLoop01:.2,decisionOutcomeMatch01:0,predictionCalibration01:.5,verification01:.1,causalAccountability01:.1,activePerception01:.2,recovery01:.6,longHorizon01:.3,interaction01:.3,integrity01:1},
  recoveryCount:0,unresolvedDecisions:0,lastDecisionId:null,lastOutcomeAt:0,lastDigest:''
});

export class VerifiedAutonomousLifeEngine {
  private state=defaultVerifiedAutonomousLife();
  restore(raw?:Partial<VerifiedAutonomousLifeState>|null){
    const d=defaultVerifiedAutonomousLife(),r:any=raw??{};
    this.state={...d,...r,version:1,
      decisions:Array.isArray(r.decisions)?r.decisions.slice(-256):[],
      outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(-256):[],
      perceptions:Array.isArray(r.perceptions)?r.perceptions.slice(-256):[],
      causalLinks:Array.isArray(r.causalLinks)?r.causalLinks.slice(-256):[],
      checkpoints:Array.isArray(r.checkpoints)?r.checkpoints.slice(-64):[],
      longitudinal:Array.isArray(r.longitudinal)?r.longitudinal.slice(-256):[],
      metrics:{...d.metrics,...(r.metrics??{})}
    };
    this.state.unresolvedDecisions=this.state.decisions.filter(x=>!x.resolved).length;
  }
  snapshot(){return structuredClone(this.state);}
  beginCycle(ctx:VerifiedAutonomousLifeContext){
    const at=ctx.at??now();
    if(at<this.state.lastAt){this.state.recoveryCount++;}
    this.state.cycles++;this.state.lastAt=at;
    this.expireStale(at);
    this.state.metrics.recovery01=clamp(this.state.metrics.recovery01*.93+ctx.recovery01*.07);
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.9+ctx.activePerception01*.1);
    this.state.metrics.longHorizon01=clamp(this.state.metrics.longHorizon01*.92+ctx.longHorizon01*.08);
    this.state.metrics.interaction01=clamp(this.state.metrics.interaction01*.93+ctx.interaction01*.07);
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.94+ctx.overall01*.01+ctx.agency01*.01+this.state.metrics.verification01*.02+this.state.metrics.decisionOutcomeMatch01*.02);
    this.checkpoint();
  }
  recordDecision(input:{action:ActionKind;predicted01:number;confidence01:number;contextKey?:string;at?:number}){
    const at=input.at??this.state.lastAt??now();
    const id=`vad-${this.state.cycles}-${this.state.nextId++}`;
    const d:VerifiedDecision={id,cycle:this.state.cycles,action:input.action,predicted01:clamp(input.predicted01),confidence01:clamp(input.confidence01),contextKey:String(input.contextKey??'default').slice(0,96),at,resolved:false};
    this.state.decisions.unshift(d);this.state.decisions=this.state.decisions.slice(0,256);this.state.unresolvedDecisions++;this.state.lastDecisionId=id;return id;
  }
  recordOutcome(input:{decisionId?:string|null;actual01:number;reward01?:number;verified01:number;causal01:number;basis?:VerificationBasis;at?:number;stateAfter?:OrganismState}){
    const at=input.at??now();
    const d=this.state.decisions.find(x=>!x.resolved&&(input.decisionId?x.id===input.decisionId:x.id===this.state.lastDecisionId));
    if(!d)return {ok:false,reason:'unmatched-decision'} as const;
    const error=Math.abs(clamp(d.predicted01)-clamp(input.actual01));
    const digest=this.digest(input.stateAfter??({} as OrganismState));
    const out:VerifiedOutcome={decisionId:d.id,actual01:clamp(input.actual01),error01:error,reward01:clamp(input.reward01??input.actual01),verified01:clamp(input.verified01),causal01:clamp(input.causal01),basis:input.basis??'none',at,stateAfterDigest:digest};
    this.state.outcomes.unshift(out);this.state.outcomes=this.state.outcomes.slice(0,256);d.resolved=true;this.state.unresolvedDecisions=Math.max(0,this.state.unresolvedDecisions-1);this.state.lastOutcomeAt=at;
    this.state.metrics.decisionOutcomeMatch01=clamp(this.state.metrics.decisionOutcomeMatch01*.9+.1);
    const calibration=1-error;
    this.state.metrics.predictionCalibration01=clamp(this.state.metrics.predictionCalibration01*.88+calibration*.08+input.verified01*.04);
    this.state.metrics.verification01=clamp(this.state.metrics.verification01*.88+input.verified01*.08+(input.basis==='none'?0:.04));
    this.state.metrics.causalAccountability01=clamp(this.state.metrics.causalAccountability01*.9+input.causal01*.06+input.verified01*.04);
    this.state.metrics.closedLoop01=clamp(this.state.metrics.closedLoop01*.86+calibration*.07+input.verified01*.04+input.causal01*.03);
    this.state.causalLinks.unshift({decisionId:d.id,outcomeId:`out-${d.id}`,action:d.action,effect01:clamp(input.actual01),confidence01:clamp(input.verified01),evidence01:clamp((1-error)*.5+input.verified01*.3+input.causal01*.2),at});
    this.state.causalLinks=this.state.causalLinks.slice(0,256);this.checkpoint();
    return {ok:true,decisionId:d.id,error01:error,verified01:clamp(input.verified01),causal01:clamp(input.causal01),basis:out.basis} as const;
  }
  recordPerception(input:{mode:string;expectedGain01:number;observedGain01:number;verified01:number;at?:number}){
    const row:PerceptionObservation={id:`per-${this.state.cycles}-${this.state.nextId++}`,cycle:this.state.cycles,mode:String(input.mode).slice(0,48),expectedGain01:clamp(input.expectedGain01),observedGain01:clamp(input.observedGain01),verified01:clamp(input.verified01),at:input.at??now()};
    this.state.perceptions.unshift(row);this.state.perceptions=this.state.perceptions.slice(0,256);
    const quality=1-Math.abs(row.expectedGain01-row.observedGain01);
    this.state.metrics.activePerception01=clamp(this.state.metrics.activePerception01*.86+quality*.08+row.verified01*.06);return row;
  }
  appendLongitudinal(input:{overall01:number;agency01:number;prediction01:number;verification01:number;recovery01:number;activePerception01:number;longHorizon01:number;interaction01:number;at?:number}){
    const loop=this.state.metrics.closedLoop01, at=input.at??this.state.lastAt??now();
    this.state.longitudinal.unshift({cycle:this.state.cycles,overall01:clamp(input.overall01),loop01:loop,agency01:clamp(input.agency01),prediction01:clamp(input.prediction01),verification01:clamp(input.verification01),recovery01:clamp(input.recovery01),at});
    this.state.longitudinal=this.state.longitudinal.slice(0,256);
  }
  checkpoint(){
    const digest=this.digest({
      cycles:this.state.cycles,decisions:this.state.decisions.slice(0,8),outcomes:this.state.outcomes.slice(0,8),causalLinks:this.state.causalLinks.slice(0,8),metrics:this.state.metrics
    });
    this.state.lastDigest=digest;this.state.checkpoints.unshift({cycle:this.state.cycles,digest,decisions:this.state.decisions.length,outcomes:this.state.outcomes.length,at:this.state.lastAt||now()});this.state.checkpoints=this.state.checkpoints.slice(0,64);
  }
  selfAudit(){
    const resolved=this.state.decisions.filter(x=>x.resolved).length;
    const linked=new Set(this.state.outcomes.map(x=>x.decisionId));
    const linksOk=this.state.causalLinks.every(x=>linked.has(x.decisionId));
    const digestOk=this.state.checkpoints.length===0||this.state.lastDigest===this.state.checkpoints[0].digest;
    const matchRatio=this.state.decisions.length?resolved/this.state.decisions.length:1;
    const pass=linksOk&&digestOk&&matchRatio>=Math.max(.5,1-this.state.unresolvedDecisions/Math.max(1,this.state.decisions.length));
    return {pass,decisions:this.state.decisions.length,resolved,unresolved:this.state.unresolvedDecisions,causalLinks:this.state.causalLinks.length,matchRatio01:clamp(matchRatio),integrity01:this.state.metrics.integrity01,digestOk,linksOk};
  }
  benchmark(){
    const long=this.state.longitudinal.slice(0,32);const stability=long.length?clamp(1-(Math.max(...long.map(x=>x.overall01))-Math.min(...long.map(x=>x.overall01)))):0;
    const overall=clamp(mean([this.state.metrics.closedLoop01,this.state.metrics.predictionCalibration01,this.state.metrics.verification01,this.state.metrics.causalAccountability01,this.state.metrics.activePerception01,this.state.metrics.recovery01,this.state.metrics.longHorizon01,this.state.metrics.interaction01,stability,this.state.metrics.integrity01]));
    return {overall01:overall,sampleCount:this.state.decisions.length,matchedOutcomes:this.state.outcomes.length,verifiedOutcomes:this.state.outcomes.filter(x=>x.verified01>=.7).length,causalLinks:this.state.causalLinks.length,unresolvedDecisions:this.state.unresolvedDecisions,autonomousReliability01:this.metricsReliability(),longitudinalStability01:stability,integrity01:this.state.metrics.integrity01};
  }
  diagnostics(){return {version:1,cycles:this.state.cycles,metrics:this.state.metrics,unresolvedDecisions:this.state.unresolvedDecisions,recoveryCount:this.state.recoveryCount,lastDecisionId:this.state.lastDecisionId,lastOutcomeAt:this.state.lastOutcomeAt,lastDigest:this.state.lastDigest,decisionCount:this.state.decisions.length,outcomeCount:this.state.outcomes.length,perceptionCount:this.state.perceptions.length,causalLinkCount:this.state.causalLinks.length,checkpoints:this.state.checkpoints.length,longitudinalSamples:this.state.longitudinal.length,selfAudit:this.selfAudit()};}
  actionBias(action:ActionKind){
    const unresolved=this.state.unresolvedDecisions>0?-.01:0;
    const verified=this.state.metrics.verification01;
    const caution=action==='verify'||action==='reflect'?verified*.008:0;
    return clamp(unresolved+caution);
  }
  private metricsReliability(){return clamp(this.state.metrics.closedLoop01*.3+this.state.metrics.predictionCalibration01*.2+this.state.metrics.verification01*.2+this.state.metrics.causalAccountability01*.15+this.state.metrics.integrity01*.15);}
  private expireStale(at:number){for(const d of this.state.decisions){if(!d.resolved&&at-d.at>300000)d.resolved=false;}this.state.unresolvedDecisions=this.state.decisions.filter(x=>!x.resolved).length;}
  private digest(value:unknown){return createHash('sha256').update(JSON.stringify(value,(k,v)=>typeof v==='number'&&Number.isFinite(v)?Number(v.toFixed(8)):v)).digest('hex');}
}
