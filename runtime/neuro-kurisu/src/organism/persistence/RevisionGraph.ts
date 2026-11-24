export type RevisionDomain = 'critical'|'memory'|'identity'|'reality'|'developmental'|'slow';

export interface RevisionToken {
  revision: number;
  tick: number;
  cause: string;
}

export interface RevisionGraphState {
  version: 1;
  current: Record<RevisionDomain, number>;
  materialized: Record<RevisionDomain, number>;
  lastCauses: Record<RevisionDomain, string>;
}

const DOMAINS: RevisionDomain[] = ['critical','memory','identity','reality','developmental','slow'];

export const defaultRevisionGraphState = (): RevisionGraphState => ({
  version: 1,
  current: { critical: 0, memory: 0, identity: 0, reality: 0, developmental: 0, slow: 0 },
  materialized: { critical: 0, memory: 0, identity: 0, reality: 0, developmental: 0, slow: 0 },
  lastCauses: { critical: 'init', memory: 'init', identity: 'init', reality: 'init', developmental: 'init', slow: 'init' },
});

/** Cheap mutation journal used as a revision token source for persistence.
 * It deliberately avoids cloning or hashing large subsystem state.
 */
export class RevisionGraph {
  private state = defaultRevisionGraphState();

  restore(raw?: Partial<RevisionGraphState>|null) {
    const d = defaultRevisionGraphState();
    const r = raw ?? {};
    this.state = {
      ...d,
      ...r,
      current: { ...d.current, ...(r.current ?? {}) },
      materialized: { ...d.materialized, ...(r.materialized ?? {}) },
      lastCauses: { ...d.lastCauses, ...(r.lastCauses ?? {}) },
    };
  }

  touch(domain: RevisionDomain, tick: number, cause: string): number {
    this.state.current[domain] = (this.state.current[domain] ?? 0) + 1;
    this.state.lastCauses[domain] = String(cause).slice(0, 96);
    return this.state.current[domain];
  }

  token(domain: RevisionDomain, tick: number): RevisionToken {
    return { revision: this.state.current[domain], tick, cause: this.state.lastCauses[domain] };
  }

  changed(domain: RevisionDomain): boolean {
    return this.state.current[domain] !== this.state.materialized[domain];
  }

  markMaterialized(domain: RevisionDomain): void {
    this.state.materialized[domain] = this.state.current[domain];
  }

  changedDomains(): RevisionDomain[] { return DOMAINS.filter(d => this.changed(d)); }
  currentSnapshot(): RevisionGraphState { return structuredClone(this.state); }
  metrics() {
    return Object.fromEntries(DOMAINS.map(d => [d, {
      current: this.state.current[d],
      materialized: this.state.materialized[d],
      changed: this.changed(d),
      cause: this.state.lastCauses[d],
    }]));
  }
}
