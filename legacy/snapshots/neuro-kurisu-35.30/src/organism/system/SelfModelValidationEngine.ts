const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface SelfPredictionRecord{predicted:string;actual:string;correct:boolean;confidence01:number;error01:number;at:number;}
export interface SelfModelValidationState{version:1;predictions:number;resolved:number;correct:number;accuracy01:number;meanError01:number;brier01:number;lastAt:number;records:SelfPredictionRecord[];}
export const defaultSelfModelValidation=():SelfModelValidationState=>({version:1,predictions:0,resolved:0,correct:0,accuracy01:0,meanError01:.5,brier01:.25,lastAt:0,records:[]});
export class SelfModelValidationEngine{
 private state=defaultSelfModelValidation(); private pending=new Map<string,{pred:string;conf:number;at:number}>();
 restore(raw?:Partial<SelfModelValidationState>|null){const d=defaultSelfModelValidation(),r=raw??{};this.state={...d,...r,records:Array.isArray(r.records)?r.records.slice(-256):[]};this.pending.clear();}
 snapshot(){return structuredClone(this.state);}
 track(input:{id:string;predicted:string;confidence01:number;at?:number}){const at=input.at??Date.now();this.pending.set(input.id,{pred:input.predicted,conf:clamp(input.confidence01),at});this.state.predictions++;this.state.lastAt=at;}
 resolve(input:{id?:string;actual:string;at?:number}){const at=input.at??Date.now();const p=input.id?this.pending.get(input.id):undefined;const pred=p?.pred??'none',conf=p?.conf??.5,correct=pred===input.actual;const err=correct?0:1;this.state.resolved++;if(correct)this.state.correct++;this.state.accuracy01=this.state.correct/Math.max(1,this.state.resolved);this.state.meanError01=clamp(this.state.meanError01*.9+err*.1);this.state.brier01=clamp(this.state.brier01*.92+(correct?1-conf*conf:(1-conf)*(1-conf))*.08);this.state.records=[{predicted:pred,actual:input.actual,correct,confidence01:conf,error01:err,at},...this.state.records].slice(0,256);this.state.lastAt=at;if(input.id)this.pending.delete(input.id);return this.state.records[0];}
}
