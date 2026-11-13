const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface NeuralDigitalCoevolutionState{version:1;cycles:number;organismAdapt01:number;substrateAdapt01:number;alignment01:number;coadaptation01:number;drift01:number;updates:number;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
export const defaultNeuralDigitalCoevolution=():NeuralDigitalCoevolutionState=>({version:1,cycles:0,organismAdapt01:.45,substrateAdapt01:.45,alignment01:.5,coadaptation01:.45,drift01:.08,updates:0});
export class NeuralDigitalCoevolutionController{
 private state=defaultNeuralDigitalCoevolution();
 restore(raw?:Partial<NeuralDigitalCoevolutionState>|null){const d=defaultNeuralDigitalCoevolution();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,cycles:cnt(read('cycles'),d.cycles),organismAdapt01:clamp(finN(read('organismAdapt01'),d.organismAdapt01)),substrateAdapt01:clamp(finN(read('substrateAdapt01'),d.substrateAdapt01)),alignment01:clamp(finN(read('alignment01'),d.alignment01)),coadaptation01:clamp(finN(read('coadaptation01'),d.coadaptation01)),drift01:clamp(finN(read('drift01'),d.drift01)),updates:cnt(read('updates'),d.updates)};}
 snapshot(){return structuredClone(this.state);}
 adapt(input:{predictionError01:number;reward01:number;stability01:number;resource01:number;humanOrEnvironmentDrift01:number}){
  const s=this.state,e=clamp(input.predictionError01),r=clamp(input.reward01),st=clamp(input.stability01),res=clamp(input.resource01),dr=clamp(input.humanOrEnvironmentDrift01);
  const org=clamp(.25+e*.42+r*.2+st*.13)*res;const sub=clamp(.24+e*.38+(1-st)*.25+res*.13);s.organismAdapt01=clamp(s.organismAdapt01*.86+org*.14);s.substrateAdapt01=clamp(s.substrateAdapt01*.86+sub*.14);s.drift01=clamp(s.drift01*.88+dr*.12);s.alignment01=clamp(1-(e*.55+dr*.25+(1-res)*.2));s.coadaptation01=clamp((s.organismAdapt01+s.substrateAdapt01+s.alignment01)/3);s.cycles++;if(e>.58||dr>.5)s.updates++;return {organismAdapt01:s.organismAdapt01,substrateAdapt01:s.substrateAdapt01,alignment01:s.alignment01,coadaptation01:s.coadaptation01,drift01:s.drift01,updateRecommended:e>.58||dr>.5};
 }
 summary(){return structuredClone(this.state);}
}
