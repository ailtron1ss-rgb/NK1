import type { IntentCompiler, IntentContract } from '../cognition/IntentCompiler.ts';
import type { ActionGatewayExecutionOptions, ToolExecution } from './ActionGateway.ts';

export interface IntentGatewayPort {
  executeTool(
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
}
export type IntentBridgeResult =
  | { executed: true; contractId: string; result: ToolExecution }
  | { executed: false; contractId: string | null; reason: string };

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
    );
    return { executed: true, contractId: gate.contractId, result };
  }
}
