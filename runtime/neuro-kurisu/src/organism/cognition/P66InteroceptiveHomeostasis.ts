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
export const defaultP66=():P66State=>({version:1,cycles:0,modeCounts:{recover:0,protect:0,balance:0,engage:0,explore:0},meanError01:.3,meanStress01:.25,meanCapacity01:.7,lastCapacity01:.7,lastError01:.3,lastStress01:.25,lastPressure01:.3,recoveryDebt01:.18,stableCycles:0,lastMode:'balance',lastAt:0,setpoints:{energy01:.68,thermal01:.25,capacity01:.72,load01:.38,awake01:1},history:[]});
const P66_MODES=new Set<P66Mode>(['recover','protect','balance','engage','explore']);
const ownDataRecord=(value:unknown):Record<string,unknown>|null=>{
 if(value===null||typeof value!=='object'||Array.isArray(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const descriptors=Object.getOwnPropertyDescriptors(value),out:Record<string,unknown>=Object.create(null);
 for(const [key,d] of Object.entries(descriptors)){if(!('value'in d))return null;out[key]=d.value;}
 return out;
};
const ownDataArray=(value:unknown,max=512):unknown[]=>{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return [];
 const length=Object.getOwnPropertyDescriptor(value,'length');
 if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||length.value>max)return [];
 const out:unknown[]=[];
 for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d){out.push(undefined);continue;}if(!('value'in d))return [];out.push(d.value);}
 return out;
};
const boundedCount=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,1_000_000_000):fallback;
const boundedMetric=(value:unknown,fallback:number):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:fallback;
const boundedTimestamp=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:fallback;
function normalizeP66History(value:unknown):P66State['history']{
 const result:P66State['history']=[];
 for(const candidate of ownDataArray(value,1024)){
  const row=ownDataRecord(candidate);if(!row||!Number.isSafeInteger(row.tick)||Number(row.tick)<0||
    typeof row.at!=='number'||!Number.isFinite(row.at)||row.at<0||typeof row.mode!=='string'||!P66_MODES.has(row.mode as P66Mode))continue;
  const error01=boundedMetric(row.error01,-1),stress01=boundedMetric(row.stress01,-1),energy01=boundedMetric(row.energy01,-1),
    thermal01=boundedMetric(row.thermal01,-1),capacity01=boundedMetric(row.capacity01,-1);
  if([error01,stress01,energy01,thermal01,capacity01].some(v=>v<0))continue;
  result.push({at:row.at,tick:Number(row.tick),error01,stress01,mode:row.mode as P66Mode,energy01,thermal01,capacity01});
  if(result.length>=128)break;
 }
 return result;
}

export class P66InteroceptiveHomeostasis {
 private state=defaultP66();
 restore(raw?:Partial<P66State>|null){
  const d=defaultP66(),r=ownDataRecord(raw);
  if(!r){this.state=d;return;}
  if(r.version!==undefined&&r.version!==1)throw new RangeError('unsupported P66 state version');
  const counts=ownDataRecord(r.modeCounts),rawSetpoints=ownDataRecord(r.setpoints),sp=d.setpoints;
  const modeCounts:Record<P66Mode,number>={
    recover:boundedCount(counts?.recover),protect:boundedCount(counts?.protect),balance:boundedCount(counts?.balance),
    engage:boundedCount(counts?.engage),explore:boundedCount(counts?.explore),
  };
  const setpoints={energy01:boundedMetric(rawSetpoints?.energy01,sp.energy01),thermal01:boundedMetric(rawSetpoints?.thermal01,sp.thermal01),
    capacity01:boundedMetric(rawSetpoints?.capacity01,sp.capacity01),load01:boundedMetric(rawSetpoints?.load01,sp.load01),
    awake01:boundedMetric(rawSetpoints?.awake01,sp.awake01)};
  const lastMode=typeof r.lastMode==='string'&&P66_MODES.has(r.lastMode as P66Mode)?r.lastMode as P66Mode:d.lastMode;
  const history=normalizeP66History(r.history);
  this.state={version:1,cycles:Math.max(boundedCount(r.cycles),history.length),modeCounts,
    meanError01:boundedMetric(r.meanError01,d.meanError01),meanStress01:boundedMetric(r.meanStress01,d.meanStress01),
    meanCapacity01:boundedMetric(r.meanCapacity01,d.meanCapacity01),lastCapacity01:boundedMetric(r.lastCapacity01,d.lastCapacity01),
    lastError01:boundedMetric(r.lastError01,d.lastError01),lastStress01:boundedMetric(r.lastStress01,d.lastStress01),
    lastPressure01:boundedMetric(r.lastPressure01,d.lastPressure01),recoveryDebt01:boundedMetric(r.recoveryDebt01,d.recoveryDebt01),
    stableCycles:boundedCount(r.stableCycles),lastMode,lastAt:boundedTimestamp(r.lastAt),setpoints,history};
 }
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){
  return {...this.state,modeCounts:{...this.state.modeCounts},setpoints:{...this.state.setpoints},history:this.state.history.slice(0,64).map(row=>({...row}))};
 }
 observe(input:{tick:number;at:number;energy01:number;thermal01:number;capacity01:number;load01:number;awake:boolean;uncertainty01:number;predictionError01:number;novelty01:number}):{mode:P66Mode;error01:number;stress01:number;capacity01:number;pressure01:number} {
  if(!Number.isSafeInteger(input.tick)||input.tick<0)throw new RangeError('homeostasis tick must be a non-negative safe integer');
  if(!Number.isFinite(input.at)||input.at<0)throw new RangeError('homeostasis timestamp must be finite and non-negative');
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
