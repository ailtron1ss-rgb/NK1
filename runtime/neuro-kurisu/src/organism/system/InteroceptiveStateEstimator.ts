/**
 * BIG PASS 221 — interoceptive state estimation.
 * Computational analogue of an insula/cingulate-style body-state loop.
 * It estimates latent internal condition, separates observation from prediction,
 * exposes uncertainty/conflict, and sends bounded control pressure downstream.
 */
import { InteroceptivePrecisionAllocator } from './InteroceptivePrecisionAllocator.ts';
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const precisionAllocator=new InteroceptivePrecisionAllocator();
type SafeObservation = { values:Record<string,unknown>; accessorKeys:Set<string> };

/** Copy only own data properties; never execute caller getters or trust Proxy reflection. */
function safeObservation(value:unknown):SafeObservation|null {
 try{
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return null;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const values:Record<string,unknown>=Object.create(null);
  const accessorKeys=new Set<string>();
  for(const key of Reflect.ownKeys(descriptors)){
   if(typeof key!=='string')continue;
   const descriptor=descriptors[key];
   if(!descriptor)continue;
   if(Object.prototype.hasOwnProperty.call(descriptor,'value'))values[key]=descriptor.value;
   else accessorKeys.add(key);
  }
  return {values,accessorKeys};
 }catch{return null;}
}
function metric(values:Record<string,unknown>|undefined,key:string,fallback:number):number{
 const value=values?.[key];
 return typeof value==='number'&&Number.isFinite(value)?value:fallback;
}
function hasMetric(values:Record<string,unknown>|undefined,key:string):boolean{
 const value=values?.[key];
 return typeof value==='number'&&Number.isFinite(value);
}
export interface InteroceptiveObservation { energy01:number; thermal01:number; cognitiveLoad01:number; sleepPressure01:number; capacity01:number; sensoryFreshness01:number; attentionBudget01?:number; externalInput?:boolean; }
export interface InteroceptiveFrame { latent:{energy01:number;thermal01:number;load01:number;capacity01:number;recoveryNeed01:number}; predicted:{energy01:number;thermal01:number;load01:number;capacity01:number}; predictionError01:number; attendedPredictionError01:number; precisionAllocation01:import('./InteroceptivePrecisionAllocator.ts').InteroceptivePrecisionAllocation; uncertainty01:number; salience01:number; conflict01:number; controlPressure01:number; confidence01:number; reason:string[]; }
export interface InteroceptiveState {version:1;ticks:number;meanPredictionError01:number;meanUncertainty01:number;meanConfidence01:number;lastFrame:InteroceptiveFrame|null;prediction:{energy01:number;thermal01:number;load01:number;capacity01:number};}
export const defaultInteroceptiveState=():InteroceptiveState=>({version:1,ticks:0,meanPredictionError01:.24,meanUncertainty01:.32,meanConfidence01:.68,lastFrame:null,prediction:{energy01:.75,thermal01:.2,load01:.2,capacity01:.8}});
export class InteroceptiveStateEstimator {
 private state=defaultInteroceptiveState();
 restore(raw?:Partial<InteroceptiveState>|null){const d=defaultInteroceptiveState(),r=raw??{};const lastFrame=r.lastFrame?structuredClone(r.lastFrame):null;if(lastFrame){if(!lastFrame.precisionAllocation01)lastFrame.precisionAllocation01=precisionAllocator.allocate({energy:lastFrame.latent?.energy01??.5,thermal:lastFrame.latent?.thermal01??.5,cognitiveLoad:lastFrame.latent?.load01??.5,sleepPressure:.5});if(!Number.isFinite(lastFrame.attendedPredictionError01))lastFrame.attendedPredictionError01=clamp(lastFrame.predictionError01);}this.state={...d,...r,prediction:{...d.prediction,...(r.prediction??{})},lastFrame,version:1};}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){const s=this.state;return {...s,prediction:{...s.prediction},lastFrame:s.lastFrame?{...s.lastFrame,latent:{...s.lastFrame.latent},predicted:{...s.lastFrame.predicted},reason:[...s.lastFrame.reason]}:null};}
 observe(o:InteroceptiveObservation):InteroceptiveFrame{
  const safe=safeObservation(o);
  const values=safe?.values;
  const p=this.state.prediction;
  // Missing or accessor-backed sensor values are not zero-valued physiology.
  // Reuse the last prediction, remove freshness, and allocate no attention when
  // the whole input cannot be reflected as a plain own-data record.
  const energy=clamp(metric(values,'energy01',p.energy01));
  const thermal=clamp(metric(values,'thermal01',p.thermal01));
  const load=clamp(metric(values,'cognitiveLoad01',p.load01));
  const capacity=clamp(metric(values,'capacity01',p.capacity01));
  const sleep=clamp(metric(values,'sleepPressure01',.5));
  const fresh=clamp(metric(values,'sensoryFreshness01',0));
  const attentionBudget=safe===null||safe.accessorKeys.has('attentionBudget01')
    ?0
    :Object.prototype.hasOwnProperty.call(values??{},'attentionBudget01')
      ?clamp(metric(values,'attentionBudget01',0)):1;
  const requiredMetrics=['energy01','thermal01','cognitiveLoad01','sleepPressure01','capacity01','sensoryFreshness01'];
  const partialInput=safe!==null&&requiredMetrics.some(key=>safe.accessorKeys.has(key)||!hasMetric(values,key));
  const predicted={energy01:p.energy01,thermal01:p.thermal01,load01:p.load01,capacity01:p.capacity01};
  const channelErrors={energy:Math.abs(energy-p.energy01),thermal:Math.abs(thermal-p.thermal01),cognitiveLoad:Math.abs(load-p.load01),sleepPressure:0};
  const predictionError=clamp((channelErrors.energy+channelErrors.thermal+channelErrors.cognitiveLoad+Math.abs(capacity-p.capacity01))/4);
  const precisionAllocation01=precisionAllocator.allocate({energy,thermal,cognitiveLoad:load,sleepPressure:sleep,attentionBudget01:attentionBudget});
  const budget=precisionAllocation01.budget01;
  const predictionPrecision=precisionAllocation01.allocation01.energy+precisionAllocation01.allocation01.thermal+precisionAllocation01.allocation01.cognitiveLoad;
  const attendedPredictionError=predictionPrecision>0?clamp((channelErrors.energy*precisionAllocation01.allocation01.energy+channelErrors.thermal*precisionAllocation01.allocation01.thermal+channelErrors.cognitiveLoad*precisionAllocation01.allocation01.cognitiveLoad)/predictionPrecision):predictionError;
  const sensorUncertainty=clamp(.48*(1-fresh)+.34*attendedPredictionError+.18*predictionError+(1-budget)*.08);
  const uncertainty=clamp(this.state.meanUncertainty01*.86+sensorUncertainty*.14);
  const baselineRecovery=clamp((1-energy)*.42+thermal*.24+load*.18+sleep*.16);
  const attendedRecovery=clamp((1-energy)*precisionAllocation01.share01.energy+thermal*precisionAllocation01.share01.thermal+load*precisionAllocation01.share01.cognitiveLoad+sleep*precisionAllocation01.share01.sleepPressure);
  const attentionInfluence=budget*.3;
  const recovery=clamp(baselineRecovery*(1-attentionInfluence)+attendedRecovery*attentionInfluence);
  const salience=clamp(attendedPredictionError*.42+recovery*.38+(values?.externalInput===true?.15:0));
  const conflict=clamp(Math.abs((1-capacity)-load)*.55+Math.abs(thermal-(1-energy))*.18+predictionError*.27);
  const controlPressure=clamp(recovery*.48+attendedPredictionError*.25+uncertainty*.17+conflict*.10);
  const confidence=clamp((1-uncertainty)*.72+fresh*.18+(1-attendedPredictionError)*.10);
  const reason:string[]=[];
  if(safe===null)reason.push('interoceptive-input-untrusted');
  else if(partialInput)reason.push('interoceptive-input-partial');
  if(predictionError>.45)reason.push('interoceptive-prediction-error');
  if(uncertainty>.55)reason.push('low-body-state-confidence');
  if(conflict>.42)reason.push('body-state-conflict');
  if(recovery>.62)reason.push('recovery-demand');
  if(!reason.length)reason.push('interoceptive-steady-state');
  const frame={latent:{energy01:energy,thermal01:thermal,load01:load,capacity01:capacity,recoveryNeed01:recovery},predicted,predictionError01:predictionError,attendedPredictionError01:attendedPredictionError,precisionAllocation01,uncertainty01:uncertainty,salience01:salience,conflict01:conflict,controlPressure01:controlPressure,confidence01:confidence,reason};
  const alpha=.14;
  const share=(channel:'energy'|'thermal'|'cognitiveLoad')=>budget>0?precisionAllocation01.share01[channel]:.25;
  const rate=(channel:'energy'|'thermal'|'cognitiveLoad')=>alpha*(.6+1.6*share(channel))*(.5+.5*budget);
  this.state.prediction={energy01:clamp(p.energy01*(1-rate('energy'))+energy*rate('energy')),thermal01:clamp(p.thermal01*(1-rate('thermal'))+thermal*rate('thermal')),load01:clamp(p.load01*(1-rate('cognitiveLoad'))+load*rate('cognitiveLoad')),capacity01:clamp(p.capacity01*(1-alpha)+capacity*alpha)};
  this.state.ticks++; this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.9+predictionError*.1); this.state.meanUncertainty01=clamp(this.state.meanUncertainty01*.92+uncertainty*.08); this.state.meanConfidence01=clamp(this.state.meanConfidence01*.92+confidence*.08); this.state.lastFrame=frame; return structuredClone(frame);
 }
 diagnostics(){return structuredClone(this.state);}
}
