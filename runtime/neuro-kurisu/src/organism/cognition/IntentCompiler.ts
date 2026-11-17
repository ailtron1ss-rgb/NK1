import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { types as nodeUtilTypes } from 'node:util';

export type IntentRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type IntentApprovalStatus = 'not-approved' | 'approved' | 'rejected';
export type IntentExtractionStatus = 'provided' | 'omitted' | 'provider-failed';

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
  readonly sourceTextDigest: string;
  readonly sourceTextTruncated: boolean;
  readonly extractionStatus: IntentExtractionStatus;
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
    readonly acknowledgedAssumptions: readonly string[];
    readonly riskAcknowledged: boolean;
    readonly at?: number;
    readonly expiresAt?: number;
    readonly evidenceRef?: string;
    readonly signature?: string;
  };
}
export interface IntentApproval {
  contractId: string;
  userConfirmed: boolean;
  allowedActions: string[];
  acknowledgedAssumptions?: string[];
  riskAcknowledged?: boolean;
  at: number;
  expiresAt?: number;
  evidenceRef: string;
}
export type IntentGateResult =
  | { allowed: true; contractId: string; action: string }
  | { allowed: false; reason:
      | 'invalid-contract'
      | 'contract-incomplete'
      | 'contract-not-approved'
      | 'approval-attestation-invalid'
      | 'approval-expired'
      | 'approval-not-yet-valid'
      | 'action-explicitly-denied'
      | 'action-not-explicitly-allowed' };

const MAX_TEXT = 2_000;
const MAX_LIST = 32;
const MAX_ACTION = 160;
const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30_000;
const MIN_APPROVAL_KEY_BYTES = 32;
const PROCESS_APPROVAL_KEY = randomBytes(32).toString('hex');

const RISK_PATTERNS: ReadonlyArray<[RegExp, string, IntentRiskLevel]> = [
  [/(?:\\b(?:token|api[ _-]?key|secret|password|credential|private[ _-]?key)\\b.{0,120}\\b(?:send|post|upload|transfer|exfiltrat\\w*|leak)\\b.{0,100}\\b(?:external|remote|third[ -]?party|public)\\b|\\b(?:exfiltrat\\w*|steal\\s+(?:the\\s+)?(?:credentials?|passwords?|secrets?|tokens?)|dump\\s+credentials?)\\b|(?:токен|ключ|секрет|парол|уч[её]тн\\p{L}*\\s+данн).{0,120}(?:отправ|переда|слить|выгруз|эксфильтр).{0,100}(?:внешн|публичн|удал[её]нн|чуж)|(?:отправ|переда|слить|выгруз).{0,100}(?:токен|ключ|секрет|парол).{0,100}(?:внешн|публичн|удал[её]нн|чуж)/iu,
    'credential-or-secret-exfiltration-language', 'critical'],
  [/\b(delete|erase|drop|destroy|remove|wipe|format)\b|удал\p{L}*|стер\p{L}*|уничтож\p{L}*|очист\p{L}*|сброс\p{L}*|форматир\p{L}*/iu,
    'destructive-operation-language', 'high'],
  [/\b(deploy|publish|release|transfer|purchase|send|install|execute|run|modify|commit)\b|развер\p{L}*|опубликов\p{L}*|выпуст\p{L}*\s+релиз|перевест\p{L}*|куп\p{L}*|отправ\p{L}*|установ\p{L}*|выполн\p{L}*|запуст\p{L}*|измен\p{L}*|коммит\p{L}*/iu,
    'external-or-mutating-operation-language', 'medium'],
];

function preserveSourceText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}
function cleanText(value: unknown, max = MAX_TEXT): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
    : '';
}
function cleanList(value: unknown, maxItems = MAX_LIST, maxText = MAX_TEXT): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, maxItems).map(item => cleanText(item, maxText)).filter(Boolean))];
}
function listWasTruncated(value: unknown, maxItems = MAX_LIST, maxText = MAX_TEXT): boolean {
  if (value === undefined || value === null) return false;
  if (!Array.isArray(value)) return true;
  try {
    if (value.length > maxItems) return true;
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] === 'string' && value[index].length > maxText) return true;
    }
    return false;
  } catch {
    return true;
  }
}
function hasMalformedActionIds(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (!Array.isArray(value)) return true;
  try {
    return value.some(action => typeof action !== 'string' ||
      action.length > MAX_ACTION || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(action) || action.includes('*'));
  } catch {
    return true;
  }
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
function isPlainDataObject(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || nodeUtilTypes.isProxy(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(descriptors).every(key => {
      if (typeof key !== 'string') return false;
      const descriptor = descriptors[key];
      return Boolean(descriptor && descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
        descriptor.get === undefined && descriptor.set === undefined);
    });
  } catch {
    return false;
  }
}
function isPlainDataTree(value: unknown, active = new Set<object>()): boolean {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return typeof value !== 'number' || Number.isFinite(value);
  }
  if (typeof value !== 'object' || nodeUtilTypes.isProxy(value) || active.has(value)) return false;
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return false;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const length = descriptors.length?.value;
      if (!Number.isSafeInteger(length) || length !== value.length) return false;
      for (let i = 0; i < length; i += 1) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
            !isPlainDataTree(descriptor.value, active)) return false;
      }
      return Reflect.ownKeys(descriptors).length === length + 1;
    }
    if (!isPlainDataObject(value)) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(descriptors).every(key => {
      const descriptor = descriptors[key as string];
      return Boolean(descriptor && isPlainDataTree(descriptor.value, active));
    });
  } catch {
    return false;
  } finally {
    active.delete(value);
  }
}
function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('unsupported primitive in intent payload');
    return encoded;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number in intent payload');
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('unsupported number in intent payload');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (!isPlainDataObject(value)) throw new TypeError('intent payload must contain inert plain data');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  return '{' + keys.map(key => JSON.stringify(key) + ':' + stableSerialize(descriptors[key].value)).join(',') + '}';
}
function stableId(requestId: string, identity: Record<string, unknown>): string {
  return createHash('sha256').update(requestId + '\u0000' + stableSerialize(identity)).digest('hex').slice(0, 24);
}
function inferRisk(text: string, explicit?: IntentRiskLevel): { level: IntentRiskLevel; reasons: string[] } {
  const matches = RISK_PATTERNS.filter(([pattern]) => pattern.test(text));
  const reasons = matches.map(([, reason]) => reason);
  const inferred = matches.reduce<IntentRiskLevel>((level, match) => {
    const rank: Record<IntentRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return rank[match[2]] > rank[level] ? match[2] : level;
  }, 'low');
  const rank: Record<IntentRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const validExplicit = explicit === 'low' || explicit === 'medium' || explicit === 'high' || explicit === 'critical'
    ? explicit : 'low';
  const level = rank[validExplicit] > rank[inferred] ? validExplicit : inferred;
  if (explicit && !reasons.includes('risk-level-explicitly-supplied')) reasons.push('risk-level-explicitly-supplied');
  return { level, reasons };
}
function isIntentContract(value: unknown): value is IntentContract {
  if (!isPlainDataTree(value) || !isPlainDataObject(value)) return false;
  const row = value as unknown as IntentContract;
  return row.schema === 'nk1.intent-contract' && row.version === 1 &&
    typeof row.id === 'string' && typeof row.sourceText === 'string' &&
    typeof row.sourceTextTruncated === 'boolean' &&
    (row.extractionStatus === 'provided' || row.extractionStatus === 'omitted' || row.extractionStatus === 'provider-failed') &&
    isPlainDataObject(row.permissions) && Array.isArray(row.permissions.allowedActions) &&
    Array.isArray(row.permissions.deniedActions) && isPlainDataObject(row.approval) &&
    Array.isArray(row.approval.allowedActions) && Array.isArray(row.approval.acknowledgedAssumptions) &&
    Array.isArray(row.missingInformation) && isPlainDataObject(row.risk) &&
    (row.risk.level === 'low' || row.risk.level === 'medium' || row.risk.level === 'high' || row.risk.level === 'critical');
}

export class IntentCompiler {
  private readonly provenance = new WeakMap<object, 'draft' | 'approved' | 'rejected' | 'superseded'>();
  constructor(private readonly options: { clock?: () => number; approvalKey?: string } = {}) {}

  private now(): number {
    const value = this.options.clock?.() ?? Date.now();
    return Number.isSafeInteger(value) && value >= 0 ? value : Date.now();
  }

  private approvalKey(): string | null {
    const key = this.options.approvalKey;
    if (key === undefined) return PROCESS_APPROVAL_KEY;
    return typeof key === 'string' && Buffer.byteLength(key, 'utf8') >= MIN_APPROVAL_KEY_BYTES ? key : null;
  }

  private signApproval(
    contract: IntentContract,
    approval: Omit<IntentContract['approval'], 'signature'>,
  ): string | null {
    const key = this.approvalKey();
    if (!key) return null;
    const { approval: _previousApproval, ...unsignedContract } = contract;
    return createHmac('sha256', key)
      .update(stableSerialize({ contract: unsignedContract, approval }))
      .digest('hex');
  }

  private hasValidApproval(contract: IntentContract): boolean {
    const signature = contract.approval.signature;
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const { signature: _signature, ...unsignedApproval } = contract.approval;
    const expected = this.signApproval(contract, unsignedApproval);
    if (!expected) return false;
    const actualBytes = Buffer.from(signature, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  }

  async compileWith(input: IntentContractInput, provider: IntentExtractionProvider): Promise<IntentContract> {
    const sourceText = cleanText(input?.text);
    if (!sourceText) return this.build(input, 'omitted');
    try {
      const extraction = await provider.extract(sourceText);
      return this.build({ ...input, extraction }, 'provided');
    } catch {
      return this.build({ ...input, extraction: undefined }, 'provider-failed');
    }
  }

  compile(input: IntentContractInput): IntentContract {
    return this.build(input, input?.extraction == null ? 'omitted' : 'provided');
  }

  private build(input: IntentContractInput, extractionStatus: IntentExtractionStatus): IntentContract {
    const rawSource = typeof input?.text === 'string' ? input.text : '';
    const sourceTextTruncated = rawSource.length > MAX_TEXT;
    const sourceTextDigest = createHash('sha256').update(rawSource).digest('hex');
    const sourceText = cleanText(preserveSourceText(rawSource.slice(0, MAX_TEXT + 1)));
    const rawExtraction = input?.extraction ?? {};
    const extractionValid = isPlainDataObject(rawExtraction) && isPlainDataTree(rawExtraction);
    const extraction = extractionValid ? rawExtraction as IntentExtraction : {};
    const structuredGoal = cleanText(extraction.goal);
    const goalText = structuredGoal || sourceText;
    const risk = inferRisk(sourceText, extraction.risk);
    const assumptions: IntentAssumption[] = [];
    let invalidAssumptionMetadata = extraction.assumptions !== undefined && !Array.isArray(extraction.assumptions);
    if (Array.isArray(extraction.assumptions)) {
      if (extraction.assumptions.length > MAX_LIST) invalidAssumptionMetadata = true;
      for (const item of extraction.assumptions.slice(0, MAX_LIST)) {
        if (!item || typeof item !== 'object') {
          invalidAssumptionMetadata = true;
          continue;
        }
        const statement = cleanText(item.statement);
        if (!statement || typeof item.statement !== 'string' || item.statement.length > MAX_TEXT) {
          invalidAssumptionMetadata = true;
          continue;
        }
        const knownImpact = item.impact === 'low' || item.impact === 'medium' || item.impact === 'high';
        if (!knownImpact && item.impact !== undefined) invalidAssumptionMetadata = true;
        const impact: IntentAssumption['impact'] = knownImpact ? item.impact : 'high';
        const confidence01 = clamp01(item.confidence01);
        assumptions.push({
          statement,
          impact,
          confidence01,
          requiresConfirmation: impact !== 'low' || confidence01 < 0.8,
        });
      }
    }
    const context = cleanList(extraction.context);
    const expectedOutcome = cleanText(extraction.expectedOutcome) || null;
    const constraints = { must: cleanList(extraction.constraints?.must), mustNot: cleanList(extraction.constraints?.mustNot) };
    const priorities = cleanList(extraction.priorities);
    const acceptanceCriteria = cleanList(extraction.acceptanceCriteria);
    const allowedActions = cleanList(extraction.permissions?.allowedActions, MAX_LIST, MAX_ACTION);
    const deniedActions = cleanList(extraction.permissions?.deniedActions, MAX_LIST, MAX_ACTION);
    const stopConditions = cleanList(extraction.stopConditions);
    const missingInformation: string[] = [];
    if (!sourceText) missingInformation.push('request-text');
    if (sourceTextTruncated) missingInformation.push('request-text-truncated');
    if (extractionStatus === 'provider-failed') missingInformation.push('semantic-extraction-failed');
    if (!extractionValid && input?.extraction != null) missingInformation.push('semantic-extraction-invalid');
    if (!expectedOutcome) missingInformation.push('expected-outcome');
    if (!acceptanceCriteria.length) missingInformation.push('acceptance-criteria');
    if (!allowedActions.length) missingInformation.push('explicit-action-allow-list');
    if (!stopConditions.length) missingInformation.push('stop-conditions');
    if (allowedActions.some(action => action.includes('*'))) missingInformation.push('wildcard-action-forbidden');
    if (allowedActions.some(action => !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(action))) missingInformation.push('malformed-action-id');
    if (hasMalformedActionIds(deniedActions)) missingInformation.push('malformed-action-id');
    if (invalidAssumptionMetadata) missingInformation.push('invalid-assumption-impact');
    if (listWasTruncated(extraction.context)) missingInformation.push('context-truncated');
    if (listWasTruncated(extraction.priorities)) missingInformation.push('priorities-truncated');
    if (listWasTruncated(extraction.acceptanceCriteria)) missingInformation.push('acceptance-criteria-truncated');
    if (listWasTruncated(extraction.stopConditions)) missingInformation.push('stop-conditions-truncated');
    if (listWasTruncated(extraction.constraints?.must) || listWasTruncated(extraction.constraints?.mustNot)) missingInformation.push('constraints-truncated');
    if (listWasTruncated(extraction.permissions?.allowedActions, MAX_LIST, MAX_ACTION) ||
        listWasTruncated(extraction.permissions?.deniedActions, MAX_LIST, MAX_ACTION)) missingInformation.push('permission-list-truncated');
    if (allowedActions.some(action => deniedActions.includes(action))) missingInformation.push('action-allow-deny-conflict');

    const requestId = cleanText(input?.requestId, 180);
    const identity: Record<string, unknown> = {
      requestId,
      sourceText,
      sourceTextDigest,
      sourceTextTruncated,
      extractionStatus,
      goal: { text: goalText, source: structuredGoal ? 'structured-extraction' : 'verbatim-request' },
      context,
      expectedOutcome,
      constraints,
      priorities,
      acceptanceCriteria,
      permissions: { allowedActions, deniedActions },
      assumptions,
      stopConditions,
      risk,
    };
    const contract: IntentContract = {
      schema: 'nk1.intent-contract',
      version: 1,
      id: stableId(requestId, identity),
      createdAt: this.now(),
      sourceText,
      sourceTextDigest,
      sourceTextTruncated,
      extractionStatus,
      goal: identity.goal as IntentContract['goal'],
      context,
      expectedOutcome,
      constraints,
      priorities,
      acceptanceCriteria,
      permissions: { allowedActions, deniedActions },
      assumptions,
      stopConditions,
      risk,
      missingInformation,
      approval: {
        status: 'not-approved',
        allowedActions: [],
        acknowledgedAssumptions: [],
        riskAcknowledged: false,
      },
    };
    const frozen = freezeDeep(contract);
    this.provenance.set(frozen, 'draft');
    return frozen;
  }

  approve(contract: IntentContract, approval: IntentApproval): IntentContract {
    if (!isIntentContract(contract) || this.provenance.get(contract as object) !== 'draft') {
      throw new TypeError('invalid, unissued, or superseded intent contract');
    }
    if (contract.missingInformation.length > 0) {
      throw new Error('intent contract is incomplete: ' + contract.missingInformation.join(', '));
    }
    if (approval?.contractId !== contract.id) throw new Error('approval must be bound to this exact intent contract');
    if (approval?.userConfirmed !== true) throw new Error('explicit user confirmation is required');
    if (!Number.isSafeInteger(approval.at) || approval.at < 0) throw new TypeError('approval timestamp is invalid');
    const now = this.now();
    const expiresAt = approval.expiresAt ?? approval.at + DEFAULT_APPROVAL_TTL_MS;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= approval.at || expiresAt > approval.at + DEFAULT_APPROVAL_TTL_MS) {
      throw new TypeError('approval expiry must be within the maximum approval lifetime');
    }
    if (expiresAt <= now) throw new Error('approval is already expired');
    const evidenceRef = cleanText(approval.evidenceRef, 180);
    if (!evidenceRef) throw new TypeError('approval evidence reference is required');
    const requested = cleanList(approval.allowedActions, MAX_LIST, MAX_ACTION);
    if (requested.some(action => action.includes('*'))) throw new Error('wildcard actions cannot be approved');
    const declared = new Set(contract.permissions.allowedActions);
    for (const action of requested) {
      if (!declared.has(action)) throw new Error(`action "${action}" was not explicitly allowed by the intent`);
    }
    const denied = new Set(contract.permissions.deniedActions);
    if (requested.some(action => denied.has(action))) throw new Error('an explicitly denied action cannot be approved');
    const requiredAssumptions = contract.assumptions.filter(item => item.requiresConfirmation).map(item => item.statement);
    const acknowledgedAssumptions = cleanList(approval.acknowledgedAssumptions, MAX_LIST, MAX_TEXT);
    if (requiredAssumptions.some(statement => !acknowledgedAssumptions.includes(statement))) {
      throw new Error('assumption acknowledgement is required');
    }
    if (acknowledgedAssumptions.some(statement => !requiredAssumptions.includes(statement))) {
      throw new Error('approval references an assumption not requiring confirmation');
    }
    if ((contract.risk.level === 'high' || contract.risk.level === 'critical') && approval.riskAcknowledged !== true) {
      throw new Error('explicit risk acknowledgement is required');
    }
    const unsignedApproval: Omit<IntentContract['approval'], 'signature'> = {
      status: 'approved',
      allowedActions: requested,
      acknowledgedAssumptions,
      riskAcknowledged: approval.riskAcknowledged === true,
      at: approval.at,
      expiresAt,
      evidenceRef,
    };
    const signature = this.signApproval(contract, unsignedApproval);
    if (!signature) throw new Error('intent approval signing key is unavailable or too short');
    const approved = freezeDeep({ ...contract, approval: { ...unsignedApproval, signature } });
    this.provenance.set(contract as object, 'superseded');
    this.provenance.set(approved as object, 'approved');
    return approved;
  }

  reject(contract: IntentContract): IntentContract {
    if (!isIntentContract(contract) || this.provenance.get(contract as object) !== 'draft') {
      throw new TypeError('invalid, unissued, or superseded intent contract');
    }
    const rejected = freezeDeep({
      ...contract,
      approval: {
        status: 'rejected',
        allowedActions: [],
        acknowledgedAssumptions: [],
        riskAcknowledged: false,
      },
    });
    this.provenance.set(contract as object, 'superseded');
    this.provenance.set(rejected as object, 'rejected');
    return rejected;
  }

  /** Restore only HMAC-attested approved contracts from a trusted durable store. */
  restoreApprovedContract(snapshot: unknown): IntentContract | null {
    if (!isIntentContract(snapshot) || snapshot.approval.status !== 'approved' || !this.hasValidApproval(snapshot)) return null;
    if (snapshot.missingInformation.length > 0) return null;
    try {
      const restored = freezeDeep(structuredClone(snapshot));
      this.provenance.set(restored as object, 'approved');
      return restored;
    } catch {
      return null;
    }
  }

  gate(contract: IntentContract, action: string): IntentGateResult {
    if (!isIntentContract(contract)) return { allowed: false, reason: 'invalid-contract' };
    const normalizedAction = cleanText(action, MAX_ACTION);
    if (!normalizedAction) return { allowed: false, reason: 'action-not-explicitly-allowed' };
    if (contract.missingInformation.length > 0) return { allowed: false, reason: 'contract-incomplete' };
    if (contract.permissions.deniedActions.includes(normalizedAction)) return { allowed: false, reason: 'action-explicitly-denied' };
    if (contract.approval.status !== 'approved') return { allowed: false, reason: 'contract-not-approved' };
    if (!this.hasValidApproval(contract)) return { allowed: false, reason: 'approval-attestation-invalid' };
    const now = this.now();
    if (typeof contract.approval.expiresAt !== 'number' || contract.approval.expiresAt <= now) {
      return { allowed: false, reason: 'approval-expired' };
    }
    if (typeof contract.approval.at !== 'number' || contract.approval.at > now + MAX_CLOCK_SKEW_MS) {
      return { allowed: false, reason: 'approval-not-yet-valid' };
    }
    if (!contract.permissions.allowedActions.includes(normalizedAction) ||
        !contract.approval.allowedActions.includes(normalizedAction)) {
      return { allowed: false, reason: 'action-not-explicitly-allowed' };
    }
    return { allowed: true, contractId: contract.id, action: normalizedAction };
  }
}
