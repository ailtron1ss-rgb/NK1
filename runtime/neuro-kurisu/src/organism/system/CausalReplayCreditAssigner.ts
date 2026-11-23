import { isTrustedExternalPostconditionVerification, type OutcomeVerification } from './OutcomeVerificationService.ts';

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

/** Capture a flat verifier tuple without invoking accessors or accepting hostile prototypes. */
function captureReceiptInput(raw:unknown):Record<string,unknown>|null{
  try{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    const proto=Object.getPrototypeOf(raw);
    if(proto!==Object.prototype&&proto!==null)return null;
    const captured:Record<string,unknown>={};
    for(const key of Reflect.ownKeys(raw)){
      if(typeof key!=='string'||key==='__proto__'||key==='prototype'||key==='constructor')return null;
      const descriptor=Object.getOwnPropertyDescriptor(raw,key);
      if(!descriptor||!('value' in descriptor))return null;
      const value=descriptor.value;
      if(value!==undefined&&value!==null&&typeof value!=='string'&&typeof value!=='boolean'&&
        !(typeof value==='number'&&Number.isFinite(value)))return null;
      Object.defineProperty(captured,key,{value,enumerable:true,writable:false,configurable:false});
    }
    return captured;
  }catch{return null;}
}

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
    // Serialized verification bits and aggregates are claims, not authority.
    // Preserve attempt history for diagnostics; proof-derived values are rebuilt
    // only from verifier receipts that are authenticated in the current process.
    const r=raw??{};
    this.state={
      ...defaultState(),version:1,
      assignments:Math.max(0,Number.isSafeInteger(r.assignments)?Number(r.assignments):0),
      verifiedAssignments:0,
      meanCredit01:0,
      meanEligibility01:0,
      meanOutcome01:0,
      meanDelayAttenuation01:0,
      lastCredit01:0,
      lastAt:0,
      recent:Array.isArray(r.recent)?r.recent.slice(-128).map(x=>({...this.cleanRecord(x),independentVerified:false,credit01:0})):[]
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
    verification?:OutcomeVerification;
    verificationInput?:Record<string,unknown>;
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
    // A valid receipt is not enough on its own: bind it to this exact credit
    // measurement. Otherwise a caller could pair a receipt for another memory,
    // delay, or outcome with a different credit assignment.
    const receiptInput=captureReceiptInput(input.verificationInput);
    const boundGain=receiptInput&&typeof receiptInput.retentionGain01==='number'
      ? clamp(receiptInput.retentionGain01)
      : receiptInput&&typeof receiptInput.retentionScore01==='number'&&typeof receiptInput.baselineScore01==='number'
        ? clamp(receiptInput.retentionScore01-receiptInput.baselineScore01)
        : Number.NaN;
    const boundMemory=receiptInput?.memoryId;
    const boundDelay=receiptInput?.delayMs;
    const boundTransfer=receiptInput?.transferPotential01;
    const boundRisk=receiptInput?.interferenceRisk01;
    const exactMeasurement=typeof boundMemory==='string'&&boundMemory.length>0&&boundMemory===String(input.memoryId)&&
      Number.isFinite(boundGain)&&Math.abs(boundGain-clamp(input.retentionGain01))<1e-12&&
      typeof boundTransfer==='number'&&Math.abs(clamp(boundTransfer)-clamp(input.transferPotential01))<1e-12&&
      typeof boundRisk==='number'&&Math.abs(clamp(boundRisk)-clamp(input.interferenceRisk01))<1e-12&&
      typeof boundDelay==='number'&&Number.isFinite(boundDelay)&&Math.max(0,boundDelay)===delayMs;
    const independentVerified=exactMeasurement&&
      isTrustedExternalPostconditionVerification(input.verification,receiptInput??undefined);
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
      credit01:0,independentVerified:false,at:Math.max(0,Number(raw?.at??0))
    };
  }
}

export const defaultCausalReplayCreditState=defaultState;
