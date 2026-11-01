/** BIG PASS 224 — continuous autonomous runtime. */

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export type AmbientMode='active'|'observe'|'reflect'|'recover'|'idle';
export interface AutonomousRuntimeLifeState{version:1;ticks:number;ambientCycles:number;selfStartedCycles:number;externallyTriggeredCycles:number;idleGapCycles:number;
continuedAfterSilence:number;selfAuthoredActivity01:number;temporalPersistence01:number;environmentalAgency01:number;meanAutonomy01:number;meanOutcome01:number;
lastMode:AmbientMode;lastReason:string;lastActivity:string|null;lastAt:number;nextWakeAt:number;sleepUntil:number;streak:number;longestStreak:number;recent:Array<{tick:number;
mode:AmbientMode;reason:string;autonomous:boolean;outcome01:number;at:number}>}
export const defaultAutonomousRuntimeLife=():AutonomousRuntimeLifeState=>({version:1,ticks:0,ambientCycles:0,selfStartedCycles:0,externallyTriggeredCycles:0,idleGapCycles:0,continuedAfterSilence:0,selfAuthoredActivity01:.35,temporalPersistence01:.28,environmentalAgency01:.3,meanAutonomy01:.4,meanOutcome01:.5,lastMode:'idle',lastReason:'initial',lastActivity:null,lastAt:0,nextWakeAt:0,sleepUntil:0,streak:0,longestStreak:0,recent:[]});

type UnknownRecord = Record<string, unknown>;
const AMBIENT_MODES: readonly AmbientMode[] = ['active', 'observe', 'reflect', 'recover', 'idle'];
const ACTIVITIES = ['explore', 'verify', 'reflect', 'rest'] as const;

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownDataValue(record: UnknownRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function safeCounter(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function safeTimestamp(value: unknown, fallback: number): number {
  return safeCounter(value, fallback);
}

function safeUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback;
}

function safeText(value: unknown, fallback: string, maxLength = 160): string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : fallback;
}

function normalizeRecent(value: unknown): AutonomousRuntimeLifeState['recent'] {
  if (!Array.isArray(value)) return [];
  const result: AutonomousRuntimeLifeState['recent'] = [];
  const start = Math.max(0, value.length - 96);
  for (let index = start; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !isPlainRecord(descriptor.value)) continue;
    const row = descriptor.value;
    const tick = ownDataValue(row, 'tick');
    const mode = ownDataValue(row, 'mode');
    const reason = ownDataValue(row, 'reason');
    const autonomous = ownDataValue(row, 'autonomous');
    const outcome01 = ownDataValue(row, 'outcome01');
    const at = ownDataValue(row, 'at');
    if (!Number.isSafeInteger(tick) || Number(tick) < 0
      || typeof mode !== 'string' || !AMBIENT_MODES.includes(mode as AmbientMode)
      || typeof reason !== 'string' || !reason.trim() || reason.length > 160
      || typeof autonomous !== 'boolean'
      || typeof outcome01 !== 'number' || !Number.isFinite(outcome01)
      || !Number.isSafeInteger(at) || Number(at) < 0) continue;
    result.push({
      tick: Number(tick),
      mode: mode as AmbientMode,
      reason: reason.trim(),
      autonomous,
      outcome01: clamp(outcome01),
      at: Number(at),
    });
  }
  return result;
}

export class AutonomousRuntimeLifeController{
   private state=defaultAutonomousRuntimeLife();

  restore(raw?:Partial<AutonomousRuntimeLifeState>|null){
    const defaults = defaultAutonomousRuntimeLife();
    try {
      if (!isPlainRecord(raw)) {
        this.state = defaults;
        return;
      }
      const read = (key: string) => ownDataValue(raw, key);
      const mode = read('lastMode');
      const activity = read('lastActivity');
      this.state = {
        ...defaults,
        ticks: safeCounter(read('ticks'), defaults.ticks),
        ambientCycles: safeCounter(read('ambientCycles'), defaults.ambientCycles),
        selfStartedCycles: safeCounter(read('selfStartedCycles'), defaults.selfStartedCycles),
        externallyTriggeredCycles: safeCounter(read('externallyTriggeredCycles'), defaults.externallyTriggeredCycles),
        idleGapCycles: safeCounter(read('idleGapCycles'), defaults.idleGapCycles),
        continuedAfterSilence: safeCounter(read('continuedAfterSilence'), defaults.continuedAfterSilence),
        selfAuthoredActivity01: safeUnit(read('selfAuthoredActivity01'), defaults.selfAuthoredActivity01),
        temporalPersistence01: safeUnit(read('temporalPersistence01'), defaults.temporalPersistence01),
        environmentalAgency01: safeUnit(read('environmentalAgency01'), defaults.environmentalAgency01),
        meanAutonomy01: safeUnit(read('meanAutonomy01'), defaults.meanAutonomy01),
        meanOutcome01: safeUnit(read('meanOutcome01'), defaults.meanOutcome01),
        lastMode: typeof mode === 'string' && AMBIENT_MODES.includes(mode as AmbientMode) ? mode as AmbientMode : defaults.lastMode,
        lastReason: safeText(read('lastReason'), defaults.lastReason),
        lastActivity: activity === null ? null
          : typeof activity === 'string' && ACTIVITIES.includes(activity as typeof ACTIVITIES[number])
            ? activity as typeof ACTIVITIES[number]
            : defaults.lastActivity,
        lastAt: safeTimestamp(read('lastAt'), defaults.lastAt),
        nextWakeAt: safeTimestamp(read('nextWakeAt'), defaults.nextWakeAt),
        sleepUntil: safeTimestamp(read('sleepUntil'), defaults.sleepUntil),
        streak: safeCounter(read('streak'), defaults.streak),
        longestStreak: safeCounter(read('longestStreak'), defaults.longestStreak),
        recent: normalizeRecent(read('recent')),
        version: 1,
      };
    } catch {
      // Malformed proxies or accessor-backed snapshots must not abort runtime startup.
      this.state = defaults;
    }
  }

  snapshot(){return structuredClone(this.state);}

    tick(input:{tick:number;at:number;externalSignal:boolean;energy01:number;uncertainty01:number;novelty01:number;goalPressure01:number;homeostaticPressure01:number;
  initiative01:number;predictionError01:number;resourcePressure01:number}){this.state.ticks++;const previousActivityAt=this.state.lastAt;const silence=!input.externalSignal;
  if(input.externalSignal)this.state.externallyTriggeredCycles++;if(silence)this.state.ambientCycles++;
  const pressure=clamp(input.goalPressure01*.28+input.uncertainty01*.2+input.novelty01*.16+input.initiative01*.2+input.homeostaticPressure01*.16+input.predictionError01*.12);
  const exhausted=clamp((1-input.energy01)*.52+input.resourcePressure01*.48+Math.max(0,input.homeostaticPressure01-.78)*.4);
  if(input.at<this.state.sleepUntil){this.state.lastMode='recover';this.state.lastReason='recovery-window';this.state.nextWakeAt=this.state.sleepUntil;
  return{shouldAct:false,mode:'recover' as const,reason:'recovery-window',activity:'rest' as const,autonomous:silence,nextWakeAt:this.state.sleepUntil};
  }const wakeInterval=Math.round(7000+clamp(1-pressure)*9000+clamp(input.homeostaticPressure01)*6000);const due=input.at>=this.state.nextWakeAt;
  // Internal work is cadence-gated; a real external signal remains immediately reactive.
  if(!due&&silence){this.state.lastMode='idle';this.state.lastReason='waiting-for-cadence';
  return{shouldAct:false,mode:'idle' as const,reason:'waiting-for-cadence',activity:null,autonomous:false,nextWakeAt:this.state.nextWakeAt};
  }if(exhausted>.76||input.energy01<.16||input.homeostaticPressure01>.92){this.state.lastMode='recover';this.state.lastReason='self-preservation';
  this.state.sleepUntil=input.at+Math.round(9000+exhausted*12000);this.state.nextWakeAt=this.state.sleepUntil;this.state.streak=0;
  return{shouldAct:false,mode:'recover' as const,reason:'self-preservation',activity:'rest' as const,autonomous:silence,nextWakeAt:this.state.sleepUntil};
  }let mode:AmbientMode='observe';let activity:'explore'|'verify'|'reflect'|'rest'|null='explore';if(input.homeostaticPressure01>.62||input.energy01<.32){mode='recover';
  activity='rest';}else if(input.uncertainty01>.64||input.predictionError01>.58){mode='observe';activity='verify';}else if(input.novelty01>.58){mode='active';activity='explore';
  }else if(input.goalPressure01>.58||input.initiative01>.58){mode='active';activity='explore';}else{mode='reflect';activity='reflect';}const autonomous=silence;
  if(autonomous){this.state.selfStartedCycles++;if(previousActivityAt>0&&input.at>previousActivityAt)this.state.continuedAfterSilence++;}if(autonomous&&this.state.lastMode!=='idle')this.state.idleGapCycles++;
  this.state.streak++;this.state.longestStreak=Math.max(this.state.longestStreak,this.state.streak);
  this.state.selfAuthoredActivity01=clamp(this.state.selfAuthoredActivity01*.93+(autonomous?.92:.22)*.07);
  this.state.temporalPersistence01=clamp(this.state.temporalPersistence01*.92+(this.state.streak>1?.86:.62)*.08);
  this.state.environmentalAgency01=clamp(this.state.environmentalAgency01*.92+((activity==='explore'||activity==='verify')?.8:.58)*.08);
  this.state.meanAutonomy01=clamp(this.state.meanAutonomy01*.94+(autonomous?.95:.3)*.06);this.state.lastMode=mode;this.state.lastActivity=activity;
  this.state.lastReason=autonomous?'internally-derived-ambient-activity':'external-cycle';this.state.lastAt=input.at;this.state.nextWakeAt=input.at+wakeInterval;
  this.state.recent=[{tick:input.tick,mode,reason:this.state.lastReason,autonomous,outcome01:.5,at:input.at},...this.state.recent].slice(0,96);
  return{shouldAct:true,mode,reason:this.state.lastReason,activity,autonomous,nextWakeAt:this.state.nextWakeAt};}

    observeOutcome(outcome01:number,at:number){const q=clamp(outcome01);this.state.meanOutcome01=clamp(this.state.meanOutcome01*.9+q*.1);
  if(this.state.recent[0])this.state.recent[0]={...this.state.recent[0],outcome01:q};this.state.lastAt=at;}

    summary(){return{ticks:this.state.ticks,ambientCycles:this.state.ambientCycles,selfStartedCycles:this.state.selfStartedCycles,externallyTriggeredCycles:this.state.externallyTriggeredCycles,idleGapCycles:this.state.idleGapCycles,continuedAfterSilence:this.state.continuedAfterSilence,selfAuthoredActivity01:this.state.selfAuthoredActivity01,temporalPersistence01:this.state.temporalPersistence01,environmentalAgency01:this.state.environmentalAgency01,meanAutonomy01:this.state.meanAutonomy01,meanOutcome01:this.state.meanOutcome01,lastMode:this.state.lastMode,lastReason:this.state.lastReason,streak:this.state.streak,longestStreak:this.state.longestStreak,nextWakeAt:this.state.nextWakeAt};
  }
}
