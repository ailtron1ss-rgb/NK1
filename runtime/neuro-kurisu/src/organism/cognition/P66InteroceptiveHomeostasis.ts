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
const P66_MODES=['recover','protect','balance','engage','explore'] as const;
const isMode=(x:unknown):x is P66Mode=>typeof x==='string'&&(P66_MODES as readonly string[]).includes(x);
const P66_SOURCES=['body-telemetry','cognitive-cycle','unspecified'] as const;
const isSource=(x:unknown):x is P66ObservationSource=>typeof x==='string'&&(P66_SOURCES as readonly string[]).includes(x);
const boundedOr=(x:unknown,fallback:number)=>typeof x==='number'&&Number.isFinite(x)?clamp(x):fallback;
/** Copy only own data properties; a corrupt persisted object must not execute accessors. */
const ownRecord=(value:unknown):Record<string,unknown>|null=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  try{
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const result:Record<string,unknown>=Object.create(null);
    for(const [key,descriptor] of Object.entries(descriptors)){
      if(!('value' in descriptor))return null;
      result[key]=descriptor.value;
    }
    return result;
  }catch{return null;}
};
const timeAlpha=(elapsedMs:number,tauMs:number)=>1-Math.exp(-Math.max(0,elapsedMs)/tauMs);
const MAX_ELAPSED_MS=24*60*60_000;
const MAX_STABLE_GAP_MS=60_000;
export type P66Mode='recover'|'protect'|'balance'|'engage'|'explore';
export type P66ObservationSource='body-telemetry'|'cognitive-cycle'|'unspecified';
type P66HistoryRow={at:number;tick:number;error01:number;stress01:number;mode:P66Mode;energy01:number;thermal01:number;capacity01:number;source?:P66ObservationSource;sampleId?:string};
export interface P66State {
  version:1;cycles:number;modeCounts:Record<P66Mode,number>;meanError01:number;meanStress01:number;
  meanCapacity01:number;lastCapacity01:number;lastError01:number;lastStress01:number;lastPressure01:number;recoveryDebt01:number;stableCycles:number;stableDurationMs:number;lastMode:P66Mode;lastAt:number;
  bodyTelemetryObservations:number;cognitiveObservations:number;duplicateObservations:number;outOfOrderObservations:number;invalidTimestampObservations:number;invalidValueObservations:number;
  setpoints:{energy01:number;thermal01:number;capacity01:number;load01:number;awake01:number};
  history:P66HistoryRow[];
}
export const defaultP66=():P66State=>({
  version:1,cycles:0,modeCounts:{recover:0,protect:0,balance:0,engage:0,explore:0},
  meanError01:.3,meanStress01:.25,meanCapacity01:.7,lastCapacity01:.7,lastError01:.3,lastStress01:.25,
  lastPressure01:.3,recoveryDebt01:.18,stableCycles:0,stableDurationMs:0,lastMode:'balance',lastAt:0,
  bodyTelemetryObservations:0,cognitiveObservations:0,duplicateObservations:0,outOfOrderObservations:0,invalidTimestampObservations:0,invalidValueObservations:0,
  setpoints:{energy01:.68,thermal01:.25,capacity01:.72,load01:.38,awake01:1},history:[],
});
export class P66InteroceptiveHomeostasis {
  private state=defaultP66();

  restore(raw?:Partial<P66State>|null){
    const d=defaultP66(),r=ownRecord(raw)??{};
    const now=Date.now();
    const validTimebase=finiteAt(r.lastAt)&&Number(r.lastAt)<=now+250;
    const rawCounts=ownRecord(r.modeCounts)??Object.create(null);
    const modeCounts:Record<P66Mode,number>={...d.modeCounts};
    for(const mode of P66_MODES) modeCounts[mode]=counter(rawCounts[mode]);
    const rawSetpoints=ownRecord(r.setpoints)??Object.create(null);
    const setpoints={
      energy01:boundedOr(rawSetpoints.energy01,d.setpoints.energy01),
      thermal01:boundedOr(rawSetpoints.thermal01,d.setpoints.thermal01),
      capacity01:boundedOr(rawSetpoints.capacity01,d.setpoints.capacity01),
      load01:boundedOr(rawSetpoints.load01,d.setpoints.load01),
      awake01:boundedOr(rawSetpoints.awake01,d.setpoints.awake01),
    };
    const history:P66HistoryRow[]=[];
    if(validTimebase&&Array.isArray(r.history)){
      for(const item of r.history.slice(0,128)){
        const row=ownRecord(item);
        if(!row||!finiteAt(row.at)||Number(row.at)>now+250||!Number.isSafeInteger(row.tick)||Number(row.tick)<0||!isMode(row.mode))continue;
        const values=[row.error01,row.stress01,row.energy01,row.thermal01,row.capacity01];
        if(!values.every(value=>typeof value==='number'&&Number.isFinite(value)))continue;
        const source=isSource(row.source)?row.source:'unspecified';
        const sampleId=typeof row.sampleId==='string'&&row.sampleId.length>0&&row.sampleId.length<=180?row.sampleId:undefined;
        history.push({
          at:Number(row.at),tick:Number(row.tick),error01:clamp(row.error01 as number),
          stress01:clamp(row.stress01 as number),mode:row.mode,
          energy01:clamp(row.energy01 as number),thermal01:clamp(row.thermal01 as number),
          capacity01:clamp(row.capacity01 as number),source,...(sampleId?{sampleId}:{})
        });
      }
    }
    this.state={
      version:1,
      cycles:validTimebase?counter(r.cycles):0,
      modeCounts,
      meanError01:boundedOr(r.meanError01,d.meanError01),
      meanStress01:boundedOr(r.meanStress01,d.meanStress01),
      meanCapacity01:boundedOr(r.meanCapacity01,d.meanCapacity01),
      lastCapacity01:boundedOr(r.lastCapacity01,d.lastCapacity01),
      lastError01:boundedOr(r.lastError01,d.lastError01),
      lastStress01:boundedOr(r.lastStress01,d.lastStress01),
      lastPressure01:boundedOr(r.lastPressure01,d.lastPressure01),
      recoveryDebt01:boundedOr(r.recoveryDebt01,d.recoveryDebt01),
      stableCycles:validTimebase?counter(r.stableCycles):0,
      stableDurationMs:validTimebase?counter(r.stableDurationMs):0,
      lastMode:isMode(r.lastMode)?r.lastMode:d.lastMode,
      lastAt:validTimebase?Number(r.lastAt):0,
      bodyTelemetryObservations:counter(r.bodyTelemetryObservations),
      cognitiveObservations:counter(r.cognitiveObservations),
      duplicateObservations:counter(r.duplicateObservations),
      outOfOrderObservations:counter(r.outOfOrderObservations),
      invalidTimestampObservations:counter(r.invalidTimestampObservations),
      invalidValueObservations:counter(r.invalidValueObservations),
      setpoints,
      history,
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
    const numericInputs=[input.tick,input.energy01,input.thermal01,input.capacity01,input.load01,input.uncertainty01,input.predictionError01,input.novelty01];
    if(!Number.isSafeInteger(input.tick)||input.tick<0||typeof input.awake!=='boolean'||
       !numericInputs.every(value=>typeof value==='number'&&Number.isFinite(value))){
      this.state.invalidValueObservations=Math.min(Number.MAX_SAFE_INTEGER,this.state.invalidValueObservations+1);
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
    const stableContinuityValid=this.state.cycles===0||elapsedMs<=MAX_STABLE_GAP_MS;
    const stableElapsedMs=this.state.cycles===0?0:elapsedMs;
    const stableDurationMs=stable&&stableContinuityValid?Math.min(Number.MAX_SAFE_INTEGER,this.state.stableDurationMs+stableElapsedMs):0;
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
    this.state.stableCycles=stable?(stableContinuityValid?this.state.stableCycles+1:1):0;
    this.state.stableDurationMs=stableDurationMs;
    return {mode,error01:error,stress01:stress,capacity01:capacity,pressure01:pressure};
  }

  private elapsed(at:number):number{
    if(this.state.cycles===0)return 1_000;
    return Math.min(MAX_ELAPSED_MS,Math.max(0,at-this.state.lastAt));
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
  summary(){return {cycles:this.state.cycles,modeCounts:this.state.modeCounts,meanError01:this.state.meanError01,meanStress01:this.state.meanStress01,meanCapacity01:this.state.meanCapacity01,lastError01:this.state.lastError01,lastStress01:this.state.lastStress01,lastPressure01:this.state.lastPressure01,recoveryDebt01:this.state.recoveryDebt01,stableCycles:this.state.stableCycles,stableDurationMs:this.state.stableDurationMs,bodyTelemetryObservations:this.state.bodyTelemetryObservations,cognitiveObservations:this.state.cognitiveObservations,duplicateObservations:this.state.duplicateObservations,outOfOrderObservations:this.state.outOfOrderObservations,invalidTimestampObservations:this.state.invalidTimestampObservations,invalidValueObservations:this.state.invalidValueObservations,lastMode:this.state.lastMode,setpoints:this.state.setpoints};}
}
