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
    const restored={...defaultSelfModel(),...(m||{})};
    restored.identityGateAcceptedCount=Number.isFinite(restored.identityGateAcceptedCount)?Math.max(0,Math.floor(restored.identityGateAcceptedCount)):0;
    restored.identityGateRejectedCount=Number.isFinite(restored.identityGateRejectedCount)?Math.max(0,Math.floor(restored.identityGateRejectedCount)):0;
    const gate=restored.lastIdentityGate as any;
    restored.lastIdentityGate=gate&&typeof gate==='object'&&typeof gate.accepted==='boolean'&&typeof gate.reason==='string'&&Number.isFinite(gate.at)
      ? {accepted:gate.accepted,reason:gate.reason.slice(0,96),at:Math.max(0,gate.at),evidenceRef:typeof gate.evidenceRef==='string'?gate.evidenceRef.slice(0,240):null}
      : null;
    this.model=restored;
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
    this.model.identityCoherence=Math.max(0, Math.min(1, this.model.identityCoherence-.018));
    this.model.agencyBelief=Math.max(0, Math.min(1, this.model.agencyBelief-.01));
    this.model.updatedAt=at;
  }

  observe(actual:ActionKind, previousState:OrganismState){
    const mismatch=this.model.predictedAction==='none'?0.5:(actual===this.model.predictedAction?0:1);
    const confidence=this.model.confidence;
    this.model.recentErrors=[...this.model.recentErrors,mismatch].slice(-64);
    const mean=this.model.recentErrors.reduce((a,b)=>a+b,0)/this.model.recentErrors.length;
    this.model.actionAccuracy=1-mean;
    this.model.calibrationError=0.8*this.model.calibrationError+0.2*Math.abs((1-mismatch)-confidence);
    this.model.identityCoherence=Math.max(0,Math.min(1,previousState.needs.identityCoherence - mismatch*0.03 + (mismatch===0?0.006:0)));
    this.model.agencyBelief=Math.max(0,Math.min(1,0.96*this.model.agencyBelief + (actual!=='wait'?0.02:0)));
    this.model.continuityShock01=Math.max(0,this.model.continuityShock01*.94);
    this.model.postRecoveryIntegration01=Math.min(1,this.model.postRecoveryIntegration01+.025);
    this.model.updatedAt=Date.now();
  }
}
