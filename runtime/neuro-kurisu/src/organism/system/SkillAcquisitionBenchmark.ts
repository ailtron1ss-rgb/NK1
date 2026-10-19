const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface SkillBenchmarkSample{action:string;contextKey:string;outcome01:number;at:number;phase:'baseline'|'learning'|'holdout';}
export interface SkillAcquisitionState{version:1;samples:number;tasks:number;baselineMean01:number;holdoutMean01:number;gain01:number;novelContexts:number;recent:SkillBenchmarkSample[];lastAt:number;}
export const defaultSkillAcquisition=():SkillAcquisitionState=>({version:1,samples:0,tasks:0,baselineMean01:.5,holdoutMean01:.5,gain01:0,novelContexts:0,recent:[],lastAt:0});
export class SkillAcquisitionBenchmark{
 private state=defaultSkillAcquisition();
 restore(raw?:Partial<SkillAcquisitionState>|null){const d=defaultSkillAcquisition();this.state={...d,...(raw??{}),version:1,recent:Array.isArray(raw?.recent)?raw!.recent.slice(-128):[]};}
 snapshot(){return structuredClone(this.state);}
 observe(input:{action:string;contextKey:string;outcome01:number;phase?:SkillBenchmarkSample['phase']}){
   const phase=input.phase??(this.state.samples<3?'baseline':this.state.samples%4===0?'holdout':'learning');
   const context=String(input.contextKey).slice(0,160);const priorContext=this.state.recent.some(x=>x.contextKey===context);
   if(!priorContext)this.state.novelContexts++;
   const row:SkillBenchmarkSample={action:String(input.action).slice(0,64),contextKey:context,outcome01:clamp(input.outcome01),at:Date.now(),phase};
   this.state.samples++;this.state.tasks=Math.max(this.state.tasks,Math.ceil(this.state.samples/3));
   this.state.recent=[row,...this.state.recent].slice(0,128);
   const update=(old:number,value:number,rate:number)=>clamp(old*(1-rate)+value*rate);
   if(phase==='baseline')this.state.baselineMean01=update(this.state.baselineMean01,row.outcome01,.18);
   if(phase==='holdout')this.state.holdoutMean01=update(this.state.holdoutMean01,row.outcome01,.22);
   const learningGap=this.state.holdoutMean01-this.state.baselineMean01;
   this.state.gain01=clamp(.9*this.state.gain01+.1*(learningGap>0?learningGap:0));
   this.state.lastAt=row.at;
   return structuredClone(row);
 }
 summary(){return {samples:this.state.samples,tasks:this.state.tasks,baselineMean01:this.state.baselineMean01,holdoutMean01:this.state.holdoutMean01,gain01:this.state.gain01,novelContexts:this.state.novelContexts};}
}
