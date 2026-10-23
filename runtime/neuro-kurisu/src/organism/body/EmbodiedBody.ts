import type { OrganismState } from '../core/types.ts';
import { snapshotPlainData } from '../core/PlainDataSnapshot.ts';

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

const isRecord = (value:unknown):value is Record<string,unknown> => value!==null && typeof value==='object' && !Array.isArray(value);
const unit01 = (value:unknown):value is number => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=1;
const timestamp = (value:unknown):value is number => typeof value==='number' && Number.isSafeInteger(value) && value>=0;
const nullableUnit01 = (value:unknown):boolean => value===null || unit01(value);
const nullableBoolean = (value:unknown):boolean => value===null || typeof value==='boolean';

/**
 * Validate a persisted body checkpoint before it can influence sensing, sleep,
 * resource regulation, speech planning, or action selection.
 *
 * Snapshotting comes first so malformed plugin/persistence objects cannot run
 * getters or survive through structuredClone into the live body state.
 */
export function normalizePersistedBodyState(raw:unknown):OrganismBodyState|null {
  let value:unknown;
  try {
    value=snapshotPlainData<unknown>(raw,{
      maxDepth:16,maxNodes:1024,maxStringUnits:8192,
    });
  } catch {
    return null;
  }
  if(!isRecord(value)||value.schemaVersion!==1||!isRecord(value.telemetry))return null;
  const t=value.telemetry;
  if(!['awake','light-sleep','deep-sleep','waking'].includes(String(value.sleep))||
     typeof value.awake!=='boolean'||
     (value.awake && !['awake','waking'].includes(String(value.sleep)))||
     (!value.awake && !['light-sleep','deep-sleep'].includes(String(value.sleep)))||
     !timestamp(value.lastExternalEventAt)||!timestamp(value.lastUserActivityAt)||
     !(value.wakeReason===null||(typeof value.wakeReason==='string'&&value.wakeReason.length<=200))||
     !unit01(value.bodyEnergy01)||!unit01(value.thermalStrain01)||!unit01(value.sensoryFreshness01)||
     !unit01(value.cognitiveCapacity01)||!unit01(value.circadian01)||
     typeof value.ttsAvailable!=='boolean'||typeof value.sttAvailable!=='boolean'||
     typeof value.cameraAvailable!=='boolean'||typeof value.microphoneAvailable!=='boolean'||
     !unit01(t.battery01)||
     !(t.batteryTemperatureC===null||(typeof t.batteryTemperatureC==='number'&&Number.isFinite(t.batteryTemperatureC)&&t.batteryTemperatureC>=-50&&t.batteryTemperatureC<=125))||
     !unit01(t.thermalPressure01)||!unit01(t.cpuLoad01)||!unit01(t.ramPressure01)||
     !nullableBoolean(t.networkOnline)||!nullableBoolean(t.screenInteractive)||
     !nullableUnit01(t.ambientLight01)||!nullableUnit01(t.proximity01)||!nullableUnit01(t.motion01)||
     !nullableBoolean(t.charging)||!timestamp(t.sampledAt)||!timestamp(t.staleMs)||
     !['android-termux','node-host','simulated'].includes(String(t.source)))return null;
  return {
    schemaVersion:1,
    sleep:value.sleep as SleepState,
    awake:value.awake,
    telemetry:{
      battery01:t.battery01 as number,
      batteryTemperatureC:t.batteryTemperatureC as number|null,
      thermalPressure01:t.thermalPressure01 as number,
      cpuLoad01:t.cpuLoad01 as number,
      ramPressure01:t.ramPressure01 as number,
      networkOnline:t.networkOnline as boolean|null,
      screenInteractive:t.screenInteractive as boolean|null,
      ambientLight01:t.ambientLight01 as number|null,
      proximity01:t.proximity01 as number|null,
      motion01:t.motion01 as number|null,
      charging:t.charging as boolean|null,
      sampledAt:t.sampledAt as number,
      source:t.source as SensorSource,
      staleMs:t.staleMs as number,
    },
    lastExternalEventAt:value.lastExternalEventAt,
    lastUserActivityAt:value.lastUserActivityAt,
    wakeReason:value.wakeReason as string|null,
    bodyEnergy01:value.bodyEnergy01,
    thermalStrain01:value.thermalStrain01,
    sensoryFreshness01:value.sensoryFreshness01,
    cognitiveCapacity01:value.cognitiveCapacity01,
    circadian01:value.circadian01,
    ttsAvailable:value.ttsAvailable,
    sttAvailable:value.sttAvailable,
    cameraAvailable:value.cameraAvailable,
    microphoneAvailable:value.microphoneAvailable,
  };
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
