export type PhysicalReliabilityClass = 'unverified'|'actuation-receipt'|'artifact-verified'|'independently-observed';
export type RecoveryMode = 'normal'|'probe'|'cooldown'|'degraded'|'blocked';

export interface EmbodiedRecoveryEpisode {
  tick:number; at:number; action:string; status:string; realityClass:string;
  verificationClass:PhysicalReliabilityClass; verified01:number; independent01:number;
  effect01:number; consequenceError01:number; source:string;
  failureStreak:number; retryIndex:number; recoveryMode:RecoveryMode;
}

export interface EmbodiedRecoveryActionState {
  attempts:number; successes:number; verified:number; failures:number; rejected:number;
  meanEffect01:number; meanError01:number; reliability01:number; lastTick:number;
  failureStreak:number; cooldownUntil:number; retries:number;
}

export interface EmbodiedRecoveryState {
  version:1;
  enabled:boolean;
  tick:number;
  totalEpisodes:number;
  verifiedEpisodes:number;
  rejectedEpisodes:number;
  recoveryEvents:number;
  sensorDropouts:number;
  consecutiveFailures:number;
  lastFailureClass:string;
  lastRecoveryReason:string;
  mode:RecoveryMode;
  nextRetryAt:number;
  globalReliability01:number;
  actionStates:Record<string,EmbodiedRecoveryActionState>;
  episodes:EmbodiedRecoveryEpisode[];
}

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const emptyAction=():EmbodiedRecoveryActionState=>({attempts:0,successes:0,verified:0,failures:0,rejected:0,meanEffect01:.5,meanError01:.5,reliability01:.5,lastTick:0,failureStreak:0,cooldownUntil:0,retries:0});

export function defaultEmbodiedRecoveryState():EmbodiedRecoveryState {
  return {version:1,enabled:true,tick:0,totalEpisodes:0,verifiedEpisodes:0,rejectedEpisodes:0,recoveryEvents:0,sensorDropouts:0,consecutiveFailures:0,lastFailureClass:'none',lastRecoveryReason:'none',mode:'normal',nextRetryAt:0,globalReliability01:.5,actionStates:{},episodes:[]};
}

export interface RecoveryInput {
  tick:number; at?:number; action:string; status:string; realityClass:string; source:string;
  verified01:number; independent01:number; effect01:number; consequenceError01:number;
  verificationMode?:string; sourceStable?:boolean; freshBefore01?:number; freshAfter01?:number; artifact?:boolean;
  enabled?:boolean;
}

/**
 * Reliability/recovery layer for the already-existing embodied action path.
 * It never selects goals and never replaces B365. It only determines whether
 * physical execution is healthy enough to continue, probe, retry or cool down.
 */
export class EmbodiedRecoveryController {
  private state:EmbodiedRecoveryState;
  constructor(initial?:EmbodiedRecoveryState){ this.state=structuredClone(initial && initial.version===1 ? initial : defaultEmbodiedRecoveryState()); }
  restore(state?:EmbodiedRecoveryState){ this.state=structuredClone(state && state.version===1 ? state : defaultEmbodiedRecoveryState()); }
  snapshot():EmbodiedRecoveryState{return structuredClone(this.state);}

  advise(action:string, now=Date.now()): {allowed:boolean;mode:RecoveryMode;retryBudget:number;reason:string;reliability01:number} {
    const item=this.state.actionStates[action] ?? emptyAction();
    if(!this.state.enabled) return {allowed:true,mode:'normal',retryBudget:0,reason:'controller-disabled',reliability01:item.reliability01};
    if(now < Math.max(item.cooldownUntil,this.state.nextRetryAt)) return {allowed:false,mode:'cooldown',retryBudget:0,reason:'physical-action-cooldown',reliability01:item.reliability01};
    const streak=item.failureStreak;
    if(streak>=5) return {allowed:false,mode:'blocked',retryBudget:0,reason:'action-circuit-open',reliability01:item.reliability01};
    if(streak>=3) return {allowed:true,mode:'degraded',retryBudget:1,reason:'degraded-safe-retry-budget',reliability01:item.reliability01};
    if(streak>=1) return {allowed:true,mode:'probe',retryBudget:1,reason:'probe-after-failure',reliability01:item.reliability01};
    return {allowed:true,mode:'normal',retryBudget:2,reason:'normal-operating-window',reliability01:item.reliability01};
  }

  record(input:RecoveryInput){
    const now=Number(input.at)||Date.now();
    const action=String(input.action||'wait');
    const item=this.state.actionStates[action] ?? (this.state.actionStates[action]=emptyAction());
    const verified=clamp(input.verified01); const independent=clamp(input.independent01);
    const success=input.status==='executed';
    const ambiguous=input.status==='ambiguous';
    const evidenceClass:PhysicalReliabilityClass = verified>=.99 && independent>=.99 ? 'independently-observed'
      : input.realityClass==='device-actuation' && success ? 'actuation-receipt'
      : input.artifact || input.realityClass==='external-observation' ? 'artifact-verified' : 'unverified';
    const hardFailure=!success&&!ambiguous;
    const rejected=verified<.99 || independent<.99;
    const beforeStreak=item.failureStreak;
    item.attempts += 1; this.state.totalEpisodes += 1;
    if(success) item.successes += 1; else if(hardFailure) item.failures += 1;
    if(verified>=.99 && independent>=.99) { item.verified += 1; this.state.verifiedEpisodes += 1; }
    if(rejected) { item.rejected += 1; this.state.rejectedEpisodes += 1; }
    // Unknown external acceptance is neither success nor failure. Preserve the
    // episode for reconciliation, but do not poison reliability, add failure streak,
    // or schedule an automatic retry that could duplicate speech/device effects.
    if(!ambiguous){
      item.meanEffect01=clamp(item.meanEffect01*.92+clamp(input.effect01)*.08);
      item.meanError01=clamp(item.meanError01*.92+clamp(input.consequenceError01)*.08);
      const evidenceBonus=evidenceClass==='independently-observed'?.35:evidenceClass==='artifact-verified'?.22:evidenceClass==='actuation-receipt'?.08:0;
      const base=success ? .58 + evidenceBonus : .12;
      item.reliability01=clamp(item.reliability01*.86+base*.14-item.meanError01*.035);
    } else {
      this.state.lastFailureClass='ambiguous-outcome-requires-reconciliation';
    }
    item.lastTick=Math.max(item.lastTick,Math.floor(Number(input.tick)||0));
    if(hardFailure){ item.failureStreak += 1; this.state.consecutiveFailures += 1; this.state.lastFailureClass=input.status; }
    else if(success) { item.failureStreak=0; this.state.consecutiveFailures=0; }
    if(hardFailure || (!ambiguous && rejected && input.freshAfter01===0)){
      const backoff=Math.min(120000, 1000*Math.pow(2,Math.max(0,item.failureStreak-1)));
      item.cooldownUntil=now+backoff;
      this.state.nextRetryAt=Math.max(this.state.nextRetryAt,item.cooldownUntil);
      this.state.recoveryEvents += 1;
      this.state.lastRecoveryReason=hardFailure?'execution-failure-backoff':'insufficient-physical-evidence';
    } else if(success && beforeStreak>0){
      this.state.recoveryEvents += 1;
      this.state.lastRecoveryReason='recovered-after-failure';
      item.cooldownUntil=0; this.state.nextRetryAt=0;
    }
    if(input.source==='android-termux' && (input.freshBefore01??1)<.99 && (input.freshAfter01??1)<.99) this.state.sensorDropouts += 1;
    this.state.mode=item.failureStreak>=5?'blocked':item.failureStreak>=3?'degraded':item.failureStreak>=1?'probe':'normal';
    this.state.tick=Math.max(this.state.tick,Math.floor(Number(input.tick)||0));
    const reliabilityValues=Object.values(this.state.actionStates).map(x=>x.reliability01);
    this.state.globalReliability01=reliabilityValues.length?clamp(reliabilityValues.reduce((a,b)=>a+b,0)/reliabilityValues.length):.5;
    this.state.episodes.unshift({tick:Math.floor(Number(input.tick)||0),at:now,action,status:input.status,realityClass:input.realityClass,verificationClass:evidenceClass,verified01:verified,independent01:independent,effect01:clamp(input.effect01),consequenceError01:clamp(input.consequenceError01),source:String(input.source),failureStreak:item.failureStreak,retryIndex:item.retries,recoveryMode:this.state.mode});
    this.state.episodes=this.state.episodes.slice(0,192);
    return {mode:this.state.mode,reliability01:item.reliability01,recovered:beforeStreak>0&&item.failureStreak===0,evidenceClass};
  }

  noteRetry(action:string){const item=this.state.actionStates[action] ?? (this.state.actionStates[action]=emptyAction()); item.retries+=1;}
}
