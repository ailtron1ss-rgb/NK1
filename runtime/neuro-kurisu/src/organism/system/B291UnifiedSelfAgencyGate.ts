/**
 * B291 — Unified Self/Agency/Personality Executive Gate.
 *
 * A lightweight PFC/Basal-Ganglia-inspired gate over the existing candidate
 * action field. It does not own personality, identity, goals, or memory.
 * Instead it decides whether the current working intention should be
 * maintained, switched, or protected, using those existing owners as inputs.
 *
 * Design goals:
 * - preserve self-authored intention across external turns when appropriate;
 * - make switching evidence-sensitive instead of score-noise-sensitive;
 * - bind action selection to persistent personality/identity signals;
 * - keep the hot path cheap and bounded for mobile/Termux;
 * - expose lesion/restore and outcome learning for causal verification.
 */
import type { ActionKind } from '../core/types.ts';

export type B291DecisionMode = 'maintain'|'switch'|'external'|'protect'|'recover';

export interface B291Candidate {
  action: ActionKind;
  score:number;
  confidence01:number;
  predictedUtility?:number;
  personalityBias01?:number;
}

export interface B291State {
  version:1;
  cycles:number;
  learningUpdates:number;
  mode:B291DecisionMode;
  workingIntent:ActionKind|null;
  workingGoalId:string|null;
  hold01:number;
  gate01:number;
  autonomyShare01:number;
  identityFit01:number;
  personalityFit01:number;
  externalOverride01:number;
  switchPressure01:number;
  volition01:number;
  updateGate01:number;
  lastReward01:number;
  lastPredictionError01:number;
  selectedAction:ActionKind|null;
  lesions01:number;
  modeCounts:Record<B291DecisionMode,number>;
  actionCounts:Record<string,number>;
  recent:Array<{tick:number;mode:B291DecisionMode;action:ActionKind|null;hold01:number;autonomy01:number;gate01:number}>;
}

export interface B291StepInput {
  tick:number;
  candidates:B291Candidate[];
  currentIntent:ActionKind|null;
  goalId:string|null;
  identityContinuity01:number;
  selfAgency01:number;
  selfCoherence01:number;
  realityAlignment01:number;
  personalityActionBias:Record<string,number>;
  b290Mode:string;
  b290Gate01:number;
  externalInput01:number;
  userRequestedAction:ActionKind|null;
  goalPressure01:number;
  novelty01:number;
  uncertainty01:number;
  energy01:number;
  thermal01:number;
  predictionError01:number;
  cadence:number;
  intentContinuity01?:number;
  commitment01?:number;
  recentFailure01?:number;
  microPredictionError01?:number;
  microActionBias?:Record<string,number>;
}

export interface B291OutcomeInput {
  tick:number;
  action:ActionKind|null;
  reward01:number;
  predictionError01:number;
  identityContinuity01:number;
  externallyGrounded01:number;
}

const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clamp11=(x:number)=>Math.max(-1,Math.min(1,Number.isFinite(x)?x:0));
const MODES:B291DecisionMode[]=['maintain','switch','external','protect','recover'];

export const defaultB291State=():B291State=>({
  version:1,cycles:0,learningUpdates:0,mode:'maintain',workingIntent:null,workingGoalId:null,
  hold01:.55,gate01:.5,autonomyShare01:.45,identityFit01:.65,personalityFit01:.5,externalOverride01:0,
  switchPressure01:.25,volition01:.5,updateGate01:.5,lastReward01:.5,lastPredictionError01:.5,selectedAction:null,
  lesions01:0,modeCounts:{maintain:0,switch:0,external:0,protect:0,recover:0},actionCounts:{},recent:[]
});

export class B291UnifiedSelfAgencyGate {
  private state=defaultB291State();

  restore(raw?:Partial<B291State>|null){
    const d=defaultB291State(),r:any=raw??{};
    this.state={...d,...r,version:1,
      mode:MODES.includes(r.mode)?r.mode:d.mode,
      modeCounts:{...d.modeCounts,...(r.modeCounts??{})},
      actionCounts:{...(r.actionCounts??{})},
      recent:Array.isArray(r.recent)?r.recent.slice(-64):[]
    };
  }
  snapshot(){return structuredClone(this.state);}
  currentIntent(){return this.state.workingIntent;}
  metrics(){const s=this.state; return {mode:s.mode,workingIntent:s.workingIntent,workingGoalId:s.workingGoalId,hold01:s.hold01,gate01:s.gate01,autonomyShare01:s.autonomyShare01,identityFit01:s.identityFit01,personalityFit01:s.personalityFit01,externalOverride01:s.externalOverride01,switchPressure01:s.switchPressure01,volition01:s.volition01,updateGate01:s.updateGate01,lastReward01:s.lastReward01,lastPredictionError01:s.lastPredictionError01,selectedAction:s.selectedAction,lesions01:s.lesions01,cycles:s.cycles,learningUpdates:s.learningUpdates};}
  diagnostics(){return {...this.snapshot(),recentDepth:this.state.recent.length};}

  lesion(fraction01=.5){this.state.lesions01=clamp(fraction01); return this.diagnostics();}
  clearLesion(){this.state.lesions01=0; return this.diagnostics();}

  private scoreCandidate(c:B291Candidate,input:B291StepInput,holdBoost:number){
    const personality=clamp(.5+(input.personalityActionBias[c.action]??c.personalityBias01??0));
    const microBias=clamp11(input.microActionBias?.[c.action]??0);
    const identityFit=clamp(input.identityContinuity01*.55+input.selfCoherence01*.25+input.realityAlignment01*.20);
    const internal=(1-input.externalInput01)*this.state.volition01;
    let delta=(personality-.5)*.065 + (identityFit-.5)*.045 + internal*.028 + microBias*.12;
    if(c.action===this.state.workingIntent) delta += holdBoost;
    if(input.userRequestedAction===c.action) delta += input.externalInput01*.04;
    if(input.energy01<.25 && c.action==='rest') delta += .06;
    if(input.thermal01>.65 && c.action==='explore') delta -= .07;
    if(input.b290Mode==='protect' && c.action==='rest') delta += .045;
    if(input.b290Mode==='verify' && c.action==='verify') delta += .035;
    if(input.b290Mode==='reflect' && c.action==='reflect') delta += .028;
    const damping=1-this.state.lesions01*.72;
    return c.score + delta*damping;
  }

  step(input:B291StepInput){
    const cadence=Math.max(1,Math.floor(input.cadence||1));
    if(input.tick%cadence!==0 && this.state.selectedAction){
      return this.cachedResult(input);
    }
    const identityFit=clamp(input.identityContinuity01*.5+input.selfCoherence01*.25+input.realityAlignment01*.25);
    const volition=clamp(input.selfAgency01*.45+identityFit*.25+input.b290Gate01*.15+(1-input.externalInput01)*.15);
    const effectivePredictionError=Math.max(input.predictionError01, input.microPredictionError01??0);
    const switchPressure=clamp(effectivePredictionError*.30+input.uncertainty01*.26+input.novelty01*.16+input.goalPressure01*.12+(1-input.energy01)*.08+input.thermal01*.08);
    const external=clamp(input.externalInput01*.65+(input.userRequestedAction?0.25:0)+input.goalPressure01*.10);
    const gate=clamp(.22+identityFit*.24+volition*.22+input.b290Gate01*.22+(1-switchPressure)*.10+(1-input.thermal01)*.05);
    const intentContinuity=clamp(input.intentContinuity01??.5);
    const commitment=clamp(input.commitment01??.5);
    const recentFailure=clamp(input.recentFailure01??0);
    const hold=clamp(.35+identityFit*.23+volition*.20+intentContinuity*.12+commitment*.10+(1-switchPressure)*.12-recentFailure*.08);
    const updateGate=clamp(switchPressure*.55+external*.25+(1-hold)*.20+recentFailure*.06);
    const shouldProtect=input.energy01<.22||input.thermal01>.72;
    const scored=input.candidates.map(c=>({...c,score:this.scoreCandidate(c,input,hold*.035)}));
    scored.sort((a,b)=>b.score-a.score);
    const winner=scored[0]??null;
    const second=scored[1]??null;
    const margin=winner&&second?clamp((winner.score-second.score)+.5)*.5:0;
    const sameIntent=Boolean(winner&&this.state.workingIntent===winner.action);
    let mode:B291DecisionMode='maintain';
    if(shouldProtect) mode='protect';
    else if(input.externalInput01>.7 && input.userRequestedAction && winner?.action===input.userRequestedAction) mode='external';
    else if(!sameIntent || switchPressure>.68 || updateGate>.64 || margin>.57) mode='switch';
    else mode='maintain';
    if(!winner) mode='recover';
    const selected=mode==='protect' && scored.find(c=>c.action==='rest') ? 'rest' as ActionKind : winner?.action ?? this.state.workingIntent ?? 'wait';
    const personalityFit=clamp(.5+(input.personalityActionBias[selected]??0));
    const autonomy=clamp(volition*(1-external*.75)+(mode==='external'?0.3:0));
    if(mode==='switch'||mode==='external'||this.state.workingIntent==null){
      this.state.workingIntent=selected; this.state.workingGoalId=input.goalId;
    }
    this.state.cycles++;
    this.state.mode=mode; this.state.hold01=hold; this.state.gate01=gate; this.state.autonomyShare01=autonomy;
    this.state.identityFit01=identityFit; this.state.personalityFit01=personalityFit; this.state.externalOverride01=external;
    this.state.switchPressure01=switchPressure; this.state.volition01=volition; this.state.updateGate01=updateGate;
    this.state.selectedAction=selected; this.state.modeCounts[mode]++;
    this.state.actionCounts[selected]=(this.state.actionCounts[selected]??0)+1;
    this.state.recent=[{tick:input.tick,mode,action:selected,hold01:hold,autonomy01:autonomy,gate01:gate},...this.state.recent].slice(0,64);
    return {selectedAction:selected,mode,gate01:gate,hold01:hold,identityFit01:identityFit,personalityFit01:personalityFit,autonomyShare01:autonomy,externalOverride01:external,switchPressure01:switchPressure,updateGate01:updateGate,volition01:volition,candidates:scored};
  }

  private cachedResult(input:B291StepInput){
    return {selectedAction:this.state.selectedAction??this.state.workingIntent??'wait',mode:this.state.mode,gate01:this.state.gate01,hold01:this.state.hold01,identityFit01:this.state.identityFit01,personalityFit01:this.state.personalityFit01,autonomyShare01:this.state.autonomyShare01,externalOverride01:this.state.externalOverride01,switchPressure01:this.state.switchPressure01,updateGate01:this.state.updateGate01,volition01:this.state.volition01,candidates:[]};
  }

  actionBias(action:ActionKind){
    if(action===this.state.workingIntent) return clamp((this.state.hold01-.5)*.06*this.state.gate01*(1-this.state.lesions01));
    if(action===this.state.selectedAction) return clamp((this.state.autonomyShare01-.5)*.045*this.state.gate01*(1-this.state.lesions01));
    if(this.state.mode==='protect' && action==='explore') return -.045*(1-this.state.lesions01);
    return 0;
  }

  learnFromOutcome(input:B291OutcomeInput){
    const reward=clamp(input.reward01),pe=clamp(input.predictionError01),identity=clamp(input.identityContinuity01),grounded=clamp(input.externallyGrounded01);
    const expected=clamp(.5+this.state.autonomyShare01*.08+this.state.identityFit01*.05);
    const delta=(reward-expected)*.14+(identity-.5)*.035+(grounded-.5)*.025-pe*.035;
    this.state.hold01=clamp(this.state.hold01+delta*.55);
    this.state.gate01=clamp(this.state.gate01+delta*.45);
    this.state.autonomyShare01=clamp(this.state.autonomyShare01+delta*.65);
    this.state.learningUpdates++;
    this.state.lastReward01=reward; this.state.lastPredictionError01=pe;
    if(input.action&&input.action===this.state.workingIntent&&reward<.42) this.state.switchPressure01=clamp(this.state.switchPressure01+.05);
    return { mode:this.state.mode, gate01:this.state.gate01, hold01:this.state.hold01, autonomyShare01:this.state.autonomyShare01, learningUpdates:this.state.learningUpdates };
  }
}
