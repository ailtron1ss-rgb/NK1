export type ModuleId =
  | 'reservoir'
  | 'somatic'
  | 'hypergraph'
  | 'personality'
  | 'language'
  | 'logic'
  | 'social'
  | 'knowledge'
  | 'self_improve';

export type ModuleStatus = 'active' | 'idle' | 'disabled' | 'error';

export interface BrainModule {
  id: ModuleId;
  name: string;
  description: string;
  status: ModuleStatus;
  /** Approximate relative cost 1–10 for mobile budgeting */
  cost: number;
  activate(): void;
  deactivate(): void;
  /** Optional context contribution for hub */
  contribute?(ctx: HubContext): ModuleContribution;
}

export interface HubContext {
  userMessage: string;
  stm: string[];
  emotions: Record<string, number>;
  frame?: string;
}

export interface ModuleContribution {
  moduleId: ModuleId;
  notes: string[];
  styleHints: string[];
  memoryHints: string[];
  weight: number;
}

export interface ImprovementProposal {
  id: string;
  createdAt: number;
  title: string;
  explanationRu: string;
  riskRu: string;
  target: string;
  patchSummary: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
}
