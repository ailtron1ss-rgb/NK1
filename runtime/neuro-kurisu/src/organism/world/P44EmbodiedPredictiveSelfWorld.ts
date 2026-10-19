import type { ActionKind } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

const signed=(n:number)=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P44State{version:1;
samples:number;
lastAction:ActionKind|'none';
lastPrediction:number[];
lastActual:number[];
meanError01:number;
horizon:number;
rollouts:Array<{actions:ActionKind[];
values:number[];
confidence01:number;
at:number}>;
actionBias:Record<ActionKind,number>;
weights:number[][];
bias:number[];
metrics:{oneStepAccuracy01:number;
multiStepAccuracy01:number;
selfPrediction01:number;
updates:number};
}
export const defaultP44=():P44State=>({version:1,samples:0,lastAction:'none',lastPrediction:Array(24).fill(.5),lastActual:Array(24).fill(.5),meanError01:.5,horizon:5,rollouts:[],actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,weights:ACTIONS.map(()=>Array(24).fill(0)),bias:Array(24).fill(0),metrics:{oneStepAccuracy01:.15,multiStepAccuracy01:.1,selfPrediction01:.1,updates:0}});

function ai(a:ActionKind){return ACTIONS.indexOf(a);
}
export class P44EmbodiedPredictiveSelfWorld{
 private state=defaultP44();

 restore(raw?:Partial<P44State>|null){const d=defaultP44(),r=raw??{};
this.state={...d,...r,lastPrediction:Array.isArray(r.lastPrediction)?r.lastPrediction.slice(0,24):d.lastPrediction,lastActual:Array.isArray(r.lastActual)?r.lastActual.slice(0,24):d.lastActual,horizon:Math.max(1,Math.min(5,Number(r.horizon??d.horizon))),rollouts:Array.isArray(r.rollouts)?r.rollouts.slice(-64):[],actionBias:{...d.actionBias,...(r.actionBias??{})},weights:Array.isArray(r.weights)?r.weights.slice(0,7).map((row:any)=>Array.isArray(row)?row.slice(0,24):Array(24).fill(0)):d.weights,bias:Array.isArray(r.bias)?r.bias.slice(0,24):d.bias,metrics:{...d.metrics,...(r.metrics??{})}};
}
 snapshot(){return structuredClone(this.state);
}
 predict(vector:number[],action:ActionKind){const row=this.state.weights[ai(action)]??Array(24).fill(0);
const next=vector.slice(0,24).map((x,i)=>clamp(.5+(x-.5)+row[i]*(x-.5)*.18+this.state.bias[i]*.03));
return {next,confidence01:clamp(.15+Math.min(1,this.state.samples/80)*.65+(1-this.state.meanError01)*.15)};
}
 observe(vector:number[],action:ActionKind,actual:number[],reward01:number){const p=this.predict(vector,action);
let err=0;
const idx=ai(action);
for(let i=0;
i<24;
i++){const e=(actual[i]??.5)-(p.next[i]??.5);
err+=Math.abs(e);
this.state.weights[idx][i]=Math.max(-1,Math.min(1,this.state.weights[idx][i]+e*(vector[i]??.5)*.16));
this.state.bias[i]=Math.max(-1,Math.min(1,this.state.bias[i]+e*.05));
}const one=clamp(err/24);
this.state.meanError01=clamp(this.state.meanError01*.88+one*.12);
this.state.metrics.oneStepAccuracy01=clamp(this.state.metrics.oneStepAccuracy01*.9+(1-one)*.1);
this.state.metrics.selfPrediction01=clamp(this.state.metrics.selfPrediction01*.9+(1-one)*.1);
this.state.samples++;
this.state.lastAction=action;
this.state.lastPrediction=p.next;
this.state.lastActual=actual.slice(0,24);
for(const a of ACTIONS){const q=this.predict(vector,a);
const utility=clamp((reward01-.5)+(1-(q.confidence01))*.02-q.next.reduce((s,x,i)=>s+Math.abs(x-.5),0)/24*.03);
this.state.actionBias[a]=signed(this.state.actionBias[a]*.94+utility*.045);
}return this.snapshot();
}
 rollout(vector:number[],actions:ActionKind[],at:number){let current=vector.slice(0,24);
const values:number[]=[];
let conf=1;
for(const a of actions.slice(0,this.state.horizon)){const p=this.predict(current,a);
values.push(clamp(p.next.reduce((s,x)=>s+x,0)/p.next.length));
conf=Math.min(conf,p.confidence01);
current=p.next;
}this.state.rollouts=[{actions:actions.slice(0,this.state.horizon),values,confidence01:conf,at},...this.state.rollouts].slice(0,64);
this.state.metrics.multiStepAccuracy01=clamp(this.state.metrics.multiStepAccuracy01*.95+conf*.05);
return {values,confidence01:conf};
}
 bias(a:ActionKind){return this.state.actionBias[a]??0;
}
}
