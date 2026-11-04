export type BrainStateMode = 'wake'|'active'|'recovery'|'sleep';
export interface BrainstemArousalInput { tick:number; sleepPressure01:number; arousalDemand01:number; energy01:number; thermal01:number; cognitiveLoad01:number; uncertainty01:number; memoryPressure01:number; circadianWakeDrive01?:number; safetyPressure01?:number; }
export interface BrainstemArousalFrame { mode:BrainStateMode; arousal01:number; computeScale01:number; plasticityScale01:number; consolidationQuota01:number; memoryReplayScale01:number; wakeInhibition01:number; sleepNeed01:number; restorative01:number; reason:string[]; transition:string|null; }
export interface BrainstemArousalState { version:1; ticks:number; sleepCycles:number; recoveryTicks:number; protectedTicks:number; restorativeTicks:number; transitions:number; mode:BrainStateMode; arousal01:number; sleepNeed01:number; lastFrame:BrainstemArousalFrame|null; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const MODES:BrainStateMode[]=['wake','active','recovery','sleep'];
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const sanFrame=(x:unknown):BrainstemArousalFrame|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const md=r.mode;return {mode:MODES.includes(md as BrainStateMode)?md as BrainStateMode:'wake',arousal01:clamp(finN(r.arousal01,0)),computeScale01:clamp(finN(r.computeScale01,0)),plasticityScale01:clamp(finN(r.plasticityScale01,0)),consolidationQuota01:clamp(finN(r.consolidationQuota01,0)),memoryReplayScale01:clamp(finN(r.memoryReplayScale01,0)),wakeInhibition01:clamp(finN(r.wakeInhibition01,0)),sleepNeed01:clamp(finN(r.sleepNeed01,0)),restorative01:clamp(finN(r.restorative01,0)),reason:strArr(r.reason,16),transition:typeof r.transition==='string'&&r.transition?r.transition.slice(0,80):null};};
export const defaultBrainstemArousalState=():BrainstemArousalState=>({version:1,ticks:0,sleepCycles:0,recoveryTicks:0,protectedTicks:0,restorativeTicks:0,transitions:0,mode:'wake',arousal01:.68,sleepNeed01:.18,lastFrame:null});
export class BrainstemArousalSleepScheduler {
 private state=defaultBrainstemArousalState();
 restore(raw?:Partial<BrainstemArousalState>|null){const d=defaultBrainstemArousalState();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const md=read('mode');this.state={version:1,ticks:cnt(read('ticks'),d.ticks),sleepCycles:cnt(read('sleepCycles'),d.sleepCycles),recoveryTicks:cnt(read('recoveryTicks'),d.recoveryTicks),protectedTicks:cnt(read('protectedTicks'),d.protectedTicks),restorativeTicks:cnt(read('restorativeTicks'),d.restorativeTicks),transitions:cnt(read('transitions'),d.transitions),mode:MODES.includes(md as BrainStateMode)?md as BrainStateMode:d.mode,arousal01:clamp(finN(read('arousal01'),d.arousal01)),sleepNeed01:clamp(finN(read('sleepNeed01'),d.sleepNeed01)),lastFrame:sanFrame(read('lastFrame'))};}
 snapshot(){return structuredClone(this.state);}
 tick(input:BrainstemArousalInput):BrainstemArousalFrame {
  const sleep=clamp(input.sleepPressure01), demand=clamp(input.arousalDemand01), energy=clamp(input.energy01), thermal=clamp(input.thermal01), load=clamp(input.cognitiveLoad01), unc=clamp(input.uncertainty01), memory=clamp(input.memoryPressure01), circ=clamp(input.circadianWakeDrive01??.65), safety=clamp(input.safetyPressure01??0);
  const wakeDrive=clamp(.38*demand+.22*circ+.16*unc+.12*safety+.12*(1-sleep));
  const stress=clamp(.42*sleep+.22*load+.18*thermal+.10*memory+.08*(1-energy));
  const sleepNeed=clamp(this.state.sleepNeed01*.92+stress*.08-wakeDrive*.035);
  const previous=this.state.mode; let mode:BrainStateMode;
  if(sleepNeed>.78 || (sleep>.86&&energy>.12)) mode='sleep'; else if(stress>.60||thermal>.76||energy<.28) mode='recovery'; else if(wakeDrive>.63||demand>.70) mode='active'; else mode='wake';
  if(previous==='sleep'&&sleepNeed>.48&&wakeDrive<.62) mode='sleep';
  if(previous==='recovery'&&stress>.43&&thermal<.72&&energy>.32) mode='recovery';
  const transition=mode===previous?null:`${previous}->${mode}`;
  const computeScale=mode==='active'?1:mode==='wake'?.88:mode==='recovery'?.52:.18;
  const plasticityScale=mode==='active'?.92:mode==='wake'?.76:mode==='recovery'?.38:.14;
  const replay=mode==='sleep'?clamp(.58+.32*sleepNeed):mode==='recovery'?.36:mode==='wake'?.12:.05;
  const consolidation=mode==='sleep'?clamp(.62+.28*sleepNeed):mode==='recovery'?.24:mode==='active'?.08:.14;
  const arousalTarget=mode==='active'?.88:mode==='wake'?.62:mode==='recovery'?.34:.16; const arousal=clamp(this.state.arousal01*.82+arousalTarget*.18);
  const restorative=clamp(mode==='sleep'?.72+.28*sleepNeed:mode==='recovery'?.26+.24*(1-thermal):0); const wakeInhibition=mode==='sleep'?clamp(.58+.34*sleepNeed):mode==='recovery'?.28:mode==='active'?.04:.10;
  const reason:string[]=[]; if(sleepNeed>.65)reason.push('sleep-homeostasis'); if(thermal>.72)reason.push('thermal-protection'); if(energy<.30)reason.push('energy-protection'); if(load>.70)reason.push('cognitive-recovery'); if(mode==='active')reason.push('high-demand-processing'); if(mode==='sleep')reason.push('consolidation-window'); if(!reason.length)reason.push('steady-state');
  this.state.ticks++; this.state.mode=mode; this.state.arousal01=arousal; this.state.sleepNeed01=clamp(sleepNeed+(mode==='sleep'?-0.035:.015)); if(transition)this.state.transitions++; if(mode==='sleep'){this.state.sleepCycles++;this.state.restorativeTicks++;} if(mode==='recovery')this.state.recoveryTicks++; if(mode==='recovery'||mode==='sleep')this.state.protectedTicks++;
  const frame={mode,arousal01:arousal,computeScale01:computeScale,plasticityScale01:plasticityScale,consolidationQuota01:consolidation,memoryReplayScale01:replay,wakeInhibition01:wakeInhibition,sleepNeed01:this.state.sleepNeed01,restorative01:restorative,reason,transition}; this.state.lastFrame=structuredClone(frame); return structuredClone(frame);
 }
 diagnostics(){return structuredClone(this.state);}
}
