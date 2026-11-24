import { PersistenceBranchBudgetAuditor, DEFAULT_PERSISTENCE_BRANCH_BUDGETS, type PersistenceBudgetReport } from './PersistenceBranchBudget.ts';

export type PersistenceBudgetTier = 'normal'|'pressure'|'emergency';

export interface PersistenceBudgetAction {
  tier: PersistenceBudgetTier;
  maintenancePressure01: number;
  traceLimit: number;
  eventLimit: number;
  compatibilityMemoryLimit: number;
  p62HistoryLimit: number;
  evidenceHistoryLimit: number;
  realityHistoryLimit: number;
  reason: string;
}

/** Converts durable-state budgets into bounded runtime maintenance signals. */
export class PersistenceBudgetController {
  private readonly auditor: PersistenceBranchBudgetAuditor;
  constructor(budgets = DEFAULT_PERSISTENCE_BRANCH_BUDGETS) { this.auditor = new PersistenceBranchBudgetAuditor(budgets); }
  inspect(state: unknown, options: { includeTotal?: boolean } = {}): PersistenceBudgetReport { return this.auditor.inspect(state, options); }
  decide(state: unknown): PersistenceBudgetAction {
    const report = this.inspect(state, { includeTotal: false });
    const max = report.maxUtilization01;
    if (report.overBudget > 0 || max >= .90) return { tier:'emergency', maintenancePressure01:1, traceLimit:160, eventLimit:220, compatibilityMemoryLimit:16, p62HistoryLimit:6, evidenceHistoryLimit:8, realityHistoryLimit:8, reason:`durable-budget emergency max=${max.toFixed(3)}` };
    if (max >= .72) return { tier:'pressure', maintenancePressure01:.88, traceLimit:224, eventLimit:260, compatibilityMemoryLimit:24, p62HistoryLimit:10, evidenceHistoryLimit:12, realityHistoryLimit:12, reason:`durable-budget pressure max=${max.toFixed(3)}` };
    return { tier:'normal', maintenancePressure01:.72, traceLimit:256, eventLimit:320, compatibilityMemoryLimit:48, p62HistoryLimit:14, evidenceHistoryLimit:16, realityHistoryLimit:16, reason:`durable-budget normal max=${max.toFixed(3)}` };
  }
}
