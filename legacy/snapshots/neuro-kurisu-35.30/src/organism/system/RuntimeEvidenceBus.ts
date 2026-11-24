/**
 * Runtime Evidence Bus — lightweight integration spine for external outcomes.
 *
 * Smaller than a second event-sourcing layer: it keeps a bounded recent stream
 * and connects prediction/action/outcome/resource/model evidence in one schema.
 * The durable operational journal remains the persistence boundary.
 */
export type RuntimeEvidenceKind =
  | 'observation'
  | 'prediction'
  | 'action'
  | 'outcome'
  | 'resource'
  | 'model'
  | 'goal'
  | 'contradiction';

export interface RuntimeEvidenceEvent {
  id: string;
  at: number;
  tick: number;
  kind: RuntimeEvidenceKind;
  source: string;
  confidence01: number;
  external01: boolean;
  parentIds: string[];
  payload: Record<string, unknown>;
}

export interface RuntimeEvidenceSnapshot {
  version: 2;
  capacity: number;
  total: number;
  externalCount: number;
  byKind: Record<RuntimeEvidenceKind, number>;
  recent: RuntimeEvidenceEvent[];
  linkedParentEvents:number;
  danglingParentLinks:number;
  lineageIntegrity01:number;
  coverage01:number;
  recentWindowTicks:number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const emptyCounts = (): Record<RuntimeEvidenceKind, number> => ({
  observation: 0, prediction: 0, action: 0, outcome: 0,
  resource: 0, model: 0, goal: 0, contradiction: 0,
});

export class RuntimeEvidenceBus {
  private readonly capacity: number;
  private events: RuntimeEvidenceEvent[] = [];
  private kindCounts = emptyCounts();
  private externalCount = 0;
  private total = 0;

  constructor(capacity = 384) {
    this.capacity = Math.max(128, Math.min(4096, Math.floor(capacity)));
  }

  publish(input: {
    tick: number;
    kind: RuntimeEvidenceKind;
    source: string;
    confidence01?: number;
    external01?: boolean;
    parentIds?: string[];
    payload?: Record<string, unknown>;
    at?: number;
  }): RuntimeEvidenceEvent {
    const at = Number.isFinite(input.at) ? Number(input.at) : Date.now();
    const event: RuntimeEvidenceEvent = {
      id: `reb:${at}:${input.tick}:${Math.random().toString(16).slice(2)}`,
      at,
      tick: Math.max(0, Math.floor(input.tick)),
      kind: input.kind,
      source: String(input.source || 'unknown').slice(0, 120),
      confidence01: clamp01(input.confidence01 ?? 0.5),
      external01: Boolean(input.external01),
      parentIds: (input.parentIds ?? []).map(String).slice(0, 8),
      payload: { ...(input.payload ?? {}) },
    };
    this.events.unshift(event);
    this.events = this.events.slice(0, this.capacity);
    this.kindCounts[event.kind] += 1;
    if (event.external01) this.externalCount += 1;
    this.total += 1;
    return event;
  }

  restore(raw?: Partial<RuntimeEvidenceSnapshot>|null): void {
    const list=Array.isArray(raw?.recent)?raw!.recent.slice(0,this.capacity).map(e=>({...e,parentIds:Array.isArray(e.parentIds)?e.parentIds.slice(0,8):[],payload:{...(e.payload??{})}})):[];
    this.events=list; this.kindCounts=emptyCounts(); this.externalCount=0; this.total=Number(raw?.total??list.length);
    for(const e of list){ this.kindCounts[e.kind]=(this.kindCounts[e.kind]??0)+1; if(e.external01)this.externalCount++; }
  }

  recent(limit = 64): RuntimeEvidenceEvent[] {
    return structuredClone(this.events.slice(0, Math.max(1, Math.min(256, Math.floor(limit)))));
  }

  metrics(){
    const latest=this.events[0]?.tick ?? 0;
    const oldest=this.events.at(-1)?.tick ?? latest;
    return { total:this.total, buffered:this.events.length, capacity:this.capacity, latestTick:latest, bufferedTickSpan:Math.max(0,latest-oldest), externalCount:this.externalCount };
  }

  snapshot(): RuntimeEvidenceSnapshot {
    const known=new Set(this.events.map(e=>e.id));
    let linked=0,dangling=0;
    for(const e of this.events){ for(const id of e.parentIds){ if(known.has(id)) linked++; else dangling++; } }
    const maxTick=this.events[0]?.tick ?? 0;
    const minTick=this.events.at(-1)?.tick ?? maxTick;
    const span=Math.max(0,maxTick-minTick);
    const coverage=clamp01(this.events.length/Math.max(1,Math.min(this.capacity,96)));
    return {
      version: 2,
      capacity: this.capacity,
      total: this.total,
      externalCount: this.externalCount,
      byKind: { ...this.kindCounts },
      recent: this.recent(48),
      linkedParentEvents:linked,
      danglingParentLinks:dangling,
      lineageIntegrity01:clamp01(linked/(linked+dangling||1)),
      coverage01: coverage,
      recentWindowTicks: span,
    };
  }
}
