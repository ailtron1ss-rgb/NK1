export interface ResidualStats{samples:number;mean01:number;variance01:number;lastError01:number;lastUpdatedAt:number;}
export interface LearnedResidualWorldState{byAction:Record<string,ResidualStats>;totalSamples:number;modelVersion:number;}
export const defaultLearnedResidual=():LearnedResidualWorldState=>({byAction:{},totalSamples:0,modelVersion:1});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class LearnedResidualWorldModel{
 private state=defaultLearnedResidual();
 restore(s:LearnedResidualWorldState|undefined){this.state={...defaultLearnedResidual(),...(s??{})};}
 predict(action:string,baseReward:number){const s=this.state.byAction[action];if(!s||s.samples<2)return {predicted:clamp(baseReward),confidence:.25,samples:s?.samples??0};const correction=(s.mean01-.5)*.35;return {predicted:clamp(baseReward+correction),confidence:clamp(.22+Math.min(.58,s.samples/24*.58)*(1-s.variance01)),samples:s.samples};}
 observe(action:string,predicted:number,actual:number){const key=action;const s=this.state.byAction[key]??{samples:0,mean01:.5,variance01:.25,lastError01:0,lastUpdatedAt:0};const error=actual-predicted;s.samples+=1;s.mean01=clamp(s.mean01+(actual-s.mean01)*Math.min(.25,1/s.samples*2));s.variance01=clamp(s.variance01*.92+Math.abs(error)*.08);s.lastError01=clamp(Math.abs(error));s.lastUpdatedAt=Date.now();this.state.byAction[key]=s;this.state.totalSamples+=1;}
 snapshot(){return structuredClone(this.state);}
}
