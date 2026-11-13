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

const clamp01=(x:unknown,fallback:number)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(1,x)):fallback;
const counter=(x:unknown,fallback:number)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:fallback;
const ACTION_KINDS:readonly ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const STRATEGY_LIMIT=8;
const ERROR_LIMIT=64;
/** Copy own data properties only; accessors, exotic prototypes and hostile traps fail closed. */
const ownDataRecord=(value:unknown):Record<string,unknown>|null=>{
  try{
    if(value===null||typeof value!=='object'||Array.isArray(value))return null;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const output:Record<string,unknown>=Object.create(null);
    for(const key of Reflect.ownKeys(descriptors)){
      if(typeof key!=='string')return null;
      const descriptor=(descriptors as Record<string,PropertyDescriptor>)[key];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||descriptor.get!==undefined||descriptor.set!==undefined)return null;
      output[key]=descriptor.value;
    }
    return output;
  }catch{return null;}
};
/** Strategy -> consistency in [-1,1]; malformed entries are dropped, never copied through. */
const restoreConsistencyMap=(value:unknown):Record<string,number>=>{
  const source=ownDataRecord(value);
  if(!source)return {};
  const output:Record<string,number>={};
  for(const [key,raw] of Object.entries(source)){
    if(!key||key.length>64)continue;
    if(typeof raw==='number'&&Number.isFinite(raw))output[key]=Math.max(-1,Math.min(1,raw));
  }
  return output;
};
const restoreStrategyList=(value:unknown):string[]=>{
  try{
    if(!Array.isArray(value))return [];
    return value.filter((item):item is string=>typeof item==='string'&&item.length>0&&item.length<=64).slice(0,STRATEGY_LIMIT);
  }catch{return [];}
};
const restoreErrorList=(value:unknown):number[]=>{
  try{
    if(!Array.isArray(value))return [];
    return value.filter((item):item is number=>typeof item==='number'&&Number.isFinite(item)&&item>=0&&item<=1).slice(-ERROR_LIMIT);
  }catch{return [];}
};
const restorePredictedAction=(value:unknown,fallback:ActionKind|'none'):ActionKind|'none'=>value==='none'||(typeof value==='string'&&(ACTION_KINDS as readonly string[]).includes(value))?value as ActionKind|'none':fallback;

export class SelfModelEngine {
  private model=defaultSelfModel();
  restore(m:SelfModelV2|undefined){
    const d=defaultSelfModel();
    const r=ownDataRecord(m);
    if(!r){this.model=d;return;}
    const gate=ownDataRecord(r.lastIdentityGate);
    this.model={
      predictedAction:restorePredictedAction(r.predictedAction,d.predictedAction),
      confidence:clamp01(r.confidence,d.confidence),
      actionAccuracy:clamp01(r.actionAccuracy,d.actionAccuracy),
      calibrationError:clamp01(r.calibrationError,d.calibrationError),
      identityCoherence:clamp01(r.identityCoherence,d.identityCoherence),
      agencyBelief:clamp01(r.agencyBelief,d.agencyBelief),
      recentErrors:restoreErrorList(r.recentErrors),
      preferredStrategies:restoreStrategyList(r.preferredStrategies),
      updatedAt:typeof r.updatedAt==='number'&&Number.isFinite(r.updatedAt)&&r.updatedAt>=0?r.updatedAt:d.updatedAt,
      recoveryCount:counter(r.recoveryCount,d.recoveryCount),
      lastRecoveryAt:typeof r.lastRecoveryAt==='number'&&Number.isFinite(r.lastRecoveryAt)&&r.lastRecoveryAt>=0?r.lastRecoveryAt:d.lastRecoveryAt,
      continuityShock01:clamp01(r.continuityShock01,d.continuityShock01),
      postRecoveryIntegration01:clamp01(r.postRecoveryIntegration01,d.postRecoveryIntegration01),
      goalAlignment01:clamp01(r.goalAlignment01,d.goalAlignment01),
      goalAlignmentEMA01:clamp01(r.goalAlignmentEMA01,d.goalAlignmentEMA01),
      selfConsistentAction11:restoreConsistencyMap(r.selfConsistentAction11),
      identityGateAcceptedCount:counter(r.identityGateAcceptedCount,d.identityGateAcceptedCount),
      identityGateRejectedCount:counter(r.identityGateRejectedCount,d.identityGateRejectedCount),
      lastIdentityGate:gate&&typeof gate.accepted==='boolean'&&typeof gate.reason==='string'&&Number.isFinite(gate.at)
        ? {accepted:gate.accepted,reason:gate.reason.slice(0,96),at:Math.max(0,gate.at as number),evidenceRef:typeof gate.evidenceRef==='string'?gate.evidenceRef.slice(0,240):null}
        : null,
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
