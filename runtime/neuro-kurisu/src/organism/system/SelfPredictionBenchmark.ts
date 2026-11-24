/** Longitudinal self-prediction benchmark: prospective action forecast vs later actual action. */
export interface SelfPredictionSample { at:number; tick:number; predicted:string; actual:string; confidence01:number; correct01:number; brier01:number; }
export interface SelfPredictionPending { createdTick:number; dueTick:number; predicted:string; confidence01:number; horizon:string; createdAt:number; }
export interface SelfPredictionBenchmarkState { version:2; samples:number; accuracy01:number; meanBrier01:number; calibrationGap01:number; recentErrors:number[]; horizonCounts:Record<string,number>; lastAt:number; pending:SelfPredictionPending[]; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export const defaultSelfPredictionBenchmark=():SelfPredictionBenchmarkState=>({version:2,samples:0,accuracy01:.5,meanBrier01:.5,calibrationGap01:.5,recentErrors:[],horizonCounts:{},lastAt:0,pending:[]});
export class SelfPredictionBenchmark {
  private state=defaultSelfPredictionBenchmark();
  restore(raw?:Partial<SelfPredictionBenchmarkState>|null){const d=defaultSelfPredictionBenchmark();this.state={...d,...(raw??{}),version:2,recentErrors:Array.isArray(raw?.recentErrors)?raw!.recentErrors.slice(-128):[],horizonCounts:{...(raw?.horizonCounts??{})},pending:Array.isArray(raw?.pending)?raw!.pending.slice(-64):[]};}
  snapshot(){return structuredClone(this.state);}
  seed(input:{tick:number;predicted:string;confidence01:number;horizon?:number|string;at?:number},clone=true){const h=Math.max(1,Number(input.horizon??1));const row={createdTick:Math.max(0,Math.floor(input.tick)),dueTick:Math.max(0,Math.floor(input.tick+h)),predicted:String(input.predicted),confidence01:clamp(input.confidence01),horizon:String(input.horizon??1),createdAt:input.at??Date.now()};this.state.pending=[...this.state.pending,row].slice(-64);return clone?structuredClone(row):row;}
  resolveDue(input:{tick:number;actual:string;at?:number}){const due=this.state.pending.filter(p=>p.dueTick<=input.tick);if(!due.length)return 0;this.state.pending=this.state.pending.filter(p=>p.dueTick>input.tick);for(const p of due)this.observe({tick:p.dueTick,predicted:p.predicted,actual:input.actual,confidence01:p.confidence01,horizon:p.horizon,at:input.at??Date.now()});return due.length;}
  observe(input:{tick:number;predicted:string;actual:string;confidence01:number;horizon?:string;at?:number}){
    const c=clamp(input.confidence01);const correct=input.predicted===input.actual?1:0;const brier=(c-correct)**2;const err=1-correct;
    this.state.samples++;this.state.accuracy01=clamp(this.state.accuracy01*.92+correct*.08);this.state.meanBrier01=clamp(this.state.meanBrier01*.92+brier*.08);this.state.calibrationGap01=clamp(this.state.calibrationGap01*.92+Math.abs(c-correct)*.08);this.state.recentErrors=[...this.state.recentErrors,err].slice(-128);const h=String(input.horizon??'next-cycle');this.state.horizonCounts[h]=(this.state.horizonCounts[h]??0)+1;this.state.lastAt=input.at??Date.now();return {correct01:correct,brier01:brier};
  }
  improvementVsChance(){return this.state.samples?clamp((this.state.accuracy01-.5)/.5):0;}
}
