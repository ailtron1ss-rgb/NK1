export type PhoneRuntimeMode = 'eco' | 'active' | 'research';

export interface PhonePolicyConfig {
  mode: PhoneRuntimeMode;
  baseIntervalMs: number;
  samplerIntervalMs: number;
  checkpointMinIntervalMs: number;
  checkpointMaxDirtyCycles: number;
  worldCheckpointMinIntervalMs: number;
  worldCheckpointMaxDirtyCycles: number;
  maxConsecutiveActiveCycles: number;
}

export interface PhonePolicyDecision {
  nextDelayMs: number;
  sampleDelayMs: number;
  cognitiveBudget01: number;
  resourcePressure01: number;
  reasonCodes: string[];
  shouldPersistWorld: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const positiveInt = (value: string | number | undefined, fallback: number, minimum: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : fallback;
};

export function resolvePhonePolicyConfig(env: Record<string, string | undefined> = process.env): PhonePolicyConfig {
  const phoneMode = !/^(0|false|no|off)$/i.test(String(env.NEURO_PHONE_MODE ?? 'true'));
  const mode = (String(env.NEURO_RUNTIME_MODE ?? (phoneMode ? 'active' : 'research')) as PhoneRuntimeMode);
  const safeMode: PhoneRuntimeMode = mode === 'eco' || mode === 'research' || mode === 'active' ? mode : (phoneMode ? 'active' : 'research');
  const baseIntervalMs = positiveInt(env.NEURO_INTERVAL_MS, 30_000, 5_000);
  const samplerIntervalMs = positiveInt(env.NEURO_SENSOR_INTERVAL_MS, safeMode === 'eco' ? 120_000 : safeMode === 'active' ? 60_000 : baseIntervalMs, 10_000);
  const checkpointMinIntervalMs = positiveInt(env.NEURO_CHECKPOINT_MIN_INTERVAL_MS, safeMode === 'research' ? 0 : 60_000, 0);
  const checkpointMaxDirtyCycles = positiveInt(env.NEURO_CHECKPOINT_MAX_DIRTY_CYCLES, safeMode === 'research' ? 4 : 3, 1);
  const worldCheckpointMinIntervalMs = positiveInt(env.NEURO_WORLD_CHECKPOINT_MIN_INTERVAL_MS, safeMode === 'research' ? 0 : 300_000, 0);
  const worldCheckpointMaxDirtyCycles = positiveInt(env.NEURO_WORLD_CHECKPOINT_MAX_DIRTY_CYCLES, safeMode === 'research' ? 8 : 10, 1);
  const maxConsecutiveActiveCycles = positiveInt(env.NEURO_MAX_CONSECUTIVE_ACTIVE_CYCLES, safeMode === 'eco' ? 1 : safeMode === 'active' ? 3 : 8, 1);
  return { mode: safeMode, baseIntervalMs, samplerIntervalMs, checkpointMinIntervalMs, checkpointMaxDirtyCycles, worldCheckpointMinIntervalMs, worldCheckpointMaxDirtyCycles, maxConsecutiveActiveCycles };
}

export function choosePhonePolicyDelay(input: {
  baseIntervalMs: number;
  mode: PhoneRuntimeMode;
  awake: boolean;
  battery01: number;
  thermalStrain01: number;
  ramPressure01: number;
  cpuLoad01: number;
  lastStepMs: number;
  previousThermalStrain01: number;
  consecutiveActiveCycles: number;
  maxConsecutiveActiveCycles?: number;
}): PhonePolicyDecision {
  const battery = clamp01(input.battery01);
  const thermal = clamp01(input.thermalStrain01);
  const ram = clamp01(input.ramPressure01);
  const cpu = clamp01(input.cpuLoad01);
  const thermalTrend = thermal - clamp01(input.previousThermalStrain01);
  let multiplier = input.mode === 'eco' ? 1.75 : input.mode === 'active' ? 1 : 0.75;
  const reasonCodes: string[] = [];

  if (!input.awake) { multiplier = Math.max(multiplier, 10); reasonCodes.push('sleep'); }
  if (battery < 0.20) { multiplier = Math.max(multiplier, 4); reasonCodes.push('low-battery'); }
  else if (battery < 0.35) { multiplier = Math.max(multiplier, 2); reasonCodes.push('battery-saving'); }
  if (thermal > 0.82 || thermalTrend > 0.04) { multiplier = Math.max(multiplier, thermalTrend > 0.04 ? 3 : 4); reasonCodes.push(thermalTrend > 0.04 ? 'thermal-rising' : 'thermal-critical'); }
  else if (thermal > 0.68) { multiplier = Math.max(multiplier, 2); reasonCodes.push('thermal-elevated'); }
  if (ram > 0.90) { multiplier = Math.max(multiplier, 3); reasonCodes.push('ram-pressure'); }
  else if (ram > 0.78) { multiplier = Math.max(multiplier, 1.6); reasonCodes.push('ram-elevated'); }
  if (cpu > 0.90) { multiplier = Math.max(multiplier, 2); reasonCodes.push('cpu-pressure'); }
  if (input.lastStepMs > input.baseIntervalMs * 0.7) { multiplier = Math.max(multiplier, 1.5); reasonCodes.push('slow-cycle'); }
  if (input.consecutiveActiveCycles >= 2 && thermalTrend > 0) { multiplier = Math.max(multiplier, 1.75); reasonCodes.push('cooldown'); }
  if (input.consecutiveActiveCycles >= Math.max(1, input.maxConsecutiveActiveCycles ?? 3)) { multiplier = Math.max(multiplier, 2.5); reasonCodes.push('cycle-budget'); }

  const nextDelayMs = Math.max(5_000, Math.round(input.baseIntervalMs * multiplier));
  const pressure = Math.max(battery < 0.2 ? 0.8 : 0, thermal > 0.68 ? (thermal - 0.68) / 0.32 : 0, ram > 0.78 ? (ram - 0.78) / 0.22 : 0, cpu > 0.85 ? (cpu - 0.85) / 0.15 : 0);
  const consecutivePressure = Math.min(1, input.consecutiveActiveCycles / Math.max(1, 6));
  const resourcePressure01 = clamp01(Math.max(pressure, consecutivePressure * 0.35));
  const cognitiveBudget01 = clamp01(1 - resourcePressure01);
  if (!reasonCodes.length) reasonCodes.push('nominal');
  const sampleMultiplier = input.mode === 'eco' ? 0.85 : input.mode === 'active' ? 0.65 : 0.5;
  return { nextDelayMs, sampleDelayMs: Math.max(10_000, Math.min(10 * 60_000, Math.round(nextDelayMs * sampleMultiplier))), cognitiveBudget01, resourcePressure01, reasonCodes, shouldPersistWorld: false };
}
