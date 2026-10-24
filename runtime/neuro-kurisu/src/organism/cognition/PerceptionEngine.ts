import type { OrganismBodyState } from '../body/EmbodiedBody.ts';
import type { WorldContext } from '../core/types.ts';

const clamp = (n:number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

type PerceptionKind = 'motion'|'proximity'|'light-change'|'resource'|'network-change'|'world-surprise'|'social-input'|'text-input'|'quiet';

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
      recent:Array.isArray(value?.recent) ? value!.recent.slice(0,64) : [],
    };
    this.lastWorld = null;
  }
  snapshot(): PerceptionState { return structuredClone(this.state); }

  perceive(input:PerceptionInput): PerceptionEvent {
    const b = input.body;
    const telemetryStaleMs = b && Number.isFinite(b.telemetry?.staleMs) ? Math.max(0, b.telemetry.staleMs) : Number.POSITIVE_INFINITY;
    const bodyTelemetryFresh = !!b && Number.isFinite(b.sensoryFreshness01)
      && b.sensoryFreshness01 >= MIN_SENSOR_FRESHNESS01
      && telemetryStaleMs <= MAX_SENSOR_STALE_MS;
    const w = input.world;
    const prev = this.lastWorld ?? input.previousWorld ?? null;
    if (input.externalEvent) {
      this.state.externalEvents += 1;
      this.state = push(this.state, { kind:'world-surprise', salience:clamp(input.externalEvent.importance ?? 0.65), novelty:clamp(input.externalEvent.importance ?? 0.55), confidence:0.92, source:input.externalEvent.source ?? 'world', detail:input.externalEvent.detail, evidence:['external-event'] });
      return this.state.lastEvent!;
    }
    if (input.text?.trim()) {
      this.state = push(this.state, { kind:'text-input', salience:0.66, novelty:0.42, confidence:0.98, source:'social', detail:'external textual input', evidence:[`length=${input.text.trim().length}`] });
      return this.state.lastEvent!;
    }

    if (b && bodyTelemetryFresh) {
      const current = {
        battery01:b.telemetry.battery01,
        ambientLight01:b.telemetry.ambientLight01,
        proximity01:b.telemetry.proximity01,
        motion01:b.telemetry.motion01,
        networkOnline:b.telemetry.networkOnline,
        thermal01:b.thermalStrain01,
      };
      const baseline = this.state.baseline;
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
      if (baseline.networkOnline !== null && current.networkOnline !== baseline.networkOnline) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, networkOnline: current.networkOnline };
        this.state = push(this.state, { kind:'network-change', salience:0.46, novelty:0.42, confidence:0.9, source:'android', detail:`network ${current.networkOnline ? 'online' : 'offline'}`, evidence:[`previous=${String(baseline.networkOnline)}`,`current=${String(current.networkOnline)}`] });
        return this.state.lastEvent!;
      }
      if (baseline.battery01 !== null && Math.abs(current.battery01-baseline.battery01) >= 0.06) {
        this.state.sensorChanges += 1;
        this.state.baseline = { ...baseline, battery01: current.battery01 };
        this.state = push(this.state, { kind:'resource', salience:clamp(0.35+Math.abs(current.battery01-baseline.battery01)*2.4), novelty:clamp(Math.abs(current.battery01-baseline.battery01)), confidence:0.96, source:'android', detail:'battery state changed', evidence:[`from=${baseline.battery01.toFixed(2)}`,`to=${current.battery01.toFixed(2)}`] });
        return this.state.lastEvent!;
      }
      if (current.battery01 < 0.18 || current.thermal01 > 0.72) {
        this.state.baseline = current;
        this.state = push(this.state, { kind:'resource', salience:0.78, novelty:0.18, confidence:0.97, source:'android', detail:'resource pressure', evidence:[`battery=${current.battery01.toFixed(2)}`,`thermal=${current.thermal01.toFixed(2)}`] });
        return this.state.lastEvent!;
      }
      this.state.baseline = current;
    }

    if (w && prev) {
      const locationChanged = w.location !== prev.location;
      const facts=Array.isArray(w.facts)?w.facts:[]; const prevFacts=Array.isArray(prev.facts)?prev.facts:[];
      const events=Array.isArray(w.events)?w.events:[]; const prevEvents=Array.isArray(prev.events)?prev.events:[];
      const factDelta = Math.abs(facts.length-prevFacts.length)+Math.abs(events.length-prevEvents.length);
      const surprise = clamp(input.surprise ?? 0);
      if (locationChanged || factDelta > 0 || surprise > 0.45) {
        this.state.worldChanges += 1;
        this.state = push(this.state, { kind:'world-surprise', salience:clamp(0.34+surprise*0.55), novelty:clamp(0.30+factDelta*0.12), confidence:0.82, source:'world', detail:locationChanged ? `location changed: ${prev.location} → ${w.location}` : 'world context changed', evidence:[`factDelta=${factDelta}`,`surprise=${surprise.toFixed(2)}`] });
        this.lastWorld = structuredClone(w);
        return this.state.lastEvent!;
      }
    }
    if (w) this.lastWorld = structuredClone(w);
    this.state = push(this.state, { kind:'quiet', salience:0.08, novelty:0.05, confidence:0.52, source:'internal', detail:'no salient external change', evidence:['quiet-cycle'] });
    return this.state.lastEvent!;
  }
}
