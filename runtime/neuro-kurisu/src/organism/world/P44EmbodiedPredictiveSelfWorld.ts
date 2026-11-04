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

const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const vSigned=(v:unknown,n:number,fb:number[]):number[]=>Array.isArray(v)?Array.from({length:n},(_,i)=>signed(finN((v as unknown[])[i],fb[i]??0))):fb.slice();
const sanRollout=(x:unknown):P44State['rollouts'][number]|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;return {actions:Array.isArray(r.actions)?r.actions.filter((a):a is ActionKind=>ACTIONS.includes(a as ActionKind)).slice(0,8):[],values:Array.isArray(r.values)?r.values.slice(0,8).map(v=>clamp(finN(v,.5))):[],confidence01:clamp(finN(r.confidence01,0)),at:cnt(r.at,0)};};
function ai(a:ActionKind){return ACTIONS.indexOf(a);
}
export class P44EmbodiedPredictiveSelfWorld{
 private state=defaultP44();

 restore(raw?:Partial<P44State>|null){const d=defaultP44();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const ab=read('actionBias');const abObj=(ab&&typeof ab==='object')?ab as Record<string,unknown>:{};const actionBias={} as Record<ActionKind,number>;for(const a of ACTIONS)actionBias[a]=signed(finN(abObj[a],0));const mRaw=read('metrics');const mObj=(mRaw&&typeof mRaw==='object')?mRaw as Record<string,unknown>:{};const wRaw=read('weights');const la=read('lastAction');
this.state={version:1,samples:cnt(read('samples'),d.samples),lastAction:(typeof la==='string'&&(la==='none'||ACTIONS.includes(la as ActionKind)))?la as ActionKind|'none':'none',lastPrediction:vSigned(read('lastPrediction'),24,d.lastPrediction),lastActual:vSigned(read('lastActual'),24,d.lastActual),meanError01:clamp(finN(read('meanError01'),d.meanError01)),horizon:Math.max(1,Math.min(5,Math.round(finN(read('horizon'),d.horizon)))),rollouts:Array.isArray(read('rollouts'))?(read('rollouts') as unknown[]).slice(-64).map(sanRollout).filter((x):x is P44State['rollouts'][number]=>x!==null):[],actionBias,weights:Array.from({length:ACTIONS.length},(_,i)=>{const row=Array.isArray(wRaw)?(wRaw as unknown[])[i]:null;return row?Array.from({length:24},(_,j)=>signed(finN((row as unknown[])[j],0))):d.weights[i]!.slice();}),bias:vSigned(read('bias'),24,d.bias),metrics:{oneStepAccuracy01:clamp(finN(mObj.oneStepAccuracy01,d.metrics.oneStepAccuracy01)),multiStepAccuracy01:clamp(finN(mObj.multiStepAccuracy01,d.metrics.multiStepAccuracy01)),selfPrediction01:clamp(finN(mObj.selfPrediction01,d.metrics.selfPrediction01)),updates:cnt(mObj.updates,d.metrics.updates)}};
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
