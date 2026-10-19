const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface ReplayCreditRecord {
  id:string;
  memoryId:string;
  replayEventId:string;
  validationId:string;
  delayMs:number;
  delayAttenuation01:number;
  cascadeShort01:number;
  cascadeMedium01:number;
  cascadeLong01:number;
  temporalMatch01:number;
  eligibility01:number;
  outcome01:number;
  credit01:number;
  independentVerified:boolean;
  at:number;
}

export interface CausalReplayCreditState {
  version:1;
  assignments:number;
  verifiedAssignments:number;
  meanCredit01:number;
  meanEligibility01:number;
  meanOutcome01:number;
  meanDelayAttenuation01:number;
  lastCredit01:number;
  lastAt:number;
  recent:ReplayCreditRecord[];
}

const defaultState=():CausalReplayCreditState=>({
  version:1,assignments:0,verifiedAssignments:0,meanCredit01:0,meanEligibility01:0,
  meanOutcome01:0,meanDelayAttenuation01:0,lastCredit01:0,lastAt:0,recent:[]
});

/**
 * P2688: delayed causal credit for replay.
 *
 * This does not claim biological equivalence. It answers a narrower engineering
 * question: when a replayed experience is validated later, how much of the
 * observed retention/transfer signal should be attributed to that specific
 * replay event rather than to the memory in the abstract?
 */
export class CausalReplayCreditAssigner {
  private state=defaultState();

  restore(raw?:Partial<CausalReplayCreditState>|null){
    const d=defaultState();
    const r=raw??{};
    this.state={
      ...d,...r,version:1,
      assignments:Math.max(0,Number(r.assignments??0)),
      verifiedAssignments:Math.max(0,Number(r.verifiedAssignments??0)),
      meanCredit01:clamp(Number(r.meanCredit01??0)),
      meanEligibility01:clamp(Number(r.meanEligibility01??0)),
      meanOutcome01:clamp(Number(r.meanOutcome01??0)),
      meanDelayAttenuation01:clamp(Number(r.meanDelayAttenuation01??0)),
      lastCredit01:clamp(Number(r.lastCredit01??0)),
      lastAt:Math.max(0,Number(r.lastAt??0)),
      recent:Array.isArray(r.recent)?r.recent.slice(-128).map(x=>this.cleanRecord(x)):[]
    };
  }

  snapshot(){return structuredClone(this.state);}

  diagnostics(){
    return {
      assignments:this.state.assignments,
      verifiedAssignments:this.state.verifiedAssignments,
      verificationRate01:clamp(this.state.verifiedAssignments/Math.max(1,this.state.assignments)),
      meanCredit01:this.state.meanCredit01,
      meanEligibility01:this.state.meanEligibility01,
      meanOutcome01:this.state.meanOutcome01,
      meanDelayAttenuation01:this.state.meanDelayAttenuation01,
      lastCredit01:this.state.lastCredit01,
      lastAt:this.state.lastAt,
      recentCount:this.state.recent.length
    };
  }

  assign(input:{
    memoryId:string;
    replayEventId:string;
    validationId:string;
    replayAt:number;
    validationAt:number;
    delayMs:number;
    retentionGain01:number;
    transferPotential01:number;
    interferenceRisk01:number;
    learningOpportunity01:number;
    priorityAfter01:number;
    independentVerified:boolean;
  }){
    const delayMs=Math.max(0,Number(input.delayMs)||0);
    const replayAt=Number.isFinite(input.replayAt)?Number(input.replayAt):0;
    const validationAt=Number.isFinite(input.validationAt)?Number(input.validationAt):replayAt+delayMs;
    const observedDelay=Math.max(0,validationAt-replayAt);
    const effectiveDelay=Math.max(delayMs,observedDelay);
    const cascadeShort01=clamp(Math.exp(-effectiveDelay/(12*60*60*1000)));
    const cascadeMedium01=clamp(Math.exp(-effectiveDelay/(3*86400000)));
    const cascadeLong01=clamp(Math.exp(-effectiveDelay/(14*86400000)));
    const delayAttenuation01=clamp(.25*cascadeShort01+.45*cascadeMedium01+.30*cascadeLong01);
    const temporalMatch01=clamp(Math.exp(-Math.abs(validationAt-(replayAt+delayMs))/(3*86400000)));
    const outcome01=clamp(
      .56*clamp(input.retentionGain01)+
      .28*clamp(input.transferPotential01)+
      .10*(1-clamp(input.interferenceRisk01))+
      .06*clamp(input.priorityAfter01)
    );
    const eligibility01=clamp(
      .30*temporalMatch01+
      .14*cascadeShort01+
      .24*cascadeMedium01+
      .10*cascadeLong01+
      .18*clamp(input.learningOpportunity01)+
      .14*clamp(input.priorityAfter01)
    );
    const independentVerified=Boolean(input.independentVerified);
    // Unverified replay is observable, but it is not a credit assignment. Keep
    // the record for diagnosis with zero credit until the verifier accepts it.
    const candidateCredit01=clamp(outcome01*eligibility01*(independentVerified?.96:.42));
    const credit01=independentVerified?candidateCredit01:0;
    const record:ReplayCreditRecord={
      id:`crc:${input.memoryId}:${input.validationId}`,
      memoryId:String(input.memoryId),replayEventId:String(input.replayEventId),validationId:String(input.validationId),
      delayMs:effectiveDelay,delayAttenuation01,cascadeShort01, cascadeMedium01, cascadeLong01, temporalMatch01,eligibility01,outcome01,credit01,
      independentVerified,at:validationAt
    };
    const existingIndex=this.state.recent.findIndex(x=>x.memoryId===record.memoryId&&x.validationId===record.validationId);
    if(existingIndex>=0){
      const existing=this.state.recent[existingIndex]!;
      if(existing.independentVerified || !record.independentVerified) return structuredClone(existing);
      this.state.assignments++;
      this.state.verifiedAssignments++;
      this.state.meanCredit01=clamp(this.state.meanCredit01*.92+credit01*.08);
      this.state.meanEligibility01=clamp(this.state.meanEligibility01*.92+eligibility01*.08);
      this.state.meanOutcome01=clamp(this.state.meanOutcome01*.92+outcome01*.08);
      this.state.meanDelayAttenuation01=clamp(this.state.meanDelayAttenuation01*.92+delayAttenuation01*.08);
      this.state.lastCredit01=credit01;
      this.state.lastAt=validationAt;
      this.state.recent[existingIndex]=record;
      return structuredClone(record);
    }
    this.state.assignments++;
    if(record.independentVerified){
      this.state.verifiedAssignments++;
      this.state.meanCredit01=clamp(this.state.meanCredit01*.92+credit01*.08);
      this.state.meanEligibility01=clamp(this.state.meanEligibility01*.92+eligibility01*.08);
      this.state.meanOutcome01=clamp(this.state.meanOutcome01*.92+outcome01*.08);
      this.state.meanDelayAttenuation01=clamp(this.state.meanDelayAttenuation01*.92+delayAttenuation01*.08);
    }
    this.state.lastCredit01=credit01;
    this.state.lastAt=validationAt;
    this.state.recent=[...this.state.recent,record].slice(-128);
    return structuredClone(record);
  }

  private cleanRecord(raw:any):ReplayCreditRecord{
    return {
      id:String(raw?.id??''),memoryId:String(raw?.memoryId??''),replayEventId:String(raw?.replayEventId??''),
      validationId:String(raw?.validationId??''),delayMs:Math.max(0,Number(raw?.delayMs??0)),
      delayAttenuation01:clamp(Number(raw?.delayAttenuation01??0)),cascadeShort01:clamp(Number(raw?.cascadeShort01??raw?.delayAttenuation01??0)),cascadeMedium01:clamp(Number(raw?.cascadeMedium01??raw?.delayAttenuation01??0)),cascadeLong01:clamp(Number(raw?.cascadeLong01??raw?.delayAttenuation01??0)),temporalMatch01:clamp(Number(raw?.temporalMatch01??0)),
      eligibility01:clamp(Number(raw?.eligibility01??0)),outcome01:clamp(Number(raw?.outcome01??0)),
      credit01:clamp(Number(raw?.credit01??0)),independentVerified:Boolean(raw?.independentVerified),at:Math.max(0,Number(raw?.at??0))
    };
  }
}

export const defaultCausalReplayCreditState=defaultState;
