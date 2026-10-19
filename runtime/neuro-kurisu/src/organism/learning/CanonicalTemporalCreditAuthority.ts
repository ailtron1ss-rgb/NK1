const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clampSigned=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const actions=['respond','explore','verify','rest','reflect','wait','defer'] as const;
export type TemporalAction=typeof actions[number];

export interface TemporalDecisionRecord {
  decisionId:string;
  tick:number;
  action:TemporalAction;
  contextKey:string;
  predicted01:number;
  registeredAt:number;
  resolved:boolean;
}

export interface TemporalOutcomeRecord {
  /** Optional immutable event key for external outcomes; prevents one observation from being credited twice. */
  outcomeId?:string;
  /** Exact decision that an explicitly targeted external outcome is allowed to resolve. */
  decisionId?:string;
  tick:number;
  reward01:number;
  predictionError01:number;
  verified01:number;
  independent01:number;
  autonomous01:number;
  at:number;
}

export interface TemporalCreditAssignment {
  assignmentId:string;
  decisionId:string;
  tick:number;
  action:TemporalAction;
  contextKey:string;
  delayTicks:number;
  eligibility01:number;
  discount01:number;
  nStepReturn01:number;
  tdErrorSigned:number;
  creditedReward01:number;
  causalConfidence01:number;
  independent:boolean;
  autonomous:boolean;
  outcomeCount:number;
  reason:'on-time'|'delayed-sequence'|'expired';
  at:number;
}

export interface CanonicalTemporalCreditState {
  version:1;
  gamma01:number;
  lambda01:number;
  maxHorizonTicks:number;
  pending:TemporalDecisionRecord[];
  outcomes:TemporalOutcomeRecord[];
  recentAssignments:TemporalCreditAssignment[];
  registeredDecisions:number;
  resolvedDecisions:number;
  delayedAssignments:number;
  expiredDecisions:number;
  capacityExpiredDecisions:number;
  meanEligibility01:number;
  meanCredit01:number;
  meanCausalConfidence01:number;
  lastAssignmentAt:number;
}

export const defaultCanonicalTemporalCreditState=():CanonicalTemporalCreditState=>({
  version:1,
  gamma01:.88,
  lambda01:.82,
  maxHorizonTicks:8,
  pending:[],
  outcomes:[],
  recentAssignments:[],
  registeredDecisions:0,
  resolvedDecisions:0,
  delayedAssignments:0,
  expiredDecisions:0,
  capacityExpiredDecisions:0,
  meanEligibility01:0,
  meanCredit01:0,
  meanCausalConfidence01:0,
  lastAssignmentAt:0,
});

/**
 * R4: one production authority for routing delayed outcome credit.
 *
 * It does not create a second policy/value learner. It owns only the temporal
 * attribution transform that determines which already-existing decision
 * receives which delayed learning signal. AdaptivePolicyEngine remains the
 * canonical action-value/policy learner.
 */
export class CanonicalTemporalCreditAuthority {
  private state=defaultCanonicalTemporalCreditState();

  constructor(config?:Partial<Pick<CanonicalTemporalCreditState,'gamma01'|'lambda01'|'maxHorizonTicks'>>){
    this.state.gamma01=clamp(config?.gamma01 ?? this.state.gamma01);
    this.state.lambda01=clamp(config?.lambda01 ?? this.state.lambda01);
    this.state.maxHorizonTicks=Math.max(1,Math.min(32,Math.floor(Number(config?.maxHorizonTicks ?? this.state.maxHorizonTicks))));
  }

  restore(raw?:Partial<CanonicalTemporalCreditState>|null){
    const d=defaultCanonicalTemporalCreditState();
    const r=raw??{};
    this.state={
      ...d,...r,version:1,
      gamma01:clamp(Number(r.gamma01??d.gamma01)),
      lambda01:clamp(Number(r.lambda01??d.lambda01)),
      maxHorizonTicks:Math.max(1,Math.min(32,Math.floor(Number(r.maxHorizonTicks??d.maxHorizonTicks)))),
      pending:Array.isArray(r.pending)?r.pending.slice(-64).map(x=>this.cleanDecision(x)) : [],
      outcomes:Array.isArray(r.outcomes)?r.outcomes.slice(-128).map(x=>this.cleanOutcome(x)) : [],
      recentAssignments:Array.isArray(r.recentAssignments)?r.recentAssignments.slice(-128).map(x=>this.cleanAssignment(x)) : [],
      registeredDecisions:Math.max(0,Math.floor(Number(r.registeredDecisions??0))),
      resolvedDecisions:Math.max(0,Math.floor(Number(r.resolvedDecisions??0))),
      delayedAssignments:Math.max(0,Math.floor(Number(r.delayedAssignments??0))),
      expiredDecisions:Math.max(0,Math.floor(Number(r.expiredDecisions??0))),
      capacityExpiredDecisions:Math.max(0,Math.floor(Number(r.capacityExpiredDecisions??0))),
      meanEligibility01:clamp(Number(r.meanEligibility01??0)),
      meanCredit01:clamp(Number(r.meanCredit01??0)),
      meanCausalConfidence01:clamp(Number(r.meanCausalConfidence01??0)),
      lastAssignmentAt:Math.max(0,Number(r.lastAssignmentAt??0)),
    };
  }

  snapshot(){ return structuredClone(this.state); }

  diagnostics(){
    const pending=this.state.pending.filter(x=>!x.resolved);
    return structuredClone({
      registeredDecisions:this.state.registeredDecisions,
      resolvedDecisions:this.state.resolvedDecisions,
      openDecisions:pending.length,
      delayedAssignments:this.state.delayedAssignments,
      expiredDecisions:this.state.expiredDecisions,
      capacityExpiredDecisions:this.state.capacityExpiredDecisions,
      gamma01:this.state.gamma01,
      lambda01:this.state.lambda01,
      maxHorizonTicks:this.state.maxHorizonTicks,
      meanEligibility01:this.state.meanEligibility01,
      meanCredit01:this.state.meanCredit01,
      meanCausalConfidence01:this.state.meanCausalConfidence01,
      recentAssignments:this.state.recentAssignments.length,
      lastAssignmentAt:this.state.lastAssignmentAt,
    });
  }

  registerDecision(input:{decisionId:string;tick:number;action:TemporalAction;contextKey:string;predicted01:number;at?:number}){
    const decisionId=String(input.decisionId);
    const existing=this.state.pending.find(x=>x.decisionId===decisionId);
    if(existing)return structuredClone(existing);
    const record:TemporalDecisionRecord={
      decisionId,
      tick:Math.max(0,Math.floor(Number(input.tick??0))),
      action:actions.includes(input.action)?input.action:'wait',
      contextKey:String(input.contextKey??''),
      predicted01:clamp(input.predicted01),
      registeredAt:Math.max(0,Number(input.at??Date.now())),
      resolved:false,
    };
    if(this.state.pending.length>=64){
      // Never silently lose an unresolved decision when the bounded journal is
      // full. Prefer reclaiming a settled row; if every slot is open, explicitly
      // expire the oldest one with zero learning eligibility and retain an audit assignment.
      const settledIndex=this.state.pending.findIndex(row=>row.resolved);
      if(settledIndex>=0){this.state.pending.splice(settledIndex,1);}
      else {
        const evicted=this.state.pending.shift();
        if(evicted){
          evicted.resolved=true;
          const expiry:TemporalCreditAssignment={
            assignmentId:`tca:${evicted.decisionId}:capacity-expired:${record.tick}:${this.state.capacityExpiredDecisions+1}`,
            decisionId:evicted.decisionId,tick:evicted.tick,action:evicted.action,contextKey:evicted.contextKey,
            delayTicks:Math.max(0,record.tick-evicted.tick),eligibility01:0,discount01:0,
            nStepReturn01:evicted.predicted01,tdErrorSigned:0,creditedReward01:evicted.predicted01,
            causalConfidence01:0,independent:false,autonomous:false,outcomeCount:0,reason:'expired',at:record.registeredAt,
          };
          this.state.recentAssignments=[...this.state.recentAssignments,expiry].slice(-128);
          this.state.resolvedDecisions++;this.state.expiredDecisions++;this.state.capacityExpiredDecisions++;
          this.state.meanEligibility01=clamp(this.state.meanEligibility01*.9);
          this.state.meanCredit01=clamp(this.state.meanCredit01*.9);
          this.state.meanCausalConfidence01=clamp(this.state.meanCausalConfidence01*.9);
          this.state.lastAssignmentAt=record.registeredAt;
        }
      }
    }
    this.state.pending.push(record);
    this.state.registeredDecisions++;
    return structuredClone(record);
  }

  resolveOutcome(input:{decisionId?:string|null;outcomeId?:string|null;tick:number;reward01:number;predictionError01?:number;verified01?:number;independent01?:number;autonomous01?:number;at?:number}){
    const tick=Math.max(0,Math.floor(Number(input.tick??0)));
    const reward01=clamp(input.reward01);
    const predictionError01=clamp(input.predictionError01??Math.abs(.5-reward01));
    const verified01=clamp(input.verified01??0);
    const independent01=clamp(input.independent01??0);
    const autonomous01=clamp(input.autonomous01??0);
    const at=Math.max(0,Number(input.at??Date.now()));
    const outcomeId=String(input.outcomeId??'').trim().slice(0,180)||undefined;
    const targetId=input.decisionId ? String(input.decisionId) : null;
    if(input.outcomeId!=null&&(!outcomeId||String(input.outcomeId).trim().length>180||/[\u0000-\u001f\u007f]/.test(String(input.outcomeId)))) throw new Error('invalid-temporal-outcome-id');
    if(outcomeId){
      const prior=this.state.outcomes.find(row=>row.outcomeId===outcomeId);
      if(prior){
        const same=prior.tick===tick&&Math.abs(prior.reward01-reward01)<1e-9&&Math.abs(prior.predictionError01-predictionError01)<1e-9&&Math.abs(prior.verified01-verified01)<1e-9&&Math.abs(prior.independent01-independent01)<1e-9&&Math.abs(prior.autonomous01-autonomous01)<1e-9&&prior.decisionId===(targetId??undefined)&&prior.at===at;
        if(!same)throw new Error('temporal-outcome-id-conflict');
        return structuredClone({assignments:[],openDecisions:this.state.pending.filter(x=>!x.resolved).length,expiredDecisions:0,at,replayed:true as const});
      }
    }
    this.state.outcomes=[...this.state.outcomes,{...(outcomeId?{outcomeId}:{}),...(targetId?{decisionId:targetId}:{}),tick,reward01,predictionError01,verified01,independent01,autonomous01,at}].slice(-128);
    const candidates=this.state.pending.filter(d=>{
      if(d.resolved)return false;
      // Explicit decision IDs are exact correlation keys. Falling through to
      // the horizon rule here incorrectly credited every recent open decision
      // from a single targeted external outcome.
      if(targetId)return d.decisionId===targetId;
      return d.tick<=tick && tick-d.tick<=this.state.maxHorizonTicks;
    });
    const expired=this.state.pending.filter(d=>!d.resolved && d.tick<tick-this.state.maxHorizonTicks && d.decisionId!==targetId);
    for(const d of expired)d.resolved=true;

    const assignments:TemporalCreditAssignment[]=[];
    for(const decision of [...candidates,...expired]){
      const delayTicks=Math.max(0,tick-decision.tick);
      // A targeted external event may affect only its exact decision. Untargeted
      // temporal events remain horizon evidence; addressed events for neighbours
      // must not leak into this decision's n-step return.
      const relevant=this.state.outcomes.filter(o=>o.tick>=decision.tick && o.tick<=tick && (!o.decisionId || o.decisionId===decision.decisionId)).slice(-this.state.maxHorizonTicks);
      let weighted=0;
      let weightSum=0;
      for(let i=0;i<relevant.length;i++){
        const rec=relevant[relevant.length-1-i];
        const weight=Math.pow(this.state.gamma01,i);
        weighted+=rec.reward01*weight;
        weightSum+=weight;
      }
      const bootstrapWeight=Math.pow(this.state.gamma01,Math.max(1,relevant.length));
      const nStepReturn=clamp((weighted+decision.predicted01*bootstrapWeight)/Math.max(1e-9,weightSum+bootstrapWeight));
      const tdError=clampSigned(nStepReturn-decision.predicted01);
      const eligibility=delayTicks>this.state.maxHorizonTicks ? 0 : Math.pow(this.state.lambda01,delayTicks);
      const discount=Math.pow(this.state.gamma01,Math.min(delayTicks,this.state.maxHorizonTicks));
      const signedCredit=tdError*eligibility*discount;
      const creditedReward=clamp(decision.predicted01+signedCredit);
      const evidenceGain=.50+.50*Math.max(eligibility,discount);
      const reason:TemporalCreditAssignment['reason']=delayTicks>this.state.maxHorizonTicks?'expired':delayTicks>0?'delayed-sequence':'on-time';
      // Expired decisions are bookkeeping only. They must never retain causal
      // confidence that a downstream learner could accidentally consume.
      const causalConfidence=reason==='expired'?0:clamp(verified01*evidenceGain*(independent01>.5?.92:.58)*(autonomous01>.5?.94:1));
      const assignment:TemporalCreditAssignment={
        assignmentId:`tca:${decision.decisionId}:${tick}:${this.state.resolvedDecisions+assignments.length+1}`,
        decisionId:decision.decisionId,tick:decision.tick,action:decision.action,contextKey:decision.contextKey,
        delayTicks,eligibility01:eligibility,discount01:discount,nStepReturn01:nStepReturn,tdErrorSigned:tdError,
        creditedReward01:creditedReward,causalConfidence01:causalConfidence,
        independent:reason!=='expired'&&independent01>.5,autonomous:reason!=='expired'&&autonomous01>.5,outcomeCount:relevant.length,
        reason,at,
      };
      decision.resolved=true;
      assignments.push(assignment);
      this.state.resolvedDecisions++;
      if(reason==='delayed-sequence')this.state.delayedAssignments++;
      if(reason==='expired')this.state.expiredDecisions++;
      this.state.meanEligibility01=clamp(this.state.meanEligibility01*.9+eligibility*.1);
      this.state.meanCredit01=clamp(this.state.meanCredit01*.9+Math.abs(signedCredit)*.1);
      this.state.meanCausalConfidence01=clamp(this.state.meanCausalConfidence01*.9+causalConfidence*.1);
      this.state.lastAssignmentAt=at;
    }
    this.state.recentAssignments=[...this.state.recentAssignments,...assignments].slice(-128);
    return structuredClone({assignments,openDecisions:this.state.pending.filter(x=>!x.resolved).length,expiredDecisions:expired.length,at});
  }

  setEligibilityLambda(lambda01:number){ this.state.lambda01=clamp(lambda01); }
  setDiscountGamma(gamma01:number){ this.state.gamma01=clamp(gamma01); }

  private cleanDecision(raw:any):TemporalDecisionRecord{return {
    decisionId:String(raw?.decisionId??''),tick:Math.max(0,Math.floor(Number(raw?.tick??0))),
    action:actions.includes(raw?.action)?raw.action:'wait',contextKey:String(raw?.contextKey??''),predicted01:clamp(Number(raw?.predicted01??.5)),
    registeredAt:Math.max(0,Number(raw?.registeredAt??0)),resolved:Boolean(raw?.resolved),
  };}
  private cleanOutcome(raw:any):TemporalOutcomeRecord{return {
    ...(typeof raw?.outcomeId==='string'&&raw.outcomeId.trim()&&raw.outcomeId.length<=180?{outcomeId:raw.outcomeId.trim()}:{}),
    ...(typeof raw?.decisionId==='string'&&raw.decisionId.trim()&&raw.decisionId.length<=180?{decisionId:raw.decisionId.trim()}:{}),
    tick:Math.max(0,Math.floor(Number(raw?.tick??0))),reward01:clamp(Number(raw?.reward01??.5)),predictionError01:clamp(Number(raw?.predictionError01??0)),
    verified01:clamp(Number(raw?.verified01??0)),independent01:clamp(Number(raw?.independent01??0)),autonomous01:clamp(Number(raw?.autonomous01??0)),at:Math.max(0,Number(raw?.at??0)),
  };}
  private cleanAssignment(raw:any):TemporalCreditAssignment{return {
    assignmentId:String(raw?.assignmentId??''),decisionId:String(raw?.decisionId??''),tick:Math.max(0,Math.floor(Number(raw?.tick??0))),action:actions.includes(raw?.action)?raw.action:'wait',contextKey:String(raw?.contextKey??''),
    delayTicks:Math.max(0,Math.floor(Number(raw?.delayTicks??0))),eligibility01:clamp(Number(raw?.eligibility01??0)),discount01:clamp(Number(raw?.discount01??0)),nStepReturn01:clamp(Number(raw?.nStepReturn01??.5)),
    tdErrorSigned:clampSigned(Number(raw?.tdErrorSigned??0)),creditedReward01:clamp(Number(raw?.creditedReward01??.5)),causalConfidence01:clamp(Number(raw?.causalConfidence01??0)),
    independent:Boolean(raw?.independent),autonomous:Boolean(raw?.autonomous),outcomeCount:Math.max(0,Math.floor(Number(raw?.outcomeCount??0))),reason:raw?.reason==='delayed-sequence'||raw?.reason==='expired'?raw.reason:'on-time',at:Math.max(0,Number(raw?.at??0)),
  };}
}
