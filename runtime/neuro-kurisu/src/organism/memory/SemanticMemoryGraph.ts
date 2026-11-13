import { createHash, randomUUID } from 'node:crypto';

export interface SemanticNode {
  id: string;
  label: string;
  type: 'concept' | 'episode' | 'goal' | 'self' | 'person' | 'place';
  salience: number;
  lastSeen: number;
  /** Source-isolated namespace for externally derived nodes. */
  sourceKey?: string;
  canonicalProjection?: { owner:'memoryOS2'; itemId:string; schemaVersion:1 };
}
export interface SemanticEdge {
  id: string;
  from: string;
  to: string;
  relation: 'supports' | 'contradicts' | 'causes' | 'associated' | 'about' | 'located';
  weight: number;
  lastSeen: number;
  canonicalProjection?: { owner:'memoryOS2'; fromItemId:string; toItemId:string; relation:SemanticEdge['relation']; schemaVersion:1 };
}
export interface SemanticGraphState {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  updates: number;
}

const MAX_NODES = 1_000;
const MAX_EDGES = 2_200;
const MAX_RETRIEVAL_RESULTS = 32;
const CANONICAL_GRAPH_SOURCE = 'memoryOS2';
type CanonicalMemoryProjectionInput = {
  id:string; content:string; kind:string; salience:number; createdAt:number; lastAccessAt:number;
  semanticLinks?:string[]; temporalLinks?:string[]; causalLinks?:string[]; contradictionLinks?:string[];
};
const stableProjectionId = (prefix:string, value:string) => `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0,32)}`;
const NODE_TYPES = new Set<SemanticNode['type']>(['concept', 'episode', 'goal', 'self', 'person', 'place']);
const EDGE_RELATIONS = new Set<SemanticEdge['relation']>(['supports', 'contradicts', 'causes', 'associated', 'about', 'located']);
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const normalize = (value: string) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
  .trim()
  .replace(/\s+/gu, ' ')
  .slice(0, 96);
const tokenize = (value: string) => normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];

function normalizeNode(value: unknown): SemanticNode | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 160) : '';
  const label = typeof value.label === 'string' ? normalize(value.label) : '';
  const type = value.type as SemanticNode['type'];
  if (!id || !label || !NODE_TYPES.has(type) || !finite(value.salience) || !finite(value.lastSeen)) return null;
  if (value.lastSeen < 0) return null;
  const sourceKey = typeof value.sourceKey === 'string' ? value.sourceKey.trim().slice(0, 160) : '';
  const rawProjection = isRecord(value.canonicalProjection) ? value.canonicalProjection : null;
  const canonicalProjection = rawProjection?.owner === CANONICAL_GRAPH_SOURCE && typeof rawProjection.itemId === 'string' && rawProjection.itemId.trim() && rawProjection.schemaVersion === 1
    ? { owner:'memoryOS2' as const, itemId:rawProjection.itemId.trim().slice(0,160), schemaVersion:1 as const }
    : undefined;
  return { id, label, type, salience: clamp(value.salience), lastSeen: Math.floor(value.lastSeen), ...(sourceKey ? { sourceKey } : {}), ...(canonicalProjection ? { canonicalProjection } : {}) };
}

function normalizeEdge(value: unknown, nodeIds: Set<string>): SemanticEdge | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 160) : '';
  const from = typeof value.from === 'string' ? value.from.trim().slice(0, 160) : '';
  const to = typeof value.to === 'string' ? value.to.trim().slice(0, 160) : '';
  const relation = value.relation as SemanticEdge['relation'];
  if (!id || !from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return null;
  if (!EDGE_RELATIONS.has(relation) || !finite(value.weight) || !finite(value.lastSeen) || value.lastSeen < 0) return null;
  const rawProjection = isRecord(value.canonicalProjection) ? value.canonicalProjection : null;
  const canonicalProjection = rawProjection?.owner === CANONICAL_GRAPH_SOURCE &&
    typeof rawProjection.fromItemId === 'string' && rawProjection.fromItemId.trim() &&
    typeof rawProjection.toItemId === 'string' && rawProjection.toItemId.trim() &&
    rawProjection.relation === relation && rawProjection.schemaVersion === 1
      ? { owner:'memoryOS2' as const, fromItemId:rawProjection.fromItemId.trim().slice(0,160), toItemId:rawProjection.toItemId.trim().slice(0,160), relation, schemaVersion:1 as const }
      : undefined;
  return { id, from, to, relation, weight: clamp(value.weight), lastSeen: Math.floor(value.lastSeen), ...(canonicalProjection ? { canonicalProjection } : {}) };
}

export class SemanticMemoryGraph {
  private state: SemanticGraphState = { nodes: [], edges: [], updates: 0 };

  /** Restore is a trust boundary: accept only bounded nodes and edges with live endpoints. */
  restore(raw: SemanticGraphState | undefined): void {
    if (!raw) return;
    const nodes: SemanticNode[] = [];
    const nodeIds = new Set<string>();
    const nodeRows = Array.isArray(raw.nodes) ? raw.nodes.slice(0, MAX_NODES * 2) : [];
    for (const value of nodeRows) {
      const node = normalizeNode(value);
      if (!node || nodeIds.has(node.id)) continue;
      nodeIds.add(node.id);
      nodes.push(node);
      if (nodes.length >= MAX_NODES) break;
    }

    const edges: SemanticEdge[] = [];
    const edgeIds = new Set<string>();
    const edgeRows = Array.isArray(raw.edges) ? raw.edges.slice(0, MAX_EDGES * 4) : [];
    for (const value of edgeRows) {
      const edge = normalizeEdge(value, nodeIds);
      if (!edge || edgeIds.has(edge.id)) continue;
      edgeIds.add(edge.id);
      edges.push(edge);
      if (edges.length >= MAX_EDGES) break;
    }

    this.state = {
      nodes,
      edges,
      updates: finite(raw.updates) && raw.updates >= 0 ? Math.floor(raw.updates) : 0,
    };
  }

  upsertNode(label: string, type: SemanticNode['type'], salience: number, sourceKey = ''): SemanticNode {
    const clean = normalize(label);
    if (!clean) throw new Error('semantic-node-empty');
    if (!NODE_TYPES.has(type)) throw new Error('semantic-node-type-invalid');
    if (!Number.isFinite(salience)) throw new Error('semantic-node-salience-invalid');

    const normalizedSalience = clamp(salience);
    const namespace = String(sourceKey ?? '').trim().slice(0, 160);
    const existing = this.state.nodes.find(node => node.label === clean && node.type === type && String(node.sourceKey ?? '') === namespace);
    const now = Date.now();
    if (existing) {
      existing.salience = clamp(existing.salience * 0.82 + normalizedSalience * 0.18);
      existing.lastSeen = now;
      return structuredClone(existing);
    }

    const node: SemanticNode = {
      id: randomUUID(),
      label: clean,
      type,
      salience: normalizedSalience,
      lastSeen: now,
      ...(namespace ? { sourceKey: namespace } : {}),
    };
    this.state.nodes.push(node);

    if (this.state.nodes.length > MAX_NODES) {
      // Keep the newly created node addressable; evict the least useful existing node.
      let victim = this.state.nodes[0]!;
      for (const candidate of this.state.nodes) {
        if (candidate.id === node.id) continue;
        if (candidate.salience < victim.salience
          || (candidate.salience === victim.salience && candidate.lastSeen < victim.lastSeen)) {
          victim = candidate;
        }
      }
      this.state.nodes = this.state.nodes.filter(candidate => candidate.id !== victim.id);
      const retained = new Set(this.state.nodes.map(candidate => candidate.id));
      this.state.edges = this.state.edges.filter(edge => retained.has(edge.from) && retained.has(edge.to));
    }

    this.state.nodes.sort((left, right) =>
      right.salience - left.salience || right.lastSeen - left.lastSeen || left.id.localeCompare(right.id));
    return structuredClone(node);
  }

  connect(from: string, to: string, relation: SemanticEdge['relation'], weight: number): SemanticEdge {
    const left = String(from ?? '').trim().slice(0, 160);
    const right = String(to ?? '').trim().slice(0, 160);
    const ids = new Set(this.state.nodes.map(node => node.id));
    if (!ids.has(left) || !ids.has(right)) throw new Error('semantic-edge-endpoint-missing');
    if (!EDGE_RELATIONS.has(relation)) throw new Error('semantic-edge-relation-invalid');
    if (!Number.isFinite(weight)) throw new Error('semantic-edge-weight-invalid');

    const normalizedWeight = clamp(weight);
    const existing = this.state.edges.find(edge => edge.from === left && edge.to === right && edge.relation === relation);
    const now = Date.now();
    if (existing) {
      existing.weight = clamp(existing.weight * 0.78 + normalizedWeight * 0.22);
      existing.lastSeen = now;
      return structuredClone(existing);
    }

    const edge: SemanticEdge = {
      id: randomUUID(),
      from: left,
      to: right,
      relation,
      weight: normalizedWeight,
      lastSeen: now,
    };
    this.state.edges.unshift(edge);
    this.state.edges.splice(MAX_EDGES);
    return structuredClone(edge);
  }

  ingestEpisode(summary: string, goalTitle?: string, location?: string): void {
    const episode = this.upsertNode(summary, 'episode', 0.62);
    const self = this.upsertNode('kurisu-self', 'self', 0.88);
    this.connect(episode.id, self.id, 'about', 0.55);
    if (goalTitle) {
      const goal = this.upsertNode(goalTitle, 'goal', 0.66);
      this.connect(episode.id, goal.id, 'supports', 0.62);
    }
    if (location) {
      const place = this.upsertNode(location, 'place', 0.42);
      this.connect(episode.id, place.id, 'located', 0.48);
    }
    this.state.updates += 1;
  }

  retrieve(query: string, limit = 6, clone = true): SemanticNode[] {
    const queryTokens = [...new Set(tokenize(query))];
    if (queryTokens.length === 0 || !Number.isFinite(limit) || limit < 1) return [];
    const safeLimit = Math.max(1, Math.min(MAX_RETRIEVAL_RESULTS, Math.floor(limit)));
    const q = normalize(query);
    const ranked = this.state.nodes.flatMap(node => {
      const labelTokens = new Set(tokenize(node.label));
      let overlap = 0;
      for (const token of queryTokens) if (labelTokens.has(token)) overlap++;
      const exactPhrase = q.length > 0 && node.label.includes(q) ? 1 : 0;
      // Salience may order grounded matches; it must not manufacture a match.
      if (overlap === 0 && exactPhrase === 0) return [];
      const coverage = overlap / queryTokens.length;
      const score = exactPhrase * 0.72 + coverage * 0.22 + node.salience * 0.06;
      return [{ node, score }];
    });
    ranked.sort((left, right) =>
      right.score - left.score || right.node.lastSeen - left.node.lastSeen || left.node.id.localeCompare(right.node.id));
    return ranked.slice(0, safeLimit).map(({ node }) => clone ? structuredClone(node) : node);
  }

  /**
   * Replace the read-only canonical projection for one MemoryOS2 row.
   * Nodes and edges are explicitly provenance-marked; this graph never becomes
   * a second writable memory authority.
   */
  syncCanonicalProjection(item: CanonicalMemoryProjectionInput, availableIds: ReadonlySet<string>): void {
    const itemId = String(item?.id ?? '').trim().slice(0,160);
    if (!itemId) return;
    const cleanLabel = normalize(String(item.content ?? '').slice(0, 4_000));
    const active = availableIds.has(itemId) && cleanLabel.length > 0 &&
      Number.isFinite(item.salience) && Number.isFinite(item.createdAt) &&
      Number.isFinite(item.lastAccessAt);
    if (!active) {
      this.removeCanonicalProjection(itemId);
      return;
    }

    const nodeId = stableProjectionId('memoryos2', itemId);
    const type: SemanticNode['type'] = item.kind === 'episodic' ? 'episode'
      : item.kind === 'identity' || item.kind === 'autobiographical' ? 'self'
      : item.kind === 'procedural' ? 'goal'
      : item.kind === 'social' ? 'person'
      : 'concept';
    const node: SemanticNode = {
      id: nodeId,
      label: cleanLabel,
      type,
      salience: clamp(item.salience),
      lastSeen: Math.max(0, Math.floor(item.lastAccessAt || item.createdAt)),
      sourceKey: `memoryOS2:${itemId}`.slice(0,160),
      canonicalProjection: { owner:'memoryOS2', itemId, schemaVersion:1 },
    };

    const priorIndex = this.state.nodes.findIndex(candidate =>
      candidate.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE && candidate.canonicalProjection.itemId === itemId);
    if (priorIndex >= 0) this.state.nodes[priorIndex] = node;
    else this.state.nodes.push(node);

    // Recreate only the outgoing canonical edges for this item, preserving all
    // externally sourced/local graph knowledge and its namespace.
    this.state.edges = this.state.edges.filter(edge =>
      !(edge.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE && edge.canonicalProjection.fromItemId === itemId));

    const relationFields: Array<[keyof Pick<CanonicalMemoryProjectionInput,'semanticLinks'|'temporalLinks'|'causalLinks'|'contradictionLinks'>,SemanticEdge['relation']]> = [
      ['semanticLinks','associated'],
      ['temporalLinks','about'],
      ['causalLinks','causes'],
      ['contradictionLinks','contradicts'],
    ];
    const byItemId = new Map(
      this.state.nodes
        .filter(candidate => candidate.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE)
        .map(candidate => [candidate.canonicalProjection!.itemId, candidate]),
    );
    const candidates: SemanticEdge[] = [];
    for (const [field, relation] of relationFields) {
      const targets = Array.isArray(item[field]) ? item[field] as string[] : [];
      for (const targetValue of targets.slice(0,128)) {
        const targetId = String(targetValue ?? '').trim().slice(0,160);
        if (!targetId || targetId === itemId || !availableIds.has(targetId)) continue;
        const targetNode = byItemId.get(targetId);
        if (!targetNode) continue;
        candidates.push({
          id: stableProjectionId('memoryos2-edge', `${itemId}\u0000${targetId}\u0000${relation}`),
          from: nodeId,
          to: targetNode.id,
          relation,
          weight: 0.72,
          lastSeen: node.lastSeen,
          canonicalProjection: {
            owner:'memoryOS2',
            fromItemId:itemId,
            toItemId:targetId,
            relation,
            schemaVersion:1,
          },
        });
      }
    }
    const edgeIds = new Set(this.state.edges.map(edge => edge.id));
    for (const edge of candidates) {
      if (!edgeIds.has(edge.id)) {
        this.state.edges.push(edge);
        edgeIds.add(edge.id);
      }
    }

    this.state.nodes.sort((left,right) =>
      right.salience-left.salience || right.lastSeen-left.lastSeen || left.id.localeCompare(right.id));
    if (this.state.nodes.length > MAX_NODES) {
      const canonical = this.state.nodes.filter(candidate => candidate.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE);
      const external = this.state.nodes.filter(candidate => candidate.canonicalProjection?.owner !== CANONICAL_GRAPH_SOURCE);
      // Preserve the newly synced canonical node while retaining the strongest others.
      const keep = new Map<string,SemanticNode>();
      for (const candidate of [...canonical, ...external.slice(0, Math.max(0,MAX_NODES-canonical.length))]) keep.set(candidate.id,candidate);
      this.state.nodes = [...keep.values()].slice(0,MAX_NODES);
      const retained = new Set(this.state.nodes.map(candidate => candidate.id));
      this.state.edges = this.state.edges.filter(edge => retained.has(edge.from) && retained.has(edge.to));
    }
    this.state.edges.splice(MAX_EDGES);
    this.state.updates += 1;
  }

  /** Rebuild all canonical graph projections while retaining non-canonical graph data. */
  reconcileCanonicalProjection(items: CanonicalMemoryProjectionInput[]): void {
    this.state.nodes = this.state.nodes.filter(node => node.canonicalProjection?.owner !== CANONICAL_GRAPH_SOURCE);
    this.state.edges = this.state.edges.filter(edge => edge.canonicalProjection?.owner !== CANONICAL_GRAPH_SOURCE);
    const active = Array.isArray(items) ? items.slice(0,MAX_NODES) : [];
    const ids = new Set(active.map(item => String(item?.id ?? '').trim().slice(0,160)).filter(Boolean));
    // First materialize every canonical node without outgoing links; then a
    // second pass resolves all relations independent of snapshot ordering.
    for (const item of active) this.syncCanonicalProjection(item, new Set());
    for (const item of active) this.syncCanonicalProjection(item, ids);
  }

  /** Remove a canonical memory node and all projected/local edges touching it. */
  removeCanonicalProjection(itemId: string): boolean {
    const key = String(itemId ?? '').trim().slice(0,160);
    if (!key) return false;
    const removedNodeIds = new Set(this.state.nodes
      .filter(node => node.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE && node.canonicalProjection.itemId === key)
      .map(node => node.id));
    const beforeNodes = this.state.nodes.length;
    const beforeEdges = this.state.edges.length;
    this.state.nodes = this.state.nodes.filter(node =>
      !(node.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE && node.canonicalProjection.itemId === key));
    this.state.edges = this.state.edges.filter(edge =>
      !(edge.canonicalProjection?.owner === CANONICAL_GRAPH_SOURCE &&
        (edge.canonicalProjection.fromItemId === key || edge.canonicalProjection.toItemId === key)) &&
      !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to));
    return this.state.nodes.length !== beforeNodes || this.state.edges.length !== beforeEdges;
  }

  snapshot(): SemanticGraphState {
    return structuredClone(this.state);
  }
}
