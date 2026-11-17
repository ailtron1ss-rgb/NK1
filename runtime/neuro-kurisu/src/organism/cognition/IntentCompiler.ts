import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type IntentRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IntentApprovalStatus = 'not-approved' | 'approved' | 'rejected';
export type IntentExtractionStatus = 'provided' | 'provider' | 'not-provided' | 'provider-failed';

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
  /** Hash of all immutable contract data, excluding this field and approval. */
  readonly contentHash: string;
  readonly requestId: string;
  readonly createdAt: number;
  readonly sourceText: string;
  readonly sourceTextTruncated: boolean;
  readonly extractionStatus: IntentExtractionStatus;
  readonly extractionError?: string;
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
    readonly acknowledgedAssumptions?: readonly string[];
    readonly riskAcknowledged?: boolean;
    readonly at?: number;
    readonly expiresAt?: number;
    readonly evidenceRef?: string;
    /** HMAC attestation; valid only under the runtime's configured approval key. */
    readonly attestation?: string;
  };
}
export interface IntentApproval {
  contractId: string;
  userConfirmed: boolean;
  allowedActions: string[];
  acknowledgedAssumptions?: string[];
  riskAcknowledged?: boolean;
  at: number;
  evidenceRef: string;
}
export interface IntentCompilerOptions {
  clock?: () => number;
  /** Inject from the runtime secret store to validate approvals after restart. Never persist this key in a contract. */
  approvalKey?: string | Uint8Array;
  approvalTtlMs?: number;
}
export type IntentGateResult =
  | { allowed: true; contractId: string; action: string }
  | { allowed: false; reason: 'invalid-contract' | 'contract-incomplete' | 'contract-not-approved' | 'approval-invalid' | 'approval-expired' | 'action-explicitly-denied' | 'action-not-explicitly-allowed' };

const MAX_TEXT = 2_000;
const MAX_LIST = 32;
const MAX_ACTION = 160;
const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;
const MAX_APPROVAL_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const ACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

const RISK_RULES: ReadonlyArray<{ pattern: RegExp; level: IntentRiskLevel; reason: string }> = [
  { pattern: /\b(exfiltrat\w*|steal\s+(?:the\s+)?(?:credentials?|passwords?|secrets?)|dump\s+credentials?)\b|украсть\s+(?:пароли?|ключи|секреты)|вывести\s+(?:секреты|учётные данные)/iu, level: 'critical', reason: 'credential-or-secret-exfiltration-language' },
  { pattern: /\b(delete|erase|drop|destroy|remove|wipe)\b|удал(?:ить|и|ение)|стереть|уничтожить|снести/iu, level: 'high', reason: 'destructive-operation-language' },
  { pattern: /\b(deploy|publish|release|transfer|purchase|send|install|execute|run|modify|commit|overwrite|format)\b|развернуть|опубликовать|выпустить|перевести|купить|отправить|установить|выполнить|изменить|перезаписать|отформатировать/iu, level: 'medium', reason: 'external-or-mutating-operation-language' },
];

type IntentCore = Omit<IntentContract, 'id' | 'contentHash' | 'approval'>;

function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  try {
    return value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  } catch {
    return '';
  }
}
function cleanList(value: unknown, maxItems = MAX_LIST, maxText = MAX_TEXT): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  try {
    const limit = Math.min(value.length, maxItems);
    for (let index = 0; index < limit; index++) {
      const item = cleanText(value[index], maxText);
      if (item && !output.includes(item)) output.push(item);
    }
  } catch {
    return [];
  }
  return output;
}
function cleanActions(value: unknown): { actions: string[]; invalidCount: number } {
  if (!Array.isArray(value)) return { actions: [], invalidCount: 0 };
  const actions: string[] = [];
  let invalidCount = 0;
  try {
    const limit = Math.min(value.length, MAX_LIST);
    for (let index = 0; index < limit; index++) {
      const action = cleanText(value[index], MAX_ACTION);
      if (!action || !ACTION_ID_PATTERN.test(action) || action.includes('*')) {
        invalidCount++;
        continue;
      }
      if (!actions.includes(action)) actions.push(action);
    }
  } catch {
    return { actions: [], invalidCount: 1 };
  }
  return { actions, invalidCount };
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
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function safeRisk(value: unknown): IntentRiskLevel | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : undefined;
}
function inferRisk(text: string, explicit?: unknown): { level: IntentRiskLevel; reasons: string[] } {
  let inferred: IntentRiskLevel = 'low';
  const reasons: string[] = [];
  const rank: Record<IntentRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  for (const rule of RISK_RULES) {
    if (!rule.pattern.test(text)) continue;
    reasons.push(rule.reason);
    if (rank[rule.level] > rank[inferred]) inferred = rule.level;
  }
  const supplied = safeRisk(explicit);
  const level = supplied && rank[supplied] > rank[inferred] ? supplied : inferred;
  if (supplied) reasons.push('risk-level-explicitly-supplied');
  return { level, reasons };
}
function coreFrom(contract: IntentContract): IntentCore {
  return {
    schema: contract.schema,
    version: contract.version,
    requestId: contract.requestId,
    createdAt: contract.createdAt,
    sourceText: contract.sourceText,
    sourceTextTruncated: contract.sourceTextTruncated,
    extractionStatus: contract.extractionStatus,
    ...(contract.extractionError ? { extractionError: contract.extractionError } : {}),
    goal: contract.goal,
    context: contract.context,
    expectedOutcome: contract.expectedOutcome,
    constraints: contract.constraints,
    priorities: contract.priorities,
    acceptanceCriteria: contract.acceptanceCriteria,
    permissions: contract.permissions,
    assumptions: contract.assumptions,
    stopConditions: contract.stopConditions,
    risk: contract.risk,
    missingInformation: contract.missingInformation,
  };
}
function approvalPayload(contract: IntentContract, approval: IntentContract['approval']): string {
  return JSON.stringify({
    contractId: contract.id,
    contentHash: contract.contentHash,
    status: approval.status,
    allowedActions: approval.allowedActions,
    acknowledgedAssumptions: approval.acknowledgedAssumptions ?? [],
    riskAcknowledged: approval.riskAcknowledged === true,
    at: approval.at,
    expiresAt: approval.expiresAt,
    evidenceRef: approval.evidenceRef,
  });
}
function structurallyValidContract(value: unknown): value is IntentContract {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const contract = value as IntentContract;
    if (contract.schema !== 'nk1.intent-contract' || contract.version !== 1 ||
        typeof contract.id !== 'string' || !/^[a-f0-9]{24}$/.test(contract.id) ||
        typeof contract.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(contract.contentHash) ||
        typeof contract.requestId !== 'string' || !Number.isSafeInteger(contract.createdAt) || contract.createdAt < 0 ||
        typeof contract.sourceText !== 'string' || typeof contract.sourceTextTruncated !== 'boolean' ||
        !['provided', 'provider', 'not-provided', 'provider-failed'].includes(contract.extractionStatus) ||
        typeof contract.goal?.text !== 'string' ||
        !['structured-extraction', 'verbatim-request'].includes(contract.goal?.source) ||
        !Array.isArray(contract.context) || !Array.isArray(contract.constraints?.must) ||
        !Array.isArray(contract.constraints?.mustNot) || !Array.isArray(contract.priorities) ||
        !Array.isArray(contract.acceptanceCriteria) || !Array.isArray(contract.permissions?.allowedActions) ||
        !Array.isArray(contract.permissions?.deniedActions) || !Array.isArray(contract.assumptions) ||
        !Array.isArray(contract.stopConditions) || !Array.isArray(contract.risk?.reasons) ||
        !Array.isArray(contract.missingInformation) || !contract.approval ||
        !['not-approved', 'approved', 'rejected'].includes(contract.approval.status) ||
        !Array.isArray(contract.approval.allowedActions)) return false;
    const coreHash = sha256(JSON.stringify(coreFrom(contract)));
    if (coreHash !== contract.contentHash) return false;
    const expectedId = sha256(JSON.stringify([contract.requestId, contract.contentHash])).slice(0, 24);
    return expectedId === contract.id;
  } catch {
    return false;
  }
}

export class IntentCompiler {
  private readonly clock: () => number;
  private readonly approvalKey: Buffer;
  private readonly approvalTtlMs: number;

  constructor(options: IntentCompilerOptions = {}) {
    this.clock = options.clock ?? Date.now;
    const suppliedKey = options.approvalKey;
    this.approvalKey = suppliedKey === undefined
      ? randomBytes(32)
      : typeof suppliedKey === 'string' ? Buffer.from(suppliedKey, 'utf8') : Buffer.from(suppliedKey);
    if (this.approvalKey.byteLength < 32) throw new TypeError('intent approval key must contain at least 32 bytes');
    const ttl = options.approvalTtlMs ?? DEFAULT_APPROVAL_TTL_MS;
    if (!Number.isSafeInteger(ttl) || ttl < 60_000 || ttl > MAX_APPROVAL_TTL_MS) {
      throw new RangeError('intent approval TTL must be between 1 and 60 minutes');
    }
    this.approvalTtlMs = ttl;
  }

  async compileWith(input: IntentContractInput, provider: IntentExtractionProvider): Promise<IntentContract> {
    const sourceText = cleanText(input?.text, Number.MAX_SAFE_INTEGER);
    if (!sourceText) return this.compileInternal(input, 'not-provided');
    try {
      const extraction = await provider.extract(sourceText);
      return this.compileInternal({ ...input, extraction }, 'provider');
    } catch (error) {
      const message = cleanText(error instanceof Error ? error.message : 'semantic-extraction-failed', 180);
      return this.compileInternal({ ...input, extraction: undefined }, 'provider-failed', message || 'semantic-extraction-failed');
    }
  }

  compile(input: IntentContractInput): IntentContract {
    return this.compileInternal(input, input?.extraction ? 'provided' : 'not-provided');
  }

  private compileInternal(input: IntentContractInput, extractionStatus: IntentExtractionStatus, extractionError?: string): IntentContract {
    const rawText = cleanText(input?.text, Number.MAX_SAFE_INTEGER);
    const sourceTextTruncated = rawText.length > MAX_TEXT;
    const sourceText = rawText.slice(0, MAX_TEXT);
    const extraction = input?.extraction && typeof input.extraction === 'object' ? input.extraction : {};
    const structuredGoal = cleanText(extraction.goal);
    const goalText = structuredGoal || sourceText;
    const risk = inferRisk(sourceText, extraction.risk);

    const assumptions: IntentAssumption[] = cleanList(extraction.assumptions, MAX_LIST, MAX_TEXT)
      .length > 0
      ? (Array.isArray(extraction.assumptions) ? extraction.assumptions : []).slice(0, MAX_LIST)
          .map(item => {
            const impact: IntentAssumption['impact'] = item?.impact === 'high' || item?.impact === 'medium' ? item.impact : 'low';
            const confidence01 = clamp01(item?.confidence01);
            return {
              statement: cleanText(item?.statement),
              impact,
              confidence01,
              requiresConfirmation: impact !== 'low' || confidence01 < 0.8,
            };
          }).filter(item => item.statement.length > 0)
      : [];

    const allowed = cleanActions(extraction.permissions?.allowedActions);
    const denied = cleanActions(extraction.permissions?.deniedActions);
    const missingInformation: string[] = [];
    if (!sourceText) missingInformation.push('request-text');
    if (sourceTextTruncated) missingInformation.push('request-text-truncated');
    if (!goalText) missingInformation.push('goal');
    if (!cleanText(extraction.expectedOutcome)) missingInformation.push('expected-outcome');
    if (!cleanList(extraction.acceptanceCriteria).length) missingInformation.push('acceptance-criteria');
    if (!allowed.actions.length) missingInformation.push('explicit-action-allow-list');
    if (!cleanList(extraction.stopConditions).length) missingInformation.push('stop-conditions');
    if (allowed.invalidCount + denied.invalidCount > 0) missingInformation.push('invalid-action-identifier');
    const deniedSet = new Set(denied.actions);
    for (const action of allowed.actions) {
      if (deniedSet.has(action)) missingInformation.push(`conflicting-action-permission:${action}`);
    }
    if (extractionStatus === 'provider-failed') missingInformation.push('semantic-extraction-failed');

    const timestamp = this.clock();
    const createdAt = Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : Date.now();
    const requestId = cleanText(input?.requestId, 180);
    const core: IntentCore = {
      schema: 'nk1.intent-contract',
      version: 1,
      requestId,
      createdAt,
      sourceText,
      sourceTextTruncated,
      extractionStatus,
      ...(extractionError ? { extractionError } : {}),
      goal: { text: goalText, source: structuredGoal ? 'structured-extraction' : 'verbatim-request' },
      context: cleanList(extraction.context),
      expectedOutcome: cleanText(extraction.expectedOutcome) || null,
      constraints: {
        must: cleanList(extraction.constraints?.must),
        mustNot: cleanList(extraction.constraints?.mustNot),
      },
      priorities: cleanList(extraction.priorities),
      acceptanceCriteria: cleanList(extraction.acceptanceCriteria),
      permissions: { allowedActions: allowed.actions, deniedActions: denied.actions },
      assumptions,
      stopConditions: cleanList(extraction.stopConditions),
      risk,
      missingInformation: [...new Set(missingInformation)],
    };
    const contentHash = sha256(JSON.stringify(core));
    const id = sha256(JSON.stringify([requestId, contentHash])).slice(0, 24);
    const contract: IntentContract = {
      ...core,
      id,
      contentHash,
      approval: { status: 'not-approved', allowedActions: [] },
    };
    return freezeDeep(contract);
  }

  approve(contract: IntentContract, approval: IntentApproval): IntentContract {
    if (!structurallyValidContract(contract)) throw new TypeError('invalid intent contract');
    if (contract.approval.status !== 'not-approved') throw new Error('intent contract is already resolved');
    if (contract.missingInformation.length > 0) throw new Error('intent contract is incomplete: ' + contract.missingInformation.join(', '));
    if (approval?.contractId !== contract.id) throw new Error('approval must be bound to this exact intent contract');
    if (approval?.userConfirmed !== true) throw new Error('explicit user confirmation is required');

    const now = this.clock();
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(approval.at) ||
        approval.at < contract.createdAt - CLOCK_SKEW_MS || approval.at > now + CLOCK_SKEW_MS ||
        now - contract.createdAt > this.approvalTtlMs) {
      throw new Error('intent approval is stale or has an invalid timestamp');
    }
    const evidenceRef = cleanText(approval.evidenceRef, 180);
    if (!evidenceRef) throw new TypeError('approval evidence reference is required');
    const requested = cleanActions(approval.allowedActions);
    if (requested.invalidCount > 0 || !requested.actions.length) throw new TypeError('approval must contain valid explicit actions');

    const declared = new Set(contract.permissions.allowedActions);
    for (const action of requested.actions) {
      if (!declared.has(action)) throw new Error(`action "${action}" was not explicitly allowed by the intent`);
    }
    const denied = new Set(contract.permissions.deniedActions);
    if (requested.actions.some(action => denied.has(action))) throw new Error('an explicitly denied action cannot be approved');

    const requiredAssumptions = contract.assumptions.filter(item => item.requiresConfirmation).map(item => item.statement);
    const acknowledgedAssumptions = cleanList(approval.acknowledgedAssumptions, MAX_LIST, MAX_TEXT);
    if (requiredAssumptions.some(statement => !acknowledgedAssumptions.includes(statement))) {
      throw new Error('every material or low-confidence assumption must be acknowledged');
    }
    if (acknowledgedAssumptions.some(statement => !requiredAssumptions.includes(statement))) {
      throw new Error('approval contains an unknown assumption acknowledgement');
    }
    if ((contract.risk.level === 'high' || contract.risk.level === 'critical') && approval.riskAcknowledged !== true) {
      throw new Error('high or critical intent requires explicit risk acknowledgement');
    }

    const expiresAt = approval.at + this.approvalTtlMs;
    const approvalBase: IntentContract['approval'] = {
      status: 'approved',
      allowedActions: requested.actions,
      acknowledgedAssumptions,
      riskAcknowledged: approval.riskAcknowledged === true,
      at: approval.at,
      expiresAt,
      evidenceRef,
    };
    const attestation = createHmac('sha256', this.approvalKey)
      .update(approvalPayload(contract, { ...approvalBase, attestation: undefined }))
      .digest('hex');
    return freezeDeep({ ...contract, approval: { ...approvalBase, attestation } });
  }

  reject(contract: IntentContract): IntentContract {
    if (!structurallyValidContract(contract)) throw new TypeError('invalid intent contract');
    if (contract.approval.status === 'approved') throw new Error('approved intent requires an explicit revocation workflow');
    return freezeDeep({ ...contract, approval: { status: 'rejected', allowedActions: [] } });
  }

  gate(contract: IntentContract, action: string): IntentGateResult {
    if (!structurallyValidContract(contract)) return { allowed: false, reason: 'invalid-contract' };
    const normalizedAction = cleanText(action, MAX_ACTION);
    if (!normalizedAction || !ACTION_ID_PATTERN.test(normalizedAction) || normalizedAction.includes('*')) {
      return { allowed: false, reason: 'action-not-explicitly-allowed' };
    }
    if (contract.permissions.deniedActions.includes(normalizedAction)) return { allowed: false, reason: 'action-explicitly-denied' };
    if (contract.missingInformation.length > 0) return { allowed: false, reason: 'contract-incomplete' };
    if (contract.approval.status !== 'approved') return { allowed: false, reason: 'contract-not-approved' };

    const approval = contract.approval;
    if (!Number.isSafeInteger(approval.at) || !Number.isSafeInteger(approval.expiresAt) ||
        approval.at === undefined || approval.expiresAt === undefined ||
        typeof approval.evidenceRef !== 'string' || !approval.evidenceRef ||
        typeof approval.attestation !== 'string' || !/^[a-f0-9]{64}$/.test(approval.attestation)) {
      return { allowed: false, reason: 'approval-invalid' };
    }
    const expected = createHmac('sha256', this.approvalKey)
      .update(approvalPayload(contract, { ...approval, attestation: undefined }))
      .digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(approval.attestation, 'hex'); } catch { return { allowed: false, reason: 'approval-invalid' }; }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return { allowed: false, reason: 'approval-invalid' };
    }
    const now = this.clock();
    if (!Number.isSafeInteger(now) || now > approval.expiresAt || now < approval.at - CLOCK_SKEW_MS) {
      return { allowed: false, reason: 'approval-expired' };
    }
    const declared = new Set(contract.permissions.allowedActions);
    const denied = new Set(contract.permissions.deniedActions);
    if (approval.allowedActions.some(item => !declared.has(item) || denied.has(item)) ||
        (contract.assumptions.some(item => item.requiresConfirmation) &&
         contract.assumptions.filter(item => item.requiresConfirmation).some(item => !approval.acknowledgedAssumptions?.includes(item.statement))) ||
        ((contract.risk.level === 'high' || contract.risk.level === 'critical') && approval.riskAcknowledged !== true)) {
      return { allowed: false, reason: 'approval-invalid' };
    }
    if (!contract.permissions.allowedActions.includes(normalizedAction) ||
        !approval.allowedActions.includes(normalizedAction)) {
      return { allowed: false, reason: 'action-not-explicitly-allowed' };
    }
    return { allowed: true, contractId: contract.id, action: normalizedAction };
  }
}
