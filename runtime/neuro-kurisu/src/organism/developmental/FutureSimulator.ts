import type { WorldModel2 } from './WorldModel2.ts';
export interface FutureSimulationResult{path:Array<{action:string;reward:number;uncertainty:number;confidence:number}>;expectedReward:number;uncertainty:number;horizon:number;}
export interface FutureSimulatorState{runs:number;last:Array<{action:string;reward:number}>;version:number;}
export const defaultFutureSimulator=():FutureSimulatorState=>({runs:0,last:[],version:1});
export class FutureSimulator{
 private state=defaultFutureSimulator();
 restore(s:FutureSimulatorState|undefined){this.state={...defaultFutureSimulator(),...(s??{}),last:Array.isArray(s?.last)?s!.last.slice(-32):[]};}
 simulate(model:WorldModel2,actions:string[],baseReward:number):FutureSimulationResult{const r=model.rollout(actions.slice(0,6),baseReward);this.state.runs++;this.state.last=[...this.state.last,{action:actions.join('>'),reward:r.reward}].slice(-32);return {path:r.path,expectedReward:r.reward,uncertainty:r.uncertainty,horizon:r.path.length};}
 snapshot(){return structuredClone(this.state);}
}
