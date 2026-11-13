import type { ActionKind } from '../core/types.ts';
export interface BoredomState{version:1;boredom01:number;quietCycles:number;explorationTriggers:number;lastTriggerAt:number;lastReason:string;}
const c=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const fin=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim().length?Number(v):NaN;return Number.isFinite(n)?n:(Number.isFinite(f)?f:0);};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(fin(v,f)));
export const defaultBoredom=():BoredomState=>({version:1,boredom01:0,quietCycles:0,explorationTriggers:0,lastTriggerAt:0,lastReason:'initial'});
export class BoredomExplorer{
 private state=defaultBoredom();
 restore(s:BoredomState|undefined){const d=defaultBoredom();const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};this.state={version:1,boredom01:c(fin(read('boredom01'),d.boredom01)),quietCycles:cnt(read('quietCycles'),d.quietCycles),explorationTriggers:cnt(read('explorationTriggers'),d.explorationTriggers),lastTriggerAt:Math.max(0,fin(read('lastTriggerAt'),d.lastTriggerAt)),lastReason:typeof read('lastReason')==='string'?(read('lastReason') as string).slice(0,240):d.lastReason};}
 snapshot(){return structuredClone(this.state);}
 observe(input:{novelty01:number;predictionError01:number;informationGain01:number;externalStimulus:boolean}){
  const quiet=!input.externalStimulus&&input.novelty01<.24&&input.predictionError01<.22&&input.informationGain01<.2;
  if(quiet)this.state.quietCycles++;else this.state.quietCycles=Math.max(0,this.state.quietCycles-2);
  this.state.boredom01=c(this.state.boredom01*.92+(quiet?.12:-.04));
  const trigger=this.state.boredom01>.68 && this.state.quietCycles>=5; if(trigger){this.state.explorationTriggers++;this.state.lastTriggerAt=Date.now();this.state.lastReason='low information gain + prolonged predictability';}
  return this.snapshot();
 }
 bias(action:ActionKind){return action==='explore'?this.state.boredom01*.11:action==='verify'?this.state.boredom01*.025:action==='rest'? -this.state.boredom01*.03:0;}
}
