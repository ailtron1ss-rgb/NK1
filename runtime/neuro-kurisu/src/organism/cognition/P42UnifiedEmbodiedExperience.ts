import type { ActionKind } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

const signed=(n:number)=>Math.max(-1,Math.min(1,Number.isFinite(n)?n:0));

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P42Input{at:number;
scene:string;
entityLabels:string[];
relationLabels:string[];
eventLabels:string[];
audioActivity01:number;
visionChange01:number;
bodyEnergy01:number;
thermal01:number;
cognitiveCapacity01:number;
uncertainty01:number;
novelty01:number;
agency01:number;
selfCoherence01:number;
goalPressure01:number;
externalText:boolean;
}
export interface P42State{version:1;
tick:number;
current:{at:number;
scene:string;
vector:number[];
salience01:number;
confidence01:number;
surprise01:number;
focus:string};
history:Array<{at:number;
scene:string;
vector:number[];
focus:string;
salience01:number;
confidence01:number}>;
actionBias:Record<ActionKind,number>;
metrics:{grounding01:number;
integration01:number;
temporalBinding01:number;
selfWorldCoupling01:number;
activeAccess01:number;
updates:number};
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const vecN=(v:unknown,len:number,fill:number):number[]=>Array.from({length:len},(_,i)=>{const x=Array.isArray(v)?(v as unknown[])[i]:undefined;const n=typeof x==='number'?x:Number(x);return Number.isFinite(n)?clamp(n):fill;});
const sanBias=(v:unknown,fb:Record<ActionKind,number>):Record<ActionKind,number>=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};return Object.fromEntries(ACTIONS.map(a=>[a,Math.max(-1,Math.min(1,finN(r[a],fb[a])))])) as Record<ActionKind,number>;};
export const defaultP42=():P42State=>({version:1,tick:0,current:{at:0,scene:'unknown',vector:Array(24).fill(.5),salience01:.1,confidence01:.1,surprise01:.5,focus:'none'},history:[],actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,metrics:{grounding01:.1,integration01:.1,temporalBinding01:.1,selfWorldCoupling01:.1,activeAccess01:.1,updates:0}});

function hash(s:string){let h=2166136261;
for(let i=0;
i<s.length;
i++){h^=s.charCodeAt(i);
h=Math.imul(h,16777619);
}return h>>>0;
}
function normalize(v:number[]){const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;
return v.map(x=>clamp((x/n+1)/2));
}
export class P42UnifiedEmbodiedExperienceEngine{
 private state=defaultP42();

 restore(raw?:Partial<P42State>|null){const d=defaultP42();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
const curRaw=(read('current')&&typeof read('current')==='object')?read('current') as Record<string,unknown>:{};
const mRaw=(read('metrics')&&typeof read('metrics')==='object')?read('metrics') as Record<string,unknown>:{};
const hRaw=read('history');
this.state={version:1,tick:cnt(read('tick'),d.tick),current:{at:finN(curRaw.at,d.current.at),scene:str(curRaw.scene,d.current.scene),vector:vecN(curRaw.vector,24,.5),salience01:clamp(finN(curRaw.salience01,d.current.salience01)),confidence01:clamp(finN(curRaw.confidence01,d.current.confidence01)),surprise01:clamp(finN(curRaw.surprise01,d.current.surprise01)),focus:str(curRaw.focus,d.current.focus)},history:Array.isArray(hRaw)?(hRaw as unknown[]).slice(-96).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {at:finN(r.at,0),scene:str(r.scene,'unknown'),vector:vecN(r.vector,24,.5),focus:str(r.focus,'none'),salience01:clamp(finN(r.salience01,.1)),confidence01:clamp(finN(r.confidence01,.1))};}):[],actionBias:sanBias(read('actionBias'),d.actionBias),metrics:{grounding01:clamp(finN(mRaw.grounding01,d.metrics.grounding01)),integration01:clamp(finN(mRaw.integration01,d.metrics.integration01)),temporalBinding01:clamp(finN(mRaw.temporalBinding01,d.metrics.temporalBinding01)),selfWorldCoupling01:clamp(finN(mRaw.selfWorldCoupling01,d.metrics.selfWorldCoupling01)),activeAccess01:clamp(finN(mRaw.activeAccess01,d.metrics.activeAccess01)),updates:cnt(mRaw.updates,d.metrics.updates)}};
}
 snapshot(){return {version:1 as const,tick:this.state.tick,current:{...this.state.current,vector:this.state.current.vector.slice()},history:this.state.history.map(h=>({...h,vector:h.vector.slice()})),actionBias:{...this.state.actionBias},metrics:{...this.state.metrics}};
}
 integrate(i:P42Input){const entity=i.entityLabels.length,relation=i.relationLabels.length,event=i.eventLabels.length;
const focus=i.entityLabels[0]??i.scene??'unknown';
const raw=[i.externalText?1:0,clamp(entity/20),clamp(relation/20),clamp(event/16),clamp(i.audioActivity01),clamp(i.visionChange01),clamp(i.bodyEnergy01),clamp(i.thermal01),clamp(i.cognitiveCapacity01),clamp(i.uncertainty01),clamp(i.novelty01),clamp(i.agency01),clamp(i.selfCoherence01),clamp(i.goalPressure01),clamp((entity+relation+event)/32),clamp(1-i.uncertainty01),clamp(i.audioActivity01+i.visionChange01),clamp(i.bodyEnergy01-i.thermal01+1)/2,clamp((i.agency01+i.selfCoherence01)/2),clamp(i.novelty01+i.goalPressure01),clamp((hash(i.scene)%1000)/1000),clamp((hash(focus)%1000)/1000),clamp((hash((i.relationLabels[0]??'none'))%1000)/1000),clamp((hash((i.eventLabels[0]??'none'))%1000)/1000)];
const vector=normalize(raw.map(x=>x*2-1));
let d=0;
for(let n=0;
n<vector.length;
n++)d+=Math.abs(vector[n]-(this.state.current.vector[n]??.5));
const surprise=clamp(d/vector.length*2.4);
const confidence=clamp(.2+Math.min(1,(entity+relation+event)/20)*.18+(1-i.uncertainty01)*.22+(i.externalText?.08:0));
const salience=clamp(surprise*.45+i.novelty01*.18+i.goalPressure01*.14+i.audioActivity01*.08+i.visionChange01*.08+(1-i.cognitiveCapacity01)*.07);
const temporal=this.state.current.scene==='unknown'?.2:this.state.current.scene===i.scene?.86:.42;
this.state.current={at:i.at,scene:(i.scene||'unknown').slice(0,96),vector,salience01:salience,confidence01:confidence,surprise01:surprise,focus};
this.state.history.push({at:i.at,scene:i.scene||'unknown',vector,focus,salience01:salience,confidence01:confidence}); if(this.state.history.length>96)this.state.history.splice(0,this.state.history.length-96);
this.state.metrics.grounding01=clamp(this.state.metrics.grounding01*.84+confidence*.16);
this.state.metrics.integration01=clamp(this.state.metrics.integration01*.8+Math.min(1,(entity+relation+event)/18)*.2);
this.state.metrics.temporalBinding01=clamp(this.state.metrics.temporalBinding01*.85+temporal*.15);
this.state.metrics.selfWorldCoupling01=clamp(this.state.metrics.selfWorldCoupling01*.84+((i.agency01+i.selfCoherence01+i.bodyEnergy01)/3)*.16);
this.state.metrics.activeAccess01=clamp(this.state.metrics.activeAccess01*.86+salience*.14);
this.state.metrics.updates++;
this.state.tick++;
for(const a of ACTIONS){const rawBias=a==='verify'?surprise*.045:a==='explore'?i.novelty01*.035+surprise*.015:a==='reflect'?surprise*.02+this.state.metrics.selfWorldCoupling01*.02:a==='respond'?salience*.02:a==='rest'?(1-salience)*.012:a==='defer'?surprise*.018:0;
this.state.actionBias[a]=signed(rawBias);
}return this.snapshot();
}
 bias(a:ActionKind){return this.state.actionBias[a]??0;
}
 vector(){return this.state.current.vector.slice();
}
 summary(){return {scene:this.state.current.scene,focus:this.state.current.focus,salience01:this.state.current.salience01,confidence01:this.state.current.confidence01,surprise01:this.state.current.surprise01,metrics:this.state.metrics};
}
}
