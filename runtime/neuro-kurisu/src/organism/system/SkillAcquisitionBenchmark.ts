const clamp = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const MAX_CONTEXT_REGISTRY = 4096;
const MIN_HOLDOUT_CONTEXTS = 3;
const MAX_CONTEXT_LENGTH = 160;
const MAX_ACTION_LENGTH = 64;
const MAX_RECENT_SAMPLES = 128;
const VALID_PHASES = ['baseline', 'learning', 'holdout'] as const;

type SkillPhase = (typeof VALID_PHASES)[number];
type DataRead = { found: boolean; safe: boolean; value?: unknown };

export interface SkillBenchmarkSample {
  action: string;
  contextKey: string;
  outcome01: number;
  at: number;
  phase: SkillPhase;
}

export interface SkillAcquisitionState {
  version: 1;
  samples: number;
  tasks: number;
  baselineMean01: number;
  holdoutMean01: number;
  gain01: number;
  novelContexts: number;
  recent: SkillBenchmarkSample[];
  lastAt: number;
  contextPhaseByKey: Record<string, SkillPhase>;
  contaminatedHoldoutSamples: number;
  acceptedHoldoutSamples: number;
  contextRegistrySaturated: boolean;
}

export const defaultSkillAcquisition = (): SkillAcquisitionState => ({
  version: 1,
  samples: 0,
  tasks: 0,
  baselineMean01: 0.5,
  holdoutMean01: 0.5,
  gain01: 0,
  novelContexts: 0,
  recent: [],
  lastAt: 0,
  contextPhaseByKey: Object.create(null) as Record<string, SkillPhase>,
  contaminatedHoldoutSamples: 0,
  acceptedHoldoutSamples: 0,
  contextRegistrySaturated: false,
});

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

// Read only own data properties. Accessors are never invoked while restoring persisted data.
const readOwnData = (record: unknown, key: string): DataRead => {
  if (!isPlainRecord(record)) return { found: false, safe: false };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor) return { found: false, safe: true };
    if (!Object.hasOwn(descriptor, 'value')) return { found: true, safe: false };
    return { found: true, safe: true, value: descriptor.value };
  } catch {
    return { found: true, safe: false };
  }
};

const readOwnArrayIndex = (array: unknown[], index: number): DataRead => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
    if (!descriptor) return { found: false, safe: true };
    if (!Object.hasOwn(descriptor, 'value')) return { found: true, safe: false };
    return { found: true, safe: true, value: descriptor.value };
  } catch {
    return { found: true, safe: false };
  }
};

const isPhase = (value: unknown): value is SkillPhase =>
  typeof value === 'string' && (VALID_PHASES as readonly string[]).includes(value);

const safeCounter = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;

const safeUnit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback;

const safeTimestamp = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const normalizeContextKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  try {
    const normalized = value.normalize('NFKC').trim().toLowerCase();
    return normalized.length > 0 && normalized.length <= MAX_CONTEXT_LENGTH ? normalized : null;
  } catch {
    return null;
  }
};

const normalizeAction = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_ACTION_LENGTH) : '';

const saturatingIncrement = (value: number): number =>
  value >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : value + 1;

export class SkillAcquisitionBenchmark {
  private state = defaultSkillAcquisition();

  restore(raw?: unknown): void {
    if (raw === undefined || raw === null) {
      this.state = defaultSkillAcquisition();
      return;
    }

    const d = defaultSkillAcquisition();
    let compromised = !isPlainRecord(raw);
    const read = (key: string): DataRead => {
      const result = readOwnData(raw, key);
      if (!result.safe) compromised = true;
      return result;
    };

    const registryRead = read('contextPhaseByKey');
    const registry: Record<string, SkillPhase> = Object.create(null) as Record<string, SkillPhase>;
    let registrySaturated = false;

    if (registryRead.found && registryRead.safe && registryRead.value !== undefined) {
      if (!isPlainRecord(registryRead.value)) {
        compromised = true;
      } else {
        let keys: string[] = [];
        try {
          keys = Object.keys(registryRead.value);
        } catch {
          compromised = true;
        }
        if (keys.length > MAX_CONTEXT_REGISTRY) {
          registrySaturated = true;
          compromised = true;
          keys = keys.slice(0, MAX_CONTEXT_REGISTRY);
        }
        for (const key of keys) {
          const phaseRead = readOwnData(registryRead.value, key);
          if (!phaseRead.safe || !isPhase(phaseRead.value)) {
            compromised = true;
            continue;
          }
          const normalizedKey = normalizeContextKey(key);
          if (!normalizedKey) {
            compromised = true;
            continue;
          }
          if (Object.hasOwn(registry, normalizedKey)) {
            if (registry[normalizedKey] !== phaseRead.value) {
              delete registry[normalizedKey];
              compromised = true;
            }
            continue;
          }
          Object.defineProperty(registry, normalizedKey, {
            value: phaseRead.value,
            enumerable: true,
            writable: false,
            configurable: true,
          });
        }
      }
    } else if (registryRead.found && !registryRead.safe) {
      compromised = true;
    }

    const uniqueHoldoutContexts = Object.values(registry).filter((phase) => phase === 'holdout').length;
    const samplesRead = read('samples');
    const tasksRead = read('tasks');
    const baselineRead = read('baselineMean01');
    const holdoutRead = read('holdoutMean01');
    const gainRead = read('gain01');
    const novelRead = read('novelContexts');
    const lastAtRead = read('lastAt');
    const contaminationRead = read('contaminatedHoldoutSamples');
    const saturationRead = read('contextRegistrySaturated');
    if (uniqueHoldoutContexts > 0 && (!contaminationRead.found || !saturationRead.found)) compromised = true;
    const recentRead = read('recent');

    const samples = safeCounter(samplesRead.value);
    const tasks = safeCounter(tasksRead.value);
    const baselineMean01 = safeUnit(baselineRead.value, d.baselineMean01);
    const holdoutMean01 = safeUnit(holdoutRead.value, d.holdoutMean01);
    const novelContexts = Math.max(safeCounter(novelRead.value), Object.keys(registry).length);
    const lastAt = safeTimestamp(lastAtRead.value);
    let contaminatedHoldoutSamples = safeCounter(contaminationRead.value);
    const contextRegistrySaturated = saturationRead.value === true || registrySaturated;

    for (const item of [samplesRead, tasksRead, baselineRead, holdoutRead, gainRead, novelRead, lastAtRead, contaminationRead, saturationRead]) {
      if (item.found && item.safe && item.value !== undefined) {
        const valid =
          (item === samplesRead || item === tasksRead || item === novelRead || item === contaminationRead)
            ? typeof item.value === 'number' && Number.isSafeInteger(item.value) && item.value >= 0
            : item === saturationRead
              ? typeof item.value === 'boolean'
              : item === lastAtRead
                ? typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0
                : typeof item.value === 'number' && Number.isFinite(item.value);
        if (!valid) compromised = true;
      }
    }

    const recent: SkillBenchmarkSample[] = [];
    if (recentRead.found && recentRead.safe && recentRead.value !== undefined) {
      if (!Array.isArray(recentRead.value)) {
        compromised = true;
      } else {
        let length = 0;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(recentRead.value, 'length');
          length = descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'number'
            ? descriptor.value
            : 0;
        } catch {
          compromised = true;
        }
        const start = Math.max(0, length - MAX_RECENT_SAMPLES);
        for (let index = start; index < length; index += 1) {
          const entryRead = readOwnArrayIndex(recentRead.value, index);
          if (!entryRead.safe || !isPlainRecord(entryRead.value)) {
            compromised = true;
            continue;
          }
          const actionRead = readOwnData(entryRead.value, 'action');
          const contextRead = readOwnData(entryRead.value, 'contextKey');
          const outcomeRead = readOwnData(entryRead.value, 'outcome01');
          const atRead = readOwnData(entryRead.value, 'at');
          const phaseRead = readOwnData(entryRead.value, 'phase');
          if (![actionRead, contextRead, outcomeRead, atRead, phaseRead].every((field) => field.safe)) {
            compromised = true;
            continue;
          }
          const contextKey = normalizeContextKey(contextRead.value);
          if (typeof actionRead.value !== 'string' || !contextKey ||
              typeof outcomeRead.value !== 'number' || !Number.isFinite(outcomeRead.value) ||
              typeof atRead.value !== 'number' || !Number.isFinite(atRead.value) || atRead.value < 0 ||
              !isPhase(phaseRead.value)) {
            compromised = true;
            continue;
          }
          recent.push({
            action: normalizeAction(actionRead.value),
            contextKey,
            outcome01: clamp(outcomeRead.value),
            at: atRead.value,
            phase: phaseRead.value,
          });
        }
      }
    } else if (recentRead.found && !recentRead.safe) {
      compromised = true;
    }

    if (compromised) contaminatedHoldoutSamples = saturatingIncrement(contaminatedHoldoutSamples);
    const holdoutEligible = uniqueHoldoutContexts >= MIN_HOLDOUT_CONTEXTS &&
      contaminatedHoldoutSamples === 0 && !contextRegistrySaturated;

    this.state = {
      version: 1,
      samples,
      tasks,
      baselineMean01,
      holdoutMean01,
      gain01: holdoutEligible ? safeUnit(gainRead.value, 0) : 0,
      novelContexts,
      recent: recent.slice(-MAX_RECENT_SAMPLES),
      lastAt,
      contextPhaseByKey: registry,
      contaminatedHoldoutSamples,
      acceptedHoldoutSamples: uniqueHoldoutContexts,
      contextRegistrySaturated,
    };
  }

  snapshot(): SkillAcquisitionState {
    return structuredClone(this.state);
  }

  observe(input: { action: string; contextKey: string; outcome01: number; phase?: SkillPhase }): SkillBenchmarkSample & { holdoutEvidenceAccepted: boolean } {
    const actionRead = readOwnData(input, 'action');
    const contextRead = readOwnData(input, 'contextKey');
    const outcomeRead = readOwnData(input, 'outcome01');
    const phaseRead = readOwnData(input, 'phase');
    const inputCompromised = !actionRead.safe || !contextRead.safe || !outcomeRead.safe || !phaseRead.safe;
    const phase: SkillPhase = isPhase(phaseRead.value) ? phaseRead.value : 'learning';
    const normalizedContext = normalizeContextKey(contextRead.value);
    const contextValid = normalizedContext !== null;
    const outcomeValid = typeof outcomeRead.value === 'number' && Number.isFinite(outcomeRead.value);
    const context = normalizedContext ?? (typeof contextRead.value === 'string' ? contextRead.value.slice(0, MAX_CONTEXT_LENGTH) : '');
    const action = normalizeAction(actionRead.value);
    const outcome01 = outcomeValid ? clamp(outcomeRead.value as number) : 0;
    const priorPhase = contextValid && Object.hasOwn(this.state.contextPhaseByKey, normalizedContext)
      ? this.state.contextPhaseByKey[normalizedContext]
      : undefined;
    const contaminated = phase === 'holdout'
      ? (!contextValid || !outcomeValid || inputCompromised || (priorPhase !== undefined && priorPhase !== 'holdout'))
      : priorPhase === 'holdout';

    if (contaminated) this.state.contaminatedHoldoutSamples = saturatingIncrement(this.state.contaminatedHoldoutSamples);

    let registeredNewContext = false;
    if (contextValid && priorPhase === undefined) {
      const registrySize = Object.keys(this.state.contextPhaseByKey).length;
      if (registrySize < MAX_CONTEXT_REGISTRY && !this.state.contextRegistrySaturated) {
        Object.defineProperty(this.state.contextPhaseByKey, normalizedContext, {
          value: phase,
          enumerable: true,
          writable: false,
          configurable: true,
        });
        registeredNewContext = true;
      } else {
        this.state.contextRegistrySaturated = true;
      }
    }

    if (registeredNewContext) this.state.novelContexts = saturatingIncrement(this.state.novelContexts);

    const row: SkillBenchmarkSample = {
      action,
      contextKey: context,
      outcome01,
      at: Date.now(),
      phase,
    };
    this.state.samples = saturatingIncrement(this.state.samples);
    this.state.tasks = Math.max(this.state.tasks, Math.ceil(this.state.samples / 3));
    this.state.recent = [row, ...this.state.recent].slice(0, MAX_RECENT_SAMPLES);

    const update = (old: number, value: number, rate: number): number => clamp(old * (1 - rate) + value * rate);
    if (phase === 'baseline' && !contaminated && registeredNewContext && outcomeValid && !inputCompromised) {
      this.state.baselineMean01 = update(this.state.baselineMean01, outcome01, 0.18);
    }

    const acceptedHoldout = phase === 'holdout' && !contaminated && registeredNewContext && outcomeValid && !this.state.contextRegistrySaturated;
    if (acceptedHoldout) {
      this.state.holdoutMean01 = update(this.state.holdoutMean01, outcome01, 0.22);
      this.state.acceptedHoldoutSamples = saturatingIncrement(this.state.acceptedHoldoutSamples);
    }

    const learningGap = this.state.holdoutMean01 - this.state.baselineMean01;
    const holdoutEligible = this.state.acceptedHoldoutSamples >= MIN_HOLDOUT_CONTEXTS &&
      this.state.contaminatedHoldoutSamples === 0 && !this.state.contextRegistrySaturated;
    this.state.gain01 = holdoutEligible
      ? clamp(0.9 * this.state.gain01 + 0.1 * (learningGap > 0 ? learningGap : 0))
      : 0;
    this.state.lastAt = row.at;
    return { ...structuredClone(row), holdoutEvidenceAccepted: acceptedHoldout };
  }

  summary() {
    const holdoutEligible = this.state.acceptedHoldoutSamples >= MIN_HOLDOUT_CONTEXTS &&
      this.state.contaminatedHoldoutSamples === 0 && !this.state.contextRegistrySaturated;
    return {
      samples: this.state.samples,
      tasks: this.state.tasks,
      baselineMean01: this.state.baselineMean01,
      holdoutMean01: this.state.holdoutMean01,
      gain01: holdoutEligible ? this.state.gain01 : 0,
      novelContexts: this.state.novelContexts,
      holdoutSamples: this.state.acceptedHoldoutSamples,
      contaminatedHoldoutSamples: this.state.contaminatedHoldoutSamples,
      acceptedHoldoutSamples: this.state.acceptedHoldoutSamples,
      holdoutContextsRequired: MIN_HOLDOUT_CONTEXTS,
      holdoutEligible,
      contextRegistrySaturated: this.state.contextRegistrySaturated,
      eligibilityBasis: 'unique-context-floor-only' as const,
      independentEvaluatorRequired: true as const,
    };
  }
}
