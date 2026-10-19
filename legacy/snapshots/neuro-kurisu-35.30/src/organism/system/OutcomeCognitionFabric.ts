import { CausalAccountabilityGraph, type CausalAccountabilityState } from './CausalAccountabilityGraph.ts';
import type { OutcomeVerification } from './OutcomeVerificationService.ts';
import type { WorldContext } from '../core/types.ts';

export interface OutcomeCognitionProjectionInput {
  tick:number;
  tool:string;
  ok:boolean;
  verification:OutcomeVerification;
  reason?:string;
  inputKeys?:string[];
  predictedAction?:string;
  predictionConfidence01?:number;
  executionId?:string;
}

export interface OutcomeCognitionProjection {
  verificationRecord:{
    at:number; tick:number; tool:string; ok:boolean; verified:boolean;
    basis:OutcomeVerification['basis']; confidence01:number; observationId?:string;
    externalObservation:boolean; expectedPostcondition?:string; observedPostcondition?:string; executionId?:string; predictionId?:string;
  };
  causal:CausalAccountabilityState;
  verifiedExternal:boolean;
  observedWorldContextAfter?:WorldContext;
}

const cap=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

/**
 * Shared outcome coordinator. It is a projection layer, not a second source of truth.
 * The Core supplies domain callbacks for memory/evidence/world; the Fabric owns the
 * cross-domain causal chain so ordinary and project actions cannot drift apart.
 */
export class OutcomeCognitionFabric {
  private readonly causal = new CausalAccountabilityGraph();
  private records:OutcomeCognitionProjection['verificationRecord'][]=[];
  private readonly maxRecords:number;

  constructor(maxRecords=96){this.maxRecords=Math.max(32,maxRecords);}

  restore(snapshot?:{version?:number; records?:OutcomeCognitionProjection['verificationRecord'][]; causal?:CausalAccountabilityState}){
    this.records=Array.isArray(snapshot?.records)?snapshot.records.slice(-this.maxRecords).map(r=>({...r})):[];
    this.causal.restore(snapshot?.causal);
  }

  project(input:OutcomeCognitionProjectionInput):OutcomeCognitionProjection{
    const v=input.verification;
    const row={
      at:Date.now(), tick:input.tick, tool:input.tool, ok:input.ok, verified:v.verified,
      basis:v.basis, confidence01:cap(v.confidence01), observationId:v.observationId,
      externalObservation:Boolean(v.externalObservation), expectedPostcondition:v.expectedPostcondition, executionId:input.executionId,
      observedPostcondition:v.observedPostcondition,
    };
    this.records=[row,...this.records.filter(r=>!(r.tool===row.tool&&r.observationId===row.observationId&&r.expectedPostcondition===row.expectedPostcondition))].slice(0,this.maxRecords);

    const predictionId=this.causal.add('prediction',input.tick,`tool:${input.tool}`,{tool:input.tool,inputKeys:(input.inputKeys??[]).slice(0,12),predictedAction:input.predictedAction},input.predictionConfidence01);
    const decisionId=this.causal.add('decision',input.tick,`tool-request:${input.tool}`,{reason:String(input.reason??'tool-request').slice(0,160)});
    const chain=this.causal.recordActionChain({
      tick:input.tick, tool:input.tool, ok:input.ok, verified:v.verified,
      observationId:v.observationId, confidence01:v.confidence01,
      expectedPostcondition:v.expectedPostcondition, observedPostcondition:v.observedPostcondition, executionId:input.executionId,
      externalObservation:Boolean(v.externalObservation), predictionId, decisionId,
      data:{basis:v.basis,executionId:input.executionId}
    });
    const verifiedExternal=Boolean(v.verified&&v.externalObservation&&v.observationId);
    if(verifiedExternal) this.causal.recordLearning(input.tick,`verified-external-outcome:${input.tool}`,chain.outcomeId,v.confidence01);
    else this.causal.recordLearning(input.tick,`unverified-outcome:${input.tool}`,chain.outcomeId,Math.max(.1,1-cap(v.confidence01)));
    return {verificationRecord:row,causal:this.causal.snapshot(),verifiedExternal,observedWorldContextAfter:v.observedWorldContextAfter};
  }

  resolveExternalObservation(input:{tick:number;executionId?:string;tool:string;observationId:string;verified:boolean;confidence01:number;expectedPostcondition?:string;observedPostcondition?:string;reason?:string;predictionId?:string}){
    const idx=this.records.findIndex(r=>(input.executionId&&r.executionId===input.executionId) || (r.tool===input.tool && (!input.executionId || r.executionId===input.executionId)));
    if(idx<0)return {resolved:false,reason:'no-matching-outcome'} as const;
    const current=this.records[idx];
    const updated={...current,verified:Boolean(input.verified),basis:'external-postcondition' as const,confidence01:cap(input.confidence01),observationId:input.observationId,externalObservation:true,expectedPostcondition:input.expectedPostcondition??current.expectedPostcondition,observedPostcondition:input.observedPostcondition??current.observedPostcondition,executionId:input.executionId??current.executionId,predictionId:input.predictionId??current.predictionId,at:current.at};
    this.records=[updated,...this.records.filter((_,i)=>i!==idx)].slice(0,this.maxRecords);
    const linked=this.causal.resolveExternalVerification({tick:input.tick,tool:input.tool,observationId:input.observationId,verified:input.verified,confidence01:input.confidence01,expectedPostcondition:updated.expectedPostcondition,observedPostcondition:updated.observedPostcondition,executionId:input.executionId,reason:input.reason});
    if(linked.learningId && input.verified===true) this.causal.link(linked.verificationId,linked.learningId,'learned-from',cap(input.confidence01));
    return {resolved:true,record:updated,causal:this.causal.snapshot()} as const;
  }

  causalAutobiography(limit=24){
    return this.records.slice(0,Math.max(1,Math.min(64,Math.floor(limit)))).map(r=>({
      at:r.at,tick:r.tick,executionId:r.executionId??null,tool:r.tool,action:r.ok?'executed':'failed',
      expectation:r.expectedPostcondition??null,observation:r.observedPostcondition??null,
      verification:r.verified?'verified':r.externalObservation?'contradicted-or-unconfirmed':'unverified',
      evidence:{basis:r.basis,observationId:r.observationId??null,confidence01:r.confidence01,external:Boolean(r.externalObservation),predictionId:r.predictionId??null},
    }));
  }

  snapshot(){return {version:1,records:this.records.map(r=>({...r})),causal:this.causal.snapshot()};}
  summary(){return {version:1,records:this.records.length,causal:this.causal.summary()};}
}
