export interface PersistenceBranchBudget {
  path: string;
  maxBytes: number;
  severity: 'critical'|'warning'|'info';
}

export interface PersistenceBranchReport {
  path: string;
  bytes: number;
  budget: number;
  utilization01: number;
  overBudget: boolean;
  severity: PersistenceBranchBudget['severity'];
}

export interface PersistenceBudgetReport {
  totalBytes: number;
  branches: PersistenceBranchReport[];
  overBudget: number;
  maxUtilization01: number;
}

const textEncoder = new TextEncoder();
const byteSize = (value: unknown) => textEncoder.encode(JSON.stringify(value)).byteLength;
const getPath = (root: any, path: string) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], root);

/**
 * Portable, dependency-free persisted-state budget auditor. It intentionally audits
 * serialized bytes (the thing that reaches the state store), not object counts.
 * This makes hidden branch growth visible before it becomes a durability/GC problem.
 */
export class PersistenceBranchBudgetAuditor {
  private readonly budgets: PersistenceBranchBudget[];
  constructor(budgets: PersistenceBranchBudget[]) { this.budgets = budgets; }
  inspect(state: unknown, options: { includeTotal?: boolean } = {}): PersistenceBudgetReport {
    const includeTotal = options.includeTotal !== false;
    const branches = this.budgets.map(budget => {
      const bytes = byteSize(getPath(state, budget.path) ?? null);
      const utilization01 = bytes / Math.max(1, budget.maxBytes);
      return { path: budget.path, bytes, budget: budget.maxBytes, utilization01, overBudget: bytes > budget.maxBytes, severity: budget.severity };
    });
    return {
      totalBytes: includeTotal ? byteSize(state) : 0,
      branches,
      overBudget: branches.filter(branch => branch.overBudget).length,
      maxUtilization01: branches.reduce((max, branch) => Math.max(max, branch.utilization01), 0),
    };
  }
}

export const DEFAULT_PERSISTENCE_BRANCH_BUDGETS: PersistenceBranchBudget[] = [
  { path:'facets.memory.autobiographicalMemories', maxBytes:145000, severity:'critical' },
  { path:'facets.memory.eventLog', maxBytes:165000, severity:'critical' },
  { path:'facets.advanced.p62MemoryFabric', maxBytes:60000, severity:'warning' },
  { path:'facets.advanced.experienceContinuum', maxBytes:180000, severity:'warning' },
  { path:'traces', maxBytes:500000, severity:'warning' },
  { path:'facets.advanced.memoryOS', maxBytes:300000, severity:'critical' },
  { path:'facets.advanced.p54LongHorizonEvidence', maxBytes:110000, severity:'warning' },
  { path:'facets.advanced.p77RealityExperimentOS', maxBytes:110000, severity:'warning' },
];
