export interface ResourceState {
  operations: number;
  memoryItems: number;
  maxOperations: number;
  maxMemoryItems: number;
}

export class MobileCognitiveResourceGuard {
  private readonly limits: Partial<ResourceState>;

  constructor(limits: Partial<ResourceState> = {}) {
    this.limits = limits;
  }

  check(state: ResourceState): boolean {
    return (
      state.operations <= (this.limits.maxOperations ?? 10000) &&
      state.memoryItems <= (this.limits.maxMemoryItems ?? 5000)
    );
  }

  suggestedReduction(state: ResourceState): number {
    if (this.check(state)) return 0;
    const overOps = Math.max(0, state.operations - (this.limits.maxOperations ?? 10000));
    const overMem = Math.max(0, state.memoryItems - (this.limits.maxMemoryItems ?? 5000));
    return Math.min(1, (overOps + overMem) / Math.max(1, state.operations + state.memoryItems));
  }
}
