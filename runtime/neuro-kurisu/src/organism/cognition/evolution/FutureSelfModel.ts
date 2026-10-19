import type { ActionKind, OrganismGoal, OrganismState } from '../../core/types.ts';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export interface FutureSelfForecast {
  id: string;
  at: number;
  horizonCycles: number;
  predictedAction: ActionKind;
  confidence: number;
  predictedGoalIds: string[];
  predictedNeeds: Record<string, number>;
}

export interface FutureSelfDevelopmentalForecast {
  id:string;
  at:number;
  horizonCycles:number;
  predictedIdentityContinuity01:number;
  predictedAgency01:number;
  predictedSocialBinding01:number;
  confidence:number;
  sourceMomentId?:string;
}

export interface FutureSelfState {
  version: 1;
  forecasts: FutureSelfForecast[];
  developmentalForecasts: FutureSelfDevelopmentalForecast[];
  calibrationError: number;
  developmentalCalibrationError01:number;
  lastMismatch: number;
  lastDevelopmentalMismatch01:number;
  futureIdentityCoherence: number;
  developmentalBias01: number;
}

export const defaultFutureSelf = (): FutureSelfState => ({
  version: 1,
  forecasts: [],
  developmentalForecasts:[],
  calibrationError: 0.5,
  developmentalCalibrationError01:.5,
  lastMismatch: 0,
  lastDevelopmentalMismatch01:0,
  futureIdentityCoherence: 0.72,
  developmentalBias01: 0,
});

export class FutureSelfModel {
  private state = defaultFutureSelf();
  restore(value: FutureSelfState | undefined): void {
    const d=defaultFutureSelf(); const raw:any=value??{};
    this.state={...d,...raw,forecasts:Array.isArray(raw.forecasts)?raw.forecasts.slice(0,128):[],developmentalForecasts:Array.isArray(raw.developmentalForecasts)?raw.developmentalForecasts.slice(0,96):[]};
  }
  snapshot(): FutureSelfState { return structuredClone(this.state); }

  /**
   * Shadow-only developmental assessment of an action's likely effect on future self-coherence.
   * This never mutates canonical identity/value state. It returns a small bounded policy bias.
   */
  developmentalBias(input:{action:ActionKind;state:OrganismState;goals:OrganismGoal[];values:{curiosity:number;truth:number;autonomy:number;evidence:number;care:number;responsibility:number;social:number};identityContinuity01:number;identityPressure01:number}):number {
    const v=input.values;
    const energy=input.state.needs.energy, uncertainty=input.state.needs.uncertainty, social=input.state.needs.socialNeed, novelty=input.state.needs.novelty;
    const goalPressure=input.state.needs.goalPressure;
    const activeGoal= input.goals.find(g=>g.status==='active');
    const goalAlignment=activeGoal ? clamp(activeGoal.importance*.45+activeGoal.confidence*.25+activeGoal.urgency*.30) : 0;
    const actionValue =
      input.action==='verify' ? v.truth*.40+v.evidence*.40+v.responsibility*.10+v.autonomy*.10 :
      input.action==='explore' ? v.curiosity*.45+v.autonomy*.35+v.evidence*.10+v.social*.10 :
      input.action==='respond' ? v.social*.50+v.care*.25+v.responsibility*.20+v.truth*.05 :
      input.action==='reflect' ? v.truth*.25+v.evidence*.20+v.autonomy*.20+v.responsibility*.20+v.care*.15 :
      input.action==='rest' ? v.responsibility*.35+v.care*.25+v.autonomy*.15+(1-energy)*.25 :
      input.action==='wait' ? (1-goalPressure)*.35+(1-uncertainty)*.35+v.responsibility*.30 :
      (1-goalPressure)*.30+(1-uncertainty)*.30+v.responsibility*.20+v.autonomy*.20;
    const stateFit = clamp(1-(
      input.action==='explore'?Math.max(0,energy-.72)*.10:
      input.action==='verify'?Math.max(0,uncertainty-.68)*.18:
      input.action==='respond'?Math.max(0,social-.72)*.14:
      input.action==='rest'?Math.max(0,.42-energy)*.32:0
    ));
    const developmentalContinuity=clamp(input.identityContinuity01*.34+(1-input.identityPressure01)*.18+goalAlignment*.16+actionValue*.32);
    const coherenceDelta=developmentalContinuity-this.state.futureIdentityCoherence;
    const calibrationGate=clamp(1-this.state.calibrationError*.55);
    const bounded=clamp((coherenceDelta*.060 + (actionValue-.5)*.012 + (stateFit-.5)*.010)*calibrationGate);
    this.state.developmentalBias01=bounded;
    return bounded-.03;
  }

  forecast(state: OrganismState, goals: OrganismGoal[], predictedAction: ActionKind, confidence: number, horizonCycles = 3): FutureSelfForecast {
    const activeGoalIds = goals.filter(goal => goal.status === 'active').slice(0, 4).map(goal => goal.id);
    const row: FutureSelfForecast = {
      id: `future-self-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: Date.now(),
      horizonCycles: Math.max(1, Math.min(12, Math.trunc(horizonCycles))),
      predictedAction,
      confidence: clamp(confidence),
      predictedGoalIds: activeGoalIds,
      predictedNeeds: { energy:state.needs.energy, uncertainty:state.needs.uncertainty, cognitiveLoad:state.needs.cognitiveLoad, socialNeed:state.needs.socialNeed },
    };
    this.state.forecasts = [row, ...this.state.forecasts].slice(0, 128);
    return structuredClone(row);
  }

  forecastDevelopmental(input:{identityContinuity01:number;agency01:number;socialBinding01:number;identityPressure01:number;socialDemand01:number;horizonCycles?:number;confidence01?:number;sourceMomentId?:string}):FutureSelfDevelopmentalForecast{
    const continuity=clamp(input.identityContinuity01+(1-input.identityPressure01)*.035-input.socialDemand01*.012);
    const agency=clamp(input.agency01+(1-input.identityPressure01)*.018);
    const social=clamp(input.socialBinding01+(input.socialDemand01>.55?.018:0)-Math.max(0,input.socialDemand01-.82)*.035);
    const row:FutureSelfDevelopmentalForecast={id:`future-development-${Date.now()}-${Math.random().toString(16).slice(2)}`,at:Date.now(),horizonCycles:Math.max(1,Math.min(24,Math.trunc(input.horizonCycles??6))),predictedIdentityContinuity01:continuity,predictedAgency01:agency,predictedSocialBinding01:social,confidence:clamp(input.confidence01??.5),sourceMomentId:input.sourceMomentId};
    this.state.developmentalForecasts=[row,...this.state.developmentalForecasts].slice(0,96);
    return structuredClone(row);
  }

  resolveDevelopmental(actual:{identityContinuity01:number;agency01:number;socialBinding01:number}|null):number{
    const prior=this.state.developmentalForecasts[0]; if(!prior||!actual)return 0;
    const mismatch=clamp((Math.abs(prior.predictedIdentityContinuity01-actual.identityContinuity01)+Math.abs(prior.predictedAgency01-actual.agency01)+Math.abs(prior.predictedSocialBinding01-actual.socialBinding01))/3);
    this.state.lastDevelopmentalMismatch01=mismatch;
    this.state.developmentalCalibrationError01=clamp(this.state.developmentalCalibrationError01*.9+mismatch*.1);
    this.state.futureIdentityCoherence=clamp(this.state.futureIdentityCoherence*.94+(1-mismatch)*.06);
    return mismatch;
  }

  resolve(actualAction: ActionKind | null): number {
    const prior = this.state.forecasts[0];
    if (!prior || !actualAction) return 0;
    const mismatch = prior.predictedAction === actualAction ? 0 : 1;
    const error = clamp(mismatch * (0.6 + prior.confidence * 0.4));
    this.state.lastMismatch = error;
    this.state.calibrationError = clamp(this.state.calibrationError * 0.9 + error * 0.1);
    this.state.futureIdentityCoherence = clamp(this.state.futureIdentityCoherence * 0.94 + (1 - error) * 0.06);
    return error;
  }
}
