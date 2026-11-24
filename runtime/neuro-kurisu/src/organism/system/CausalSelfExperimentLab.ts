/** BIG PASS 236 — self-authored intervention lab with explicit baseline/intervention evidence. */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type ExperimentEvidenceClass='observed'|'synthetic'|'unavailable';
export type ExperimentObservationSource='controlled-test'|'android-termux'|'external'|'simulation';
export interface ExperimentRecord{
 id:string; domain:string; baseline01:number; intervention01:number; delta01:number; predictedDelta01:number; effect01:number; verified:boolean; at:number;
 executed:boolean; evidenceClass:ExperimentEvidenceClass; source:ExperimentObservationSource;
}
export interface CausalSelfExperimentState{
 version:2; cycles:number; designed:number; observed:number; verified:number; rejected:number; synthetic:number; calibration01:number; records:ExperimentRecord[];
}
export const defaultCausalSelfExperiment=():CausalSelfExperimentState=>({version:2,cycles:0,designed:0,observed:0,verified:0,rejected:0,synthetic:0,calibration01:.5,records:[]});

export class CausalSelfExperimentLab{
 private state=defaultCausalSelfExperiment();
 restore(raw?:Partial<CausalSelfExperimentState>|null){
  const d=defaultCausalSelfExperiment(),r=raw??{};
  this.state={...d,...r,records:Array.isArray(r.records)?structuredClone(r.records).slice(0,96).map((x:any)=>({
    id:String(x?.id??''),domain:String(x?.domain??'unknown'),baseline01:clamp(x?.baseline01),intervention01:clamp(x?.intervention01),delta01:Number(x?.delta01??0),
    predictedDelta01:Number(x?.predictedDelta01??0),effect01:clamp(x?.effect01),verified:Boolean(x?.verified),at:Number(x?.at??0),executed:Boolean(x?.executed),
    evidenceClass:['observed','synthetic','unavailable'].includes(x?.evidenceClass)?x.evidenceClass:'unavailable',
    source:['controlled-test','android-termux','external','simulation'].includes(x?.source)?x.source:'simulation'
  })):[],version:2};
 }
 snapshot(){return structuredClone(this.state);}

 /** Register a hypothesis/measurement. Synthetic projections can be stored but never count as evidence. */
 run(input:{at:number;domain:string;baseline01:number;intervention01:number;predictedDelta01:number;minEffect01?:number;executed?:boolean;evidenceClass?:ExperimentEvidenceClass;source?:ExperimentObservationSource}){
  const b=clamp(input.baseline01),i=clamp(input.intervention01),observed=i-b;
  const pred=clamp(input.predictedDelta01)*2-1;
  const effect=Math.abs(observed-pred);
  const executed=Boolean(input.executed);
  const evidenceClass=input.evidenceClass??(executed?'observed':'synthetic');
  const source=input.source??(executed?'controlled-test':'simulation');
  const eligible=executed && evidenceClass==='observed' && source!=='simulation';
  const verified=eligible && Math.abs(observed)>=clamp(input.minEffect01??.06) && Math.sign(observed||pred)===Math.sign(pred||observed);
  this.state.cycles++;this.state.designed++;if(eligible)this.state.observed++;else this.state.synthetic++;
  if(verified)this.state.verified++;else this.state.rejected++;
  if(eligible)this.state.calibration01=clamp(this.state.calibration01*.9+(1-effect)*.1);
  const rec:ExperimentRecord={id:`exp:${this.state.cycles}:${input.domain}`,domain:input.domain,baseline01:b,intervention01:i,delta01:observed,predictedDelta01:pred,effect01:effect,verified,at:input.at,executed,evidenceClass,source};
  this.state.records=[rec,...this.state.records].slice(0,96);
  return rec;
 }

 /**
  * Close a previously designed intervention using an actual post-action observation.
  * This is the only path that can convert a hypothesis into canonical causal evidence.
  */
 observeOutcome(input:{experimentId:string;at:number;intervention01:number;minEffect01?:number;source:ExperimentObservationSource}){
  const row=this.state.records.find(x=>x.id===input.experimentId);
  if(!row)return null;
  row.intervention01=clamp(input.intervention01);row.delta01=row.intervention01-row.baseline01;row.effect01=Math.abs(row.delta01-row.predictedDelta01);
  row.executed=true;row.evidenceClass='observed';row.source=input.source;
  row.verified=Math.abs(row.delta01)>=clamp(input.minEffect01??.06) && Math.sign(row.delta01||row.predictedDelta01)===Math.sign(row.predictedDelta01||row.delta01);
  this.state.observed++;
  if(row.verified)this.state.verified++;else this.state.rejected++;
  if(row.verified)this.state.calibration01=clamp(this.state.calibration01*.9+(1-row.effect01)*.1);
  row.at=input.at;
  return structuredClone(row);
 }
 summary(){return{cycles:this.state.cycles,designed:this.state.designed,observed:this.state.observed,verified:this.state.verified,rejected:this.state.rejected,synthetic:this.state.synthetic,calibration01:this.state.calibration01,last:this.state.records[0]??null};}
}
