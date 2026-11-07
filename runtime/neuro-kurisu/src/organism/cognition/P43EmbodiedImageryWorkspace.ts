import type { ActionKind } from '../core/types.ts';

const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

const ACTIONS:ActionKind[]=['respond','explore','verify','rest','reflect','wait','defer'];

export interface P43State{version:1;
tick:number;
scene:{label:string;
selfLocation:string;
objects:string[];
relations:string[];
at:number};
activeContents:Array<{id:string;
label:string;
source:'perception'|'memory'|'prediction'|'self';
salience01:number;
confidence01:number;
at:number}>;
imagined:Array<{action:ActionKind;
expectedScene:string;
expectedValue01:number;
confidence01:number;
at:number}>;
actionBias:Record<ActionKind,number>;
metrics:{workspaceUse01:number;
sceneBinding01:number;
selfGrounding01:number;
simulationConsistency01:number;
updates:number};
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const sanBias=(v:unknown,fb:Record<ActionKind,number>):Record<ActionKind,number>=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};return Object.fromEntries(ACTIONS.map(a=>[a,Math.max(-1,Math.min(1,finN(r[a],fb[a])))])) as Record<ActionKind,number>;};
const SOURCES:Array<'perception'|'memory'|'prediction'|'self'>=['perception','memory','prediction','self'];
export const defaultP43=():P43State=>({version:1,tick:0,scene:{label:'unknown',selfLocation:'host-local',objects:[],relations:[],at:0},activeContents:[],imagined:[],actionBias:Object.fromEntries(ACTIONS.map(a=>[a,0])) as Record<ActionKind,number>,metrics:{workspaceUse01:.1,sceneBinding01:.1,selfGrounding01:.1,simulationConsistency01:.2,updates:0}});

function id(s:string){let h=2166136261;
for(let i=0;
i<s.length;
i++){h^=s.charCodeAt(i);
h=Math.imul(h,16777619);
}return `pc-${(h>>>0).toString(16).padStart(8,'0')}`;
}
export class P43EmbodiedImageryWorkspace{
 private state=defaultP43();

 restore(raw?:Partial<P43State>|null){const d=defaultP43();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
const scRaw=(read('scene')&&typeof read('scene')==='object')?read('scene') as Record<string,unknown>:{};
const acRaw=read('activeContents'),imRaw=read('imagined');
const mRaw=(read('metrics')&&typeof read('metrics')==='object')?read('metrics') as Record<string,unknown>:{};
this.state={version:1,tick:cnt(read('tick'),d.tick),scene:{label:str(scRaw.label,d.scene.label),selfLocation:str(scRaw.selfLocation,d.scene.selfLocation),objects:Array.isArray(scRaw.objects)?(scRaw.objects as unknown[]).filter(v=>typeof v==='string').slice(0,64) as string[]:d.scene.objects,relations:Array.isArray(scRaw.relations)?(scRaw.relations as unknown[]).filter(v=>typeof v==='string').slice(0,64) as string[]:d.scene.relations,at:finN(scRaw.at,d.scene.at)},activeContents:Array.isArray(acRaw)?(acRaw as unknown[]).slice(-96).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {id:str(r.id,'pc-00000000'),label:str(r.label,'unknown'),source:SOURCES.includes(r.source as typeof SOURCES[number])?r.source as typeof SOURCES[number]:'perception',salience01:clamp(finN(r.salience01,.1)),confidence01:clamp(finN(r.confidence01,.1)),at:finN(r.at,0)};}):[],imagined:Array.isArray(imRaw)?(imRaw as unknown[]).slice(-64).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {action:ACTIONS.includes(r.action as ActionKind)?r.action as ActionKind:'wait',expectedScene:str(r.expectedScene,'unknown'),expectedValue01:Math.max(-1,Math.min(1,finN(r.expectedValue01,0))),confidence01:clamp(finN(r.confidence01,.1)),at:finN(r.at,0)};}):[],actionBias:sanBias(read('actionBias'),d.actionBias),metrics:{workspaceUse01:clamp(finN(mRaw.workspaceUse01,d.metrics.workspaceUse01)),sceneBinding01:clamp(finN(mRaw.sceneBinding01,d.metrics.sceneBinding01)),selfGrounding01:clamp(finN(mRaw.selfGrounding01,d.metrics.selfGrounding01)),simulationConsistency01:clamp(finN(mRaw.simulationConsistency01,d.metrics.simulationConsistency01)),updates:cnt(mRaw.updates,d.metrics.updates)}};
}
 snapshot(){return structuredClone(this.state);
}
 integrate(input:{at:number;
scene:string;
selfLocation:string;
objects:string[];
relations:string[];
memoryLabels:string[];
predictionLabels:string[];
goal:string}){const same=this.state.scene.label===input.scene;
const confidence=clamp(.35+Math.min(12,input.objects.length)*.035+Math.min(8,input.relations.length)*.035);
this.state.scene={label:(input.scene||'unknown').slice(0,96),selfLocation:(input.selfLocation||'host-local').slice(0,96),objects:input.objects.slice(0,64),relations:input.relations.slice(0,64),at:input.at};
const contents=[...input.objects.map(x=>({label:x,source:'perception' as const,s:.65})),...input.memoryLabels.slice(0,8).map(x=>({label:x,source:'memory' as const,s:.48})),...input.predictionLabels.slice(0,8).map(x=>({label:x,source:'prediction' as const,s:.5}))].slice(0,32);
this.state.activeContents=[...contents.map(x=>({id:id(`${x.source}:${x.label}`),label:x.label,source:x.source,salience01:clamp(x.s),confidence01:confidence,at:input.at})),...this.state.activeContents].slice(0,96);
const goal=input.goal.toLowerCase();
const active=ACTIONS.map(a=>({action:a,expectedScene:`${input.scene}→${a}`,expectedValue01:clamp(.45+(a==='explore'&&/learn|research|discover/.test(goal)?.16:0)+(a==='verify'&&input.relations.length>0?.12:0)+(a==='reflect'&&input.memoryLabels.length>0?.09:0)+(a==='rest'&&input.objects.length===0?.06:0)),confidence01:confidence,at:input.at}));
this.state.imagined=active;
for(const r of active)this.state.actionBias[r.action]=clamp((r.expectedValue01-.5)*.065);
this.state.metrics.workspaceUse01=clamp(this.state.metrics.workspaceUse01*.84+.16*Math.min(1,contents.length/10));
this.state.metrics.sceneBinding01=clamp(this.state.metrics.sceneBinding01*.85+(same?.88:.44)*.15);
this.state.metrics.selfGrounding01=clamp(this.state.metrics.selfGrounding01*.84+((input.selfLocation&&input.selfLocation!=='unknown')?.9:.2)*.16);
this.state.metrics.simulationConsistency01=clamp(this.state.metrics.simulationConsistency01*.9+confidence*.1);
this.state.metrics.updates++;
this.state.tick++;
return this.snapshot();
}
 bias(a:ActionKind){return this.state.actionBias[a]??0;
}
}
