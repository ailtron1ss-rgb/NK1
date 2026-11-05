const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface CounterfactualWorldState{version:1;cycles:number;compiled:number;promoted:number;rejected:number;meanSeparation01:number;lastDomain:string;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
export const defaultCounterfactualWorld=():CounterfactualWorldState=>({version:1,cycles:0,compiled:0,promoted:0,rejected:0,meanSeparation01:0,lastDomain:'none'});
export class CounterfactualWorldCompiler{
 private state=defaultCounterfactualWorld();
 restore(raw?:Partial<CounterfactualWorldState>|null){const d=defaultCounterfactualWorld();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,cycles:cnt(read('cycles'),d.cycles),compiled:cnt(read('compiled'),d.compiled),promoted:cnt(read('promoted'),d.promoted),rejected:cnt(read('rejected'),d.rejected),meanSeparation01:clamp(finN(read('meanSeparation01'),d.meanSeparation01)),lastDomain:str(read('lastDomain'),d.lastDomain)};}
 snapshot(){return structuredClone(this.state);}
 compile(input:{domain:string;baseline01:number;intervention01:number;uncertainty01:number;resource01:number;predictedGain01:number}){
  const s=this.state,b=clamp(input.baseline01),i=clamp(input.intervention01),u=clamp(input.uncertainty01),r=clamp(input.resource01),p=clamp(input.predictedGain01);const sep=Math.abs(i-b);const score=clamp(sep*.5+p*.3+(1-u)*.12+r*.08);const promoted=score>.5 && sep>.05;
  s.cycles++;s.compiled++;if(promoted)s.promoted++;else s.rejected++;s.meanSeparation01=clamp(s.meanSeparation01*.9+sep*.1);s.lastDomain=input.domain;
  return {domain:input.domain,separation01:sep,score01:score,promoted,reason:promoted?'counterfactual-supported':'insufficient-separation'};
 }
 summary(){return structuredClone(this.state);}
}
