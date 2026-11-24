import type {
  IntentApproval,
  IntentContract,
  IntentContractInput,
  IntentExtractionProvider,
} from '../cognition/IntentCompiler.ts';
import { IntentCompiler } from '../cognition/IntentCompiler.ts';
import { sha256Stable } from '../core/StableSerialization.ts';
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
export interface TrustedAutonomousDecisionEvidence {
  source: 'autonomous-resource-tool-life' | 'project-executor' | 'compound-skill';
  decisionId: string;
  tick: number;
  /** Tool identifier selected by the planner before Core alias normalization. */
  plannerToolId: string;
  /** Canonical ActionGateway tool identifier included in the intent contract. */
  toolId: string;
  intentHash: string;
  reason: string;
  sourceText: string;
  projectId?: string;
  stepId?: string;
  requestFingerprint?: string;
  operationKey?: string;
  sequence?: number;
  skillId?: string;
  attempt?: number;
  parentDecisionId?: string;
  inputHash?: string;
}
export type IntentExecutionPhase = 'prepared' | 'pending-reconciliation' | 'reconciliation-attempted' | 'completed' | 'blocked';
export interface IntentExecutionLink {
  at: number;
  contractId: string;
  toolId: string;
  operation: 'execute' | 'reconcile';
  phase?: IntentExecutionPhase;
  /** SHA-256 digest only; the original idempotency key is never persisted here. */
  idempotencyKeyHash?: string;
  decisionId?: string;
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
  autonomousDecisionVerifier?: (contract: IntentContract, evidence: TrustedAutonomousDecisionEvidence) => boolean;
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
  /** Prevent concurrent callers from dispatching the same approved intent/tool pair. */
  private readonly inFlightExecutions = new Set<string>();
  private readonly clock: () => number;
  private readonly actionGateway: ActionGateway;
  private readonly options: IntentExecutionRuntimeOptions;

  constructor(
    actionGateway: ActionGateway,
    options: IntentExecutionRuntimeOptions = {},
  ) {
    this.actionGateway = actionGateway;
    this.options = options;
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
    const request = this.actionGateway.toolPermissionSnapshot().requests.find(row => row.id === requestId);
    if (!request || request.toolId !== INTENT_APPROVAL_TOOL_ID || request.operation !== 'direct') {
      return { ok: false, error: 'intent-approval-request-not-found' };
    }
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

  /**
   * Mint a short-lived internal approval only from a Core-verified CEF planner event.
   * Autonomous approval cannot waive material assumptions or high/critical risk;
   * those cases must return to the human approval centre.
   */
  approveFromTrustedPlanner(
    contract: IntentContract,
    scope: IntentApprovalScope,
    evidence: TrustedAutonomousDecisionEvidence,
  ): IntentContract {
    this.issuedDraft(contract);
    const normalized = this.normalizeScope(contract, scope);
    if (contract.risk.level === 'high' || contract.risk.level === 'critical') {
      throw new Error('autonomous planner cannot self-approve high or critical intent');
    }
    if (contract.assumptions.some(item => item.requiresConfirmation)) {
      throw new Error('autonomous planner cannot self-acknowledge material intent assumptions');
    }
    const verifier = this.options.autonomousDecisionVerifier;
    let verified = false;
    try {
      verified = Boolean(verifier?.(contract, evidence));
    } catch {
      verified = false;
    }
    if (!verified) throw new Error('trusted autonomous planner decision receipt was not verified');
    const approval: IntentApproval = {
      contractId: contract.id,
      authority: 'autonomous-planner',
      ...normalized,
      at: this.clock(),
      evidenceRef: `planner-decision:${evidence.decisionId}`,
    };
    this.verifiedApprovals.add(approval);
    const signed = this.compiler.approve(contract, approval);
    this.drafts.delete(contract.id);
    this.approved.set(contract.id, signed);
    this.trimContracts();
    return signed;
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

  private idempotencyKeyHash(action: IntentBoundAction): string | undefined {
    const key = action?.options?.idempotencyKey;
    if (typeof key !== 'string' || !key.trim() || key.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(key)) return undefined;
    return sha256Stable({ idempotencyKey: key.trim() });
  }

  private pendingIntentExecution(contractId: string, toolId: string): IntentExecutionLink | undefined {
    return [...this.executions].reverse().find(row =>
      row.contractId === contractId && row.toolId === toolId && row.operation === 'execute' &&
      (row.phase === 'prepared' || row.phase === 'pending-reconciliation' || row.phase === 'reconciliation-attempted'),
    );
  }

  private pushExecutionLink(row: IntentExecutionLink): void {
    this.executions.push(row);
    if (this.executions.length > MAX_EXECUTIONS) this.executions.splice(0, this.executions.length - MAX_EXECUTIONS);
  }

  async execute(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
    beforeDispatch?: () => Promise<void>,
  ): Promise<IntentBridgeResult> {
    if (!contract || this.approved.get(contract.id) !== contract) {
      return { executed: false, contractId: null, reason: 'intent-contract-not-owned-or-restored-by-this-core' };
    }
    const gate = this.compiler.gate(contract, action?.toolId);
    if (!gate.allowed) return { executed: false, contractId: null, reason: gate.reason };
    if (!action || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) {
      return { executed: false, contractId: gate.contractId, reason: 'invalid-action-input' };
    }
    if (typeof action.reason !== 'string' || !action.reason.trim() || !gateway || typeof gateway.executeTool !== 'function') {
      return { executed: false, contractId: gate.contractId, reason: 'action-gateway-unavailable-or-invalid-reason' };
    }

    const executionLock = contract.id + String.fromCharCode(0) + gate.action;
    if (this.inFlightExecutions.has(executionLock)) {
      return { executed: false, contractId: contract.id, reason: 'intent-execution-in-progress' };
    }
    this.inFlightExecutions.add(executionLock);
    try {
      const keyHash = this.idempotencyKeyHash(action);
      const prior = this.pendingIntentExecution(contract.id, gate.action);
      if (prior && prior.phase !== 'prepared') {
        return { executed: false, contractId: contract.id, reason: 'intent-execution-reconciliation-required' };
      }
      if (prior?.phase === 'prepared' && prior.idempotencyKeyHash !== keyHash) {
        return { executed: false, contractId: contract.id, reason: 'intent-prepared-operation-key-mismatch' };
      }
      const link: IntentExecutionLink = prior ?? {
        at: this.clock(),
        contractId: contract.id,
        toolId: gate.action,
        operation: 'execute',
        phase: 'prepared',
        ...(keyHash ? { idempotencyKeyHash: keyHash } : {}),
        ...(action.options?.decisionId ? { decisionId: action.options.decisionId } : {}),
      };
      if (!prior) this.pushExecutionLink(link);

      // A durable link is checkpointed before ActionGateway can write its own
      // receipt or enter a side-effect executor. The in-process lock prevents
      // a concurrent caller from seeing the prepared row and dispatching it.
      await beforeDispatch?.();

      let result: IntentBridgeResult;
      try {
        result = await this.bridge.execute(contract, action, gateway);
      } catch {
        // An exception at the gateway boundary is ambiguous: the executor may
        // have started before transport/adapter failure. Never permit a fresh
        // side-effect attempt; persist a reconciliation-required state.
        link.at = this.clock();
        link.phase = 'pending-reconciliation';
        try {
          await beforeDispatch?.();
        } catch {
          // The pre-dispatch checkpoint already records prepared; restore()
          // promotes that crash window to pending-reconciliation as well.
        }
        return { executed: false, contractId: contract.id, reason: 'intent-execution-outcome-uncertain' };
      }

      link.at = this.clock();
      const gatewayOutcomeClass = String(result.executed ? result.result.outcomeClass : '');
      const gatewayNeedsApproval = ['approval-required', 'approval-invalid', 'approval-storage-failed'].includes(gatewayOutcomeClass);
      link.phase = gatewayNeedsApproval
        ? 'blocked'
        : result.executed
          ? (['idempotency-recovery-required', 'idempotency-storage-failed', 'idempotency-ledger-full', 'executed-partial', 'executed-unverified', 'executed-contradicted'].includes(gatewayOutcomeClass)
              ? 'pending-reconciliation' : 'completed')
          : 'blocked';
      if (result.executed) {
        link.executionId = result.result.executionId;
        link.outcomeClass = result.result.outcomeClass;
        link.idempotencyStatus = result.result.idempotencyStatus;
      }
      return result;
    } finally {
      this.inFlightExecutions.delete(executionLock);
    }
  }

  async reconcile(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
    beforeLookup?: () => Promise<void>,
  ): Promise<IntentBridgeReconciliationResult> {
    if (!contract || this.approved.get(contract.id) !== contract) {
      return { attempted: false, contractId: null, reason: 'intent-contract-not-owned-or-restored-by-this-core' };
    }
    const gate = this.compiler.gate(contract, action?.toolId, 'reconcile');
    if (!gate.allowed) return { attempted: false, contractId: null, reason: gate.reason };
    if (!action || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) {
      return { attempted: false, contractId: gate.contractId, reason: 'invalid-action-input' };
    }
    if (typeof action.reason !== 'string' || !action.reason.trim() ||
        !gateway || typeof gateway.reconcileToolExecution !== 'function') {
      return { attempted: false, contractId: gate.contractId, reason: 'action-gateway-reconciliation-unavailable' };
    }
    const keyHash = this.idempotencyKeyHash(action);
    if (!keyHash) return { attempted: false, contractId: contract.id, reason: 'original-idempotency-key-required' };
    const lock = contract.id + String.fromCharCode(0) + gate.action;
    if (this.inFlightExecutions.has(lock)) {
      return { attempted: false, contractId: contract.id, reason: 'intent-execution-in-progress' };
    }
    this.inFlightExecutions.add(lock);
    try {
      const pending = this.pendingIntentExecution(contract.id, gate.action);
      if (!pending || pending.idempotencyKeyHash !== keyHash) {
        return { attempted: false, contractId: contract.id, reason: 'matching-pending-intent-execution-not-found' };
      }
      pending.phase = 'reconciliation-attempted';
      pending.at = this.clock();
      const link: IntentExecutionLink = {
        at: this.clock(), contractId: contract.id, toolId: gate.action, operation: 'reconcile',
        phase: 'reconciliation-attempted', idempotencyKeyHash: keyHash,
        ...(action.options?.decisionId ? { decisionId: action.options.decisionId } : {}),
      };
      this.pushExecutionLink(link);
      await beforeLookup?.();
      const result = await this.bridge.reconcile(contract, action, gateway);
      if (result.attempted) {
        const outcome = result.result;
        link.at = this.clock();
        link.executionId = outcome.executionId;
        link.outcomeClass = outcome.outcomeClass;
        link.idempotencyStatus = outcome.idempotencyStatus;
        const noGatewayReceipt = outcome.result?.error === 'no-pending-receipt-to-reconcile';
        const resolved = outcome.idempotencyStatus === 'reconciled' ||
          outcome.idempotencyStatus === 'confirmed-not-executed' ||
          outcome.outcomeClass === 'reconciled-not-executed' || outcome.verified === true;
        if (noGatewayReceipt || !resolved) {
          // Missing/unknown receipts and non-final provider lookups are not proof of non-execution.
          link.phase = 'pending-reconciliation';
          pending.phase = 'pending-reconciliation';
          pending.at = this.clock();
          pending.outcomeClass = outcome.outcomeClass;
          pending.executionId = outcome.executionId;
          pending.idempotencyStatus = outcome.idempotencyStatus;
        } else {
          link.phase = 'completed';
          pending.phase = 'completed';
          pending.at = this.clock();
          pending.outcomeClass = outcome.outcomeClass;
          pending.executionId = outcome.executionId;
          pending.idempotencyStatus = outcome.idempotencyStatus;
        }
      }
      return result;
    } finally {
      this.inFlightExecutions.delete(lock);
    }
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
        Number.isSafeInteger(item.at) && item.at >= 0 &&
        (item.phase === undefined || ['prepared','pending-reconciliation','reconciliation-attempted','completed','blocked'].includes(item.phase)) &&
        (item.idempotencyKeyHash === undefined || /^[a-f0-9]{64}$/i.test(item.idempotencyKeyHash)),
      ).map(item => {
        const restored = structuredClone(item);
        if (restored.phase === undefined) {
          restored.phase = restored.outcomeClass === 'executed-unverified' ||
            restored.outcomeClass === 'executed-contradicted' ||
            restored.outcomeClass === 'executed-partial' ||
            restored.outcomeClass === 'idempotency-recovery-required'
            ? 'pending-reconciliation'
            : 'completed';
        }
        // A prepared intent persisted by a previous process may have crashed
        // immediately before or after ActionGateway receipt admission. The old
        // process boundary is gone, so never infer that it is safe to dispatch
        // again. Reconciliation is the only permitted continuation.
        if (restored.operation === 'execute' && restored.phase === 'prepared') {
          restored.phase = 'pending-reconciliation';
        }
        return restored;
      });
    }
  }

  private trimContracts(): void {
    while (this.approved.size > MAX_CONTRACTS) {
      const first = this.approved.keys().next().value as string | undefined;
      if (!first) break;
      this.approved.delete(first);
    }
  }
}
