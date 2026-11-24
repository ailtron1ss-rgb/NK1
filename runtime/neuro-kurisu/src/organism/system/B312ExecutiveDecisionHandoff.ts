import type { ActionKind } from '../core/types.ts';

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface B312DecisionHandoffState {
  version:1;
  evaluations:number;
  promotions:number;
  confirmations:number;
  blocked:number;
  lastPolicyAction:ActionKind|null;
  lastPromotedAction:ActionKind|null;
  lastReason:string;
  lastPolicyCredit01:number;
  lastPolicyMargin01:number;
  history:Array<{tick:number;policyAction:ActionKind|null;promotedAction:ActionKind|null;reason:string;credit01:number;margin01:number}>;
}

export interface B312DecisionHandoffInput {
  tick:number;
  policyAction:ActionKind|null;
  policyCredit01:number;
  policyMargin01:number;
  policyVerifiedUpdates:number;
  currentAction:ActionKind|null;
  currentCandidateScore01:number;
  policyCandidateScore01:number;
  externalInput:boolean;
  userRequestedAction?:ActionKind|null;
  constitutionalBlocked:boolean;
  quorumAccepted:boolean;
  repairPressure01:number;
  identity01:number;
  realityGap01:number;
}

export interface B312DecisionHandoffResult {
  promotedAction:ActionKind|null;
  applied:boolean;
  reason:string;
  eligibility01:number;
}

export const defaultB312DecisionHandoff=():B312DecisionHandoffState=>({version:1,evaluations:0,promotions:0,confirmations:0,blocked:0,lastPolicyAction:null,lastPromotedAction:null,lastReason:'none',lastPolicyCredit01:.5,lastPolicyMargin01:0,history:[]});

export class B312ExecutiveDecisionHandoff {
  private state=B312ExecutiveDecisionHandoff.normalize();
  private lesions=false;
  private static normalize(raw?:Partial<B312DecisionHandoffState>|null):B312DecisionHandoffState{
    const d=defaultB312DecisionHandoff(),r=raw??{};
    return {...d,...r,version:1,evaluations:Math.max(0,Math.floor(Number(r.evaluations??0))),promotions:Math.max(0,Math.floor(Number(r.promotions??0))),confirmations:Math.max(0,Math.floor(Number(r.confirmations??0))),blocked:Math.max(0,Math.floor(Number(r.blocked??0))),lastPolicyAction:ACTIONS.includes(r.lastPolicyAction as ActionKind)?r.lastPolicyAction!:null,lastPromotedAction:ACTIONS.includes(r.lastPromotedAction as ActionKind)?r.lastPromotedAction!:null,lastReason:String(r.lastReason??'none'),lastPolicyCredit01:clamp(Number(r.lastPolicyCredit01??.5)),lastPolicyMargin01:clamp(Number(r.lastPolicyMargin01??0)),history:Array.isArray(r.history)?r.history.slice(-96):[]};
  }
  restore(raw?:Partial<B312DecisionHandoffState>|null){this.state=B312ExecutiveDecisionHandoff.normalize(raw);this.lesions=false;}
  snapshot(){return structuredClone(this.state);}
  lesion(enabled=true){this.lesions=enabled;return {lesioned:this.lesions};}
  clearLesion(){this.lesions=false;}
  evaluate(input:B312DecisionHandoffInput):B312DecisionHandoffResult{
    const credit=clamp(input.policyCredit01),margin=clamp(input.policyMargin01),repair=clamp(input.repairPressure01),identity=clamp(input.identity01),reality=clamp(input.realityGap01);
    const enoughEvidence=input.policyAction!=null && input.policyVerifiedUpdates>=3 && credit>=.70 && margin>=.02;
    const safe=Boolean(input.quorumAccepted) && !input.constitutionalBlocked && repair<.62 && reality<.78;
    const notUserForced=!input.externalInput && input.userRequestedAction==null;
    const closeEnough=Boolean(input.policyAction && input.policyAction===input.currentAction ? true : input.policyAction && (input.policyCandidateScore01 >= input.currentCandidateScore01-.085 || margin>=.02));
    const eligibility=clamp(.32*credit+.28*Math.min(1,input.policyVerifiedUpdates/8)+.18*Math.min(1,margin/.08)+.12*identity+.10*(1-reality));
    let reason='not-eligible';
    let applied=false;
    let promotedAction:ActionKind|null=null;
    if(this.lesions){reason='lesioned';}
    else if(!enoughEvidence){reason='insufficient-verified-policy-evidence';}
    else if(!safe){reason='safety-or-governance-block';}
    else if(!notUserForced){reason='external-request-protection';}
    else if(!closeEnough){reason='policy-candidate-too-far-from-current-decision';}
    else {
      promotedAction=input.policyAction;
      applied=Boolean(promotedAction && promotedAction!==input.currentAction);
      reason=applied?'verified-policy-promoted':'verified-policy-confirmed';
    }
    this.state.evaluations++;
    this.state.lastPolicyAction=input.policyAction??null;
    this.state.lastPromotedAction=promotedAction;
    this.state.lastReason=reason;
    this.state.lastPolicyCredit01=credit;
    this.state.lastPolicyMargin01=margin;
    if(applied)this.state.promotions++;
    if(reason==='verified-policy-confirmed')this.state.confirmations++;
    else if(!applied)this.state.blocked++;
    this.state.history=[{tick:Math.max(0,Math.floor(input.tick)),policyAction:input.policyAction??null,promotedAction,reason,credit01:credit,margin01:margin},...this.state.history].slice(0,96);
    return {promotedAction,applied,reason,eligibility01:eligibility};
  }
  diagnostics(){return {...this.state,lesioned:this.lesions,promotionRate01:this.state.evaluations?this.state.promotions/this.state.evaluations:0,blockRate01:this.state.evaluations?this.state.blocked/this.state.evaluations:0};}
}
