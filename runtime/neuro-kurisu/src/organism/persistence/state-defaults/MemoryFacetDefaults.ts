/** Domain-specific default-state factory extracted from the persistence coordinator. */
import type { MemoryFacet } from '../../core/types.ts';
import { defaultSelfModel } from '../../cognition/SelfModelV2.ts';
import { attend } from '../../cognition/AttentionSchema.ts';
import { DEFAULT_ADAPTIVE_VALUES } from '../../cognition/ValuePlasticity.ts';

export const defaultMemoryFacet = (): MemoryFacet => ({ eventLog:[], autobiographicalMemories:[], selfModel:defaultSelfModel(), attention:attend({target:'none',reason:'migration',salience:0,confidence:0.2,budget:0.82}), socialModel:[], adaptiveValues:{...DEFAULT_ADAPTIVE_VALUES}, workspace:{capacity:5,items:[],broadcastId:'',recurrence:0,lastCompetition:0,ignition01:0,sourceDiversity01:0,coalitionStability01:0}, semanticGraph:{nodes:[],edges:[],updates:0}, experiments:[], counterfactuals:[], lastRetrievedMemoryIds:[] });
