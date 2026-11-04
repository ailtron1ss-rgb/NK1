import type { WorldModel2 } from './WorldModel2.ts';
export interface FutureSimulationResult{path:Array<{action:string;reward:number;uncertainty:number;confidence:number}>;expectedReward:number;uncertainty:number;horizon:number;}
export interface FutureSimulatorState{runs:number;last:Array<{action:string;reward:number}>;version:number;}
export const defaultFutureSimulator=():FutureSimulatorState=>({runs:0,last:[],version:1});
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const sanitizeStep=(v:unknown):{action:string;reward:number}|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;return {action:typeof r.action==='string'?r.action.slice(0,320):'',reward:finN(r.reward,0)};};
export class FutureSimulator{
 private state=defaultFutureSimulator();
 restore(s:FutureSimulatorState|undefined){const src:Record<string,unknown>=(s&&typeof s==='object')?s as unknown as Record<string,unknown>:{};let last:Array<{action:string;reward:number}>=[];try{const raw=src.last;if(Array.isArray(raw))last=raw.map(sanitizeStep).filter((x):x is {action:string;reward:number}=>x!==null).slice(-32);}catch{last=[];}this.state={runs:Math.max(0,Math.floor(finN(src.runs,0))),last,version:1};}
 simulate(model:WorldModel2,actions:string[],baseReward:number):FutureSimulationResult{const r=model.rollout(actions.slice(0,6),baseReward);this.state.runs++;this.state.last=[...this.state.last,{action:actions.join('>'),reward:r.reward}].slice(-32);return {path:r.path,expectedReward:r.reward,uncertainty:r.uncertainty,horizon:r.path.length};}
 snapshot(){return structuredClone(this.state);}
}
