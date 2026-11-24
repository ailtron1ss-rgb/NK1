export type MemoryTier = 'working' | 'episodic' | 'long_term';

export class HierarchicalMemoryCoordinator {
  private tiers: Record<MemoryTier, unknown[]> = {
    working: [],
    episodic: [],
    long_term: [],
  };

  store(value: unknown, tier: MemoryTier = 'working') {
    this.tiers[tier].push(value);
    if (this.tiers[tier].length > 256) this.tiers[tier].shift();
  }

  snapshot() {
    return {
      working: this.tiers.working.length,
      episodic: this.tiers.episodic.length,
      longTerm: this.tiers.long_term.length,
    };
  }
}
