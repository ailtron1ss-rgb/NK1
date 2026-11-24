export type IdentityCausalNodeKind =
  | 'identity' | 'value' | 'goal' | 'memory' | 'event'
  | 'belief' | 'observation' | 'prediction' | 'action' | 'outcome'
  | 'evidence' | 'person' | 'commitment' | 'self-change';

export type IdentityCausalRelation =
  | 'supports' | 'contradicts' | 'caused-by' | 'changed-by' | 'evidences'
  | 'predicted-by' | 'resulted-in' | 'about' | 'involves' | 'binds'
  | 'influences' | 'revised-by';

export interface IdentityCausalNode {
  id: string;
  kind: IdentityCausalNodeKind;
  label: string;
  at: number;
  confidence01?: number;
  source?: string;
}

export interface IdentityCausalEdge {
  from: string;
  to: string;
  strength01: number;
  reason: string;
  at: number;
  relation?: IdentityCausalRelation;
  evidence01?: number;
  source?: string;
}

export interface IdentityCausalityState {
  version: 2;
  nodes: IdentityCausalNode[];
  edges: IdentityCausalEdge[];
  samples: number;
  meanStrength01: number;
  lastAt: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const clean = (x: unknown, n = 120) => String(x ?? '').trim().replace(/\s+/g, ' ').slice(0, n);

export const defaultIdentityCausality = (): IdentityCausalityState => ({
  version: 2,
  nodes: [],
  edges: [],
  samples: 0,
  meanStrength01: 0.5,
  lastAt: 0,
});

const id = (kind: string, label: string) =>
  `${kind}:${label.toLowerCase().slice(0, 96).replace(/[^a-z0-9а-яё_\-]+/gi, '-')}`;

export class IdentityCausalityGraphEngine {
  private state = defaultIdentityCausality();

  restore(raw?: Partial<IdentityCausalityState> | null) {
    const d = defaultIdentityCausality();
    this.state = {
      ...d,
      ...(raw ?? {}),
      version: 2,
      nodes: Array.isArray(raw?.nodes)
        ? raw!.nodes.slice(-128).map((node: any) => ({
            id: clean(node?.id, 160),
            kind: (node?.kind ?? 'event') as IdentityCausalNodeKind,
            label: clean(node?.label, 120),
            at: Number(node?.at ?? Date.now()),
            confidence01: node?.confidence01 == null ? undefined : clamp(Number(node.confidence01)),
            source: node?.source == null ? undefined : clean(node.source, 48),
          }))
        : [],
      edges: Array.isArray(raw?.edges)
        ? raw!.edges.slice(-256).map((edge: any) => ({
            from: clean(edge?.from, 160),
            to: clean(edge?.to, 160),
            strength01: clamp(Number(edge?.strength01 ?? 0)),
            reason: clean(edge?.reason, 160),
            at: Number(edge?.at ?? Date.now()),
            relation: edge?.relation as IdentityCausalRelation | undefined,
            evidence01: edge?.evidence01 == null ? undefined : clamp(Number(edge.evidence01)),
            source: edge?.source == null ? undefined : clean(edge.source, 48),
          }))
        : [],
      samples: Math.max(0, Math.floor(Number(raw?.samples ?? 0))),
      meanStrength01: clamp(Number(raw?.meanStrength01 ?? d.meanStrength01)),
      lastAt: Number(raw?.lastAt ?? 0),
    };
  }

  snapshot() { return structuredClone(this.state); }

  private upsertNode(input: {
    kind: IdentityCausalNodeKind;
    label: string;
    at?: number;
    confidence01?: number;
    source?: string;
  }) {
    const at = Number(input.at ?? Date.now());
    const node: IdentityCausalNode = {
      id: id(input.kind, clean(input.label)),
      kind: input.kind,
      label: clean(input.label),
      at,
      confidence01: input.confidence01 == null ? undefined : clamp(input.confidence01),
      source: input.source == null ? undefined : clean(input.source, 48),
    };
    const existing = this.state.nodes.findIndex((n) => n.id === node.id);
    if (existing >= 0) this.state.nodes[existing] = node;
    else this.state.nodes.unshift(node);
    if (this.state.nodes.length > 128) this.state.nodes.length = 128;
    return node;
  }

  link(input: {
    tick: number;
    fromKind: IdentityCausalNodeKind;
    fromLabel: string;
    toKind: IdentityCausalNodeKind;
    toLabel: string;
    strength01: number;
    reason: string;
    relation?: IdentityCausalRelation;
    evidence01?: number;
    source?: string;
    fromConfidence01?: number;
    toConfidence01?: number;
  }) {
    const at = Date.now();
    const from = this.upsertNode({ kind: input.fromKind, label: input.fromLabel, at, confidence01: input.fromConfidence01, source: input.source });
    const to = this.upsertNode({ kind: input.toKind, label: input.toLabel, at, confidence01: input.toConfidence01, source: input.source });
    const edge: IdentityCausalEdge = {
      from: from.id,
      to: to.id,
      strength01: clamp(input.strength01),
      reason: clean(input.reason, 160),
      at,
      relation: input.relation,
      evidence01: input.evidence01 == null ? undefined : clamp(input.evidence01),
      source: input.source == null ? undefined : clean(input.source, 48),
    };
    const existing = this.state.edges.findIndex((e) => e.from === edge.from && e.to === edge.to && e.relation === edge.relation);
    if (existing >= 0) this.state.edges[existing] = edge;
    else this.state.edges.unshift(edge);
    if (this.state.edges.length > 256) this.state.edges.length = 256;
    this.state.samples++;
    this.state.meanStrength01 = clamp(this.state.meanStrength01 * 0.94 + edge.strength01 * 0.06);
    this.state.lastAt = at;
    return edge;
  }

  observe(input: {
    tick: number;
    identityLabel: string;
    causeKind: IdentityCausalNodeKind;
    causeLabel: string;
    strength01: number;
    reason: string;
    relation?: IdentityCausalRelation;
    evidence01?: number;
    source?: string;
  }) {
    return this.link({
      tick: input.tick,
      fromKind: input.causeKind,
      fromLabel: input.causeLabel,
      toKind: 'identity',
      toLabel: input.identityLabel,
      strength01: input.strength01,
      reason: input.reason,
      relation: input.relation ?? 'influences',
      evidence01: input.evidence01,
      source: input.source,
    });
  }

  neighborhood(label: string, limit = 24) {
    const needle = String(label).toLowerCase();
    const nodeIds = new Set(this.state.nodes.filter((n) => n.label.toLowerCase().includes(needle) || n.id.includes(needle)).map((n) => n.id));
    const edges = this.state.edges.filter((e) => nodeIds.has(e.from) || nodeIds.has(e.to)).slice(0, Math.max(1, Math.min(64, Math.floor(limit))));
    const ids = new Set(edges.flatMap((e) => [e.from, e.to]));
    return {
      nodes: this.state.nodes.filter((n) => ids.has(n.id)).slice(0, 64),
      edges,
    };
  }

  summary() {
    const kinds = this.state.nodes.reduce<Record<string, number>>((out, node) => { out[node.kind] = (out[node.kind] ?? 0) + 1; return out; }, {});
    const relations = this.state.edges.reduce<Record<string, number>>((out, edge) => { const key = edge.relation ?? 'unspecified'; out[key] = (out[key] ?? 0) + 1; return out; }, {});
    return {
      version: 2,
      nodes: this.state.nodes.length,
      edges: this.state.edges.length,
      samples: this.state.samples,
      meanStrength01: this.state.meanStrength01,
      lastAt: this.state.lastAt,
      kinds,
      relations,
    };
  }
}
