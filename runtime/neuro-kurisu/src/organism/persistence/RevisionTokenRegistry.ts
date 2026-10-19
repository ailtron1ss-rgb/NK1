import type { RevisionDomain, RevisionGraph, RevisionGraphState } from './RevisionGraph.ts';

export type RevisionSubsystem =
  | 'memory-core'
  | 'memory-fabric'
  | 'identity-core'
  | 'reality-model'
  | 'development-core'
  | 'evidence-ledger'
  | 'critical-kernel'
  | 'slow-cognition';

export interface RevisionSubsystemToken {
  subsystem: RevisionSubsystem;
  domain: RevisionDomain;
  revision: number;
  materializedRevision: number;
  dirty: boolean;
  lastTick: number;
  lastMaterializedTick: number;
  lastCause: string;
}

export interface RevisionTokenRegistryState {
  version: 2;
  tokens: Record<RevisionSubsystem, Omit<RevisionSubsystemToken, 'subsystem' | 'dirty'>>;
}

const SUBSYSTEMS: Record<RevisionSubsystem, RevisionDomain> = {
  'memory-core': 'memory',
  'memory-fabric': 'memory',
  'identity-core': 'identity',
  'reality-model': 'reality',
  'development-core': 'developmental',
  'evidence-ledger': 'reality',
  'critical-kernel': 'critical',
  'slow-cognition': 'slow',
};

const names = Object.keys(SUBSYSTEMS) as RevisionSubsystem[];
const emptyState = (): RevisionTokenRegistryState => {
  const tokens = {} as RevisionTokenRegistryState['tokens'];
  for (const subsystem of names) tokens[subsystem] = {
    domain: SUBSYSTEMS[subsystem], revision: 0, materializedRevision: 0,
    lastTick: 0, lastMaterializedTick: 0, lastCause: 'init',
  };
  return { version: 2, tokens };
};

/**
 * Independent subsystem revision journal.
 * Unlike the coarse RevisionGraph, each subsystem owns its own counter even when
 * several subsystems share one projection domain. No state hashing is performed.
 */
export class RevisionTokenRegistry {
  private state = emptyState();
  private readonly graph: RevisionGraph;

  constructor(graph: RevisionGraph) { this.graph = graph; }

  restore(raw?: Partial<RevisionTokenRegistryState> | null, graphState?: RevisionGraphState | null): void {
    const d = emptyState();
    const source = (raw?.tokens ?? {}) as Partial<RevisionTokenRegistryState['tokens']>;
    const tokens = {} as RevisionTokenRegistryState['tokens'];
    for (const subsystem of names) {
      const fallback = d.tokens[subsystem];
      const item = source[subsystem] ?? d.tokens[subsystem];
      tokens[subsystem] = {
        ...fallback,
        ...item,
        domain: SUBSYSTEMS[subsystem],
        revision: Number(item.revision ?? fallback.revision),
        materializedRevision: Number(item.materializedRevision ?? fallback.materializedRevision),
        lastTick: Number(item.lastTick ?? fallback.lastTick),
        lastMaterializedTick: Number(item.lastMaterializedTick ?? fallback.lastMaterializedTick),
        lastCause: String(item.lastCause ?? fallback.lastCause).slice(0, 96),
      };
    }
    this.state = { ...d, version: 2, tokens };
    // Legacy states had only the coarse graph. Seed independent counters from it
    // so migration never fabricates a regression to zero.
    if (!raw?.tokens && graphState) {
      for (const subsystem of names) {
        const domain = SUBSYSTEMS[subsystem];
        const gCurrent = Number(graphState.current?.[domain] ?? 0);
        const gMaterialized = Number(graphState.materialized?.[domain] ?? 0);
        this.state.tokens[subsystem].revision = gCurrent;
        this.state.tokens[subsystem].materializedRevision = Math.min(gCurrent, gMaterialized);
        this.state.tokens[subsystem].lastCause = String(graphState.lastCauses?.[domain] ?? 'migration').slice(0, 96);
      }
    }
  }

  touch(subsystem: RevisionSubsystem, tick: number, cause: string): number {
    const item = this.state.tokens[subsystem];
    item.revision += 1;
    item.lastTick = tick;
    item.lastCause = `${subsystem}:${cause}`.slice(0, 96);
    // Keep the legacy coarse graph authoritative for projection grouping.
    this.graph.touch(item.domain, tick, item.lastCause);
    return item.revision;
  }

  markMaterialized(domain: RevisionDomain, tick: number): void {
    for (const subsystem of names) {
      if (SUBSYSTEMS[subsystem] !== domain) continue;
      const item = this.state.tokens[subsystem];
      item.materializedRevision = item.revision;
      item.lastMaterializedTick = tick;
    }
  }

  token(subsystem: RevisionSubsystem): RevisionSubsystemToken {
    const item = this.state.tokens[subsystem];
    return {
      subsystem,
      domain: item.domain,
      revision: item.revision,
      materializedRevision: item.materializedRevision,
      dirty: item.revision !== item.materializedRevision,
      lastTick: item.lastTick,
      lastMaterializedTick: item.lastMaterializedTick,
      lastCause: item.lastCause,
    };
  }

  all(): RevisionSubsystemToken[] { return names.map(name => this.token(name)); }
  snapshot(): RevisionTokenRegistryState { return structuredClone(this.state); }
  metrics() {
    return Object.fromEntries(names.map(name => [name, this.token(name)]));
  }
}
