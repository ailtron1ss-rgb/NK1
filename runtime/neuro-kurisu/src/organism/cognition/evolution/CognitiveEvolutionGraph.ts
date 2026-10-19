export interface CognitiveEvolutionNode {
  id: string;
  tick: number;
  type: 'experience'|'memory'|'prediction'|'behavior'|'identity';
  value01: number;
  metadata?: Record<string, unknown>;
}

export interface CognitiveEvolutionEdge {
  from: string;
  to: string;
  strength01: number;
  reason: string;
}

export class CognitiveEvolutionGraph {
  private nodes: CognitiveEvolutionNode[] = [];
  private edges: CognitiveEvolutionEdge[] = [];

  record(node: CognitiveEvolutionNode) {
    this.nodes.push(node);
    if (this.nodes.length > 2048) this.nodes.shift();
    return node;
  }

  connect(from: string, to: string, reason: string, strength01 = 0.5) {
    this.edges.push({ from, to, reason, strength01: Math.max(0, Math.min(1, strength01)) });
    if (this.edges.length > 4096) this.edges.shift();
  }

  reinforce(edgeIndex: number, amount: number) {
    const edge = this.edges[edgeIndex];
    if (!edge) return;
    edge.strength01 = Math.max(0, Math.min(1, edge.strength01 + amount));
  }

  snapshot() {
    return { nodes: [...this.nodes], edges: [...this.edges] };
  }
}
