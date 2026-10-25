import type { HexisHmxApplyReceipt, HexisHmxStage } from './HexisAdaptationFabric.ts';
import type { MemoryFabric } from '../../memory/MemoryFabric.ts';
import type { SemanticMemoryGraph } from '../../memory/SemanticMemoryGraph.ts';

export declare class HexisCanonicalMemoryProjector {
  constructor(memoryFabric: MemoryFabric, semanticGraph?: SemanticMemoryGraph);
  apply(stage: HexisHmxStage): HexisHmxApplyReceipt;
}
