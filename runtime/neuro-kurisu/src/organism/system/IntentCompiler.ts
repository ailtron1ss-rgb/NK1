import { randomUUID } from 'node:crypto';
import type { ActionGateway, ActionGatewayExecutionOptions, ToolExecution } from './ActionGateway.ts';

export type IntentRisk = 'low' | 'moderate' | 'high' | 'critical';
export type IntentStatus = 'ready' | 'needs-clarification' | 'blocked';

export interface IntentExtraction {
  goal: string;
  context?: string;
  constraints?: string[];
  priorities?: string[];
  expectedResult: string;
  acceptanceCriteria: string[];
  allowedToolIds: string[];
  forbiddenToolIds?: string[];
  stopConditions: string[];
  assumptions?: string[];
  unresolvedQuestions?: string[];
  risk?: IntentRisk;
  requiresConfirmation?: boolean;
}

export interface IntentContract {
  version: 1;
  id: string;
  sourceText: string;
  goal: string;
  context: string;
  constraints: string[];
  priorities: string[];
  expectedResult: string;
  acceptanceCriteria: string[];
  allowedToolIds: string[];
  forbiddenToolIds: string[];
  stopConditions: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  risk: IntentRisk;
  requiresConfirmation: boolean;
  status: IntentStatus;
  diagnostics: string[];
  createdAt: number;
}

export interface IntentCompileResult {
  contract: IntentContract;
  executable: boolean;
}

export interface IntentExecutionBlocked {
  ok: false;
  blocked: true;
  reason: string;
  intentId: string;
  diagnostics: string[];
}

export interface IntentExecutionAllowed {
  ok: true;
  blocked: false;
  intentId: string;
  execution: ToolExecution;
}

export type IntentExecutionResult = IntentExecutionBlocked | IntentExecutionAllowed;

const MAX_SOURCE = 16_000;
const MAX_TEXT = 2_000;
const MAX_LIST = 32;
const clampText = (value: unknown, max = MAX_TEXT): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const cleanList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, MAX_LIST).map(item => clampText(item, 500)).filter(Boolean))];
};
const RISK: readonly IntentRisk[] = ['low', 'moderate', 'high', 'critical'];

/**
 * Intent Compiler — converts a structured extraction of a human request into
 * a bounded, inspectable execution contract. It deliberately does not call an
 * LLM: extraction is injected by the caller, while this module validates it.
 * An extraction is a proposal, never an authorization grant.
 */
export class IntentCompiler {
  compile(sourceText: string, extraction: IntentExtraction, at = Date.now()): IntentCompileResult {
    const source = clampText(sourceText, MAX_SOURCE);
    const diagnostics: string[] = [];
    if (!source) diagnostics.push('source-text-missing');
    if (typeof sourceText === 'string' && sourceText.length > MAX_SOURCE) diagnostics.push('source-text-truncated');

    const goal = clampText(extraction?.goal);
    const expectedResult = clampText(extraction?.expectedResult);
    const acceptanceCriteria = cleanList(extraction?.acceptanceCriteria);
    const allowedToolIds = cleanList(extraction?.allowedToolIds);
    const stopConditions = cleanList(extraction?.stopConditions);
    const unresolvedQuestions = cleanList(extraction?.unresolvedQuestions);
    const assumptions = cleanList(extraction?.assumptions);
    const rawRisk = extraction?.risk;
    const risk: IntentRisk = RISK.includes(rawRisk as IntentRisk) ? rawRisk as IntentRisk : 'high';

    if (!goal) diagnostics.push('goal-missing');
    if (!expectedResult) diagnostics.push('expected-result-missing');
    if (acceptanceCriteria.length === 0) diagnostics.push('acceptance-criteria-missing');
    if (allowedToolIds.length === 0) diagnostics.push('explicit-tool-allowlist-missing');
    if (stopConditions.length === 0) diagnostics.push('stop-conditions-missing');
    if (!RISK.includes(rawRisk as IntentRisk)) diagnostics.push('risk-unspecified-defaulted-high');
    if (unresolvedQuestions.length > 0) diagnostics.push('unresolved-questions-present');

    const forbiddenToolIds = cleanList(extraction?.forbiddenToolIds);
    const collisions = allowedToolIds.filter(toolId => forbiddenToolIds.includes(toolId));
    if (collisions.length) diagnostics.push('allow-deny-list-conflict');

    const blocked = !source || collisions.length > 0;
    const needsClarification = !goal || !expectedResult || acceptanceCriteria.length === 0 ||
      allowedToolIds.length === 0 || stopConditions.length === 0 || unresolvedQuestions.length > 0;
    const requiresConfirmation = Boolean(extraction?.requiresConfirmation) || risk === 'high' || risk === 'critical';

    const contract: IntentContract = {
      version: 1,
      id: `intent-${randomUUID()}`,
      sourceText: source,
      goal,
      context: clampText(extraction?.context),
      constraints: cleanList(extraction?.constraints),
      priorities: cleanList(extraction?.priorities),
      expectedResult,
      acceptanceCriteria,
      allowedToolIds,
      forbiddenToolIds,
      stopConditions,
      assumptions,
      unresolvedQuestions,
      risk,
      requiresConfirmation,
      status: blocked ? 'blocked' : needsClarification ? 'needs-clarification' : 'ready',
      diagnostics,
      createdAt: Number.isFinite(at) && at >= 0 ? at : Date.now(),
    };
    return { contract, executable: contract.status === 'ready' };
  }

  /**
   * The execution gate is intentionally separate from ActionGateway's own
   * safety/approval checks. Passing this gate does not grant tool permission.
   */
  async executeTool(
    gateway: Pick<ActionGateway, 'executeTool'>,
    contract: IntentContract,
    toolId: string,
    input: Record<string, unknown>,
    reason: string,
    options: ActionGatewayExecutionOptions & { confirmedIntentId?: string } = {},
  ): Promise<IntentExecutionResult> {
    const deny = (why: string): IntentExecutionBlocked => ({
      ok: false, blocked: true, reason: why, intentId: contract?.id ?? 'unknown',
      diagnostics: contract?.diagnostics ?? [],
    });

    if (!contract || contract.version !== 1 || contract.status !== 'ready') {
      return deny('intent-contract-not-executable');
    }
    if (!toolId || contract.forbiddenToolIds.includes(toolId)) {
      return deny('tool-explicitly-forbidden');
    }
    if (!contract.allowedToolIds.includes(toolId)) {
      return deny('tool-not-explicitly-allowed');
    }
    if (contract.requiresConfirmation && options.confirmedIntentId !== contract.id) {
      return deny('intent-confirmation-required');
    }

    const { confirmedIntentId: _confirmation, ...gatewayOptions } = options;
    const execution = await gateway.executeTool(
      toolId,
      input,
      reason,
      { ...gatewayOptions, decisionId: gatewayOptions.decisionId ?? contract.id },
    );
    return { ok: true, blocked: false, intentId: contract.id, execution };
  }
}
