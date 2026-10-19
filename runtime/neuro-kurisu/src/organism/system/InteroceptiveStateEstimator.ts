/**
 * BIG PASS 221 — interoceptive state estimation.
 * Computational analogue of an insula/cingulate-style body-state loop.
 * It estimates latent internal condition, separates observation from prediction,
 * exposes uncertainty/conflict, and sends bounded control pressure downstream.
 */
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export interface InteroceptiveObservation { energy01:number; thermal01:number; cognitiveLoad01:number; sleepPressure01:number; capacity01:number; sensoryFreshness01:number; externalInput?:boolean; }
export interface InteroceptiveFrame { latent:{energy01:number;thermal01:number;load01:number;capacity01:number;recoveryNeed01:number}; predicted:{energy01:number;thermal01:number;load01:number;capacity01:number}; predictionError01:number; uncertainty01:number; salience01:number; conflict01:number; controlPressure01:number; confidence01:number; reason:string[]; }
export interface InteroceptiveState {version:1;ticks:number;meanPredictionError01:number;meanUncertainty01:number;meanConfidence01:number;lastFrame:InteroceptiveFrame|null;prediction:{energy01:number;thermal01:number;load01:number;capacity01:number};}
export const defaultInteroceptiveState=():InteroceptiveState=>({version:1,ticks:0,meanPredictionError01:.24,meanUncertainty01:.32,meanConfidence01:.68,lastFrame:null,prediction:{energy01:.75,thermal01:.2,load01:.2,capacity01:.8}});
export class InteroceptiveStateEstimator {
 private state=defaultInteroceptiveState();
 restore(raw?:Partial<InteroceptiveState>|null){const d=defaultInteroceptiveState(),r=raw??{};this.state={...d,...r,prediction:{...d.prediction,...(r.prediction??{})},lastFrame:r.lastFrame?structuredClone(r.lastFrame):null,version:1};}
 snapshot(){return structuredClone(this.state);}
 persistenceSnapshot(){const s=this.state;return {...s,prediction:{...s.prediction},lastFrame:s.lastFrame?{...s.lastFrame,latent:{...s.lastFrame.latent},predicted:{...s.lastFrame.predicted},reason:[...s.lastFrame.reason]}:null};}
 observe(o:InteroceptiveObservation):InteroceptiveFrame{
  const energy=clamp(o.energy01),thermal=clamp(o.thermal01),load=clamp(o.cognitiveLoad01),capacity=clamp(o.capacity01),sleep=clamp(o.sleepPressure01),fresh=clamp(o.sensoryFreshness01);
  const p=this.state.prediction;
  const predicted={energy01:p.energy01,thermal01:p.thermal01,load01:p.load01,capacity01:p.capacity01};
  const predictionError=clamp((Math.abs(energy-p.energy01)+Math.abs(thermal-p.thermal01)+Math.abs(load-p.load01)+Math.abs(capacity-p.capacity01))/4);
  const sensorUncertainty=clamp(.48*(1-fresh)+.18*Math.abs(energy-p.energy01)+.12*Math.abs(thermal-p.thermal01)+.12*Math.abs(load-p.load01)+.10*predictionError);
  const uncertainty=clamp(this.state.meanUncertainty01*.86+sensorUncertainty*.14);
  const recovery=clamp((1-energy)*.42+thermal*.24+load*.18+sleep*.16);
  const salience=clamp(predictionError*.42+recovery*.38+(o.externalInput?.15:0));
  const conflict=clamp(Math.abs((1-capacity)-load)*.55+Math.abs(thermal-(1-energy))*.18+predictionError*.27);
  const controlPressure=clamp(recovery*.48+predictionError*.25+uncertainty*.17+conflict*.10);
  const confidence=clamp((1-uncertainty)*.72+fresh*.18+(1-predictionError)*.10);
  const reason:string[]=[];
  if(predictionError>.45)reason.push('interoceptive-prediction-error');
  if(uncertainty>.55)reason.push('low-body-state-confidence');
  if(conflict>.42)reason.push('body-state-conflict');
  if(recovery>.62)reason.push('recovery-demand');
  if(!reason.length)reason.push('interoceptive-steady-state');
  const frame={latent:{energy01:energy,thermal01:thermal,load01:load,capacity01:capacity,recoveryNeed01:recovery},predicted,predictionError01:predictionError,uncertainty01:uncertainty,salience01:salience,conflict01:conflict,controlPressure01:controlPressure,confidence01:confidence,reason};
  const alpha=.14;
  this.state.prediction={energy01:clamp(p.energy01*(1-alpha)+energy*alpha),thermal01:clamp(p.thermal01*(1-alpha)+thermal*alpha),load01:clamp(p.load01*(1-alpha)+load*alpha),capacity01:clamp(p.capacity01*(1-alpha)+capacity*alpha)};
  this.state.ticks++; this.state.meanPredictionError01=clamp(this.state.meanPredictionError01*.9+predictionError*.1); this.state.meanUncertainty01=clamp(this.state.meanUncertainty01*.92+uncertainty*.08); this.state.meanConfidence01=clamp(this.state.meanConfidence01*.92+confidence*.08); this.state.lastFrame=frame; return structuredClone(frame);
 }
 diagnostics(){return structuredClone(this.state);}
}
