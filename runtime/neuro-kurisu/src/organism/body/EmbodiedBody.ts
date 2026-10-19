import type { OrganismState } from '../core/types.ts';

export type SleepState = 'awake' | 'light-sleep' | 'deep-sleep' | 'waking';
export type SensorSource = 'android-termux' | 'node-host' | 'simulated';

export interface BodyTelemetry {
  battery01: number;
  batteryTemperatureC: number | null;
  thermalPressure01: number;
  cpuLoad01: number;
  ramPressure01: number;
  networkOnline: boolean | null;
  screenInteractive: boolean | null;
  ambientLight01: number | null;
  proximity01: number | null;
  motion01: number | null;
  charging: boolean | null;
  sampledAt: number;
  source: SensorSource;
  staleMs: number;
}

export interface OrganismBodyState {
  schemaVersion: 1;
  sleep: SleepState;
  awake: boolean;
  telemetry: BodyTelemetry;
  lastExternalEventAt: number;
  lastUserActivityAt: number;
  wakeReason: string | null;
  bodyEnergy01: number;
  thermalStrain01: number;
  sensoryFreshness01: number;
  cognitiveCapacity01: number;
  circadian01: number;
  ttsAvailable: boolean;
  sttAvailable: boolean;
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
}

export interface OrganismBodyEvent {
  at: number;
  kind: 'sensor' | 'sleep' | 'wake' | 'resource' | 'external';
  detail: string;
  importance: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function defaultBodyState(now = Date.now()): OrganismBodyState {
  return {
    schemaVersion: 1,
    sleep: 'awake',
    awake: true,
    telemetry: {
      battery01: 0.75,
      batteryTemperatureC: null,
      thermalPressure01: 0.12,
      cpuLoad01: 0.15,
      ramPressure01: 0.18,
      networkOnline: null,
      screenInteractive: null,
      ambientLight01: null,
      proximity01: null,
      motion01: null,
      charging: null,
      sampledAt: now,
      source: 'simulated',
      staleMs: 0,
    },
    lastExternalEventAt: now,
    lastUserActivityAt: now,
    wakeReason: 'startup',
    bodyEnergy01: 0.78,
    thermalStrain01: 0.12,
    sensoryFreshness01: 1,
    cognitiveCapacity01: 0.84,
    circadian01: 0.7,
    ttsAvailable: false,
    sttAvailable: false,
    cameraAvailable: false,
    microphoneAvailable: false,
  };
}

export function synthesizeBody(telemetry: BodyTelemetry, prev: OrganismBodyState, now = Date.now()): OrganismBodyState {
  const tempPressure = telemetry.batteryTemperatureC == null
    ? prev.thermalStrain01 * 0.92
    : clamp((telemetry.batteryTemperatureC - 28) / 24);
  const thermal = clamp(tempPressure * 0.75 + telemetry.thermalPressure01 * 0.55);
  const resourcePenalty = clamp((1 - telemetry.battery01) * 0.38 + telemetry.ramPressure01 * 0.26 + thermal * 0.34);
  const bodyEnergy = clamp(telemetry.battery01 * 0.7 + (1 - resourcePenalty) * 0.3);
  const capacity = clamp(1 - telemetry.ramPressure01 * 0.42 - telemetry.cpuLoad01 * 0.22 - thermal * 0.38);
  const fresh = clamp(1 - Math.min(1, telemetry.staleMs / 120_000));
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const circadian = clamp(0.5 + Math.sin(((hour - 7) / 24) * Math.PI * 2) * 0.32);

  const sleepCandidate = !prev.awake ? prev.sleep : (
    telemetry.battery01 < 0.08 || (telemetry.ramPressure01 > 0.94 && telemetry.cpuLoad01 > 0.9) ? 'light-sleep' : 'awake'
  );
  return {
    ...prev,
    sleep: sleepCandidate,
    awake: sleepCandidate === 'awake' || sleepCandidate === 'waking',
    telemetry: { ...telemetry, sampledAt: now, staleMs: Math.max(0, now - telemetry.sampledAt) },
    bodyEnergy01: bodyEnergy,
    thermalStrain01: thermal,
    sensoryFreshness01: fresh,
    cognitiveCapacity01: capacity,
    circadian01: circadian,
  };
}

export function applyBodyToOrganismState(state: OrganismState, body: OrganismBodyState): OrganismState {
  const n = state.needs;
  const lowBattery = clamp((0.35 - body.telemetry.battery01) / 0.35);
  const heat = body.thermalStrain01;
  const sleepPenalty = body.awake ? 0 : 0.48;
  n.energy = clamp(n.energy * 0.62 + body.bodyEnergy01 * 0.38 - lowBattery * 0.08);
  n.cognitiveLoad = clamp(n.cognitiveLoad * 0.72 + (1 - body.cognitiveCapacity01) * 0.42 + heat * 0.16 + sleepPenalty * 0.12);
  n.uncertainty = clamp(n.uncertainty * 0.98 + (1 - body.sensoryFreshness01) * 0.10);
  state.attentionBudget = clamp(state.attentionBudget * 0.7 + body.cognitiveCapacity01 * 0.3);
  return state;
}

export function bodyActionPenalty(body: OrganismBodyState): number {
  return clamp((1 - body.cognitiveCapacity01) * 0.34 + body.thermalStrain01 * 0.28 + (1 - body.bodyEnergy01) * 0.26);
}

export function shouldEnterSleep(body: OrganismBodyState, now = Date.now()): boolean {
  const idleMs = now - body.lastUserActivityAt;
  const resourcePressure = (1 - body.telemetry.battery01) * 0.5 + body.telemetry.ramPressure01 * 0.2 + body.thermalStrain01 * 0.3;
  return resourcePressure > 0.72 || (idleMs > 45 * 60_000 && body.circadian01 < 0.38);
}
