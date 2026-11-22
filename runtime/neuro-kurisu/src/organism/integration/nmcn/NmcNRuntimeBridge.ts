/**
 * Optional, bounded bridge from the canonical NK1 cycle into the NMCN 0.4.x
 * sidecar. NMCN is an advisor: it cannot write MemoryOS2 or dispatch actions.
 */
export const NMCN_BRIDGE_SCHEMA_VERSION = 1 as const;
export const NMCN_STATE_DIMENSION = 8;
export const NMCN_ACTION_DIMENSION = 6;
export const NMCN_MEMORY_KEY_DIMENSION = 8;

const ACTIONS = ['observe', 'inspect', 'move', 'collect', 'rest', 'communicate'] as const;
const MAX_AUXILIARY_STATE_BYTES = 64 * 1024 * 1024;

export interface NmcNRuntimeInput {
  schema_version: 1;
  tick: number;
  state: number[];
  action: number[];
  memory_key: number[];
  signal: {
    signal_id: string;
    payload_ref: string;
    goal_relevance: number;
    novelty: number;
    prediction_error: number;
    urgency: number;
    consequence: number;
    risk: number;
    uncertainty: number;
    created_at: number;
  };
  low_power: boolean;
}

export interface NmcNRuntimePort {
  /** Host adapter for NeuroCore_Neural_Evolution NeuroCoreRuntime.evaluate(). */
  evaluate(input: NmcNRuntimeInput, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface NmcNRuntimeDecision {
  mode: string;
  reason: string;
  invokeLanguageCore: boolean;
  distributionShiftDetected: boolean;
  maxReasoningCycles: number;
  estimatedAuxiliaryStateBytes: number;
}

export interface NmcNRuntimeInputSource {
  tick: number;
  energy01: number;
  cognitiveLoad01: number;
  uncertainty01: number;
  novelty01: number;
  goalPressure01: number;
  predictionError01: number;
  bodyEnergy01: number;
  thermalStrain01: number;
  sensoryFreshness01: number;
  battery01: number;
  selectedAction?: string | null;
  lowPower: boolean;
  nowMs?: number;
}

function unit(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function boundedVector(value: unknown, expected: number, name: string): number[] {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new Error(`nmcn-invalid-${name}-dimension`);
  }
  return value.map((entry) => {
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1) {
      throw new Error(`nmcn-invalid-${name}-value`);
    }
    return entry;
  });
}

/** Create the fixed-size, numeric-only projection; no user text or memory payload leaves NK1. */
export function buildNmcNRuntimeInput(source: NmcNRuntimeInputSource): NmcNRuntimeInput {
  if (!Number.isSafeInteger(source.tick) || source.tick < 0) throw new Error('nmcn-invalid-tick');
  const energy = unit(source.energy01);
  const cognitiveLoad = unit(source.cognitiveLoad01);
  const uncertainty = unit(source.uncertainty01);
  const novelty = unit(source.novelty01);
  const goalPressure = unit(source.goalPressure01);
  const predictionError = unit(source.predictionError01);
  const bodyEnergy = unit(source.bodyEnergy01);
  const thermal = unit(source.thermalStrain01);
  const freshness = unit(source.sensoryFreshness01);
  const battery = unit(source.battery01);
  const action = ACTIONS.map((name) => name === source.selectedAction ? 1 : 0);
  const nowMs = Number.isFinite(source.nowMs) ? Math.max(0, Number(source.nowMs)) : Date.now();

  return {
    schema_version: NMCN_BRIDGE_SCHEMA_VERSION,
    tick: source.tick,
    state: [energy, cognitiveLoad, uncertainty, novelty, goalPressure, predictionError, bodyEnergy, thermal],
    action,
    memory_key: [novelty, uncertainty, goalPressure, predictionError, energy, cognitiveLoad, freshness, battery],
    signal: {
      signal_id: `nk1-cycle-${source.tick}`,
      payload_ref: `nk1-cycle:${source.tick}`,
      goal_relevance: goalPressure,
      novelty,
      prediction_error: predictionError,
      urgency: goalPressure,
      consequence: predictionError,
      risk: unit((1 - energy) * 0.45 + cognitiveLoad * 0.35 + uncertainty * 0.20),
      uncertainty,
      created_at: nowMs / 1000,
    },
    low_power: source.lowPower === true,
  };
}

function normalizeDecision(value: unknown): NmcNRuntimeDecision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const compute = record.compute && typeof record.compute === 'object' && !Array.isArray(record.compute)
    ? record.compute as Record<string, unknown>
    : null;
  if (typeof record.invoke_language_core !== 'boolean' || typeof record.distribution_shift_detected !== 'boolean' || !compute) {
    return null;
  }
  const mode = typeof compute.mode === 'string' ? compute.mode.trim().slice(0, 40) : '';
  const computeReason = typeof compute.reason === 'string' ? compute.reason : '';
  const reason = typeof record.invocation_reason === 'string' ? record.invocation_reason : computeReason;
  const cycles = Number(compute.max_reasoning_cycles);
  const bytes = Number(record.estimated_auxiliary_state_bytes);
  if (!mode || !reason.trim() || !Number.isInteger(cycles) || cycles < 0 || cycles > 8 ||
      !Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_AUXILIARY_STATE_BYTES) return null;
  return {
    mode,
    reason: reason.trim().slice(0, 180),
    invokeLanguageCore: record.invoke_language_core,
    distributionShiftDetected: record.distribution_shift_detected,
    maxReasoningCycles: cycles,
    estimatedAuxiliaryStateBytes: bytes,
  };
}

/**
 * A timeout, transport error or malformed sidecar response degrades to null.
 * The caller must continue with canonical NK1 policy and must not infer health.
 */
export async function evaluateNmcNRuntime(
  port: NmcNRuntimePort,
  input: NmcNRuntimeInput,
  options: { timeoutMs?: number } = {},
): Promise<NmcNRuntimeDecision | null> {
  if (!port || typeof port.evaluate !== 'function') return null;
  try {
    boundedVector(input.state, NMCN_STATE_DIMENSION, 'state');
    boundedVector(input.action, NMCN_ACTION_DIMENSION, 'action');
    boundedVector(input.memory_key, NMCN_MEMORY_KEY_DIMENSION, 'memory-key');
    if (input.schema_version !== NMCN_BRIDGE_SCHEMA_VERSION || !Number.isSafeInteger(input.tick) || input.tick < 0) return null;
    const timeoutMs = Number.isFinite(options.timeoutMs)
      ? Math.max(10, Math.min(1000, Number(options.timeoutMs)))
      : 80;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<null>((resolve) => {
      timeout = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, timeoutMs);
    });
    const evaluation = Promise.resolve()
      .then(() => port.evaluate(input, { signal: controller.signal }))
      .then(normalizeDecision)
      .catch(() => null);
    try {
      return await Promise.race([evaluation, timeoutPromise]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
