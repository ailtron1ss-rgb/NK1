/** BIG PASS 236 — self-authored intervention lab with explicit baseline/intervention evidence. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface ExperimentRecord{
 id:string; domain:string; baseline01:number; intervention01:number; delta01:number; predictedDelta01:number; effect01:number; verified:boolean; at:number;
}
export interface CausalSelfExperimentState{
 version:1; cycles:number; designed:number; verified:number; rejected:number; calibration01:number; records:ExperimentRecord[];
}
export const defaultCausalSelfExperiment=():CausalSelfExperimentState=>({version:1,cycles:0,designed:0,verified:0,rejected:0,calibration01:.5,records:[]});
export class CausalSelfExperimentLab{
 private state=defaultCausalSelfExperiment();
 restore(raw?:Partial<CausalSelfExperimentState>|null){
  const d=defaultCausalSelfExperiment(),r=raw??{};
  this.state={...d,...r,records:Array.isArray(r.records)?structuredClone(r.records).slice(0,96):[],version:1};
 }
 snapshot(){return structuredClone(this.state);}
 run(input:{at:number;domain:string;baseline01:number;intervention01:number;predictedDelta01:number;minEffect01?:number}){
  const b=clamp(input.baseline01),i=clamp(input.intervention01),observed=i-b,pred=clamp(input.predictedDelta01)*2-1,effect=Math.abs(observed-pred);
  const verified=Math.abs(observed)>=clamp(input.minEffect01??.06)&&Math.sign(observed||pred)===Math.sign(pred||observed);
  this.state.cycles++; this.state.designed++;
  if(verified)this.state.verified++; else this.state.rejected++;
  this.state.calibration01=clamp(this.state.calibration01*.9+(1-effect)*.1);
  const rec:ExperimentRecord={id:`exp:${this.state.cycles}:${input.domain}`,domain:input.domain,baseline01:b,intervention01:i,delta01:observed,predictedDelta01:pred,effect01:effect,verified,at:input.at};
  this.state.records=[rec,...this.state.records].slice(0,96);
  return rec;
 }
 summary(){return{cycles:this.state.cycles,designed:this.state.designed,verified:this.state.verified,rejected:this.state.rejected,calibration01:this.state.calibration01,last:this.state.records[0]??null};}
}
