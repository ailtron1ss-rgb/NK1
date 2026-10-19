/** BIG PASS 224 — continuous autonomous runtime. */

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type AmbientMode='active'|'observe'|'reflect'|'recover'|'idle';
export interface AutonomousRuntimeLifeState{version:1;ticks:number;ambientCycles:number;selfStartedCycles:number;externallyTriggeredCycles:number;idleGapCycles:number;
continuedAfterSilence:number;selfAuthoredActivity01:number;temporalPersistence01:number;environmentalAgency01:number;meanAutonomy01:number;meanOutcome01:number;
lastMode:AmbientMode;lastReason:string;lastActivity:string|null;lastAt:number;nextWakeAt:number;sleepUntil:number;streak:number;longestStreak:number;recent:Array<{tick:number;
mode:AmbientMode;reason:string;autonomous:boolean;outcome01:number;at:number}>}
export const defaultAutonomousRuntimeLife=():AutonomousRuntimeLifeState=>({version:1,ticks:0,ambientCycles:0,selfStartedCycles:0,externallyTriggeredCycles:0,idleGapCycles:0,continuedAfterSilence:0,selfAuthoredActivity01:.35,temporalPersistence01:.28,environmentalAgency01:.3,meanAutonomy01:.4,meanOutcome01:.5,lastMode:'idle',lastReason:'initial',lastActivity:null,lastAt:0,nextWakeAt:0,sleepUntil:0,streak:0,longestStreak:0,recent:[]});
export class AutonomousRuntimeLifeController{
   private state=defaultAutonomousRuntimeLife();

  restore(raw?:Partial<AutonomousRuntimeLifeState>|null){const d=defaultAutonomousRuntimeLife(),r=raw??{};this.state={...d,...r,recent:Array.isArray(r.recent)?structuredClone(r.recent).slice(0,96):[],version:1};}

  snapshot(){return structuredClone(this.state);}

    tick(input:{tick:number;at:number;externalSignal:boolean;energy01:number;uncertainty01:number;novelty01:number;goalPressure01:number;homeostaticPressure01:number;
  initiative01:number;predictionError01:number;resourcePressure01:number}){this.state.ticks++;this.state.lastAt=input.at;const silence=!input.externalSignal;
  if(input.externalSignal)this.state.externallyTriggeredCycles++;if(silence)this.state.ambientCycles++;
  const pressure=clamp(input.goalPressure01*.28+input.uncertainty01*.2+input.novelty01*.16+input.initiative01*.2+input.homeostaticPressure01*.16+input.predictionError01*.12);
  const exhausted=clamp((1-input.energy01)*.52+input.resourcePressure01*.48+Math.max(0,input.homeostaticPressure01-.78)*.4);
  if(input.at<this.state.sleepUntil){this.state.lastMode='recover';this.state.lastReason='recovery-window';this.state.nextWakeAt=this.state.sleepUntil;
  return{shouldAct:false,mode:'recover' as const,reason:'recovery-window',activity:'rest' as const,autonomous:silence,nextWakeAt:this.state.sleepUntil};
  }const wakeInterval=Math.round(7000+clamp(1-pressure)*9000+clamp(input.homeostaticPressure01)*6000);const due=input.at>=this.state.nextWakeAt;
  if(!due&&!silence){this.state.lastMode='idle';this.state.lastReason='waiting-for-cadence';
  return{shouldAct:false,mode:'idle' as const,reason:'waiting-for-cadence',activity:null,autonomous:false,nextWakeAt:this.state.nextWakeAt};
  }if(exhausted>.76||input.energy01<.16||input.homeostaticPressure01>.92){this.state.lastMode='recover';this.state.lastReason='self-preservation';
  this.state.sleepUntil=input.at+Math.round(9000+exhausted*12000);this.state.nextWakeAt=this.state.sleepUntil;this.state.streak=0;
  return{shouldAct:false,mode:'recover' as const,reason:'self-preservation',activity:'rest' as const,autonomous:silence,nextWakeAt:this.state.sleepUntil};
  }let mode:AmbientMode='observe';let activity:'explore'|'verify'|'reflect'|'rest'|null='explore';if(input.homeostaticPressure01>.62||input.energy01<.32){mode='recover';
  activity='rest';}else if(input.uncertainty01>.64||input.predictionError01>.58){mode='observe';activity='verify';}else if(input.novelty01>.58){mode='active';activity='explore';
  }else if(input.goalPressure01>.58||input.initiative01>.58){mode='active';activity='explore';}else{mode='reflect';activity='reflect';}const autonomous=silence;
  if(autonomous){this.state.selfStartedCycles++;if(this.state.lastAt>0)this.state.continuedAfterSilence++;}if(autonomous&&this.state.lastMode!=='idle')this.state.idleGapCycles++;
  this.state.streak++;this.state.longestStreak=Math.max(this.state.longestStreak,this.state.streak);
  this.state.selfAuthoredActivity01=clamp(this.state.selfAuthoredActivity01*.93+(autonomous?.92:.22)*.07);
  this.state.temporalPersistence01=clamp(this.state.temporalPersistence01*.92+(this.state.streak>1?.86:.62)*.08);
  this.state.environmentalAgency01=clamp(this.state.environmentalAgency01*.92+((activity==='explore'||activity==='verify')?.8:.58)*.08);
  this.state.meanAutonomy01=clamp(this.state.meanAutonomy01*.94+(autonomous?.95:.3)*.06);this.state.lastMode=mode;this.state.lastActivity=activity;
  this.state.lastReason=autonomous?'internally-derived-ambient-activity':'external-cycle';this.state.nextWakeAt=input.at+wakeInterval;
  this.state.recent=[{tick:input.tick,mode,reason:this.state.lastReason,autonomous,outcome01:.5,at:input.at},...this.state.recent].slice(0,96);
  return{shouldAct:true,mode,reason:this.state.lastReason,activity,autonomous,nextWakeAt:this.state.nextWakeAt};}

    observeOutcome(outcome01:number,at:number){const q=clamp(outcome01);this.state.meanOutcome01=clamp(this.state.meanOutcome01*.9+q*.1);
  if(this.state.recent[0])this.state.recent[0]={...this.state.recent[0],outcome01:q};this.state.lastAt=at;}

    summary(){return{ticks:this.state.ticks,ambientCycles:this.state.ambientCycles,selfStartedCycles:this.state.selfStartedCycles,externallyTriggeredCycles:this.state.externallyTriggeredCycles,idleGapCycles:this.state.idleGapCycles,continuedAfterSilence:this.state.continuedAfterSilence,selfAuthoredActivity01:this.state.selfAuthoredActivity01,temporalPersistence01:this.state.temporalPersistence01,environmentalAgency01:this.state.environmentalAgency01,meanAutonomy01:this.state.meanAutonomy01,meanOutcome01:this.state.meanOutcome01,lastMode:this.state.lastMode,lastReason:this.state.lastReason,streak:this.state.streak,longestStreak:this.state.longestStreak,nextWakeAt:this.state.nextWakeAt};
  }
}
