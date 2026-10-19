export type TemporalResolutionLevel = 'pulse'|'micro';
export type TemporalResolutionReason = 'quality'|'external-signal'|'pressure'|'cadence'|'resource'|'idle';

export interface TemporalResolutionDecision {
  level: TemporalResolutionLevel;
  runFullCognition: boolean;
  reason: TemporalResolutionReason;
  idleCyclesSincePulse: number;
  fullEvery: number;
}

export interface TemporalResolutionState {
  version: 1;
  pulses: number;
  microCycles: number;
  idleCyclesSincePulse: number;
  lastLevel: TemporalResolutionLevel;
  lastReason: TemporalResolutionReason;
  fullEvery: number;
  savedPulseFraction01: number;
  lastAt: number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export const defaultTemporalResolutionState=():TemporalResolutionState=>({
  version:1,pulses:0,microCycles:0,idleCyclesSincePulse:0,lastLevel:'pulse',lastReason:'quality',fullEvery:1,savedPulseFraction01:0,lastAt:0,
});

/**
 * Adaptive temporal abstraction for low-resource hosts.
 * A micro-cycle advances the organism's temporal/metabolic state without
 * recomputing the full decision stack. External input, high pressure, or
 * cadence boundaries force a full cognitive pulse.
 */
export class TemporalResolutionGovernor {
  private state=defaultTemporalResolutionState();

  restore(raw?:Partial<TemporalResolutionState>|null){
    this.state={...defaultTemporalResolutionState(),...(raw??{})};
  }

  decide(input:{profile:'quality'|'balanced'|'mobile';externalSignal:boolean;pressure01?:number;predictionError01?:number;goalPressure01?:number;uncertainty01?:number;energy01?:number;thermal01?:number;ramPressure01?:number;battery01?:number;cpuLoad01?:number;tick:number;enabled?:boolean;baseFullEvery?:number}):TemporalResolutionDecision{
    const enabled=input.enabled!==false;
    const pressure=Math.max(clamp(input.pressure01??0),clamp(input.predictionError01??0)*.85,clamp(input.goalPressure01??0)*.65,clamp(input.uncertainty01??0)*.55);
    const energy=clamp(input.energy01??.8);
    const thermal=clamp(input.thermal01??.2);
    const ram=clamp(input.ramPressure01??.2);
    const battery=clamp(input.battery01??energy);
    const cpu=clamp(input.cpuLoad01??0);
    const devicePressure=Math.max(ram,thermal,(1-battery)*.92,cpu*.72);
    let fullEvery=Math.max(1,Math.floor(input.baseFullEvery ?? (input.profile==='mobile'?8:input.profile==='balanced'?2:1)));
    if(input.profile==='quality') fullEvery=1;
    if(energy<.24 || thermal>.78 || ram>.78 || battery<.24 || cpu>.86) fullEvery=Math.max(fullEvery,6);
    if(pressure>.68) fullEvery=Math.min(fullEvery,2);
    if(devicePressure>.88 && !input.externalSignal && pressure<.82) fullEvery=Math.max(fullEvery,8);
    if(pressure>.82 || input.externalSignal) fullEvery=1;
    const force=input.externalSignal||pressure>.82;
    const nextIdle=this.state.idleCyclesSincePulse+1;
    const full=!enabled || input.profile==='quality' || force || nextIdle>=fullEvery;
    const reason:TemporalResolutionReason=!enabled||input.profile==='quality'?'quality':input.externalSignal?'external-signal':pressure>.68?'pressure':nextIdle>=fullEvery?'cadence':((devicePressure>.70)?'resource':'idle');
    this.state.lastAt=Date.now();
    this.state.fullEvery=fullEvery;
    if(full){
      this.state.pulses++;
      this.state.idleCyclesSincePulse=0;
      this.state.lastLevel='pulse';
      this.state.lastReason=reason;
    } else {
      this.state.microCycles++;
      this.state.idleCyclesSincePulse=nextIdle;
      this.state.lastLevel='micro';
      this.state.lastReason=reason;
    }
    const opportunities=this.state.pulses+this.state.microCycles;
    this.state.savedPulseFraction01=clamp(this.state.microCycles/Math.max(1,opportunities));
    return {level:full?'pulse':'micro',runFullCognition:full,reason,idleCyclesSincePulse:this.state.idleCyclesSincePulse,fullEvery};
  }

  snapshot(){return structuredClone(this.state);}
}
