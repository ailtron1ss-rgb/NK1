import type {
  IntentApproval,
  IntentContract,
  IntentContractInput,
  IntentExtractionProvider,
} from '../cognition/IntentCompiler.ts';
import { IntentCompiler } from '../cognition/IntentCompiler.ts';
import type { ActionGateway, ToolExecution } from './ActionGateway.ts';
import type { IntentBoundAction, IntentBridgeReconciliationResult, IntentBridgeResult, IntentGatewayPort } from './IntentActionGatewayBridge.ts';
import { IntentActionGatewayBridge } from './IntentActionGatewayBridge.ts';

export const INTENT_APPROVAL_TOOL_ID = 'system.intent.approve';

export interface IntentApprovalScope {
  allowedActions: string[];
  acknowledgedAssumptions?: string[];
  riskAcknowledged?: boolean;
}
export interface IntentApprovalEvidence extends IntentApprovalScope {
  /** Ignored as authority; the runtime stamps approval time after consuming the host ticket. */
  at?: number;
  evidenceRef: string;
  expiresAt?: number;
  userConfirmed?: boolean;
}
export interface IntentExecutionLink {
  at: number;
  contractId: string;
  toolId: string;
  operation: 'execute' | 'reconcile';
  executionId?: string;
  outcomeClass?: ToolExecution['outcomeClass'];
  idempotencyStatus?: ToolExecution['idempotencyStatus'];
}
export interface IntentExecutionRuntimeSnapshot {
  version: 1;
  records: IntentContract[];
  executions: IntentExecutionLink[];
}
export interface IntentExecutionRuntimeOptions {
  clock?: () => number;
  approvalKey?: string | Uint8Array;
  extractionTimeoutMs?: number;
}

const MAX_CONTRACTS = 64;
const MAX_EXECUTIONS = 256;
const ACTION_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/i;

type Scope = {
  allowedActions: string[];
  acknowledgedAssumptions: string[];
  riskAcknowledged: boolean;
};

function cleanStrings(values: unknown, max = 32, maxLength = 2_000): string[] {
  if (!Array.isArray(values)) return [];
  const output = new Set<string>();
  for (const value of values.slice(0, max)) {
    if (typeof value !== 'string') continue;
    const normalized = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
    if (normalized) output.add(normalized);
  }
  return [...output].sort();
}

/**
 * OrganismCore-owned orchestration for intent compilation, human approval,
 * execution, persistence and read-only receipt recovery.
 *
 * The compiler's approval verifier accepts only the exact approval object that
 * this runtime has backed with a consumed ActionGateway user-approval ticket.
 */
export class IntentExecutionRuntime {
  private readonly compiler: IntentCompiler;
  private readonly bridge: IntentActionGatewayBridge;
  private readonly verifiedApprovals = new WeakSet<object>();
  private readonly drafts = new Map<string, IntentContract>();
  private readonly approved = new Map<string, IntentContract>();
  private executions: IntentExecutionLink[] = [];
  private readonly clock: () => number;

  constructor(
    private readonly actionGateway: ActionGateway,
    options: IntentExecutionRuntimeOptions = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.compiler = new IntentCompiler({
      ...options,
      approvalVerifier: (_contract, approval) => this.verifiedApprovals.has(approval),
    });
    this.bridge = new IntentActionGatewayBridge(this.compiler);
  }

  compile(input: IntentContractInput): IntentContract {
    const contract = this.compiler.compile(input);
    this.drafts.set(contract.id, contract);
    return contract;
  }

  async compileWith(input: IntentContractInput, provider: IntentExtractionProvider): Promise<IntentContract> {
    const contract = await this.compiler.compileWith(input, provider);
    this.drafts.set(contract.id, contract);
    return contract;
  }

  private issuedDraft(contract: IntentContract): void {
    if (!contract || this.drafts.get(contract.id) !== contract) {
      throw new TypeError('intent contract is not an active draft issued by this OrganismCore');
    }
    if (contract.missingInformation.length > 0) {
      throw new Error('intent contract is incomplete: ' + contract.missingInformation.join(', '));
    }
  }

  private normalizeScope(contract: IntentContract, scope: IntentApprovalScope): Scope {
    const allowedActions = cleanStrings(scope?.allowedActions, 32, 160);
    const acknowledgedAssumptions = cleanStrings(scope?.acknowledgedAssumptions, 32, 2_000);
    if (!Array.isArray(scope?.allowedActions) || allowedActions.length === 0 ||
        scope.allowedActions.length > 32 || allowedActions.length !== new Set(scope.allowedActions).size) {
      throw new TypeError('intent approval requires a non-empty bounded action scope');
    }
    if (allowedActions.some(action => !ACTION_ID.test(action) || action.includes('*'))) {
      throw new TypeError('intent approval contains an invalid or wildcard action identifier');
    }
    const declared = new Set(contract.permissions.allowedActions);
    const denied = new Set(contract.permissions.deniedActions);
    if (allowedActions.some(action => !declared.has(action) || denied.has(action))) {
      throw new Error('intent approval scope must be a subset of the non-denied declared actions');
    }
    const requiredAssumptions = contract.assumptions.filter(item => item.requiresConfirmation).map(item => item.statement);
    if (requiredAssumptions.some(statement => !acknowledgedAssumptions.includes(statement))) {
      throw new Error('all material and low-confidence assumptions must be acknowledged before requesting approval');
    }
    if (acknowledgedAssumptions.some(statement => !requiredAssumptions.includes(statement))) {
      throw new Error('approval includes an assumption that does not require acknowledgement');
    }
    const riskAcknowledged = scope.riskAcknowledged === true;
    if ((contract.risk.level === 'high' || contract.risk.level === 'critical') && !riskAcknowledged) {
      throw new Error('high and critical intent requires explicit risk acknowledgement');
    }
    return { allowedActions, acknowledgedAssumptions, riskAcknowledged };
  }

  private approvalEvidencePayload(contract: IntentContract, scope: Scope): Record<string, unknown> {
    return {
      intentContractId: contract.id,
      goal: contract.goal.text.slice(0, 240),
      riskLevel: contract.risk.level,
      requestedActions: scope.allowedActions.join(', '),
      acknowledgedAssumptions: scope.acknowledgedAssumptions.join(' | ') || '(none)',
      riskAcknowledged: scope.riskAcknowledged,
    };
  }

  async requestApproval(
    contract: IntentContract,
    scope: IntentApprovalScope,
    reason = 'intent-user-confirmation',
  ) {
    this.issuedDraft(contract);
    const normalized = this.normalizeScope(contract, scope);
    return this.actionGateway.requestToolApproval(
      INTENT_APPROVAL_TOOL_ID,
      this.approvalEvidencePayload(contract, normalized),
      reason,
      {},
      'direct',
    );
  }

  async resolveApprovalRequest(requestId: string, approved: boolean, actor = 'owner') {
    return this.actionGateway.resolveToolApproval(requestId, approved, actor);
  }

  async approve(contract: IntentContract, evidence: IntentApprovalEvidence): Promise<IntentContract> {
    this.issuedDraft(contract);
    if (evidence?.userConfirmed === false) throw new Error('explicit user confirmation is required');
    const scope = this.normalizeScope(contract, evidence);
    const evidenceRef = typeof evidence?.evidenceRef === 'string' ? evidence.evidenceRef.trim() : '';
    if (!evidenceRef) throw new TypeError('intent approval evidence reference is required');
    const payload = this.approvalEvidencePayload(contract, scope);
    const consumed = await this.actionGateway.consumeDirectActionApproval(
      INTENT_APPROVAL_TOOL_ID,
      payload,
      evidenceRef,
      {},
      'direct',
    );
    if (!consumed.ok) {
      throw new Error('intent host approval was not confirmed or no longer matches this exact contract: ' + (consumed.reason ?? 'approval-invalid'));
    }
    const hostAttestedApproval: IntentApproval = {
      contractId: contract.id,
      userConfirmed: true,
      ...scope,
      at: this.clock(),
      ...(evidence.expiresAt === undefined ? {} : { expiresAt: evidence.expiresAt }),
      evidenceRef,
    };
    this.verifiedApprovals.add(hostAttestedApproval);
    const approved = this.compiler.approve(contract, hostAttestedApproval);
    this.drafts.delete(contract.id);
    this.approved.set(contract.id, approved);
    this.trimContracts();
    return approved;
  }

  reject(contract: IntentContract): IntentContract {
    this.issuedDraft(contract);
    const rejected = this.compiler.reject(contract);
    this.drafts.delete(contract.id);
    return rejected;
  }

  getContract(contractId: string): IntentContract | null {
    return this.approved.get(contractId) ?? null;
  }

  async execute(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
  ): Promise<IntentBridgeResult> {
    const result = await this.bridge.execute(contract, action, gateway);
    if (result.executed) this.record(contract, action, 'execute', result.result);
    return result;
  }

  async reconcile(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
  ): Promise<IntentBridgeReconciliationResult> {
    const result = await this.bridge.reconcile(contract, action, gateway);
    if (result.reconciled) this.record(contract, action, 'reconcile', result.result);
    return result;
  }

  snapshot(): IntentExecutionRuntimeSnapshot {
    return {
      version: 1,
      records: [...this.approved.values()].slice(-MAX_CONTRACTS).map(row => structuredClone(row)),
      executions: this.executions.slice(-MAX_EXECUTIONS).map(row => structuredClone(row)),
    };
  }

  restore(snapshot: unknown): void {
    this.approved.clear();
    this.drafts.clear();
    this.executions = [];
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;
    const row = snapshot as Partial<IntentExecutionRuntimeSnapshot>;
    if (row.version !== 1) return;
    if (Array.isArray(row.records)) {
      for (const candidate of row.records.slice(-MAX_CONTRACTS)) {
        const restored = this.compiler.restoreApprovedContract(candidate);
        if (restored) this.approved.set(restored.id, restored);
      }
    }
    if (Array.isArray(row.executions)) {
      this.executions = row.executions.slice(-MAX_EXECUTIONS).filter(item =>
        item && typeof item === 'object' &&
        typeof item.contractId === 'string' &&
        typeof item.toolId === 'string' &&
        (item.operation === 'execute' || item.operation === 'reconcile') &&
        Number.isSafeInteger(item.at) && item.at >= 0,
      ).map(item => structuredClone(item));
    }
  }

  private record(
    contract: IntentContract,
    action: IntentBoundAction,
    operation: IntentExecutionLink['operation'],
    result: ToolExecution,
  ): void {
    this.approved.set(contract.id, contract);
    this.executions.push({
      at: this.clock(),
      contractId: contract.id,
      toolId: action.toolId,
      operation,
      ...(result.executionId ? { executionId: result.executionId } : {}),
      ...(result.outcomeClass ? { outcomeClass: result.outcomeClass } : {}),
      ...(result.idempotencyStatus ? { idempotencyStatus: result.idempotencyStatus } : {}),
    });
    if (this.executions.length > MAX_EXECUTIONS) this.executions.splice(0, this.executions.length - MAX_EXECUTIONS);
    this.trimContracts();
  }

  private trimContracts(): void {
    while (this.approved.size > MAX_CONTRACTS) {
      const first = this.approved.keys().next().value as string | undefined;
      if (!first) break;
      this.approved.delete(first);
    }
  }
}
