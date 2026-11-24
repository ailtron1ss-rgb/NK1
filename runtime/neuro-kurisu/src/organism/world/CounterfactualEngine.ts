import type { ActionKind } from '../core/types.ts';
import { WorldEnvironment, type EnvironmentAction } from './WorldEnvironment.ts';
export interface CounterfactualBranch { actions:EnvironmentAction[]; expectedReward:number; uncertainty:number; rationale:string; }
const actions:EnvironmentAction[]=['observe','inspect','move','collect','rest','communicate'];
export class CounterfactualEngine {
  private readonly env: WorldEnvironment;
  constructor(env:WorldEnvironment){ this.env = env; }
  imagine(preferred:EnvironmentAction|undefined, depth=3, width=4):CounterfactualBranch[]{
    type Node={state:ReturnType<WorldEnvironment['snapshot']>;actions:EnvironmentAction[];reward:number;unc:number};
    let beam:Node[]=[{state:this.env.snapshot(),actions:[],reward:0,unc:0.25}];
    for(let d=0;d<Math.min(4,Math.max(1,depth));d++){
      const next:Node[]=[];
      for(const n of beam){ for(const a of actions){ const p=this.env.project(a,n.state); next.push({state:p.next,actions:[...n.actions,a],reward:n.reward+p.reward*Math.pow(0.86,d),unc:Math.min(1,n.unc+(1-p.confidence)*0.2)}); } }
      next.sort((a,b)=>(b.reward-b.unc*0.25)-(a.reward-a.unc*0.25)); beam=next.slice(0,Math.max(2,width));
    }
    return beam.map(n=>({actions:n.actions,expectedReward:Number(n.reward.toFixed(3)),uncertainty:Number(n.unc.toFixed(3)),rationale:`counterfactual depth=${depth}; preferred=${preferred||'none'}`}));
  }
}
