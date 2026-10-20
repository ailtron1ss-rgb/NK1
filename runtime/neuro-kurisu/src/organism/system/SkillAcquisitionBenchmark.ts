const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const MAX_CONTEXT_REGISTRY=4096;
const MIN_HOLDOUT_CONTEXTS=3;
export interface SkillBenchmarkSample{action:string;contextKey:string;outcome01:number;at:number;phase:'baseline'|'learning'|'holdout';}
export interface SkillAcquisitionState{version:1;samples:number;tasks:number;baselineMean01:number;holdoutMean01:number;gain01:number;novelContexts:number;recent:SkillBenchmarkSample[];lastAt:number;contextPhaseByKey:Record<string,'baseline'|'learning'|'holdout'>;contaminatedHoldoutSamples:number;acceptedHoldoutSamples:number;contextRegistrySaturated:boolean;}
export const defaultSkillAcquisition=():SkillAcquisitionState=>({version:1,samples:0,tasks:0,baselineMean01:.5,holdoutMean01:.5,gain01:0,novelContexts:0,recent:[],lastAt:0,contextPhaseByKey:{},contaminatedHoldoutSamples:0,acceptedHoldoutSamples:0,contextRegistrySaturated:false});
export class SkillAcquisitionBenchmark{
 private state=defaultSkillAcquisition();
 restore(raw?:Partial<SkillAcquisitionState>|null){
  const d=defaultSkillAcquisition(),r=raw??{};
  const registry=r.contextPhaseByKey&&typeof r.contextPhaseByKey==='object'?Object.fromEntries(Object.entries(r.contextPhaseByKey).slice(-MAX_CONTEXT_REGISTRY).filter((entry):entry is [string,'baseline'|'learning'|'holdout']=>['baseline','learning','holdout'].includes(String(entry[1])))): {};
  // Older snapshots counted repeated observations as holdout samples. Recompute from
  // unique registered contexts instead of trusting a non-independent legacy counter.
  const uniqueHoldoutContexts=Object.values(registry).filter(phase=>phase==='holdout').length;
  this.state={...d,...r,version:1,recent:Array.isArray(r.recent)?r.recent.slice(-128):[],contextPhaseByKey:registry,acceptedHoldoutSamples:uniqueHoldoutContexts,contaminatedHoldoutSamples:Math.max(0,Math.floor(Number(r.contaminatedHoldoutSamples)||0)),contextRegistrySaturated:Boolean(r.contextRegistrySaturated)};
  if(Object.keys(registry).length>=MAX_CONTEXT_REGISTRY)this.state.contextRegistrySaturated=true;
 }
 snapshot(){return structuredClone(this.state);}
 observe(input:{action:string;contextKey:string;outcome01:number;phase?:SkillBenchmarkSample['phase']}){
  // Sample order is not a split protocol: missing phase means learning, never holdout.
  const phase=input.phase??'learning';
  const context=String(input.contextKey).normalize('NFKC').trim().toLocaleLowerCase().slice(0,160);
  const contextValid=context.length>0;
  // Never trust inherited object properties such as "__proto__" as registered phases.
  const priorPhase=contextValid&&Object.hasOwn(this.state.contextPhaseByKey,context)?this.state.contextPhaseByKey[context]:undefined;
  const contaminated=phase==='holdout'?(!contextValid||(priorPhase!==undefined&&priorPhase!=='holdout')):priorPhase==='holdout';
  if(contaminated)this.state.contaminatedHoldoutSamples++;
  let registeredNewContext=false;
  if(contextValid&&priorPhase===undefined){
   if(Object.keys(this.state.contextPhaseByKey).length<MAX_CONTEXT_REGISTRY){
    Object.defineProperty(this.state.contextPhaseByKey,context,{value:phase,enumerable:true,writable:true,configurable:true});
    registeredNewContext=true;
   } else this.state.contextRegistrySaturated=true;
  }
  if(!this.state.recent.some(x=>x.contextKey===context))this.state.novelContexts++;
  const row:SkillBenchmarkSample={action:String(input.action).slice(0,64),contextKey:context,outcome01:clamp(input.outcome01),at:Date.now(),phase};
  this.state.samples++;this.state.tasks=Math.max(this.state.tasks,Math.ceil(this.state.samples/3));
  this.state.recent=[row,...this.state.recent].slice(0,128);
  const update=(old:number,value:number,rate:number)=>clamp(old*(1-rate)+value*rate);
  if(phase==='baseline'&&!contaminated&&registeredNewContext)this.state.baselineMean01=update(this.state.baselineMean01,row.outcome01,.18);
  const acceptedHoldout=phase==='holdout'&&!contaminated&&!this.state.contextRegistrySaturated&&registeredNewContext;
  if(acceptedHoldout){this.state.holdoutMean01=update(this.state.holdoutMean01,row.outcome01,.22);this.state.acceptedHoldoutSamples++;}
  // Repeated observations of one holdout context are not independent samples.
  const learningGap=this.state.holdoutMean01-this.state.baselineMean01;
  const holdoutEligible=this.state.acceptedHoldoutSamples>=MIN_HOLDOUT_CONTEXTS&&this.state.contaminatedHoldoutSamples===0&&!this.state.contextRegistrySaturated;
  this.state.gain01=holdoutEligible?clamp(.9*this.state.gain01+.1*(learningGap>0?learningGap:0)):0;
  this.state.lastAt=row.at;
  return {...structuredClone(row),holdoutEvidenceAccepted:acceptedHoldout};
 }
 summary(){return {samples:this.state.samples,tasks:this.state.tasks,baselineMean01:this.state.baselineMean01,holdoutMean01:this.state.holdoutMean01,gain01:this.state.gain01,novelContexts:this.state.novelContexts,holdoutSamples:this.state.acceptedHoldoutSamples,contaminatedHoldoutSamples:this.state.contaminatedHoldoutSamples,acceptedHoldoutSamples:this.state.acceptedHoldoutSamples,holdoutContextsRequired:MIN_HOLDOUT_CONTEXTS,holdoutEligible:this.state.acceptedHoldoutSamples>=MIN_HOLDOUT_CONTEXTS&&this.state.contaminatedHoldoutSamples===0&&!this.state.contextRegistrySaturated,contextRegistrySaturated:this.state.contextRegistrySaturated};}
}
