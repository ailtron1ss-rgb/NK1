/**
 * P66 — Interoceptive Homeostasis.
 *
 * Converts raw body telemetry into a small, persistent internal-regulation state.
 * Setpoints are not treated as emotions or consciousness; they are control targets
 * whose deviations can alter cognition, rest, exploration and protection pressure.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type P66Mode='recover'|'protect'|'balance'|'engage'|'explore';
export interface P66State {
  version:1;cycles:number;modeCounts:Record<P66Mode,number>;meanError01:number;meanStress01:number;
  meanCapacity01:number;lastCapacity01:number;lastError01:number;lastStress01:number;lastPressure01:number;recoveryDebt01:number;stableCycles:number;lastMode:P66Mode;lastAt:number;
  setpoints:{energy01:number;thermal01:number;capacity01:number;load01:number;awake01:number};
  history:Array<{at:number;tick:number;error01:number;stress01:number;mode:P66Mode;energy01:number;thermal01:number;capacity01:number}>;
}
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const MODES:P66Mode[]=['recover','protect','balance','engage','explore'];
export const defaultP66=():P66State=>({version:1,cycles:0,modeCounts:{recover:0,protect:0,balance:0,engage:0,explore:0},meanError01:.3,meanStress01:.25,meanCapacity01:.7,lastCapacity01:.7,lastError01:.3,lastStress01:.25,lastPressure01:.3,recoveryDebt01:.18,stableCycles:0,lastMode:'balance',lastAt:0,setpoints:{energy01:.68,thermal01:.25,capacity01:.72,load01:.38,awake01:1},history:[]});
export class P66InteroceptiveHomeostasis {
 private state=defaultP66();
 restore(raw?:Partial<P66State>|null){const d=defaultP66();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};
const mc=(read('modeCounts')&&typeof read('modeCounts')==='object')?read('modeCounts') as Record<string,unknown>:{};
const sp=(read('setpoints')&&typeof read('setpoints')==='object')?read('setpoints') as Record<string,unknown>:{};
const hRaw=read('history');
this.state={version:1,cycles:cnt(read('cycles'),d.cycles),modeCounts:Object.fromEntries(MODES.map(m=>[m,cnt(mc[m],d.modeCounts[m])])) as Record<P66Mode,number>,meanError01:clamp(finN(read('meanError01'),d.meanError01)),meanStress01:clamp(finN(read('meanStress01'),d.meanStress01)),meanCapacity01:clamp(finN(read('meanCapacity01'),d.meanCapacity01)),lastCapacity01:clamp(finN(read('lastCapacity01'),d.lastCapacity01)),lastError01:clamp(finN(read('lastError01'),d.lastError01)),lastStress01:clamp(finN(read('lastStress01'),d.lastStress01)),lastPressure01:clamp(finN(read('lastPressure01'),d.lastPressure01)),recoveryDebt01:clamp(finN(read('recoveryDebt01'),d.recoveryDebt01)),stableCycles:cnt(read('stableCycles'),d.stableCycles),lastMode:MODES.includes(read('lastMode') as P66Mode)?read('lastMode') as P66Mode:d.lastMode,lastAt:finN(read('lastAt'),d.lastAt),
setpoints:{energy01:clamp(finN(sp.energy01,d.setpoints.energy01)),thermal01:clamp(finN(sp.thermal01,d.setpoints.thermal01)),capacity01:clamp(finN(sp.capacity01,d.setpoints.capacity01)),load01:clamp(finN(sp.load01,d.setpoints.load01)),awake01:clamp(finN(sp.awake01,d.setpoints.awake01))},
history:Array.isArray(hRaw)?(hRaw as unknown[]).slice(-128).filter(v=>v&&typeof v==='object').map(v=>{const r=v as Record<string,unknown>;return {at:finN(r.at,0),tick:cnt(r.tick,0),error01:clamp(finN(r.error01,0)),stress01:clamp(finN(r.stress01,0)),mode:MODES.includes(r.mode as P66Mode)?r.mode as P66Mode:d.lastMode,energy01:clamp(finN(r.energy01,0)),thermal01:clamp(finN(r.thermal01,0)),capacity01:clamp(finN(r.capacity01,0))};}):[]};
}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){
  return {...this.state,modeCounts:{...this.state.modeCounts},setpoints:{...this.state.setpoints},history:this.state.history.slice(0,64).map(row=>({...row}))};
 }
 observe(input:{tick:number;at:number;energy01:number;thermal01:number;capacity01:number;load01:number;awake:boolean;uncertainty01:number;predictionError01:number;novelty01:number}):{mode:P66Mode;error01:number;stress01:number;capacity01:number;pressure01:number} {
  const e=clamp(input.energy01),t=clamp(input.thermal01),c=clamp(input.capacity01),load=clamp(input.load01),awake=input.awake;
  const sp=this.state.setpoints;
  const previousMode=this.state.lastMode;
  const previousPressure=this.state.lastPressure01;
  const energyErr=Math.abs(e-sp.energy01);
  const thermalErr=Math.max(0,t-sp.thermal01)*1.25;
  const capErr=Math.max(0,sp.capacity01-c)*1.15;
  const loadErr=Math.max(0,load-sp.load01)*.9;
  const wakeErr=awake?0:Math.abs(sp.awake01-0);
  const error=clamp(energyErr*.28+thermalErr*.24+capErr*.22+loadErr*.16+wakeErr*.10);
  const stress=clamp(error*.62+clamp(input.uncertainty01)*.16+clamp(input.predictionError01)*.14+clamp(1-c)*.08);
  let mode:P66Mode='balance';
  if(e<.28||c<.3||t>.82) mode='recover';
  else if(stress>.58||t>.65||c<.5) mode='protect';
  else if(input.novelty01>.65&&stress<.42&&c>.72) mode='explore';
  else if(stress<.28&&c>.7) mode='engage';
  this.state.cycles++;this.state.modeCounts[mode]++;this.state.lastError01=error;this.state.lastStress01=stress;this.state.lastCapacity01=c;this.state.lastMode=mode;this.state.lastAt=input.at;
  this.state.meanError01=clamp(this.state.meanError01*.97+error*.03);this.state.meanStress01=clamp(this.state.meanStress01*.97+stress*.03);this.state.meanCapacity01=clamp(this.state.meanCapacity01*.97+c*.03);
  // Slow allostatic adaptation only when the organism is stable. This avoids setpoint drift from acute stress.
  if(stress<.25){ sp.energy01=clamp(sp.energy01*.998+e*.002); sp.capacity01=clamp(sp.capacity01*.998+c*.002); sp.load01=clamp(sp.load01*.998+load*.002); }
  this.state.history=[{at:input.at,tick:input.tick,error01:error,stress01:stress,mode,energy01:e,thermal01:t,capacity01:c},...this.state.history].slice(0,128);
  const pressure=clamp(error*.52+stress*.30+(1-c)*.18);
  const recoveryDebt=clamp(this.state.recoveryDebt01*.92 + Math.max(0,pressure-.34)*.12 - Math.max(0,.22-pressure)*.045);
  const stableCycles=pressure<.28 ? this.state.stableCycles+1 : 0;
  this.state.lastPressure01=pressure;
  this.state.recoveryDebt01=recoveryDebt;
  this.state.stableCycles=stableCycles;
  // Hysteresis: do not bounce between engage/explore and protect on tiny pressure changes.
  if(previousPressure<.32 && pressure<.37 && previousMode==='explore' && input.novelty01>.45) mode='explore';
  if(previousPressure<.32 && pressure<.37 && previousMode==='engage' && input.novelty01<=.65) mode='engage';
  if(mode==='balance' && previousMode==='protect' && pressure<.5 && recoveryDebt>.12) mode='protect';
  return {mode,error01:error,stress01:stress,capacity01:c,pressure01:pressure};
 }
 summary(){return {cycles:this.state.cycles,modeCounts:this.state.modeCounts,meanError01:this.state.meanError01,meanStress01:this.state.meanStress01,meanCapacity01:this.state.meanCapacity01,lastError01:this.state.lastError01,lastStress01:this.state.lastStress01,lastPressure01:this.state.lastPressure01,recoveryDebt01:this.state.recoveryDebt01,stableCycles:this.state.stableCycles,lastMode:this.state.lastMode,setpoints:this.state.setpoints};}
}
