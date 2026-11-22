import type { ActionKind } from '../core/types.ts';
import { countOr, isPlainDataRecord, ownDataValue, unitOr } from '../body/RestoreSanitizers.ts';
const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];
const RECOVERY:ActionKind[]=['verify','explore','reflect','defer'];
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:(a+b)/2));
const deep=<T>(x:T):T=>structuredClone(x);
export interface RiskAwareRecoveryControllerState{version:1;tick:number;decisions:number;riskEvents:number;abstainEvents:number;recoveryAttempts:number;recoverySuccesses:number;failedRecoveries:number;meanRisk01:number;riskCalibration01:number;recoveryQuality01:number;recoverability01:number;selectedRisk01:number;selectedRecovery:ActionKind|null;lastFailureSeverity01:number;catastrophicAvoidance01:number;}
const defaultState=():RiskAwareRecoveryControllerState=>({version:1,tick:0,decisions:0,riskEvents:0,abstainEvents:0,recoveryAttempts:0,recoverySuccesses:0,failedRecoveries:0,meanRisk01:.25,riskCalibration01:.5,recoveryQuality01:.5,recoverability01:.5,selectedRisk01:.25,selectedRecovery:null,lastFailureSeverity01:0,catastrophicAvoidance01:0});
export class RiskAwareRecoveryController{
 private state=defaultState();snapshot(){return deep(this.state);}
 restore(raw?:Partial<RiskAwareRecoveryControllerState>|null){
  const d=defaultState();
  if(!isPlainDataRecord(raw) || ownDataValue(raw,'version')!==1){this.state=d;return;}
  const selected=ownDataValue(raw,'selectedRecovery');
  this.state={
   version:1,
   tick:countOr(ownDataValue(raw,'tick'),d.tick),
   decisions:countOr(ownDataValue(raw,'decisions'),d.decisions),
   riskEvents:countOr(ownDataValue(raw,'riskEvents'),d.riskEvents),
   abstainEvents:countOr(ownDataValue(raw,'abstainEvents'),d.abstainEvents),
   recoveryAttempts:countOr(ownDataValue(raw,'recoveryAttempts'),d.recoveryAttempts),
   recoverySuccesses:countOr(ownDataValue(raw,'recoverySuccesses'),d.recoverySuccesses),
   failedRecoveries:countOr(ownDataValue(raw,'failedRecoveries'),d.failedRecoveries),
   meanRisk01:unitOr(ownDataValue(raw,'meanRisk01'),d.meanRisk01),
   riskCalibration01:unitOr(ownDataValue(raw,'riskCalibration01'),d.riskCalibration01),
   recoveryQuality01:unitOr(ownDataValue(raw,'recoveryQuality01'),d.recoveryQuality01),
   recoverability01:unitOr(ownDataValue(raw,'recoverability01'),d.recoverability01),
   selectedRisk01:unitOr(ownDataValue(raw,'selectedRisk01'),d.selectedRisk01),
   selectedRecovery:typeof selected==='string' && ACTIONS.includes(selected as ActionKind) ? selected as ActionKind : null,
   lastFailureSeverity01:unitOr(ownDataValue(raw,'lastFailureSeverity01'),d.lastFailureSeverity01),
   catastrophicAvoidance01:unitOr(ownDataValue(raw,'catastrophicAvoidance01'),d.catastrophicAvoidance01),
  };
 }
 beforeDecision(args:{tick:number;actionUtilities:Record<ActionKind,number>;predictionError01:number;uncertainty01:number;modelDrift01:number;recoveryGain01:number;verified01:number;computeBudget01:number}):{actionBias:Record<ActionKind,number>;recoveryAction:ActionKind|null;abstain:boolean;risk01:number;recoverability01:number}{
  if(!Number.isSafeInteger(args.tick)||args.tick<0) throw new RangeError('risk-aware recovery tick must be a non-negative safe integer');
  this.state.tick=args.tick;this.state.decisions++;
  const predictionError01=clamp(args.predictionError01), uncertainty01=clamp(args.uncertainty01);
  const modelDrift01=clamp(args.modelDrift01), recoveryGain01=clamp(args.recoveryGain01);
  const verified01=clamp(args.verified01), computeBudget01=clamp(args.computeBudget01);
  const risk=clamp(.36*predictionError01+.26*uncertainty01+.16*modelDrift01+.14*(1-recoveryGain01)+.08*(1-verified01));
  const threshold=.58+.12*(1-computeBudget01);
  const bias=Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>;
  for(const a of ACTIONS){const actionRisk=(a==='verify'||a==='explore')?risk*.72:risk*(a==='rest'||a==='wait'?1.05:.96);const penalty=Math.max(0,actionRisk-.55)*.055;bias[a]=clamp(-penalty,-.065,.065);}
  let recovery:ActionKind|null=null;
  if(risk>threshold||predictionError01>.78){
    recovery=RECOVERY.slice().sort((a,b)=>(args.actionUtilities[b]??.5)-(args.actionUtilities[a]??.5))[0]??'verify';
    bias[recovery]=clamp((bias[recovery]??0)+.052,-.065,.065);this.state.recoveryAttempts++;this.state.selectedRecovery=recovery;this.state.riskEvents++;
  }else{this.state.selectedRecovery=null;}
  const abstain=risk>.86 && args.recoveryGain01<.35;
  if(abstain){this.state.abstainEvents++;bias.defer=clamp((bias.defer??0)+.06,-.065,.065);}
  this.state.selectedRisk01=risk;this.state.meanRisk01=clamp(this.state.meanRisk01*.95+risk*.05);this.state.recoverability01=clamp(this.state.recoverability01*.97+(1-risk)*(1-args.modelDrift01)*.03);
  if(risk<.25)this.state.catastrophicAvoidance01=clamp(this.state.catastrophicAvoidance01*.98+.02);
  return {actionBias:bias,recoveryAction:recovery,abstain,risk01:risk,recoverability01:this.state.recoverability01};
 }
 afterOutcome(args:{reward01:number;verified01:number;predictionError01:number;recoveryTriggered:boolean;recoverySuccessful01:number;failureSeverity01:number}){
  const actualRisk=clamp(.55*args.failureSeverity01+.25*args.predictionError01+.20*(1-args.verified01)),err=Math.abs(actualRisk-this.state.selectedRisk01);this.state.riskCalibration01=clamp(this.state.riskCalibration01*.95+(1-err)*.05);this.state.lastFailureSeverity01=clamp(args.failureSeverity01);
  if(args.recoveryTriggered){if(args.recoverySuccessful01>.55)this.state.recoverySuccesses++;else this.state.failedRecoveries++;this.state.recoveryQuality01=clamp(this.state.recoveryQuality01*.90+args.recoverySuccessful01*.10);this.state.recoverability01=clamp(this.state.recoverability01*.92+args.recoverySuccessful01*.08);}
  this.state.meanRisk01=clamp(this.state.meanRisk01*.95+actualRisk*.05);
 }
 metrics(){return deep(this.state);}
}
export const defaultRiskAwareRecoveryController=():RiskAwareRecoveryControllerState=>defaultState();
