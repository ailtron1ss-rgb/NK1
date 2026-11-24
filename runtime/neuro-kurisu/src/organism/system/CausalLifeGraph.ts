/**
 * BIG PASS 168 — Causal Life Graph.
 *
 * A bounded causal autobiographical graph over existing organism signals.
 * It is deliberately a projection/index, not a second memory database.
 * Each node points back to an existing entity (event, memory, emotion, value,
 * goal, action, outcome, self-change) and edges preserve directional lineage.
 */
export type LifeNodeKind='experience'|'emotion'|'memory'|'belief'|'value'|'goal'|'decision'|'action'|'outcome'|'learning'|'self-change';
export type LifeEdgeKind='interpreted-as'|'evoked'|'encoded-as'|'retrieved-for'|'supported'|'contradicted'|'pursued'|'selected'|'resulted-in'|'learned-from'|'changed-by';
export interface LifeNode{ id:string; kind:LifeNodeKind; refId:string; label:string; tick:number; at:number; confidence01:number; external01:number; metadata:Record<string,unknown>; }
export interface LifeEdge{ id:string; fromId:string; toId:string; kind:LifeEdgeKind; strength01:number; evidence01:number; tick:number; at:number; }
export interface CausalLifeGraphState{ version:1; nodes:LifeNode[]; edges:LifeEdge[]; totalNodes:number; totalEdges:number; observedChains:number; completeChains:number; chainCoverage01:number; meanEvidence01:number; lastAt:number; }
const clamp=(x:number)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const clean=(x:unknown,n=160)=>String(x??'').trim().replace(/\s+/g,' ').slice(0,n);
const hash=(s:string)=>{let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');};
const empty=():CausalLifeGraphState=>({version:1,nodes:[],edges:[],totalNodes:0,totalEdges:0,observedChains:0,completeChains:0,chainCoverage01:0,meanEvidence01:0,lastAt:0});
const chainKinds:LifeNodeKind[]=['experience','emotion','memory','decision','action','outcome','learning','self-change'];
export class CausalLifeGraph {
  private state = empty();
  private nodeByRef = new Map<string, string>();
  private nodeById = new Map<string, LifeNode>();
  private edgeByKey = new Map<string, LifeEdge>();

  restore(raw?: Partial<CausalLifeGraphState> | null) {
    const d = empty();
    const r = raw ?? {};
    this.state = {
      ...d,
      ...r,
      version: 1,
      nodes: Array.isArray(r.nodes) ? r.nodes.slice(0, 768) : [],
      edges: Array.isArray(r.edges) ? r.edges.slice(0, 1536) : [],
    };
    this.rebuildIndex();
    this.recompute();
  }

  snapshot() {
    return structuredClone(this.state);
  }


  private rebuildIndex() {
    this.nodeByRef.clear();
    this.nodeById.clear();
    this.edgeByKey.clear();
    for (const n of this.state.nodes) { this.nodeByRef.set(`${n.kind}:${n.refId}`, n.id); this.nodeById.set(n.id, n); }
    for (const e of this.state.edges) this.edgeByKey.set(`${e.fromId}|${e.toId}|${e.kind}`, e);
  }

  upsertNode(input: {
    kind: LifeNodeKind;
    refId: string;
    label?: string;
    tick: number;
    at?: number;
    confidence01?: number;
    external01?: number;
    metadata?: Record<string, unknown>;
  }, options: { clone?: boolean; recompute?: boolean } = {}): LifeNode | undefined {
    const ref = clean(input.refId, 180) || `${input.kind}:${input.tick}`;
    const key = `${input.kind}:${ref}`;
    const existingId = this.nodeByRef.get(key);
    const at = Number(input.at ?? Date.now());
    if (existingId) {
      const n = this.nodeById.get(existingId);
      if (n) {
        n.label = clean(input.label ?? n.label);
        n.tick = Math.max(0, Math.floor(input.tick));
        n.at = at;
        n.confidence01 = clamp(input.confidence01 ?? n.confidence01);
        n.external01 = clamp(input.external01 ?? n.external01);
        n.metadata = { ...n.metadata, ...(input.metadata ?? {}) };
        this.state.lastAt = at;
        if (options.recompute !== false) this.recompute();
        return options.clone === false ? undefined : structuredClone(n);
      }
    }
    const node: LifeNode = {
      id: `clg:${input.kind}:${hash(ref)}:${Math.max(0, Math.floor(input.tick))}`,
      kind: input.kind,
      refId: ref,
      label: clean(input.label ?? ref),
      tick: Math.max(0, Math.floor(input.tick)),
      at,
      confidence01: clamp(input.confidence01 ?? 0.5),
      external01: clamp(input.external01 ?? 0),
      metadata: { ...(input.metadata ?? {}) },
    };
    this.state.nodes.unshift(node);
    if (this.state.nodes.length > 768) { this.state.nodes = this.state.nodes.slice(0, 768); this.rebuildIndex(); } else { this.nodeByRef.set(key, node.id); this.nodeById.set(node.id, node); }
    this.state.totalNodes += 1;
    this.state.lastAt = at;
    if (options.recompute !== false) this.recompute();
    return options.clone === false ? undefined : structuredClone(node);
  }

  private linkInternal(
    from: { kind: LifeNodeKind; refId: string },
    to: { kind: LifeNodeKind; refId: string },
    kind: LifeEdgeKind,
    strength01: number,
    evidence01: number,
    tick: number,
    at?: number,
    recompute = true,
    clone = true,
  ) {
    const fromId=this.nodeByRef.get(`${from.kind}:${clean(from.refId,180)}`);
    const toId=this.nodeByRef.get(`${to.kind}:${clean(to.refId,180)}`);
    if(!fromId || !toId || fromId===toId) return null;
    const timestamp=Number(at??Date.now());
    const key=`${fromId}|${toId}|${kind}`;
    const existing=this.edgeByKey.get(key);
    if(existing){
      existing.strength01=Math.max(existing.strength01,clamp(strength01));
      existing.evidence01=Math.max(existing.evidence01,clamp(evidence01));
      existing.tick=Math.max(existing.tick,Math.floor(tick));
      existing.at=timestamp;
      if(recompute)this.recompute();
      return clone ? structuredClone(existing) : undefined;
    }
    const e:LifeEdge={id:`clg-edge:${hash(key)}:${Math.max(0,Math.floor(tick))}`,fromId,toId,kind,strength01:clamp(strength01),evidence01:clamp(evidence01),tick:Math.max(0,Math.floor(tick)),at:timestamp};
    this.state.edges.unshift(e);
    if(this.state.edges.length>1536){this.state.edges=this.state.edges.slice(0,1536);this.rebuildIndex();}
    else this.edgeByKey.set(key,e);
    this.state.totalEdges+=1; this.state.lastAt=timestamp;
    if(recompute)this.recompute();
    return clone ? structuredClone(e) : undefined;
  }

  link(
    from: { kind: LifeNodeKind; refId: string },
    to: { kind: LifeNodeKind; refId: string },
    kind: LifeEdgeKind,
    strength01: number,
    evidence01: number,
    tick: number,
    at?: number,
  ) {
    return this.linkInternal(from,to,kind,strength01,evidence01,tick,at,true);
  }

  recordCycle(input: {
    tick: number;
    at?: number;
    experience?: { id: string; label: string; confidence01?: number; external01?: number; metadata?: Record<string, unknown> };
    emotion?: { id: string; label: string; confidence01?: number; external01?: number; metadata?: Record<string, unknown> };
    memory?: { id: string; label: string; confidence01?: number; external01?: number; metadata?: Record<string, unknown> };
    decision?: { id: string; label: string; confidence01?: number; metadata?: Record<string, unknown> };
    action?: { id: string; label: string; confidence01?: number; metadata?: Record<string, unknown> };
    outcome?: { id: string; label: string; confidence01?: number; external01?: number; metadata?: Record<string, unknown> };
    learning?: { id: string; label: string; confidence01?: number; metadata?: Record<string, unknown> };
    selfChange?: { id: string; label: string; confidence01?: number; metadata?: Record<string, unknown> };
  }, options: { snapshot?: boolean } = {}) {
    const at = Number(input.at ?? Date.now());
    const refs: Array<{
      kind: LifeNodeKind;
      id: string;
      label: string;
      confidence01?: number;
      external01?: number;
      metadata?: Record<string, unknown>;
    }> = [];
    if (input.experience) refs.push({ kind: 'experience', ...input.experience });
    if (input.emotion) refs.push({ kind: 'emotion', ...input.emotion });
    if (input.memory) refs.push({ kind: 'memory', ...input.memory });
    if (input.decision) refs.push({ kind: 'decision', ...input.decision });
    if (input.action) refs.push({ kind: 'action', ...input.action });
    if (input.outcome) refs.push({ kind: 'outcome', ...input.outcome });
    if (input.learning) refs.push({ kind: 'learning', ...input.learning });
    if (input.selfChange) refs.push({ kind: 'self-change', ...input.selfChange });
    for (const r of refs) {
      this.upsertNode({
        kind: r.kind,
        refId: r.id,
        label: r.label,
        tick: input.tick,
        at,
        confidence01: r.confidence01,
        external01: r.external01,
        metadata: r.metadata,
      }, { clone: false, recompute: false });
    }
    const pairs: Array<[LifeNodeKind, LifeNodeKind, LifeEdgeKind]> = [
      ['experience', 'emotion', 'evoked'],
      ['experience', 'memory', 'encoded-as'],
      ['memory', 'decision', 'retrieved-for'],
      ['emotion', 'decision', 'interpreted-as'],
      ['decision', 'action', 'selected'],
      ['action', 'outcome', 'resulted-in'],
      ['outcome', 'learning', 'learned-from'],
      ['learning', 'self-change', 'changed-by'],
    ];
    for (const [a, b, k] of pairs) {
      const x = refs.find(r => r.kind === a);
      const y = refs.find(r => r.kind === b);
      if (x && y) this.linkInternal({ kind: a, refId: x.id }, { kind: b, refId: y.id }, k, 0.68, 0.66, input.tick, at, false, false);
    }
    this.recompute();
    return options.snapshot === false ? undefined : this.snapshot();
  }

  private recompute() {
    const ids = new Set(this.state.nodes.map(n => n.id));
    this.state.edges = this.state.edges.filter(e => ids.has(e.fromId) && ids.has(e.toId));
    const evidence = this.state.edges.length
      ? this.state.edges.reduce((sum, e) => sum + e.evidence01, 0) / this.state.edges.length
      : 0;
    const byTick = new Map<number, Set<LifeNodeKind>>();
    for (const n of this.state.nodes) {
      const set = byTick.get(n.tick) ?? new Set<LifeNodeKind>();
      set.add(n.kind);
      byTick.set(n.tick, set);
    }
    let complete = 0;
    for (const set of byTick.values()) if (chainKinds.every(k => set.has(k))) complete++;
    this.state.observedChains = byTick.size;
    this.state.completeChains = complete;
    this.state.chainCoverage01 = clamp(complete / Math.max(1, byTick.size));
    this.state.meanEvidence01 = clamp(evidence);
  }

  hasCompleteChainAtTick(tick:number):boolean {
    const target=Math.max(0,Math.floor(Number(tick)));
    const kinds=new Set<LifeNodeKind>();
    for(const node of this.state.nodes) if(node.tick===target) kinds.add(node.kind);
    return chainKinds.every(kind=>kinds.has(kind));
  }

  summary() {
    const s = this.state;
    return {
      nodes: s.nodes.length,
      edges: s.edges.length,
      totalNodes: s.totalNodes,
      totalEdges: s.totalEdges,
      observedChains: s.observedChains,
      completeChains: s.completeChains,
      chainCoverage01: s.chainCoverage01,
      meanEvidence01: s.meanEvidence01,
      lastAt: s.lastAt,
    };
  }

  explainRef(ref: { kind: LifeNodeKind; refId: string }, maxDepth = 6) {
    const start = this.nodeByRef.get(`${ref.kind}:${clean(ref.refId, 180)}`);
    if (!start) return { found: false, nodes: [], edges: [] };
    const nodeById = this.nodeById;
    const incoming = new Map<string, LifeEdge[]>();
    for (const edge of this.state.edges) {
      const list = incoming.get(edge.toId) ?? [];
      list.push(edge);
      incoming.set(edge.toId, list);
    }
    const seen = new Set<string>([start]);
    const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
    const edgeRows: LifeEdge[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      if (current.depth >= Math.max(1, Math.min(12, Math.floor(maxDepth)))) continue;
      for (const edge of incoming.get(current.id) ?? []) {
        edgeRows.push(edge);
        if (!seen.has(edge.fromId)) {
          seen.add(edge.fromId);
          queue.push({ id: edge.fromId, depth: current.depth + 1 });
        }
      }
    }
    return {
      found: true,
      nodes: structuredClone([...seen].map(id => nodeById.get(id)).filter(Boolean)),
      edges: structuredClone(edgeRows),
    };
  }

  causalPath(from: { kind: LifeNodeKind; refId: string }, to: { kind: LifeNodeKind; refId: string }, maxDepth = 10) {
    const start = this.nodeByRef.get(`${from.kind}:${clean(from.refId, 180)}`);
    const target = this.nodeByRef.get(`${to.kind}:${clean(to.refId, 180)}`);
    if (!start || !target) return { found: false, nodes: [], edges: [] };
    const outgoing = new Map<string, LifeEdge[]>();
    for (const edge of this.state.edges) {
      const list = outgoing.get(edge.fromId) ?? [];
      list.push(edge);
      outgoing.set(edge.fromId, list);
    }
    const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
    const previous = new Map<string, LifeEdge>();
    const visited = new Set<string>([start]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.id === target) break;
      if (current.depth >= Math.max(1, Math.min(16, Math.floor(maxDepth)))) continue;
      for (const edge of outgoing.get(current.id) ?? []) {
        if (visited.has(edge.toId)) continue;
        visited.add(edge.toId);
        previous.set(edge.toId, edge);
        queue.push({ id: edge.toId, depth: current.depth + 1 });
      }
    }
    if (!visited.has(target)) return { found: false, nodes: [], edges: [] };
    const ids: string[] = [target]; const edges: LifeEdge[] = [];
    let current = target;
    while (current !== start) {
      const edge = previous.get(current);
      if (!edge) break;
      edges.unshift(edge);
      current = edge.fromId;
      ids.unshift(current);
    }
    const nodeById = this.nodeById;
    return { found: ids[0] === start && ids.at(-1) === target, nodes: structuredClone(ids.map(id => nodeById.get(id)).filter(Boolean)), edges: structuredClone(edges) };
  }

  chainForTick(tick: number) {
    const nodes = this.state.nodes.filter(n => n.tick === Math.floor(tick));
    const ids = new Set(nodes.map(n => n.id));
    return {
      nodes: structuredClone(nodes),
      edges: structuredClone(this.state.edges.filter(e => ids.has(e.fromId) && ids.has(e.toId))),
    };
  }
}
export const defaultCausalLifeGraph = () => empty();
