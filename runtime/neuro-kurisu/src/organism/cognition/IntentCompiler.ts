import { createHash } from 'node:crypto';

export type IntentRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IntentApprovalStatus = 'not-approved' | 'approved' | 'rejected';
export interface IntentAssumption {
  statement: string;
  impact: 'low' | 'medium' | 'high';
  confidence01: number;
  requiresConfirmation: boolean;
}
export interface IntentExtraction {
  goal?: string;
  context?: string[];
  expectedOutcome?: string;
  constraints?: { must?: string[]; mustNot?: string[] };
  priorities?: string[];
  acceptanceCriteria?: string[];
  permissions?: { allowedActions?: string[]; deniedActions?: string[] };
  assumptions?: Array<{ statement: string; impact?: 'low' | 'medium' | 'high'; confidence01?: number }>;
  stopConditions?: string[];
  risk?: IntentRiskLevel;
}
export interface IntentExtractionProvider {
  extract(requestText: string): Promise<IntentExtraction>;
}
export interface IntentContractInput {
  requestId?: string;
  text: string;
  extraction?: IntentExtraction;
}
export interface IntentContract {
  readonly schema: 'nk1.intent-contract';
  readonly version: 1;
  readonly id: string;
  readonly createdAt: number;
  readonly sourceText: string;
  readonly goal: { readonly text: string; readonly source: 'structured-extraction' | 'verbatim-request' };
  readonly context: readonly string[];
  readonly expectedOutcome: string | null;
  readonly constraints: { readonly must: readonly string[]; readonly mustNot: readonly string[] };
  readonly priorities: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly permissions: { readonly allowedActions: readonly string[]; readonly deniedActions: readonly string[] };
  readonly assumptions: readonly IntentAssumption[];
  readonly stopConditions: readonly string[];
  readonly risk: { readonly level: IntentRiskLevel; readonly reasons: readonly string[] };
  readonly missingInformation: readonly string[];
  readonly approval: {
    readonly status: IntentApprovalStatus;
    readonly allowedActions: readonly string[];
    readonly at?: number;
    readonly evidenceRef?: string;
  };
}
export interface IntentApproval {
  contractId: string;
  userConfirmed: boolean;
  allowedActions: string[];
  at: number;
  evidenceRef: string;
}
export type IntentGateResult =
  | { allowed: true; contractId: string; action: string }
  | { allowed: false; reason: 'invalid-contract' | 'contract-incomplete' | 'contract-not-approved' | 'action-explicitly-denied' | 'action-not-explicitly-allowed' };

const MAX_TEXT = 2_000;
const MAX_LIST = 32;
const MAX_ACTION = 160;
const RISK_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(delete|erase|drop|destroy|remove|wipe)\b/i, 'destructive-operation-language'],
  [/\b(deploy|publish|release|transfer|purchase|send|install|execute|run|modify|commit)\b/i, 'external-or-mutating-operation-language'],
];

function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}
function cleanList(value: unknown, maxItems = MAX_LIST, maxText = MAX_TEXT): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(item => cleanText(item, maxText)).filter(Boolean);
}
function clamp01(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}
function stableId(requestId: string, text: string): string {
  return createHash('sha256').update(requestId + '\\u0000' + text).digest('hex').slice(0, 24);
}
function inferRisk(text: string, explicit?: IntentRiskLevel): { level: IntentRiskLevel; reasons: string[] } {
  const reasons = RISK_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, reason]) => reason);
  const inferred: IntentRiskLevel = reasons.some(reason => reason === 'destructive-operation-language') ? 'high' : reasons.length ? 'medium' : 'low';
  const rank: Record<IntentRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const level = explicit && rank[explicit] > rank[inferred] ? explicit : inferred;
  return { level, reasons: [...reasons, ...(explicit ? ['risk-level-explicitly-supplied'] : [])] };
}
function isIntentContract(value: IntentContract): boolean {
  return !!value && value.schema === 'nk1.intent-contract' && value.version === 1 &&
    typeof value.id === 'string' && Array.isArray(value.permissions?.allowedActions) &&
    Array.isArray(value.permissions?.deniedActions) && Array.isArray(value.missingInformation) &&
    !!value.approval && Array.isArray(value.approval.allowedActions);
}

/**
 * Converts a user request plus optional semantic extraction into a reviewable,
 * immutable execution contract. This class never infers tool permissions from prose.
 */
export class IntentCompiler {
  constructor(private readonly options: { clock?: () => number } = {}) {}

  async compileWith(input: IntentContractInput, provider: IntentExtractionProvider): Promise<IntentContract> {
    const sourceText = cleanText(input?.text);
    if (!sourceText) return this.compile(input);
    const extraction = await provider.extract(sourceText);
    return this.compile({ ...input, extraction });
  }

  compile(input: IntentContractInput): IntentContract {
    const sourceText = cleanText(input?.text);
    const extraction = input?.extraction ?? {};
    const structuredGoal = cleanText(extraction.goal);
    const goalText = structuredGoal || sourceText;
    const risk = inferRisk(sourceText, extraction.risk);
    const assumptions: IntentAssumption[] = (Array.isArray(extraction.assumptions) ? extraction.assumptions : [])
      .slice(0, MAX_LIST)
      .map(item => {
        const impact = item?.impact === 'high' || item?.impact === 'medium' ? item.impact : 'low';
        const confidence01 = clamp01(item?.confidence01);
        return {
          statement: cleanText(item?.statement),
          impact,
          confidence01,
          requiresConfirmation: impact !== 'low' || confidence01 < 0.8,
        };
      })
      .filter(item => item.statement.length > 0);
    const missingInformation: string[] = [];
    if (!sourceText) missingInformation.push('request-text');
    if (!cleanText(extraction.expectedOutcome)) missingInformation.push('expected-outcome');
    if (!cleanList(extraction.acceptanceCriteria).length) missingInformation.push('acceptance-criteria');
    if (!cleanList(extraction.permissions?.allowedActions).length) missingInformation.push('explicit-action-allow-list');
    if (!cleanList(extraction.stopConditions).length) missingInformation.push('stop-conditions');
    const timestamp = this.options.clock?.() ?? Date.now();
    const requestId = cleanText(input?.requestId, 180);
    const contract: IntentContract = {
      schema: 'nk1.intent-contract',
      version: 1,
      id: stableId(requestId, sourceText),
      createdAt: Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : Date.now(),
      sourceText,
      goal: { text: goalText, source: structuredGoal ? 'structured-extraction' : 'verbatim-request' },
      context: cleanList(extraction.context),
      expectedOutcome: cleanText(extraction.expectedOutcome) || null,
      constraints: {
        must: cleanList(extraction.constraints?.must),
        mustNot: cleanList(extraction.constraints?.mustNot),
      },
      priorities: cleanList(extraction.priorities),
      acceptanceCriteria: cleanList(extraction.acceptanceCriteria),
      permissions: {
        allowedActions: cleanList(extraction.permissions?.allowedActions, MAX_LIST, MAX_ACTION),
        deniedActions: cleanList(extraction.permissions?.deniedActions, MAX_LIST, MAX_ACTION),
      },
      assumptions,
      stopConditions: cleanList(extraction.stopConditions),
      risk,
      missingInformation,
      approval: { status: 'not-approved', allowedActions: [] },
    };
    return freezeDeep(contract);
  }

  /** Approval is an explicit user attestation and may only narrow the declared allow-list. */
  approve(contract: IntentContract, approval: IntentApproval): IntentContract {
    if (!isIntentContract(contract)) throw new TypeError('invalid intent contract');
    if (contract.missingInformation.length > 0) throw new Error('intent contract is incomplete: ' + contract.missingInformation.join(', '));
    if (approval?.contractId !== contract.id) throw new Error('approval must be bound to this exact intent contract');
    if (approval?.userConfirmed !== true) throw new Error('explicit user confirmation is required');
    if (!Number.isSafeInteger(approval.at) || approval.at < 0) throw new TypeError('approval timestamp is invalid');
    const evidenceRef = cleanText(approval.evidenceRef, 180);
    if (!evidenceRef) throw new TypeError('approval evidence reference is required');
    const requested = cleanList(approval.allowedActions, MAX_LIST, MAX_ACTION);
    const declared = new Set(contract.permissions.allowedActions);
    for (const action of requested) {
      if (!declared.has(action)) throw new Error(`action "${action}" was not explicitly allowed by the intent`);
    }
    const denied = new Set(contract.permissions.deniedActions);
    if (requested.some(action => denied.has(action))) throw new Error('an explicitly denied action cannot be approved');
    const approved: IntentContract = {
      ...contract,
      approval: { status: 'approved', allowedActions: requested, at: approval.at, evidenceRef },
    };
    return freezeDeep(approved);
  }

  reject(contract: IntentContract): IntentContract {
    if (!isIntentContract(contract)) throw new TypeError('invalid intent contract');
    return freezeDeep({ ...contract, approval: { status: 'rejected', allowedActions: [] } });
  }

  gate(contract: IntentContract, action: string): IntentGateResult {
    if (!isIntentContract(contract)) return { allowed: false, reason: 'invalid-contract' };
    const normalizedAction = cleanText(action, MAX_ACTION);
    if (!normalizedAction) return { allowed: false, reason: 'action-not-explicitly-allowed' };
    if (contract.missingInformation.length > 0) return { allowed: false, reason: 'contract-incomplete' };
    if (contract.permissions.deniedActions.includes(normalizedAction)) return { allowed: false, reason: 'action-explicitly-denied' };
    if (contract.approval.status !== 'approved') return { allowed: false, reason: 'contract-not-approved' };
    if (!contract.permissions.allowedActions.includes(normalizedAction) ||
        !contract.approval.allowedActions.includes(normalizedAction)) {
      return { allowed: false, reason: 'action-not-explicitly-allowed' };
    }
    return { allowed: true, contractId: contract.id, action: normalizedAction };
  }
}
