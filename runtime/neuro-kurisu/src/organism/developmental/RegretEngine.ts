export interface RegretRecord{id:string;at:number;chosen:string;alternative:string;chosenOutcome:number;counterfactualOutcome:number;regret:number;learning:string;}
export interface RegretState{records:RegretRecord[];meanRegret:number;lastAt:number;version:number;}
export const defaultRegretState=():RegretState=>({records:[],meanRegret:0,lastAt:0,version:1});
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export class RegretEngine{private state=defaultRegretState();restore(s:RegretState|undefined){this.state={...defaultRegretState(),...(s??{}),records:Array.isArray(s?.records)?s!.records.slice(0,256):[]};
}observe(chosen:string,chosenOutcome:number,alternatives:Array<{action:string;estimated:number}>){const alt=alternatives.filter(x=>x.action!==chosen).sort((a,b)=>b.estimated-a.estimated)[0];if(!alt)return null;const regret=clamp(alt.estimated-chosenOutcome);const row={id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,at:Date.now(),chosen,alternative:alt.action,chosenOutcome,counterfactualOutcome:alt.estimated,regret,learning:regret>.35?`reconsider:${alt.action}`:'minor-regret'};
this.state.records=[row,...this.state.records].slice(0,256);this.state.meanRegret=this.state.meanRegret*.9+regret*.1;this.state.lastAt=row.at;return row;}snapshot(){return structuredClone(this.state);}}
