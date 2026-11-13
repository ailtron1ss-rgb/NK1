import { randomUUID } from 'node:crypto';

export interface SemanticNode {
  id: string;
  label: string;
  type: 'concept' | 'episode' | 'goal' | 'self' | 'person' | 'place';
  salience: number;
  lastSeen: number;
}
export interface SemanticEdge {
  id: string;
  from: string;
  to: string;
  relation: 'supports' | 'contradicts' | 'causes' | 'associated' | 'about' | 'located';
  weight: number;
  lastSeen: number;
}
export interface SemanticGraphState {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  updates: number;
}

const MAX_NODES = 1_000;
const MAX_EDGES = 2_200;
const MAX_RETRIEVAL_RESULTS = 32;
const NODE_TYPES = new Set<SemanticNode['type']>(['concept', 'episode', 'goal', 'self', 'person', 'place']);
const EDGE_RELATIONS = new Set<SemanticEdge['relation']>(['supports', 'contradicts', 'causes', 'associated', 'about', 'located']);
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const normalize = (value: string) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase()
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
  return { id, label, type, salience: clamp(value.salience), lastSeen: Math.floor(value.lastSeen) };
}

function normalizeEdge(value: unknown, nodeIds: Set<string>): SemanticEdge | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 160) : '';
  const from = typeof value.from === 'string' ? value.from.trim().slice(0, 160) : '';
  const to = typeof value.to === 'string' ? value.to.trim().slice(0, 160) : '';
  const relation = value.relation as SemanticEdge['relation'];
  if (!id || !from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return null;
  if (!EDGE_RELATIONS.has(relation) || !finite(value.weight) || !finite(value.lastSeen) || value.lastSeen < 0) return null;
  return { id, from, to, relation, weight: clamp(value.weight), lastSeen: Math.floor(value.lastSeen) };
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

  upsertNode(label: string, type: SemanticNode['type'], salience: number): SemanticNode {
    const clean = normalize(label);
    if (!clean) throw new Error('semantic-node-empty');
    if (!NODE_TYPES.has(type)) throw new Error('semantic-node-type-invalid');
    if (!Number.isFinite(salience)) throw new Error('semantic-node-salience-invalid');

    const normalizedSalience = clamp(salience);
    const existing = this.state.nodes.find(node => node.label === clean && node.type === type);
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
    const ranked = this.state.nodes.map(node => {
      const labelTokens = new Set(tokenize(node.label));
      let overlap = 0;
      for (const token of queryTokens) if (labelTokens.has(token)) overlap++;
      const coverage = overlap / queryTokens.length;
      const exactPhrase = q.length > 0 && node.label.includes(q) ? 1 : 0;
      const score = exactPhrase * 0.72 + coverage * 0.22 + node.salience * 0.06;
      return { node, score };
    });
    ranked.sort((left, right) =>
      right.score - left.score || right.node.lastSeen - left.node.lastSeen || left.node.id.localeCompare(right.node.id));
    return ranked.slice(0, safeLimit).map(({ node }) => clone ? structuredClone(node) : node);
  }

  snapshot(): SemanticGraphState {
    return structuredClone(this.state);
  }
}
