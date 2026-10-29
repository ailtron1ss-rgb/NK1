import type { OrganismBodyState } from '../body/EmbodiedBody.ts';
import type { WorldContext } from '../core/types.ts';

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

type PerceptionKind = 'motion'|'proximity'|'light-change'|'resource'|'network-change'|'sensor-availability'|'world-surprise'|'social-input'|'text-input'|'quiet';

export interface PerceptionEvent {
  id: string;
  at: number;
  kind: PerceptionKind;
  salience: number;
  novelty: number;
  confidence: number;
  source: 'android'|'world'|'social'|'internal';
  detail: string;
  evidence: string[];
}

export interface PerceptionState {
  version: 2;
  lastEvent: PerceptionEvent | null;
  eventCount: number;
  rollingSalience: number;
  rollingNovelty: number;
  sensorChanges: number;
  worldChanges: number;
  externalEvents: number;
  quietCycles: number;
  /** True after the first fresh telemetry sample establishes a reference baseline. */
  baselineInitialized: boolean;
  /** True while sustained battery/thermal pressure is already reported. */
  resourcePressureActive: boolean;
  baseline: {
    battery01: number | null;
    ambientLight01: number | null;
    proximity01: number | null;
    motion01: number | null;
    networkOnline: boolean | null;
    thermal01: number | null;
  };
  recent: PerceptionEvent[];
}

export interface PerceptionInput {
  body?: OrganismBodyState;
  world?: WorldContext;
  previousWorld?: WorldContext | null;
  text?: string;
  surprise?: number;
  externalEvent?: { detail: string; importance?: number; source?: PerceptionEvent['source'] };
}

export function defaultPerceptionState(): PerceptionState {
  return {
    version:2,
    lastEvent:null,
    eventCount:0,
    rollingSalience:0.15,
    rollingNovelty:0.12,
    sensorChanges:0,
    worldChanges:0,
    externalEvents:0,
    quietCycles:0,
    baselineInitialized:false,
    resourcePressureActive:false,
    baseline:{battery01:null,ambientLight01:null,proximity01:null,motion01:null,networkOnline:null,thermal01:null},
    recent:[],
  };
}

function push(state:PerceptionState, event:Omit<PerceptionEvent,'id'|'at'>): PerceptionState {
  const next: PerceptionEvent = { id:`px-${state.eventCount+1}`, at:Date.now(), ...event };
  return {
    ...state,
    eventCount:state.eventCount+1,
    lastEvent:next,
    rollingSalience:clamp(state.rollingSalience*0.78 + next.salience*0.22),
    rollingNovelty:clamp(state.rollingNovelty*0.78 + next.novelty*0.22),
    recent:[next,...state.recent].slice(0,64),
    quietCycles: next.salience < 0.16 ? state.quietCycles+1 : 0,
  };
}

const changed = (prev:number|null, next:number|null, threshold:number) => prev != null && next != null && Math.abs(next-prev) >= threshold;
const MAX_SENSOR_STALE_MS = 120_000;
const MIN_SENSOR_FRESHNESS01 = 0.2;
const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;
const sensorValue01 = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value) : null;
const sensorBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;
const boundedText = (value: unknown, limit = 240): string => {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/\\s+/g, ' ').trim().slice(0, limit);
};

function quantized(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}
function stableStrings(value: unknown, sort = false): string[] {
  if (!Array.isArray(value)) return [];
  const result = value.filter((item): item is string => typeof item === 'string').map(item => item.normalize('NFKC').trim());
  return sort ? result.sort() : result;
}
/** Semantic delta, not just length delta: changing "door open" to "door closed" is a world change. */
function changedWorldSections(previous: WorldContext, current: WorldContext): string[] {
  const changedSections: string[] = [];
  if (previous.location !== current.location) changedSections.push('location');
  if (['energy','attention','uncertainty'].some(key =>
    quantized(previous[key as 'energy'|'attention'|'uncertainty']) !== quantized(current[key as 'energy'|'attention'|'uncertainty']))) {
    changedSections.push('state-metrics');
  }
  if (JSON.stringify(stableStrings(previous.facts, true)) !== JSON.stringify(stableStrings(current.facts, true))) {
    changedSections.push('facts');
  }
  const objectProjection = (items: unknown): unknown[] => {
    if (!Array.isArray(items)) return [];
    return items.map((item: any) => ({
      id: typeof item?.id === 'string' ? item.id : '',
      label: typeof item?.label === 'string' ? item.label : '',
      location: typeof item?.location === 'string' ? item.location : '',
      value: quantized(item?.value),
      valueKnown: typeof item?.valueKnown === 'boolean' ? item.valueKnown : typeof item?.value === 'number' && Number.isFinite(item.value),
      visible: item?.visible === true,
      visibilityKnown: typeof item?.visibilityKnown === 'boolean' ? item.visibilityKnown : typeof item?.visible === 'boolean',
      collected: item?.collected === true,
      collectionKnown: typeof item?.collectionKnown === 'boolean' ? item.collectionKnown : typeof item?.collected === 'boolean',
      confidence01: quantized(item?.confidence01),
      evidenceKind: typeof item?.evidenceKind === 'string' ? item.evidenceKind : null,
      sourceId: typeof item?.sourceId === 'string' ? item.sourceId : null,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id) || a.label.localeCompare(b.label));
  };
  if (JSON.stringify(objectProjection(previous.objects)) !== JSON.stringify(objectProjection(current.objects))) {
    changedSections.push('objects');
  }
  if (JSON.stringify(stableStrings(previous.events)) !== JSON.stringify(stableStrings(current.events))) {
    changedSections.push('events');
  }
  return changedSections;
}

export class PerceptionEngine {
  private state: PerceptionState = defaultPerceptionState();
  private lastWorld: WorldContext | null = null;
  restore(value?: Partial<PerceptionState> | null): void {
    const base = defaultPerceptionState();
    this.state = {
      ...base,
      ...(value ?? {}),
      version:2,
      baseline:{...base.baseline,...(value?.baseline ?? {})},
      baselineInitialized: typeof value?.baselineInitialized === 'boolean'
        ? value.baselineInitialized
        : !!value?.baseline && Object.values(value.baseline).some(v => v !== null),
      resourcePressureActive: typeof value?.resourcePressureActive === 'boolean' ? value.resourcePressureActive : false,
      recent:Array.isArray(value?.recent) ? value!.recent.slice(0,64) : [],
    };
    this.lastWorld = null;
  }
  snapshot(): PerceptionState { return structuredClone(this.state); }

  perceive(input:PerceptionInput): PerceptionEvent {
    const b = input.body;
    const now = Date.now();
    const sampleAt = b?.telemetry?.sampledAt;
    const sampleAgeMs = typeof sampleAt === 'number' && Number.isFinite(sampleAt) && sampleAt > 0
      ? now - sampleAt
      : Number.POSITIVE_INFINITY;
    const reportedStaleMs = b && Number.isFinite(b.telemetry?.staleMs) && b.telemetry.staleMs >= 0
      ? b.telemetry.staleMs
      : Number.POSITIVE_INFINITY;
    const effectiveStaleMs = Math.max(reportedStaleMs, Math.max(0, sampleAgeMs));
    const clockPlausible = Number.isFinite(sampleAgeMs) && sampleAgeMs >= -MAX_FUTURE_CLOCK_SKEW_MS;
    const bodyTelemetryFresh = !!b && Number.isFinite(b.sensoryFreshness01)
      && b.sensoryFreshness01 >= MIN_SENSOR_FRESHNESS01
      && b.sensoryFreshness01 <= 1
      && clockPlausible
      && effectiveStaleMs <= MAX_SENSOR_STALE_MS;
    const w = input.world;
    const prev = this.lastWorld ?? input.previousWorld ?? null;
    if (input.externalEvent) {
      this.state.externalEvents += 1;
      this.state = push(this.state, { kind:'world-surprise', salience:clamp(input.externalEvent.importance ?? 0.65), novelty:clamp(input.externalEvent.importance ?? 0.55), confidence:0.92, source:input.externalEvent.source ?? 'world', detail:boundedText(input.externalEvent.detail) || 'external event', evidence:['external-event'] });
      return this.state.lastEvent!;
    }
    if (input.text?.trim()) {
      this.state = push(this.state, { kind:'text-input', salience:0.66, novelty:0.42, confidence:0.98, source:'social', detail:'external textual input', evidence:[`length=${input.text.trim().length}`] });
      return this.state.lastEvent!;
    }

    if (b && bodyTelemetryFresh) {
      const current = {
        battery01:sensorValue01(b.telemetry.battery01),
        ambientLight01:sensorValue01(b.telemetry.ambientLight01),
        proximity01:sensorValue01(b.telemetry.proximity01),
        motion01:sensorValue01(b.telemetry.motion01),
        networkOnline:sensorBoolean(b.telemetry.networkOnline),
        thermal01:sensorValue01(b.thermalStrain01),
      };
      let baseline = this.state.baseline;
      if (!this.state.baselineInitialized) {
        // First fresh sample is a reference point, not a physical change.
        this.state = { ...this.state, baseline: current, baselineInitialized: true };
        baseline = current;
      } else {
        // Sensor signal availability is not equivalent to a numeric value of zero.
        // Report availability transitions separately and update one baseline field at a time.
        const availability = [
          { name: 'motion', key: 'motion01' as const, previous: baseline.motion01, current: current.motion01 },
          { name: 'proximity', key: 'proximity01' as const, previous: baseline.proximity01, current: current.proximity01 },
          { name: 'ambient-light', key: 'ambientLight01' as const, previous: baseline.ambientLight01, current: current.ambientLight01 },
          { name: 'network', key: 'networkOnline' as const, previous: baseline.networkOnline, current: current.networkOnline },
        ].find(item => (item.previous === null) !== (item.current === null));
        if (availability) {
          this.state.sensorChanges += 1;
          this.state.baseline = { ...baseline, [availability.key]: availability.current };
          const available = availability.current !== null;
          this.state = push(this.state, {
            kind: 'sensor-availability',
            salience: available ? 0.34 : 0.42,
            novelty: 0.65,
            confidence: 0.78,
            source: 'android',
            detail: `${availability.name} signal became ${available ? 'available' : 'unavailable'}`,
            evidence: [
              `sensor=${availability.name}`,
              `previous=${String(availability.previous)}`,
              `current=${String(availability.current)}`,
            ],
          });
          return this.state.lastEvent!;
        }
      }
      const resourcePressure = (current.battery01 !== null && current.battery01 < 0.18)
        || (current.thermal01 !== null && current.thermal01 > 0.72);
      if (resourcePressure && !this.state.resourcePressureActive) {
        this.state.resourcePressureActive = true;
        this.state.baseline = current;
        this.state = push(this.state, {
          kind:'resource', salience:0.78, novelty:0.32, confidence:0.97, source:'android',
          detail:'resource pressure detected',
          evidence:[`battery=${current.battery01?.toFixed(2) ?? 'unknown'}`,`thermal=${current.thermal01?.toFixed(2) ?? 'unknown'}`],
        });
        return this.state.lastEvent!;
      }
      if (!resourcePressure && this.state.resourcePressureActive) {
        this.state.resourcePressureActive = false;
        this.state.baseline = current;
        this.state = push(this.state, {
          kind:'resource', salience:0.38, novelty:0.28, confidence:0.9, source:'android',
          detail:'resource pressure cleared',
          evidence:[`battery=${current.battery01?.toFixed(2) ?? 'unknown'}`,`thermal=${current.thermal01?.toFixed(2) ?? 'unknown'}`],
        });
        return this.state.lastEvent!;
      }
      if (changed(baseline.motion01,current.motion01,0.18)) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, motion01: current.motion01 };
        this.state = push(this.state, { kind:'motion', salience:clamp(0.35+(current.motion01 ?? 0)*0.55), novelty:clamp(Math.abs((current.motion01 ?? 0)-(baseline.motion01 ?? 0))), confidence:0.76, source:'android', detail:'motion change detected', evidence:[`from=${baseline.motion01?.toFixed(2) ?? 'n/a'}`,`to=${current.motion01?.toFixed(2) ?? 'n/a'}`] });
        return this.state.lastEvent!;
      }
      if (changed(baseline.proximity01,current.proximity01,0.22)) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, proximity01: current.proximity01 };
        this.state = push(this.state, { kind:'proximity', salience:0.58, novelty:clamp(Math.abs((current.proximity01 ?? 0)-(baseline.proximity01 ?? 0))), confidence:0.7, source:'android', detail:'proximity changed', evidence:[`from=${baseline.proximity01?.toFixed(2) ?? 'n/a'}`,`to=${current.proximity01?.toFixed(2) ?? 'n/a'}`] });
        return this.state.lastEvent!;
      }
      if (changed(baseline.ambientLight01,current.ambientLight01,0.20)) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, ambientLight01: current.ambientLight01 };
        this.state = push(this.state, { kind:'light-change', salience:0.34, novelty:clamp(Math.abs((current.ambientLight01 ?? 0)-(baseline.ambientLight01 ?? 0))), confidence:0.64, source:'android', detail:'ambient light changed', evidence:[`from=${baseline.ambientLight01?.toFixed(2) ?? 'n/a'}`,`to=${current.ambientLight01?.toFixed(2) ?? 'n/a'}`] });
        return this.state.lastEvent!;
      }
      if (current.networkOnline !== baseline.networkOnline) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, networkOnline: current.networkOnline };
        this.state = push(this.state, { kind:'network-change', salience:0.46, novelty:0.42, confidence:0.9, source:'android', detail:current.networkOnline === null ? 'network status became unavailable' : `network ${current.networkOnline ? 'online' : 'offline'}`, evidence:[`previous=${String(baseline.networkOnline)}`,`current=${String(current.networkOnline)}`] });
        return this.state.lastEvent!;
      }
      if (baseline.battery01 !== null && current.battery01 !== null && Math.abs(current.battery01-baseline.battery01) >= 0.06) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, battery01: current.battery01 };
        this.state = push(this.state, { kind:'resource', salience:clamp(0.35+Math.abs(current.battery01-baseline.battery01)*2.4), novelty:clamp(Math.abs(current.battery01-baseline.battery01)), confidence:0.96, source:'android', detail:'battery state changed', evidence:[`from=${baseline.battery01.toFixed(2)}`,`to=${current.battery01.toFixed(2)}`] });
        return this.state.lastEvent!;
      }
      this.state.baseline = current;
    }

    if (w && prev) {
      const sections = changedWorldSections(prev, w);
      const surprise = clamp(input.surprise ?? 0);
      if (sections.length > 0 || surprise > 0.45) {
        this.state.worldChanges += 1;
        this.state = push(this.state, {
          kind:'world-surprise',
          salience:clamp(0.34 + Math.min(0.35, sections.length * 0.06) + surprise * 0.35),
          novelty:clamp(0.25 + Math.min(0.5, sections.length * 0.1) + surprise * 0.2),
          confidence:sections.length > 0 ? 0.82 : 0.68,
          source:'world',
          detail:sections.includes('location')
            ? `location changed: ${boundedText(prev.location, 80)} → ${boundedText(w.location, 80)}`
            : sections.length > 0 ? `world context changed: ${sections.join(', ')}` : 'prediction surprise exceeded threshold',
          evidence:[`changedSections=${sections.join(',') || 'none'}`,`surprise=${surprise.toFixed(2)}`,`facts=${Array.isArray(w.facts) ? w.facts.length : 0}`,`objects=${Array.isArray(w.objects) ? w.objects.length : 0}`],
        });
        this.lastWorld = structuredClone(w);
        return this.state.lastEvent!;
      }
    }
    if (w) this.lastWorld = structuredClone(w);
    this.state = push(this.state, { kind:'quiet', salience:0.08, novelty:0.05, confidence:0.52, source:'internal', detail:'no salient external change', evidence:['quiet-cycle'] });
    return this.state.lastEvent!;
  }
}
