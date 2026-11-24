import type { EnvironmentAction, EnvironmentTransition } from '../world/WorldEnvironment.ts';

export interface SensorimotorTrace {
  tick: number;
  action: EnvironmentAction;
  valid: boolean;
  expectedReward: number;
  actualReward: number;
  rewardPredictionError: number;
  statePredictionError: number;
  bodyCost01: number;
  at: number;
}

export interface SensorimotorState {
  version: 1;
  traces: SensorimotorTrace[];
  meanPredictionError: number;
  actionSuccessRate: number;
  lastAction: EnvironmentAction | null;
}

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function defaultSensorimotorState(): SensorimotorState {
  return { version: 1, traces: [], meanPredictionError: 0.5, actionSuccessRate: 0.5, lastAction: null };
}

export class SensorimotorLoop {
  private state = defaultSensorimotorState();
  restore(value: SensorimotorState | undefined): void { this.state = { ...defaultSensorimotorState(), ...(value ?? {}), traces: [...(value?.traces ?? [])].slice(-256) }; }
  snapshot(): SensorimotorState { return structuredClone(this.state); }

  observe(tick: number, transition: EnvironmentTransition, expectedReward: number, bodyCost01: number): SensorimotorTrace {
    const rewardError = clamp(Math.abs(clamp(expectedReward) - clamp((transition.reward + 1) / 2)));
    const energyDelta = Math.abs(transition.after.energy - transition.before.energy);
    const attentionDelta = Math.abs(transition.after.attention - transition.before.attention);
    const stateError = clamp(Math.min(1, energyDelta * 0.8 + attentionDelta * 0.6 + transition.surprise * 0.7));
    const trace: SensorimotorTrace = { tick, action: transition.action, valid: transition.valid, expectedReward: clamp(expectedReward), actualReward: clamp((transition.reward + 1) / 2), rewardPredictionError: rewardError, statePredictionError: stateError, bodyCost01: clamp(bodyCost01), at: transition.at };
    this.state.traces = [trace, ...this.state.traces].slice(0, 256);
    this.state.meanPredictionError = clamp(this.state.meanPredictionError * 0.9 + (rewardError * 0.6 + stateError * 0.4) * 0.1);
    this.state.actionSuccessRate = clamp(this.state.actionSuccessRate * 0.92 + (transition.valid ? 0.08 : 0));
    this.state.lastAction = transition.action;
    return structuredClone(trace);
  }
}
