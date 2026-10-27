import type { HexisHmxApplyReceipt, HexisHmxStage } from './HexisAdaptationFabric.ts';
import type { MemoryFabric } from '../../memory/MemoryFabric.ts';
import type { SemanticMemoryGraph } from '../../memory/SemanticMemoryGraph.ts';

export declare class HexisCanonicalMemoryProjector {
  constructor(memoryFabric: MemoryFabric, semanticGraph?: SemanticMemoryGraph, temporalLedger?: { snapshot(): unknown; restore(state: any): void; recordTemporalAssertion(input: { memoryId: string; summary: string; confidence01: number; validFrom: number; source?: string; value?: unknown }): unknown; removeBeliefProjection?(memoryId: string): boolean; registerOrUpdateBelief?(input: { memoryId: string; confidence01: number; trust01?: number; at?: number }): unknown });
  apply(stage: HexisHmxStage): HexisHmxApplyReceipt;
}

/** Shared receipt contract used by both the projector and persisted-stage replay path. */
export declare function isValidHmxApplyReceipt(stage: HexisHmxStage, receipt: unknown): receipt is HexisHmxApplyReceipt;
