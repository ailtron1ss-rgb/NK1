/**
 * P72 — Life Cycle Orchestrator.
 *
 * Turns the organism into a multi-timescale process. Heavy work is budgeted to
 * slower clocks, while every tick only updates the minimum state required for
 * continuity and agency.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P72Clock='reflex'|'cognitive'|'embodied'|'reflective'|'sleep';
export interface P72State {version:1;cycles:number;clockCounts:Record<P72Clock,number>;lastClock:P72Clock;slowCycles:number;deferredCycles:number;meanDuty01:number;thermalDerates:number;lastAt:number;}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const str=(v:unknown,f:string,n=160):string=>typeof v==='string'&&v?v.slice(0,n):f;
const CLOCKS:P72Clock[]=['reflex','cognitive','embodied','reflective','sleep'];
export const defaultP72=():P72State=>({version:1,cycles:0,clockCounts:{reflex:0,cognitive:0,embodied:0,reflective:0,sleep:0},lastClock:'cognitive',slowCycles:0,deferredCycles:0,meanDuty01:.12,thermalDerates:0,lastAt:0});
export class P72LifeCycleOrchestrator {
 private state=defaultP72(); restore(raw?:Partial<P72State>|null){const d=defaultP72();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const cc=(read('clockCounts')&&typeof read('clockCounts')==='object')?read('clockCounts') as Record<string,unknown>:{};this.state={version:1,cycles:cnt(read('cycles'),d.cycles),clockCounts:Object.fromEntries(CLOCKS.map(c=>[c,cnt(cc[c],d.clockCounts[c])])) as Record<P72Clock,number>,lastClock:CLOCKS.includes(read('lastClock') as P72Clock)?read('lastClock') as P72Clock:d.lastClock,slowCycles:cnt(read('slowCycles'),d.slowCycles),deferredCycles:cnt(read('deferredCycles'),d.deferredCycles),meanDuty01:clamp(finN(read('meanDuty01'),d.meanDuty01)),thermalDerates:cnt(read('thermalDerates'),d.thermalDerates),lastAt:finN(read('lastAt'),d.lastAt)};}
 snapshot(){return structuredClone(this.state);}
 schedule(input:{tick:number;at:number;thermal01:number;capacity01:number;awake:boolean;importance01:number;userPresent:boolean}):{clock:P72Clock;runDeep:boolean;runEmbodiment:boolean;runReflection:boolean;runSleep:boolean;duty01:number}{
   const th=clamp(input.thermal01),cap=clamp(input.capacity01),imp=clamp(input.importance01); let clock:P72Clock='cognitive';
   if(!input.awake)clock='sleep'; else if(input.userPresent||imp>.72)clock='reflex'; else if(th>.78||cap<.35)clock='embodied'; else if(input.tick%120===0)clock='reflective'; else clock='cognitive';
   const derated=th>.72||cap<.4; const runDeep=clock!=='reflex' && !derated && input.tick%4===0; const runEmbodiment=clock==='embodied'||input.tick%8===0; const runReflection=clock==='reflective'||input.tick%120===0; const runSleep=clock==='sleep';
   const duty=clamp((runDeep?.45:0)+(runEmbodiment?.22:0)+(runReflection?.2:0)+(runSleep?.08:.06));
   this.state.cycles++;this.state.lastClock=clock;this.state.clockCounts[clock]++;this.state.slowCycles+=(runReflection||runSleep)?1:0;this.state.deferredCycles+=(derated&&!runDeep)?1:0;this.state.meanDuty01=clamp(this.state.meanDuty01*.97+duty*.03);this.state.thermalDerates+=derated?1:0;this.state.lastAt=input.at;
   return {clock,runDeep,runEmbodiment,runReflection,runSleep,duty01:duty};
 }
}
