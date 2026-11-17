import type { IntentCompiler, IntentContract } from '../cognition/IntentCompiler.ts';
import type { ActionGatewayExecutionOptions, ToolExecution } from './ActionGateway.ts';

export interface IntentGatewayPort {
  executeTool(
    id: string,
    input: Record<string, unknown>,
    reason: string,
    options?: ActionGatewayExecutionOptions,
    finalizationContextKeys?: string[],
  ): Promise<ToolExecution>;
  reconcileToolExecution?(
    id: string,
    input: Record<string, unknown>,
    reason: string,
    options?: ActionGatewayExecutionOptions,
  ): Promise<ToolExecution>;
}
export interface IntentBoundAction {
  toolId: string;
  input: Record<string, unknown>;
  reason: string;
  options?: ActionGatewayExecutionOptions;
  intentApprovalId?: string;
  finalizationContextKeys?: string[];
}
export type IntentBridgeResult =
  | { executed: true; contractId: string; result: ToolExecution }
  | { executed: false; contractId: string | null; reason: string };
export type IntentBridgeReconciliationResult =
  | { attempted: true; contractId: string; result: ToolExecution }
  | { attempted: false; contractId: string | null; reason: string };

/**
 * Mandatory intent boundary for callers that want to dispatch a tool through
 * ActionGateway. It never invokes the executor when the contract gate refuses.
 */
export class IntentActionGatewayBridge {
  private readonly compiler: IntentCompiler;

  constructor(compiler: IntentCompiler) {
    this.compiler = compiler;
  }

  async execute(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
  ): Promise<IntentBridgeResult> {
    const gate = this.compiler.gate(contract, action?.toolId);
    if (!gate.allowed) {
      return { executed: false, contractId: null, reason: gate.reason };
    }
    if (!action || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) {
      return { executed: false, contractId: gate.contractId, reason: 'invalid-action-input' };
    }
    if (typeof action.reason !== 'string' || !action.reason.trim()) {
      return { executed: false, contractId: gate.contractId, reason: 'execution-reason-required' };
    }
    if (!gateway || typeof gateway.executeTool !== 'function') {
      return { executed: false, contractId: gate.contractId, reason: 'action-gateway-unavailable' };
    }
    const result = await gateway.executeTool(
      gate.action,
      action.input,
      action.reason,
      action.options,
      action.finalizationContextKeys,
    );
    return { executed: true, contractId: gate.contractId, result };
  }

  /**
   * Receipt recovery is deliberately a separate, read-only route. It may use an
   * expired-but-authentic intent approval because the operation cannot start a
   * side effect; ActionGateway still enforces the original idempotency receipt and
   * its separate one-shot reconciliation approval for protected tools.
   */
  async reconcile(
    contract: IntentContract,
    action: IntentBoundAction,
    gateway: IntentGatewayPort,
  ): Promise<IntentBridgeReconciliationResult> {
    const gate = this.compiler.gate(contract, action?.toolId, 'reconcile');
    if (!gate.allowed) {
      return { attempted: false, contractId: null, reason: gate.reason };
    }
    if (!action || !action.input || typeof action.input !== 'object' || Array.isArray(action.input)) {
      return { attempted: false, contractId: gate.contractId, reason: 'invalid-action-input' };
    }
    if (typeof action.reason !== 'string' || !action.reason.trim()) {
      return { attempted: false, contractId: gate.contractId, reason: 'execution-reason-required' };
    }
    if (!gateway || typeof gateway.reconcileToolExecution !== 'function') {
      return { attempted: false, contractId: gate.contractId, reason: 'action-gateway-reconciliation-unavailable' };
    }
    const result = await gateway.reconcileToolExecution(
      gate.action,
      action.input,
      action.reason,
      action.options,
    );
    return { attempted: true, contractId: gate.contractId, result };
  }
}
