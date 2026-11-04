/**
 * BIG PASS 221 — interoceptive state estimation.
 * Computational analogue of an insula/cingulate-style body-state loop.
 * It estimates latent internal condition, separates observation from prediction,
 * exposes uncertainty/conflict, and sends bounded control pressure downstream.
 */
import { InteroceptivePrecisionAllocator } from './InteroceptivePrecisionAllocator.ts';
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const precisionAllocator=new InteroceptivePrecisionAllocator();
const finN=(v:unknown,f:number):number=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:f;};
const cnt=(v:unknown,f:number):number=>Math.max(0,Math.floor(finN(v,f)));
const CHANNELS=['energy','thermal','cognitiveLoad','sleepPressure'] as const;
const strArr=(v:unknown,cap:number):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>x.slice(0,160)).slice(0,cap):[];
const needVec=(v:unknown,fb:import('./InteroceptivePrecisionAllocator.ts').InteroceptiveNeedVector):import('./InteroceptivePrecisionAllocator.ts').InteroceptiveNeedVector=>{const r=(v&&typeof v==='object')?v as Record<string,unknown>:{};const out={} as import('./InteroceptivePrecisionAllocator.ts').InteroceptiveNeedVector;for(const c of CHANNELS)out[c]=clamp(finN(r[c],fb[c]));return out;};
const sanAlloc=(v:unknown):import('./InteroceptivePrecisionAllocator.ts').InteroceptivePrecisionAllocation|null=>{if(!v||typeof v!=='object')return null;const r=v as Record<string,unknown>;const dc=r.dominantChannel;return {budget01:clamp(finN(r.budget01,0)),allocation01:needVec(r.allocation01,{energy:0,thermal:0,cognitiveLoad:0,sleepPressure:0}),share01:needVec(r.share01,{energy:0,thermal:0,cognitiveLoad:0,sleepPressure:0}),urgency01:needVec(r.urgency01,{energy:0,thermal:0,cognitiveLoad:0,sleepPressure:0}),dominantChannel:dc==='none'||CHANNELS.includes(dc as any)?dc as import('./InteroceptivePrecisionAllocator.ts').InteroceptivePrecisionAllocation['dominantChannel']:'none',entropy01:clamp(finN(r.entropy01,0))};};
const sanFrame=(x:unknown):InteroceptiveFrame|null=>{if(!x||typeof x!=='object')return null;const r=x as Record<string,unknown>;const latentRaw=(r.latent&&typeof r.latent==='object')?r.latent as Record<string,unknown>:{};const predRaw=(r.predicted&&typeof r.predicted==='object')?r.predicted as Record<string,unknown>:{};const latent={energy01:clamp(finN(latentRaw.energy01,.5)),thermal01:clamp(finN(latentRaw.thermal01,.5)),load01:clamp(finN(latentRaw.load01,.5)),capacity01:clamp(finN(latentRaw.capacity01,.5)),recoveryNeed01:clamp(finN(latentRaw.recoveryNeed01,.5))};const predicted={energy01:clamp(finN(predRaw.energy01,.5)),thermal01:clamp(finN(predRaw.thermal01,.5)),load01:clamp(finN(predRaw.load01,.5)),capacity01:clamp(finN(predRaw.capacity01,.5))};const pe=clamp(finN(r.predictionError01,0));const alloc=sanAlloc(r.precisionAllocation01)??precisionAllocator.allocate({energy:latent.energy01,thermal:latent.thermal01,cognitiveLoad:latent.load01,sleepPressure:.5});return {latent,predicted,predictionError01:pe,attendedPredictionError01:Number.isFinite(finN(r.attendedPredictionError01,NaN))?clamp(finN(r.attendedPredictionError01,0)):pe,precisionAllocation01:alloc,uncertainty01:clamp(finN(r.uncertainty01,0)),salience01:clamp(finN(r.salience01,0)),conflict01:clamp(finN(r.conflict01,0)),controlPressure01:clamp(finN(r.controlPressure01,0)),confidence01:clamp(finN(r.confidence01,0)),reason:strArr(r.reason,16)};};
export interface InteroceptiveObservation { energy01:number; thermal01:number; cognitiveLoad01:number; sleepPressure01:number; capacity01:number; sensoryFreshness01:number; attentionBudget01?:number; externalInput?:boolean; }
export interface InteroceptiveFrame { latent:{energy01:number;thermal01:number;load01:number;capacity01:number;recoveryNeed01:number}; predicted:{energy01:number;thermal01:number;load01:number;capacity01:number}; predictionError01:number; attendedPredictionError01:number; precisionAllocation01:import('./InteroceptivePrecisionAllocator.ts').InteroceptivePrecisionAllocation; uncertainty01:number; salience01:number; conflict01:number; controlPressure01:number; confidence01:number; reason:string[]; }
export interface InteroceptiveState {version:1;ticks:number;meanPredictionError01:number;meanUncertainty01:number;meanConfidence01:number;lastFrame:InteroceptiveFrame|null;prediction:{energy01:number;thermal01:number;load01:number;capacity01:number};}
export const defaultInteroceptiveState=():InteroceptiveState=>({version:1,ticks:0,meanPredictionError01:.24,meanUncertainty01:.32,meanConfidence01:.68,lastFrame:null,prediction:{energy01:.75,thermal01:.2,load01:.2,capacity01:.8}});
export class InteroceptiveStateEstimator {
 private state=defaultInteroceptiveState();
 restore(raw?:Partial<InteroceptiveState>|null){const d=defaultInteroceptiveState();const src=(raw&&typeof raw==='object')?raw as Record<string,unknown>:{};const read=(k:string):unknown=>{try{return src[k];}catch{return undefined;}};const pr=(read('prediction')&&typeof read('prediction')==='object')?read('prediction') as Record<string,unknown>:{};this.state={version:1,ticks:cnt(read('ticks'),d.ticks),meanPredictionError01:clamp(finN(read('meanPredictionError01'),d.meanPredictionError01)),meanUncertainty01:clamp(finN(read('meanUncertainty01'),d.meanUncertainty01)),meanConfidence01:clamp(finN(read('meanConfidence01'),d.meanConfidence01)),lastFrame:sanFrame(read('lastFrame')),prediction:{energy01:clamp(finN(pr.energy01,d.prediction.energy01)),thermal01:clamp(finN(pr.thermal01,d.prediction.thermal01)),load01:clamp(finN(pr.load01,d.prediction.load01)),capacity01:clamp(finN(pr.capacity01,d.prediction.capacity01))}};}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){const s=this.state;return {...s,prediction:{...s.prediction},lastFrame:s.lastFrame?{...s.lastFrame,latent:{...s.lastFrame.latent},predicted:{...s.lastFrame.predicted},reason:[...s.lastFrame.reason]}:null};}
 observe(o:InteroceptiveObservation):InteroceptiveFrame{
  const energy=clamp(o.energy01),thermal=clamp(o.thermal01),load=clamp(o.cognitiveLoad01),capacity=clamp(o.capacity01),sleep=clamp(o.sleepPressure01),fresh=clamp(o.sensoryFreshness01);
  const p=this.state.prediction;
  const predicted={energy01:p.energy01,thermal01:p.thermal01,load01:p.load01,capacity01:p.capacity01};
  const channelErrors={energy:Math.abs(energy-p.energy01),thermal:Math.abs(thermal-p.thermal01),cognitiveLoad:Math.abs(load-p.load01),sleepPressure:0};
  const predictionError=clamp((channelErrors.energy+channelErrors.thermal+channelErrors.cognitiveLoad+Math.abs(capacity-p.capacity01))/4);
  const precisionAllocation01=precisionAllocator.allocate({energy,thermal,cognitiveLoad:load,sleepPressure:sleep,attentionBudget01:o.attentionBudget01});
  const budget=precisionAllocation01.budget01;
  const predictionPrecision=precisionAllocation01.allocation01.energy+precisionAllocation01.allocation01.thermal+precisionAllocation01.allocation01.cognitiveLoad;
  const attendedPredictionError=predictionPrecision>0?clamp((channelErrors.energy*precisionAllocation01.allocation01.energy+channelErrors.thermal*precisionAllocation01.allocation01.thermal+channelErrors.cognitiveLoad*precisionAllocation01.allocation01.cognitiveLoad)/predictionPrecision):predictionError;
  const sensorUncertainty=clamp(.48*(1-fresh)+.34*attendedPredictionError+.18*predictionError+(1-budget)*.08);
  const uncertainty=clamp(this.state.meanUncertainty01*.86+sensorUncertainty*.14);
  const baselineRecovery=clamp((1-energy)*.42+thermal*.24+load*.18+sleep*.16);
  const attendedRecovery=clamp((1-energy)*precisionAllocation01.share01.energy+thermal*precisionAllocation01.share01.thermal+load*precisionAllocation01.share01.cognitiveLoad+sleep*precisionAllocation01.share01.sleepPressure);
  const attentionInfluence=budget*.3;
  const recovery=clamp(baselineRecovery*(1-attentionInfluence)+attendedRecovery*attentionInfluence);
  const salience=clamp(attendedPredictionError*.42+recovery*.38+(o.externalInput?.15:0));
  const conflict=clamp(Math.abs((1-capacity)-load)*.55+Math.abs(thermal-(1-energy))*.18+predictionError*.27);
  const controlPressure=clamp(recovery*.48+attendedPredictionError*.25+uncertainty*.17+conflict*.10);
  const confidence=clamp((1-uncertainty)*.72+fresh*.18+(1-attendedPredictionError)*.10);
  const reason:string[]=[];
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
