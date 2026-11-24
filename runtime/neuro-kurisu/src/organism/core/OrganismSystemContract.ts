import type { OrganismSystemName } from './OrganismSystemFabric.ts';

export type OrganismSystemPhase = 'critical'|'hot'|'warm'|'cold';

export interface OrganismSystemContract {
  name: OrganismSystemName;
  version: 1;
  purpose: string;
  phase: OrganismSystemPhase;
  estimatedCost01: number;
  cadenceCycles: number;
  dependencies: readonly OrganismSystemName[];
  capabilityNames: readonly string[];
  capabilities?: readonly string[];
  snapshotWeight01: number;
  executionRank?: number;
}


export interface ResolvedOrganismSystemContract {
  name: OrganismSystemName;
  version: 1;
  purpose: string;
  phase: OrganismSystemPhase;
  estimatedCost01: number;
  cadenceCycles: number;
  dependencies: readonly OrganismSystemName[];
  capabilityNames: readonly string[];
  capabilities: readonly string[];
  snapshotWeight01: number;
  executionRank?: number;
  systemName: OrganismSystemName;
  snapshot(): unknown;
  health(): OrganismSystemHealthSnapshot;
}

export interface OrganismSystemHealthSnapshot {
  systemName: OrganismSystemName | string;
  available: boolean;
  snapshotKeys: number;
  snapshotMs: number;
  checkedAt: number;
  error?: string;
}

export interface ProbeableOrganismSystem {
  readonly systemName: string;
  snapshot: () => unknown;
}

export function probeOrganismSystem(system: ProbeableOrganismSystem): OrganismSystemHealthSnapshot {
  const started = Date.now();
  try {
    const value = system.snapshot();
    const snapshotKeys = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value as Record<string, unknown>).length
      : 1;
    return {systemName:system.systemName, available:true, snapshotKeys, snapshotMs:Date.now()-started, checkedAt:Date.now()};
  } catch (error) {
    return {systemName:system.systemName, available:false, snapshotKeys:0, snapshotMs:Date.now()-started, checkedAt:Date.now(), error:String((error as any)?.message ?? error).slice(0,160)};
  }
}


export interface OrganismSystemRuntimeContract {
  readonly systemName: OrganismSystemName;
  readonly dependencies: readonly OrganismSystemName[];
  readonly systemCapabilities: readonly string[];
  snapshot(): unknown;
  health(): OrganismSystemHealthSnapshot;
}


const CONTRACTS: readonly OrganismSystemContract[] = [
  {name:'self',version:1,purpose:'identity, personhood, continuity and self-model',phase:'hot',estimatedCost01:.22,cadenceCycles:1,dependencies:['memory','world'],capabilityNames:['identity','self-model','personhood','continuity'],snapshotWeight01:.18,executionRank:3},
  {name:'governance',version:1,purpose:'integrity, safety, constitutional constraints and rollback',phase:'critical',estimatedCost01:.14,cadenceCycles:1,dependencies:['self'],capabilityNames:['integrity','safety','capability-control','rollback'],snapshotWeight01:.14,executionRank:4},
  {name:'memory',version:1,purpose:'episodic, semantic, autobiographical and working memory',phase:'hot',estimatedCost01:.28,cadenceCycles:1,dependencies:['world'],capabilityNames:['episodic-memory','semantic-memory','autobiography','consolidation'],snapshotWeight01:.22,executionRank:2},
  {name:'world',version:1,purpose:'world-state, prediction, causal and reality models',phase:'hot',estimatedCost01:.31,cadenceCycles:1,dependencies:['embodiment'],capabilityNames:['world-model','prediction','causality','grounding'],snapshotWeight01:.20,executionRank:1},
  {name:'embodiment',version:1,purpose:'sensorium, perception, multimodal grounding and body state',phase:'hot',estimatedCost01:.24,cadenceCycles:1,dependencies:[],capabilityNames:['vision','audio','sensorium','interoception','multimodal-fusion'],snapshotWeight01:.12,executionRank:0},
  {name:'agency',version:1,purpose:'goals, planning, action selection and project execution',phase:'warm',estimatedCost01:.23,cadenceCycles:1,dependencies:['self','world','governance'],capabilityNames:['goals','planning','action','projects'],snapshotWeight01:.08,executionRank:5},
  {name:'research',version:1,purpose:'evidence, experiments, development and model comparison',phase:'cold',estimatedCost01:.36,cadenceCycles:8,dependencies:['world','memory','governance'],capabilityNames:['research','evidence','experiments','model-selection','development'],snapshotWeight01:.06,executionRank:6},
];

export function organismSystemContract(name: OrganismSystemName): OrganismSystemContract {
  const found = CONTRACTS.find(c=>c.name===name);
  if (!found) throw new Error(`Unknown organism system contract: ${name}`);
  return {...found,dependencies:[...found.dependencies],capabilityNames:[...found.capabilityNames]};
}

export function organismSystemContracts(): OrganismSystemContract[] {
  return CONTRACTS.map(c=>({...c,dependencies:[...c.dependencies],capabilityNames:[...c.capabilityNames]}));
}
