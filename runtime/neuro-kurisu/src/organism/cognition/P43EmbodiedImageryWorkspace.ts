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

 restore(raw?:Partial<P43State>|null){const d=defaultP43(),r=raw??{};
this.state={...d,...r,scene:{...d.scene,...(r.scene??{}),objects:Array.isArray(r.scene?.objects)?r.scene!.objects.slice(0,64):d.scene.objects,relations:Array.isArray(r.scene?.relations)?r.scene!.relations.slice(0,64):d.scene.relations},activeContents:Array.isArray(r.activeContents)?r.activeContents.slice(-96):[],imagined:Array.isArray(r.imagined)?r.imagined.slice(-64):[],actionBias:{...d.actionBias,...(r.actionBias??{})},metrics:{...d.metrics,...(r.metrics??{})}};
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
