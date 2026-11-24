/**
 * B290 — Reality-Gated Neurodevelopment Controller.
 *
 * This is a coordinator, not another cognitive subsystem owner. It binds the
 * existing B270-B289 neural/developmental substrates to one evidence-gated
 * developmental policy. The policy changes action preference and plasticity
 * mode based on measurable causal evidence, stability, resources and learning
 * outcome. It never claims consciousness.
 */
import type { ActionKind } from '../core/types.ts';

export type B290Mode = 'explore'|'verify'|'consolidate'|'reflect'|'recover'|'protect';

export interface B290State {
  version:1;
  cycles:number;
  learningUpdates:number;
  mode:B290Mode;
  developmentalPressure01:number;
  evidenceStrength01:number;
  causalConfidence01:number;
  stability01:number;
  autonomy01:number;
  plasticityBudget01:number;
  realityGate01:number;
  lastAction:ActionKind|null;
  lastReward01:number;
  lastPredictionError01:number;
  eventLineage01:number;
  cycleCoverage01:number;
  modeCounts:Record<B290Mode,number>;
  recent:Array<{tick:number;mode:B290Mode;action:ActionKind|null;reward01:number;gate01:number}>;
}

const MODES:B290Mode[]=['explore','verify','consolidate','reflect','recover','protect'];
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));

export interface B290ObserveInput {
  tick:number;
  b289Integration01:number;
  b289Agency01:number;
  b289Identity01:number;
  b289Reality01:number;
  morphStructuralFitness01:number;
  morphNeurons:number;
  morphSynapses:number;
  selfAgency01:number;
  selfCoherence01:number;
  causalVerified01:number;
  causalCalibration01:number;
  eventLineage01:number;
  cycleCoverage01:number;
  predictionError01:number;
  uncertainty01:number;
  novelty01:number;
  energy01:number;
  thermal01:number;
  microPredictionError01?:number;
}

export interface B290OutcomeInput {
  tick:number;
  action:ActionKind|null;
  reward01:number;
  predictionError01:number;
  externallyGrounded01:number;
  identityContinuity01:number;
}

export const defaultB290State=():B290State=>({
  version:1,cycles:0,learningUpdates:0,mode:'consolidate',developmentalPressure01:.4,
  evidenceStrength01:.25,causalConfidence01:.25,stability01:.65,autonomy01:.45,plasticityBudget01:.5,
  realityGate01:.4,lastAction:null,lastReward01:.5,lastPredictionError01:.5,eventLineage01:.5,cycleCoverage01:.5,
  modeCounts:{explore:0,verify:0,consolidate:0,reflect:0,recover:0,protect:0},recent:[]
});

export class B290RealityGatedNeurodevelopment {
  private state=defaultB290State();
  restore(raw?:Partial<B290State>|null){
    const d=defaultB290State(), r:any=raw??{};
    this.state={...d,...r,version:1,
      mode:MODES.includes(r.mode)?r.mode:d.mode,
      modeCounts:{...d.modeCounts,...(r.modeCounts??{})},
      recent:Array.isArray(r.recent)?structuredClone(r.recent).slice(-128):[]
    };
  }
  snapshot(){return structuredClone(this.state);}

  observe(input:B290ObserveInput){
    const stability=clamp((input.b289Identity01*.28+input.b289Reality01*.22+input.b289Integration01*.18+input.selfCoherence01*.17+input.morphStructuralFitness01*.15) - input.thermal01*.10);
    this.state.eventLineage01=clamp(input.eventLineage01); this.state.cycleCoverage01=clamp(input.cycleCoverage01);
    const causal=clamp(input.causalVerified01*.55+input.causalCalibration01*.25+this.state.eventLineage01*.12+this.state.cycleCoverage01*.08);
    const evidence=clamp(this.state.eventLineage01*.25+this.state.cycleCoverage01*.20+input.causalVerified01*.35+input.causalCalibration01*.20);
    const autonomy=clamp(input.b289Agency01*.45+input.selfAgency01*.35+input.b289Integration01*.20);
    const effectivePredictionError=Math.max(input.predictionError01, input.microPredictionError01??0);
    const pressure=clamp(effectivePredictionError*.30+input.uncertainty01*.22+input.novelty01*.16+(1-input.morphStructuralFitness01)*.08+(1-input.b289Reality01)*.10+(1-input.energy01)*.06+input.selfAgency01*.08);
    const thermalPenalty=clamp(input.thermal01*.65);
    const resource=clamp(input.energy01*(1-thermalPenalty));
    const gate=clamp(.20+stability*.22+evidence*.24+causal*.18+autonomy*.12+resource*.12);
    let mode:B290Mode='consolidate';
    if(thermalPenalty>.62 || input.energy01<.23) mode='protect';
    else if(resource<.38) mode='recover';
    else if(evidence<.30 || causal<.30) mode='verify';
    else if(pressure>.69 && gate>.58) mode='explore';
    else if(effectivePredictionError>.48 && stability>.55) mode='reflect';
    else mode='consolidate';
    this.state.cycles++;
    this.state.mode=mode; this.state.developmentalPressure01=pressure; this.state.evidenceStrength01=evidence;
    this.state.causalConfidence01=causal; this.state.stability01=stability; this.state.autonomy01=autonomy;
    this.state.realityGate01=gate;
    const budget=clamp(gate*(.55+pressure*.45)-thermalPenalty*.25-(1-input.morphStructuralFitness01)*.12);
    this.state.plasticityBudget01=budget; this.state.modeCounts[mode]++;
    return {mode,developmentalPressure01:pressure,evidenceStrength01:evidence,causalConfidence01:causal,stability01:stability,autonomy01:autonomy,realityGate01:gate,plasticityBudget01:budget};
  }

  actionBias(action:ActionKind){
    const s=this.state; let b=0;
    if(s.mode==='explore') b += action==='explore'?.075:action==='verify'?.025:action==='rest'?-0.025:0;
    if(s.mode==='verify') b += action==='verify'?.090:action==='reflect'?.035:action==='explore'?.015:0;
    if(s.mode==='consolidate') b += action==='reflect'?.055:action==='respond'?.020:action==='explore'?-0.018:0;
    if(s.mode==='reflect') b += action==='reflect'?.085:action==='verify'?.035:0;
    if(s.mode==='recover') b += action==='rest'?.110:action==='defer'?.035:action==='explore'?-0.05:0;
    if(s.mode==='protect') b += action==='rest'?.090:action==='defer'?.055:action==='verify'?.025:action==='explore'?-0.08:0;
    const confidence=(s.realityGate01-.5)*.04;
    return Math.max(-.18,Math.min(.18,b+confidence));
  }

  learnFromOutcome(input:B290OutcomeInput){
    const r=clamp(input.reward01), pe=clamp(input.predictionError01), grounded=clamp(input.externallyGrounded01), identity=clamp(input.identityContinuity01);
    const expected=.5 + (this.state.mode==='explore'?.06:this.state.mode==='verify'?.04:this.state.mode==='reflect'?.03:0);
    const delta=(r-expected)*.12 + (grounded-.5)*.04 + (identity-.5)*.03 - pe*.025;
    this.state.realityGate01=clamp(this.state.realityGate01+delta);
    this.state.plasticityBudget01=clamp(this.state.plasticityBudget01+delta*.75);
    this.state.stability01=clamp(this.state.stability01*.98+identity*.02);
    this.state.lastAction=input.action??null; this.state.lastReward01=r; this.state.lastPredictionError01=pe;
    this.state.learningUpdates++;
    this.state.recent=[{tick:input.tick,mode:this.state.mode,action:input.action??null,reward01:r,gate01:this.state.realityGate01},...this.state.recent].slice(0,64);
    return {realityGate01:this.state.realityGate01,plasticityBudget01:this.state.plasticityBudget01,stability01:this.state.stability01};
  }

  controlMetrics(){return {mode:this.state.mode, realityGate01:this.state.realityGate01, eventLineage01:this.state.eventLineage01, cycleCoverage01:this.state.cycleCoverage01, plasticityBudget01:this.state.plasticityBudget01, stability01:this.state.stability01, autonomy01:this.state.autonomy01};}
  diagnostics(){return {...this.snapshot(),modeCounts:{...this.state.modeCounts},recentDepth:this.state.recent.length};}
}
