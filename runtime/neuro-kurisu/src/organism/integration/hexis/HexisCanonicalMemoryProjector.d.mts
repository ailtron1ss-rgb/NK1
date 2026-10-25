import type { HexisHmxApplyReceipt, HexisHmxStage } from './HexisAdaptationFabric.ts';

/** Typed boundary for the JavaScript canonical-memory projector. */
export declare class HexisCanonicalMemoryProjector {
  constructor(memoryFabric: any, semanticGraph?: any);
  apply(stage: HexisHmxStage): HexisHmxApplyReceipt;
}
