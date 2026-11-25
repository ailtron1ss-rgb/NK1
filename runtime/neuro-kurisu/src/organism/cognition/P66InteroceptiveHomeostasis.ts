/**
 * P66 — Interoceptive Homeostasis.
 *
 * Converts raw body telemetry into a small, persistent internal-regulation state.
 * Setpoints are control targets, not emotions or claims about consciousness.
 * Temporal filters are normalized by elapsed time so sensor/cognitive call rate
 * does not change the organism's effective stress or recovery trajectory.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const finiteAt=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const counter=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?x:0;
const timeAlpha=(elapsedMs:number,tauMs:number)=>1-Math.exp(-Math.max(0,elapsedMs)/tauMs);
export type P66Mode='recover'|'protect'|'balance'|'engage'|'explore';
export type P66ObservationSource='body-telemetry'|'cognitive-cycle'|'unspecified';
type P66HistoryRow={at:number;tick:number;error01:number;stress01:number;mode:P66Mode;energy01:number;thermal01:number;capacity01:number;source?:P66ObservationSource;sampleId?:string};
export interface P66State {
  version:1;cycles:number;modeCounts:Record<P66Mode,number>;meanError01:number;meanStress01:number;
  meanCapacity01:number;lastCapacity01:number;lastError01:number;lastStress01:number;lastPressure01:number;recoveryDebt01:number;stableCycles:number;stableDurationMs:number;lastMode:P66Mode;lastAt:number;
  bodyTelemetryObservations:number;cognitiveObservations:number;duplicateObservations:number;outOfOrderObservations:number;invalidTimestampObservations:number;
  setpoints:{energy01:number;thermal01:number;capacity01:number;load01:number;awake01:number};
  history:P66HistoryRow[];
}
export const defaultP66=():P66State=>({
  version:1,cycles:0,modeCounts:{recover:0,protect:0,balance:0,engage:0,explore:0},
  meanError01:.3,meanStress01:.25,meanCapacity01:.7,lastCapacity01:.7,lastError01:.3,lastStress01:.25,
  lastPressure01:.3,recoveryDebt01:.18,stableCycles:0,stableDurationMs:0,lastMode:'balance',lastAt:0,
  bodyTelemetryObservations:0,cognitiveObservations:0,duplicateObservations:0,outOfOrderObservations:0,invalidTimestampObservations:0,
  setpoints:{energy01:.68,thermal01:.25,capacity01:.72,load01:.38,awake01:1},history:[],
});
export class P66InteroceptiveHomeostasis {
  private state=defaultP66();

  restore(raw?:Partial<P66State>|null){
    const d=defaultP66(),r=raw??{};
    const history=Array.isArray(r.history)?r.history.slice(0,128).filter(row=>row&&finiteAt(row.at)&&Number.isFinite(row.tick)):[];
    this.state={
      ...d,...r,
      cycles:counter(r.cycles),
      modeCounts:{...d.modeCounts,...(r.modeCounts??{})},
      setpoints:{...d.setpoints,...(r.setpoints??{})},
      history,
      lastAt:finiteAt(r.lastAt)?Number(r.lastAt):0,
      lastPressure01:clamp(Number(r.lastPressure01??d.lastPressure01)),
      recoveryDebt01:clamp(Number(r.recoveryDebt01??d.recoveryDebt01)),
      stableCycles:counter(r.stableCycles),
      stableDurationMs:counter(r.stableDurationMs),
      bodyTelemetryObservations:counter(r.bodyTelemetryObservations),
      cognitiveObservations:counter(r.cognitiveObservations),
      duplicateObservations:counter(r.duplicateObservations),
      outOfOrderObservations:counter(r.outOfOrderObservations),
      invalidTimestampObservations:counter(r.invalidTimestampObservations),
    };
  }

  snapshot(){return structuredClone(this.state);}
  persistenceSnapshot(){
    return {...this.state,modeCounts:{...this.state.modeCounts},setpoints:{...this.state.setpoints},history:this.state.history.slice(0,64).map(row=>({...row}))};
  }

  observe(input:{tick:number;at:number;energy01:number;thermal01:number;capacity01:number;load01:number;awake:boolean;uncertainty01:number;predictionError01:number;novelty01:number;source?:P66ObservationSource;sampleId?:string}):{mode:P66Mode;error01:number;stress01:number;capacity01:number;pressure01:number} {
    const source:P66ObservationSource=input.source==='body-telemetry'||input.source==='cognitive-cycle'?input.source:'unspecified';
    const sampleId=typeof input.sampleId==='string'&&input.sampleId.length>0&&input.sampleId.length<=180?input.sampleId:undefined;
    if(!finiteAt(input.at)||input.at>Date.now()+250){
      this.state.invalidTimestampObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.invalidTimestampObservations+1);
      return this.currentResult();
    }
    if(sampleId&&this.state.history.some(row=>row.source===source&&row.sampleId===sampleId)){
      this.state.duplicateObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.duplicateObservations+1);
      return this.currentResult();
    }
    if(this.state.cycles>0&&input.at<this.state.lastAt){
      this.state.outOfOrderObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.outOfOrderObservations+1);
      return this.currentResult();
    }

    const e=clamp(input.energy01),t=clamp(input.thermal01),capacity=clamp(input.capacity01),load=clamp(input.load01),awake=input.awake;
    const sp=this.state.setpoints;
    const previousMode=this.state.lastMode;
    const previousPressure=this.state.lastPressure01;
    const energyErr=Math.abs(e-sp.energy01);
    const thermalErr=Math.max(0,t-sp.thermal01)*1.25;
    const capErr=Math.max(0,sp.capacity01-capacity)*1.15;
    const loadErr=Math.max(0,load-sp.load01)*.9;
    const wakeErr=awake?0:Math.abs(sp.awake01-0);
    const error=clamp(energyErr*.28+thermalErr*.24+capErr*.22+loadErr*.16+wakeErr*.10);
    const stress=clamp(error*.62+clamp(input.uncertainty01)*.16+clamp(input.predictionError01)*.14+clamp(1-capacity)*.08);
    const pressure=clamp(error*.52+stress*.30+(1-capacity)*.18);
    let mode:P66Mode='balance';
    if(e<.28||capacity<.3||t>.82) mode='recover';
    else if(stress>.58||t>.65||capacity<.5) mode='protect';
    else if(input.novelty01>.65&&stress<.42&&capacity>.72) mode='explore';
    else if(stress<.28&&capacity>.7) mode='engage';

    const elapsedMs=this.elapsed(input.at);
    const proposedRecoveryDebt=this.timeNormalizedDebt(pressure,elapsedMs);
    if(previousPressure<.32&&pressure<.37&&previousMode==='explore'&&input.novelty01>.45) mode='explore';
    if(previousPressure<.32&&pressure<.37&&previousMode==='engage'&&input.novelty01<=.65) mode='engage';
    if(mode==='balance'&&previousMode==='protect'&&pressure<.5&&proposedRecoveryDebt>.12) mode='protect';

    const errorAlpha=timeAlpha(elapsedMs,30_000);
    const stressAlpha=timeAlpha(elapsedMs,30_000);
    const capacityAlpha=timeAlpha(elapsedMs,60_000);
    const stable=pressure<.28;
    const stableElapsedMs=this.state.cycles===0?0:elapsedMs;
    const stableDurationMs=stable?Math.min(Number.MAX_SAFE_INTEGER,this.state.stableDurationMs+stableElapsedMs):0;
    this.state.cycles=Math.min(Number.MAX_SAFE_INTEGER,this.state.cycles+1);
    this.state.modeCounts[mode]=Math.min(Number.MAX_SAFE_INTEGER,(this.state.modeCounts[mode]??0)+1);
    if(source==='body-telemetry')this.state.bodyTelemetryObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.bodyTelemetryObservations+1);
    if(source==='cognitive-cycle')this.state.cognitiveObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.cognitiveObservations+1);
    this.state.lastError01=error;
    this.state.lastStress01=stress;
    this.state.lastCapacity01=capacity;
    this.state.lastMode=mode;
    this.state.lastAt=input.at;
    this.state.meanError01=clamp(this.state.meanError01+(error-this.state.meanError01)*errorAlpha);
    this.state.meanStress01=clamp(this.state.meanStress01+(stress-this.state.meanStress01)*stressAlpha);
    this.state.meanCapacity01=clamp(this.state.meanCapacity01+(capacity-this.state.meanCapacity01)*capacityAlpha);

    if(stress<.25){
      const adaptation=timeAlpha(elapsedMs,5*60_000);
      sp.energy01=clamp(sp.energy01+(e-sp.energy01)*adaptation);
      sp.capacity01=clamp(sp.capacity01+(capacity-sp.capacity01)*adaptation);
      sp.load01=clamp(sp.load01+(load-sp.load01)*adaptation);
    }
    this.state.history=[{at:input.at,tick:input.tick,error01:error,stress01:stress,mode,energy01:e,thermal01:t,capacity01:capacity,source,...(sampleId?{sampleId}:{})},...this.state.history].slice(0,128);
    this.state.lastPressure01=pressure;
    this.state.recoveryDebt01=proposedRecoveryDebt;
    this.state.stableCycles=stable?this.state.stableCycles+1:0;
    this.state.stableDurationMs=stableDurationMs;
    return {mode,error01:error,stress01:stress,capacity01:capacity,pressure01:pressure};
  }

  private elapsed(at:number):number{
    if(this.state.cycles===0)return 1_000;
    return Math.min(5*60_000,Math.max(0,at-this.state.lastAt));
  }
  private timeNormalizedDebt(pressure:number,elapsedMs:number):number{
    const target=clamp((pressure-.22)/.55);
    const tau=target>this.state.recoveryDebt01?12_000:45_000;
    const alpha=timeAlpha(elapsedMs,tau);
    return clamp(this.state.recoveryDebt01+(target-this.state.recoveryDebt01)*alpha);
  }
  private currentResult(){
    return {mode:this.state.lastMode,error01:this.state.lastError01,stress01:this.state.lastStress01,capacity01:this.state.lastCapacity01,pressure01:this.state.lastPressure01};
  }
  summary(){return {cycles:this.state.cycles,modeCounts:this.state.modeCounts,meanError01:this.state.meanError01,meanStress01:this.state.meanStress01,meanCapacity01:this.state.meanCapacity01,lastError01:this.state.lastError01,lastStress01:this.state.lastStress01,lastPressure01:this.state.lastPressure01,recoveryDebt01:this.state.recoveryDebt01,stableCycles:this.state.stableCycles,stableDurationMs:this.state.stableDurationMs,bodyTelemetryObservations:this.state.bodyTelemetryObservations,cognitiveObservations:this.state.cognitiveObservations,duplicateObservations:this.state.duplicateObservations,outOfOrderObservations:this.state.outOfOrderObservations,invalidTimestampObservations:this.state.invalidTimestampObservations,lastMode:this.state.lastMode,setpoints:this.state.setpoints};}
}
