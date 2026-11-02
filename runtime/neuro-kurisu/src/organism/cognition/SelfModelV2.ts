import type { ActionKind, OrganismState } from '../core/types.ts';

export interface SelfModelV2 {
  predictedAction: ActionKind|'none';
  confidence: number;
  actionAccuracy: number;
  calibrationError: number;
  identityCoherence: number;
  agencyBelief: number;
  recentErrors: number[];
  preferredStrategies: string[];
  updatedAt: number;
  recoveryCount: number;
  lastRecoveryAt: number;
  continuityShock01: number;
  postRecoveryIntegration01: number;
  goalAlignment01: number;
  goalAlignmentEMA01: number;
  selfConsistentAction11: Record<string, number>;
  identityGateAcceptedCount: number;
  identityGateRejectedCount: number;
  lastIdentityGate: { accepted: boolean; reason: string; at: number; evidenceRef: string | null } | null;
}

export function defaultSelfModel(): SelfModelV2 {
  return { predictedAction:'none', confidence:0, actionAccuracy:0.5, calibrationError:0.5, identityCoherence:0.88, agencyBelief:0.5, recentErrors:[], preferredStrategies:[], updatedAt:Date.now(),recoveryCount:0,lastRecoveryAt:0,continuityShock01:0,postRecoveryIntegration01:0,goalAlignment01:0.5,goalAlignmentEMA01:0.5,selfConsistentAction11:{}, identityGateAcceptedCount:0, identityGateRejectedCount:0, lastIdentityGate:null, };
}

export class SelfModelEngine {
  private model=defaultSelfModel();
  restore(m:SelfModelV2|undefined){
    // Saved self-state is untrusted input. Rebuild only known fields and never
    // spread/read arbitrary objects, because getters and Proxy traps may execute.
    const defaults=defaultSelfModel();
    const record=(value:unknown):Record<string,unknown>|null=>{
      try {
        if(!value || typeof value!=='object' || Array.isArray(value)) return null;
        const proto=Object.getPrototypeOf(value);
        if(proto!==Object.prototype && proto!==null) return null;
        for(const key of Reflect.ownKeys(value)){
          const descriptor=Object.getOwnPropertyDescriptor(value,key);
          if(!descriptor || !('value' in descriptor)) return null;
        }
        return value as Record<string,unknown>;
      } catch { return null; }
    };
    const read=(value:unknown,key:string):unknown=>{
      const row=record(value);
      if(!row) return undefined;
      try {
        const descriptor=Object.getOwnPropertyDescriptor(row,key);
        return descriptor && 'value' in descriptor ? descriptor.value : undefined;
      } catch { return undefined; }
    };
    const bounded=(value:unknown,fallback:number,min=0,max=1):number=>
      typeof value==='number' && Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback;
    const counter=(value:unknown,fallback=0,max=1_000_000_000):number=>
      typeof value==='number' && Number.isSafeInteger(value) ? Math.max(0,Math.min(max,value)) : fallback;
    const actionKinds:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
    const root=record(m);
    if(!root){ this.model=defaults; return; }
    const predicted=read(root,'predictedAction');
    const errorsRaw=read(root,'recentErrors');
    const errors:number[]=[];
    try {
      if(Array.isArray(errorsRaw)){
        const length=Object.getOwnPropertyDescriptor(errorsRaw,'length');
        const count=length && 'value' in length && typeof length.value==='number'
          ? Math.min(64,Math.max(0,Math.floor(length.value))) : 0;
        for(let i=0;i<count;i++){
          const descriptor=Object.getOwnPropertyDescriptor(errorsRaw,String(i));
          if(descriptor && 'value' in descriptor && typeof descriptor.value==='number' && Number.isFinite(descriptor.value))
            errors.push(bounded(descriptor.value,0));
        }
      }
    } catch { /* malformed proxy-backed history contributes no entries */ }
    const strategiesRaw=read(root,'preferredStrategies');
    const strategies:string[]=[];
    try {
      if(Array.isArray(strategiesRaw)){
        const length=Object.getOwnPropertyDescriptor(strategiesRaw,'length');
        const count=length && 'value' in length && typeof length.value==='number'
          ? Math.min(64,Math.max(0,Math.floor(length.value))) : 0;
        for(let i=0;i<count;i++){
          const descriptor=Object.getOwnPropertyDescriptor(strategiesRaw,String(i));
          if(!descriptor || !('value' in descriptor) || typeof descriptor.value!=='string') continue;
          const item=descriptor.value.trim();
          if(item && item.length<=80 && !strategies.includes(item)) strategies.push(item);
          if(strategies.length>=8) break;
        }
      }
    } catch { /* malformed strategy arrays restore empty */ }
    const scoresRaw=read(root,'selfConsistentAction11');
    const scores:Record<string,number>={};
    const scoreRecord=record(scoresRaw);
    if(scoreRecord){
      for(const action of actionKinds){
        const value=read(scoreRecord,action);
        if(typeof value==='number' && Number.isFinite(value))
          Object.defineProperty(scores,action,{value:bounded(value,0,-1,1),enumerable:true,writable:true,configurable:true});
      }
    }
    const gateRaw=read(root,'lastIdentityGate');
    const gateRecord=record(gateRaw);
    let lastIdentityGate:SelfModelV2['lastIdentityGate']=null;
    if(gateRecord){
      const accepted=read(gateRecord,'accepted'),reason=read(gateRecord,'reason'),at=read(gateRecord,'at'),evidenceRef=read(gateRecord,'evidenceRef');
      if(typeof accepted==='boolean' && typeof reason==='string' && reason.length<=256
        && typeof at==='number' && Number.isFinite(at)
        && (evidenceRef===null || typeof evidenceRef==='string')){
        lastIdentityGate={
          accepted,reason:reason.slice(0,96),at:bounded(at,0,0,Number.MAX_SAFE_INTEGER),
          evidenceRef:typeof evidenceRef==='string'?evidenceRef.slice(0,240):null,
        };
      }
    }
    this.model={
      predictedAction:predicted==='none'||actionKinds.includes(predicted as ActionKind)?predicted as ActionKind|'none':'none',
      confidence:bounded(read(root,'confidence'),defaults.confidence),
      actionAccuracy:bounded(read(root,'actionAccuracy'),defaults.actionAccuracy),
      calibrationError:bounded(read(root,'calibrationError'),defaults.calibrationError),
      identityCoherence:bounded(read(root,'identityCoherence'),defaults.identityCoherence),
      agencyBelief:bounded(read(root,'agencyBelief'),defaults.agencyBelief),
      recentErrors:errors,preferredStrategies:strategies,
      updatedAt:bounded(read(root,'updatedAt'),defaults.updatedAt,0,Number.MAX_SAFE_INTEGER),
      recoveryCount:counter(read(root,'recoveryCount')),
      lastRecoveryAt:bounded(read(root,'lastRecoveryAt'),defaults.lastRecoveryAt,0,Number.MAX_SAFE_INTEGER),
      continuityShock01:bounded(read(root,'continuityShock01'),defaults.continuityShock01),
      postRecoveryIntegration01:bounded(read(root,'postRecoveryIntegration01'),defaults.postRecoveryIntegration01),
      goalAlignment01:bounded(read(root,'goalAlignment01'),defaults.goalAlignment01),
      goalAlignmentEMA01:bounded(read(root,'goalAlignmentEMA01'),defaults.goalAlignmentEMA01),
      selfConsistentAction11:scores,
      identityGateAcceptedCount:counter(read(root,'identityGateAcceptedCount')),
      identityGateRejectedCount:counter(read(root,'identityGateRejectedCount')),
      lastIdentityGate,
    };
  }
  snapshot(){ return structuredClone(this.model); }
  predict(action:ActionKind, confidence:number){ this.model.predictedAction=action; this.model.confidence=Math.max(0,Math.min(1,confidence)); this.model.updatedAt=Date.now(); }
  actionBias(action:ActionKind){
    const selfConsistency=Number(this.model.selfConsistentAction11[action] ?? 0);
    const predictedMatch=this.model.predictedAction===action ? this.model.confidence : 0;
    const agency=(this.model.agencyBelief-.5)*0.08;
    const identity=(this.model.identityCoherence-.5)*0.05;
    return Math.max(-0.06, Math.min(0.06, selfConsistency*0.045 + (predictedMatch-.5)*0.028 + agency + identity));
  }

  learnGoalOutcome(input:{action:ActionKind;goalAlignment01:number;reward01:number;tick:number;evidence?:{verified:boolean;independent:boolean;source:'world-transition'|'external-verification'|'internal';evidenceRef?:string}}){
    const alignment=Math.max(0,Math.min(1,input.goalAlignment01));
    const reward=Math.max(0,Math.min(1,input.reward01));
    const quality=0.5*alignment+0.5*reward;
    const lr=0.04 + 0.04*Math.abs(quality-.5);
    this.model.goalAlignmentEMA01=Math.max(0,Math.min(1,this.model.goalAlignmentEMA01*(1-lr)+quality*lr));
    this.model.goalAlignment01=Math.max(0,Math.min(1,this.model.goalAlignment01*.96 + alignment*.04));
    const old=this.model.selfConsistentAction11[input.action] ?? 0;
    const target=(quality-.5)*2;
    this.model.selfConsistentAction11[input.action]=Math.max(-1,Math.min(1,old*(1-lr)+target*lr));
    // CAKN-inspired write-time gate: action preferences can learn from the already-gated reward,
    // but high-level self-beliefs move only when a trusted, independent outcome is explicitly bound.
    const evidence=input.evidence;
    const evidenceRef=String(evidence?.evidenceRef??'').trim().slice(0,240);
    const allowedSource=evidence?.source==='world-transition'||evidence?.source==='external-verification';
    const sourceRefBound=evidence?.source==='world-transition'?evidenceRef.startsWith('world-transition:'):evidence?.source==='external-verification'?evidenceRef.startsWith('external-verification:'):false;
    const gateAccepted=Boolean(evidence?.verified&&evidence.independent&&allowedSource&&sourceRefBound&&evidenceRef);
    const gateReason=gateAccepted?'verified-independent-outcome-bound':!evidence?'missing-provenance':!evidence.verified?'outcome-unverified':!evidence.independent?'outcome-not-independent':!allowedSource?'untrusted-evidence-source':!sourceRefBound?'evidence-source-binding-mismatch':'missing-evidence-reference';
    if(gateAccepted){
      this.model.agencyBelief=Math.max(0,Math.min(1,this.model.agencyBelief*.985 + (alignment-.5)*.024 + (reward-.5)*.012));
      this.model.identityCoherence=Math.max(0,Math.min(1,this.model.identityCoherence*.99 + (alignment-.5)*.016));
      this.model.identityGateAcceptedCount=(this.model.identityGateAcceptedCount??0)+1;
    } else {
      this.model.identityGateRejectedCount=(this.model.identityGateRejectedCount??0)+1;
    }
    this.model.lastIdentityGate={accepted:gateAccepted,reason:gateReason,at:Number.isFinite(input.tick)?input.tick:0,evidenceRef:gateAccepted?evidenceRef:null};
    if (input.action) this.model.preferredStrategies=[input.action,...this.model.preferredStrategies.filter(x=>x!==input.action)].slice(0,8);
    this.model.updatedAt=Date.now();
    return {updated:true,action:input.action,quality01:quality,goalAlignment01:this.model.goalAlignment01,goalAlignmentEMA01:this.model.goalAlignmentEMA01,actionBias11:this.actionBias(input.action),agencyBelief:this.model.agencyBelief,identityCoherence:this.model.identityCoherence,identityUpdateAccepted:gateAccepted,identityUpdateReason:gateReason,identityGateAcceptedCount:this.model.identityGateAcceptedCount,identityGateRejectedCount:this.model.identityGateRejectedCount};
  }

  registerRecovery(input:{at?:number;recoveryCount?:number;preTick?:number;postTick?:number;reason?:string}){
    const at=input.at??Date.now();
    this.model.recoveryCount=Math.max(this.model.recoveryCount+1, Math.max(0, Math.floor(input.recoveryCount??0)));
    this.model.lastRecoveryAt=at;
    this.model.continuityShock01=Math.min(1, this.model.continuityShock01*.35+.58);
    this.model.postRecoveryIntegration01=Math.max(0, Math.min(1, this.model.postRecoveryIntegration01*.55+.45));
    // Recovery is recorded as continuity evidence, not treated as independent evidence about identity or agency.
    this.model.updatedAt=at;
  }

  observe(actual:ActionKind, previousState:OrganismState){
    const mismatch=this.model.predictedAction==='none'?0.5:(actual===this.model.predictedAction?0:1);
    const confidence=this.model.confidence;
    this.model.recentErrors=[...this.model.recentErrors,mismatch].slice(-64);
    const mean=this.model.recentErrors.reduce((a,b)=>a+b,0)/this.model.recentErrors.length;
    this.model.actionAccuracy=1-mean;
    this.model.calibrationError=0.8*this.model.calibrationError+0.2*Math.abs((1-mismatch)-confidence);
    // Prediction agreement updates calibration only. High-level identity/agency beliefs are written by the evidence-gated outcome path.
    this.model.continuityShock01=Math.max(0,this.model.continuityShock01*.94);
    this.model.postRecoveryIntegration01=Math.min(1,this.model.postRecoveryIntegration01+.025);
    this.model.updatedAt=Date.now();
  }
}
