import { randomUUID } from 'node:crypto';
import { snapshotPlainData } from '../../core/PlainDataSnapshot.ts';
import { sha256Stable } from '../../core/StableSerialization.ts';
export type HexisEvidenceStance = 'supports' | 'contradicts';
export type HexisReviewDecision = 'approve' | 'correct' | 'forget';
export type HexisHmxIntent = 'port' | 'duplicate' | 'telepathy' | 'analysis';
export type HexisHmxStrategy = 'additive' | 'authoritative' | 'deliberative' | 'analysis_only';
export type HexisOutboxStatus = 'pending' | 'publishing' | 'published' | 'failed';
export type HexisExecutionPlacement = 'local' | 'sandbox' | 'remote' | 'companion';
export interface HexisEvidenceSource {
    ref?: string;
    label?: string;
    contentHash?: string;
    trust01?: number;
    note?: string;
}
export interface HexisBeliefState {
    memoryId: string;
    confidence01: number;
    trust01: number;
    sourceKeys: string[];
    contradictingSourceKeys: string[];
    updatedAt: number;
}
export interface HexisBeliefRevisionAudit {
    id: string;
    memoryId: string;
    stance: HexisEvidenceStance;
    evidence: HexisEvidenceSource;
    priorConfidence01: number;
    posteriorConfidence01: number;
    priorTrust01: number;
    posteriorTrust01: number;
    independent: boolean;
    applied: boolean;
    reason: string;
    policy: 'residual_v1';
    context?: string;
    at: number;
    digest: string;
}
export interface HexisTemporalAssertion {
    id: string;
    memoryId: string;
    valueHash: string;
    summary: string;
    confidence01: number;
    validFrom: number;
    validUntil: number | null;
    supersedesId?: string;
    source: string;
    at: number;
}
export interface HexisLearningReviewItem {
    id: string;
    kind: 'semantic_belief' | 'new_procedure' | 'revised_strategy' | 'proposed_skill';
    title: string;
    content: string;
    sourceMemoryId?: string;
    evidence: Record<string, unknown>;
    status: 'pending' | 'approved' | 'corrected' | 'forgotten';
    correction?: string;
    createdAt: number;
    decidedAt?: number;
}
export interface HexisLearningReview {
    id: string;
    periodStart: number;
    periodEnd: number;
    summary: string;
    status: 'pending' | 'completed';
    items: HexisLearningReviewItem[];
    createdAt: number;
    completedAt?: number;
}
export interface HexisFidelityReceipt {
    id: string;
    operation: 'compression' | 'archive' | 'forget' | 'hmx-import';
    sourceCount: number;
    retainedCount: number;
    sourceBytes: number;
    retainedBytes: number;
    fidelity01: number;
    regret01: number;
    at: number;
    digest: string;
}
export interface HexisRetentionProposal {
    id: string;
    memoryId: string;
    action: 'compress' | 'archive' | 'forget';
    reason: string;
    sourceBytes: number;
    projectedBytes: number;
    estimatedFidelity01: number;
    estimatedRegret01: number;
    status: 'proposed' | 'accepted' | 'rejected';
    createdAt: number;
}
export interface HexisHmxApplyReceipt {
    version: 1;
    exportId: string;
    sourceLineageId: string;
    stageId: string;
    stageDigest: string;
    appliedAt: number;
    status: 'applied' | 'partial' | 'noop';
    complete: boolean;
    candidateMemoryRecords: number;
    uniqueMemoryRecords: number;
    importedCount: number;
    deduplicatedCount: number;
    projectedRelationships: number;
    deferredRelationships: number;
    semanticEdgeIds: string[];
    memoryIds: string[];
    createdMemoryIds: string[];
    deferredSections: Record<string, number>;
    warnings: string[];
    digest: string;
}
export interface HexisHmxPrivacy {
    redactionPolicy: 'none' | 'basic' | 'strict' | 'custom';
    containsSensitiveContent: boolean;
    consentScope: 'backup' | 'migration' | 'third_party_transfer' | 'unspecified';
}
export interface HexisHmxStage {
    stagingId: string;
    exportId: string;
    intent: HexisHmxIntent;
    strategy: HexisHmxStrategy;
    sourceSubjectId?: string;
    sourceLineageId?: string;
    sourceSchemaVersion?: string;
    privacy?: HexisHmxPrivacy;
    capabilitiesDigest?: string;
    sectionCounts: Record<string, number>;
    protectedSections: string[];
    conflicts: Array<{
        path: string;
        kind: string;
        detail: string;
    }>;
    status: 'staged' | 'accepted' | 'rejected' | 'applied';
    createdAt: number;
    digest: string;
    stagedSections: Record<string, unknown>;
    applicationAttempts?: number;
    application?: HexisHmxApplyReceipt;
}
export interface HexisOutboxEntry {
    id: string;
    idempotencyKey: string;
    kind: string;
    channel: string;
    payload: unknown;
    status: HexisOutboxStatus;
    attempts: number;
    createdAt: number;
    updatedAt: number;
    publishedAt?: number;
    lastError?: string;
}
export interface HexisConnectorPolicy {
    id: string;
    connectorId: string;
    actionKind: string;
    contexts: string[];
    allowAutonomous: boolean;
    requiresApproval: boolean;
    allowedTargets: string[];
    deniedTargets: string[];
    maxPerWindow?: number;
    windowMs: number;
    expiresAt?: number;
    windowStartedAt: number;
    windowCount: number;
    status: 'active' | 'revoked';
    grantedAt: number;
}
export interface HexisExecutionPlan {
    id: string;
    actionKind: string;
    requestedPlacement: HexisExecutionPlacement;
    resolvedPlacement: HexisExecutionPlacement;
    risk01: number;
    requiresApproval: boolean;
    rationale: string;
    at: number;
}
export interface HexisAdaptationState {
    version: 1;
    source: {
        name: 'Hexis-main';
        mode: 'canonical-adapter';
        integratedAt: string;
    };
    beliefs: HexisBeliefState[];
    beliefAudit: HexisBeliefRevisionAudit[];
    temporal: HexisTemporalAssertion[];
    learningReviews: HexisLearningReview[];
    retentionProposals: HexisRetentionProposal[];
    fidelityReceipts: HexisFidelityReceipt[];
    hmxStages: HexisHmxStage[];
    outbox: HexisOutboxEntry[];
    connectorPolicies: HexisConnectorPolicy[];
    executions: HexisExecutionPlan[];
    metrics: {
        beliefRevisions: number;
        duplicateEvidence: number;
        temporalQueries: number;
        reviewsCreated: number;
        reviewDecisions: number;
        retentionProposals: number;
        hmxStaged: number;
        hmxAccepted: number;
        hmxApplied: number;
        outboxQueued: number;
        outboxPublished: number;
        outboxIdempotencyConflicts: number;
        policyAllows: number;
        policyDenials: number;
        executionPlans: number;
    };
}
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const digest = (value: unknown) => sha256Stable(value, 'legacy');
const sourceKey = (source: HexisEvidenceSource) => String(source.ref || source.label || source.contentHash || digest(source));
const nowMs = () => Date.now();

const HEXIS_POLICY_MAX_ENTRIES = 256;
const HEXIS_POLICY_MAX_TARGETS = 256;
const HEXIS_POLICY_MAX_WINDOW_MS = 31_536_000_000;
const HEXIS_POLICY_MAX_RATE = 1_000_000;

function isHexisPolicyRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHexisPolicyText(value: unknown, maxLength: number): value is string {
    return typeof value === 'string' && value.trim().length > 0 &&
        value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizeHexisPolicyStringList(
    value: unknown,
    maxEntries: number,
    maxStringLength: number,
    lowercase = false,
): string[] | null {
    if (!Array.isArray(value) || value.length > maxEntries) return null;
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (!isHexisPolicyText(item, maxStringLength)) return null;
        const normalized = (lowercase ? item.trim().toLowerCase() : item.trim()).normalize('NFKC');
        if (!normalized) return null;
        if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(normalized);
        }
    }
    return result;
}

/** Persisted connector policy is an authorization boundary; malformed rows never survive restore. */
function normalizeHexisConnectorPolicy(value: unknown): HexisConnectorPolicy | null {
    if (!isHexisPolicyRecord(value)) return null;
    const row = value;
    if (!isHexisPolicyText(row.id, 256) || !isHexisPolicyText(row.connectorId, 128) ||
        !isHexisPolicyText(row.actionKind, 128) ||
        typeof row.allowAutonomous !== 'boolean' || typeof row.requiresApproval !== 'boolean' ||
        (row.status !== 'active' && row.status !== 'revoked')) return null;
    const contexts = normalizeHexisPolicyStringList(row.contexts, 32, 128);
    const allowedTargets = normalizeHexisPolicyStringList(row.allowedTargets, HEXIS_POLICY_MAX_TARGETS, 512);
    const deniedTargets = normalizeHexisPolicyStringList(row.deniedTargets, HEXIS_POLICY_MAX_TARGETS, 512);
    if (!contexts || contexts.length === 0 || !allowedTargets || !deniedTargets) return null;
    if (typeof row.windowMs !== 'number' || !Number.isSafeInteger(row.windowMs) ||
        row.windowMs < 1000 || row.windowMs > HEXIS_POLICY_MAX_WINDOW_MS ||
        typeof row.windowStartedAt !== 'number' || !Number.isSafeInteger(row.windowStartedAt) || row.windowStartedAt < 0 ||
        typeof row.windowCount !== 'number' || !Number.isSafeInteger(row.windowCount) ||
        row.windowCount < 0 || row.windowCount > HEXIS_POLICY_MAX_RATE ||
        typeof row.grantedAt !== 'number' || !Number.isSafeInteger(row.grantedAt) || row.grantedAt < 0) return null;
    if (row.maxPerWindow !== undefined &&
        (typeof row.maxPerWindow !== 'number' || !Number.isSafeInteger(row.maxPerWindow) ||
            row.maxPerWindow < 1 || row.maxPerWindow > HEXIS_POLICY_MAX_RATE)) return null;
    if (row.expiresAt !== undefined &&
        (typeof row.expiresAt !== 'number' || !Number.isSafeInteger(row.expiresAt) || row.expiresAt < 0)) return null;
    return {
        id: row.id.trim().normalize('NFKC'),
        connectorId: row.connectorId.trim().normalize('NFKC').toLowerCase(),
        actionKind: row.actionKind.trim().normalize('NFKC').toLowerCase(),
        contexts,
        allowAutonomous: row.allowAutonomous,
        requiresApproval: row.requiresApproval,
        allowedTargets,
        deniedTargets,
        ...(row.maxPerWindow === undefined ? {} : { maxPerWindow: row.maxPerWindow }),
        windowMs: row.windowMs,
        ...(row.expiresAt === undefined ? {} : { expiresAt: row.expiresAt }),
        windowStartedAt: row.windowStartedAt,
        windowCount: row.windowCount,
        status: row.status,
        grantedAt: row.grantedAt,
    };
}

function normalizeHexisConnectorPolicies(value: unknown): HexisConnectorPolicy[] {
    if (!Array.isArray(value)) return [];
    const candidates = value.slice(-HEXIS_POLICY_MAX_ENTRIES)
        .map(normalizeHexisConnectorPolicy)
        .filter((policy): policy is HexisConnectorPolicy => policy !== null);
    const counts = new Map<string, number>();
    for (const policy of candidates) counts.set(policy.id, (counts.get(policy.id) ?? 0) + 1);
    // Duplicate IDs are ambiguous for revocation; fail closed by dropping every duplicate.
    return candidates.filter(policy => counts.get(policy.id) === 1);
}

const HEXIS_SAFE_TEXT_CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
function isHexisSafeText(value: unknown, maxLength: number, allowEmpty = false): value is string {
    return typeof value === 'string' && value.length <= maxLength &&
        (allowEmpty || value.trim().length > 0) && !HEXIS_SAFE_TEXT_CONTROL.test(value);
}
function isHexisUnit(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function isHexisSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isHexisTime(value: unknown): value is number {
    return isHexisSafeInteger(value) && value <= 8_640_000_000_000_000;
}
function isHexisStringList(value: unknown, maxItems: number, maxText: number): value is string[] {
    return Array.isArray(value) && value.length <= maxItems &&
        value.every(item => isHexisSafeText(item, maxText));
}
function isHexisDigest(value: unknown): value is string {
    return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}
function isHexisRecordOfCounts(value: unknown): value is Record<string, number> {
    if (!isHexisPolicyRecord(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= 128 && entries.every(([key, count]) =>
        isHexisSafeText(key, 128) && isHexisSafeInteger(count) && count <= 100_000);
}
function isHexisEvidenceSource(value: unknown): value is HexisEvidenceSource {
    if (!isHexisPolicyRecord(value)) return false;
    return (value.ref === undefined || isHexisSafeText(value.ref, 512)) &&
        (value.label === undefined || isHexisSafeText(value.label, 256)) &&
        (value.contentHash === undefined || isHexisSafeText(value.contentHash, 256)) &&
        (value.trust01 === undefined || isHexisUnit(value.trust01)) &&
        (value.note === undefined || isHexisSafeText(value.note, 2_000, true));
}
function isHexisBelief(value: unknown): value is HexisBeliefState {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.memoryId, 192) && isHexisUnit(value.confidence01) &&
        isHexisUnit(value.trust01) && isHexisStringList(value.sourceKeys, 256, 512) &&
        isHexisStringList(value.contradictingSourceKeys, 256, 512) && isHexisTime(value.updatedAt);
}
function isHexisBeliefAudit(value: unknown): value is HexisBeliefRevisionAudit {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisSafeText(value.memoryId, 192) &&
        (value.stance === 'supports' || value.stance === 'contradicts') &&
        isHexisEvidenceSource(value.evidence) && isHexisUnit(value.priorConfidence01) &&
        isHexisUnit(value.posteriorConfidence01) && isHexisUnit(value.priorTrust01) &&
        isHexisUnit(value.posteriorTrust01) && typeof value.independent === 'boolean' &&
        typeof value.applied === 'boolean' && isHexisSafeText(value.reason, 256) &&
        value.policy === 'residual_v1' &&
        (value.context === undefined || isHexisSafeText(value.context, 2_000, true)) &&
        isHexisTime(value.at) && isHexisDigest(value.digest);
}
function isHexisTemporalAssertion(value: unknown): value is HexisTemporalAssertion {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisSafeText(value.memoryId, 192) &&
        isHexisDigest(value.valueHash) && isHexisSafeText(value.summary, 2_000, true) &&
        isHexisUnit(value.confidence01) && isHexisTime(value.validFrom) &&
        (value.validUntil === null || isHexisTime(value.validUntil)) &&
        (value.supersedesId === undefined || isHexisSafeText(value.supersedesId, 128)) &&
        isHexisSafeText(value.source, 256) && isHexisTime(value.at);
}
function isHexisLearningReviewItem(value: unknown): value is HexisLearningReviewItem {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) &&
        ['semantic_belief', 'new_procedure', 'revised_strategy', 'proposed_skill'].includes(String(value.kind)) &&
        isHexisSafeText(value.title, 256) && isHexisSafeText(value.content, 8_000, true) &&
        (value.sourceMemoryId === undefined || isHexisSafeText(value.sourceMemoryId, 192)) &&
        isHexisPolicyRecord(value.evidence) &&
        ['pending', 'approved', 'corrected', 'forgotten'].includes(String(value.status)) &&
        (value.correction === undefined || isHexisSafeText(value.correction, 2_000, true)) &&
        isHexisTime(value.createdAt) &&
        (value.decidedAt === undefined || isHexisTime(value.decidedAt));
}
function isHexisLearningReview(value: unknown): value is HexisLearningReview {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisTime(value.periodStart) &&
        isHexisTime(value.periodEnd) && value.periodEnd >= value.periodStart &&
        isHexisSafeText(value.summary, 2_000, true) &&
        (value.status === 'pending' || value.status === 'completed') &&
        Array.isArray(value.items) && value.items.length <= 50 &&
        value.items.every(isHexisLearningReviewItem) && isHexisTime(value.createdAt) &&
        (value.completedAt === undefined || isHexisTime(value.completedAt));
}
function isHexisRetentionProposal(value: unknown): value is HexisRetentionProposal {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisSafeText(value.memoryId, 192) &&
        ['compress', 'archive', 'forget'].includes(String(value.action)) &&
        isHexisSafeText(value.reason, 500, true) &&
        isHexisSafeInteger(value.sourceBytes) && isHexisSafeInteger(value.projectedBytes) &&
        isHexisUnit(value.estimatedFidelity01) && isHexisUnit(value.estimatedRegret01) &&
        ['proposed', 'accepted', 'rejected'].includes(String(value.status)) && isHexisTime(value.createdAt);
}
function isHexisFidelityReceipt(value: unknown): value is HexisFidelityReceipt {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) &&
        ['compression', 'archive', 'forget', 'hmx-import'].includes(String(value.operation)) &&
        isHexisSafeInteger(value.sourceCount) && isHexisSafeInteger(value.retainedCount) &&
        isHexisSafeInteger(value.sourceBytes) && isHexisSafeInteger(value.retainedBytes) &&
        isHexisUnit(value.fidelity01) && isHexisUnit(value.regret01) &&
        isHexisTime(value.at) && isHexisDigest(value.digest);
}
function isHexisHmxConflict(value: unknown): boolean {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.path, 512) && isHexisSafeText(value.kind, 128) &&
        isHexisSafeText(value.detail, 2_000, true);
}
function isHexisHmxApplyReceipt(value: unknown): value is HexisHmxApplyReceipt {
    if (!isHexisPolicyRecord(value)) return false;
    return value.version === 1 && isHexisSafeText(value.exportId, 128) &&
        isHexisSafeText(value.sourceLineageId, 256) && isHexisSafeText(value.stageId, 128) &&
        isHexisDigest(value.stageDigest) && isHexisTime(value.appliedAt) &&
        ['applied', 'partial', 'noop'].includes(String(value.status)) &&
        typeof value.complete === 'boolean' &&
        ['candidateMemoryRecords', 'uniqueMemoryRecords', 'importedCount', 'deduplicatedCount', 'projectedRelationships', 'deferredRelationships'].every(key =>
            Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) &&
        isHexisStringList(value.semanticEdgeIds, 512, 128) &&
        isHexisStringList(value.memoryIds, 512, 128) &&
        isHexisStringList(value.createdMemoryIds, 512, 128) &&
        isHexisRecordOfCounts(value.deferredSections) &&
        isHexisStringList(value.warnings, 64, 512) && isHexisDigest(value.digest) &&
        sha256Stable(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'digest')), 'json') === value.digest;
}
function isHexisHmxStage(value: unknown): value is HexisHmxStage {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.stagingId, 128) && isHexisSafeText(value.exportId, 128) &&
        ['port', 'duplicate', 'telepathy', 'analysis'].includes(String(value.intent)) &&
        ['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(String(value.strategy)) &&
        (value.sourceSubjectId === undefined || isHexisSafeText(value.sourceSubjectId, 256)) &&
        (value.sourceLineageId === undefined || isHexisSafeText(value.sourceLineageId, 256)) &&
        (value.sourceSchemaVersion === undefined || isHexisSafeText(value.sourceSchemaVersion, 64)) &&
        (value.privacy === undefined || (isHexisPolicyRecord(value.privacy) &&
            ['none', 'basic', 'strict', 'custom'].includes(String(value.privacy.redactionPolicy)) &&
            typeof value.privacy.containsSensitiveContent === 'boolean' &&
            ['backup', 'migration', 'third_party_transfer', 'unspecified'].includes(String(value.privacy.consentScope)))) &&
        (value.capabilitiesDigest === undefined || isHexisDigest(value.capabilitiesDigest)) &&
        (value.applicationAttempts === undefined || (Number.isSafeInteger(value.applicationAttempts) && Number(value.applicationAttempts) >= 0 && Number(value.applicationAttempts) <= 1000)) &&
        (value.application === undefined || isHexisHmxApplyReceipt(value.application)) &&
        (value.status !== 'applied' || isHexisHmxApplyReceipt(value.application)) &&
        isHexisRecordOfCounts(value.sectionCounts) &&
        isHexisStringList(value.protectedSections, 128, 128) &&
        Array.isArray(value.conflicts) && value.conflicts.length <= 256 &&
        value.conflicts.every(isHexisHmxConflict) &&
        ['staged', 'accepted', 'rejected', 'applied'].includes(String(value.status)) &&
        isHexisTime(value.createdAt) && isHexisDigest(value.digest) &&
        isHexisPolicyRecord(value.stagedSections);
}
function isHexisOutboxEntry(value: unknown): value is HexisOutboxEntry {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisSafeText(value.idempotencyKey, 160) &&
        isHexisSafeText(value.kind, 128) && isHexisSafeText(value.channel, 128) &&
        Object.prototype.hasOwnProperty.call(value, 'payload') &&
        ['pending', 'publishing', 'published', 'failed'].includes(String(value.status)) &&
        isHexisSafeInteger(value.attempts) && value.attempts <= 1_000_000 &&
        isHexisTime(value.createdAt) && isHexisTime(value.updatedAt) &&
        (value.publishedAt === undefined || isHexisTime(value.publishedAt)) &&
        (value.lastError === undefined || isHexisSafeText(value.lastError, 1_000, true));
}
function isHexisExecutionPlan(value: unknown): value is HexisExecutionPlan {
    if (!isHexisPolicyRecord(value)) return false;
    return isHexisSafeText(value.id, 128) && isHexisSafeText(value.actionKind, 128) &&
        ['local', 'sandbox', 'remote', 'companion'].includes(String(value.requestedPlacement)) &&
        ['local', 'sandbox', 'remote', 'companion'].includes(String(value.resolvedPlacement)) &&
        isHexisUnit(value.risk01) && typeof value.requiresApproval === 'boolean' &&
        isHexisSafeText(value.rationale, 2_000, true) && isHexisTime(value.at);
}
function normalizeHexisRows<T>(
    value: unknown,
    limit: number,
    validate: (candidate: unknown) => candidate is T,
    identityKeys: (row: T) => string[],
): T[] {
    if (!Array.isArray(value)) return [];
    const valid = value.slice(-limit).filter(validate);
    const counts = new Map<string, number>();
    for (const row of valid) {
        for (const key of identityKeys(row)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return valid.filter(row => identityKeys(row).every(key => counts.get(key) === 1));
}

const protectedSections = new Set(['identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals']);
export function defaultHexisAdaptationState(): HexisAdaptationState {
    return { version: 1, source: { name: 'Hexis-main', mode: 'canonical-adapter', integratedAt: '2026-10-08' }, beliefs: [], beliefAudit: [], temporal: [], learningReviews: [], retentionProposals: [], fidelityReceipts: [], hmxStages: [], outbox: [], connectorPolicies: [], executions: [], metrics: { beliefRevisions: 0, duplicateEvidence: 0, temporalQueries: 0, reviewsCreated: 0, reviewDecisions: 0, retentionProposals: 0, hmxStaged: 0, hmxAccepted: 0, hmxApplied: 0, outboxQueued: 0, outboxPublished: 0, outboxIdempotencyConflicts: 0, policyAllows: 0, policyDenials: 0, executionPlans: 0 } };
}
export class HexisAdaptationFabric {
    private state = defaultHexisAdaptationState();
    private canonicalMemoryApply?: (stage: HexisHmxStage, tick: number) => HexisHmxApplyReceipt;

    bindCanonicalMemoryApply(handler: (stage: HexisHmxStage, tick: number) => HexisHmxApplyReceipt): void {
        this.canonicalMemoryApply = handler;
    }
    restore(raw?: Partial<HexisAdaptationState> | null): void {
        const defaults = defaultHexisAdaptationState();
        let value: Record<string, unknown>;
        try {
            // Persisted state is untrusted input. Copy only bounded inert own-data
            // properties before reading any field; never execute accessors or retain
            // proxies/class instances in the live organism state.
            const detached = snapshotPlainData(raw ?? {}, { allowNonFiniteNumbers: true });
            if (!isHexisPolicyRecord(detached)) throw new Error('hexis-snapshot-root-invalid');
            value = detached;
        } catch {
            this.state = defaults;
            return;
        }

        const normalizedPolicies = normalizeHexisConnectorPolicies(value.connectorPolicies);
        const metricInput = isHexisPolicyRecord(value.metrics)
            ? value.metrics
            : Object.create(null) as Record<string, unknown>;
        const metrics = Object.fromEntries(
            Object.entries(defaults.metrics).map(([key, fallback]) => {
                const candidate = metricInput[key];
                return [key, Number.isSafeInteger(candidate) && (candidate as number) >= 0
                    ? candidate as number
                    : fallback];
            }),
        ) as HexisAdaptationState['metrics'];

        this.state = {
            version: defaults.version,
            source: defaults.source,
            beliefs: normalizeHexisRows(value.beliefs, 1024, isHexisBelief, row => [row.memoryId]),
            beliefAudit: normalizeHexisRows(value.beliefAudit, 2048, isHexisBeliefAudit, row => [row.id]),
            temporal: normalizeHexisRows(value.temporal, 4096, isHexisTemporalAssertion, row => [row.id]),
            learningReviews: normalizeHexisRows(value.learningReviews, 96, isHexisLearningReview, row => [row.id]),
            retentionProposals: normalizeHexisRows(value.retentionProposals, 512, isHexisRetentionProposal, row => [row.id]),
            fidelityReceipts: normalizeHexisRows(value.fidelityReceipts, 512, isHexisFidelityReceipt, row => [row.id]),
            hmxStages: normalizeHexisRows(value.hmxStages, 32, isHexisHmxStage, row => [row.stagingId]),
            outbox: normalizeHexisRows(value.outbox, 512, isHexisOutboxEntry, row => [row.id, row.idempotencyKey]),
            connectorPolicies: normalizedPolicies,
            executions: normalizeHexisRows(value.executions, 512, isHexisExecutionPlan, row => [row.id]),
            metrics,
        };
    }
    snapshot(): HexisAdaptationState { return structuredClone(this.state); }
    diagnostics() {
        const pendingReviews = this.state.learningReviews.filter((r) => r.status === 'pending').length;
        const pendingOutbox = this.state.outbox.filter((x) => x.status === 'pending' || x.status === 'publishing').length;
        const activePolicies = this.state.connectorPolicies.filter((x) => x.status === 'active').length;
        return {
            source: this.state.source,
            counts: {
                beliefs: this.state.beliefs.length,
                audits: this.state.beliefAudit.length,
                temporal: this.state.temporal.length,
                reviews: this.state.learningReviews.length,
                pendingReviews,
                retentionProposals: this.state.retentionProposals.length,
                fidelityReceipts: this.state.fidelityReceipts.length,
                hmxStages: this.state.hmxStages.length,
                pendingOutbox,
                connectorPolicies: activePolicies,
                executions: this.state.executions.length,
            },
            metrics: this.state.metrics,
        };
    }
    registerOrUpdateBelief(input: {
        memoryId: string;
        confidence01: number;
        trust01?: number;
        at?: number;
    }): HexisBeliefState { const id = String(input.memoryId); const existing = this.state.beliefs.find((x) => x.memoryId === id); if (existing)
        return structuredClone(existing); const created: HexisBeliefState = { memoryId: id, confidence01: clamp(input.confidence01), trust01: clamp(input.trust01 ?? 0.5), sourceKeys: [], contradictingSourceKeys: [], updatedAt: Number.isFinite(input.at) ? Number(input.at) : nowMs() }; this.state.beliefs.push(created); this.state.beliefs = this.state.beliefs.slice(-1024); return structuredClone(created); }
    reviseBelief(input: {
        memoryId: string;
        confidence01: number;
        trust01?: number;
        evidence: HexisEvidenceSource;
        stance: HexisEvidenceStance;
        context?: string;
        at?: number;
        protectedBelief?: boolean;
    }): HexisBeliefRevisionAudit { const at = Number.isFinite(input.at) ? Number(input.at) : nowMs(); let stored = this.state.beliefs.find((x) => x.memoryId === String(input.memoryId)); if (!stored) {
        this.registerOrUpdateBelief({ memoryId: input.memoryId, confidence01: input.confidence01, trust01: input.trust01, at });
        stored = this.state.beliefs.find((x) => x.memoryId === String(input.memoryId));
    } if (!stored)
        throw new Error('belief_registration_failed'); const belief = stored; const key = sourceKey(input.evidence); const independent = !belief.sourceKeys.includes(key) && !belief.contradictingSourceKeys.includes(key); const evidenceTrust = clamp(input.evidence.trust01 ?? 0.5); const priorConfidence01 = clamp(belief.confidence01); const priorTrust01 = clamp(belief.trust01); let posteriorConfidence01 = priorConfidence01; let applied = false; let reason = 'applied'; if (!independent) {
        reason = 'duplicate_source';
        this.state.metrics.duplicateEvidence += 1;
    }
    else if (input.protectedBelief && input.stance === 'contradicts')
        reason = 'protected';
    else if (input.stance === 'supports') {
        posteriorConfidence01 = Math.min(0.99, priorConfidence01 + (1 - priorConfidence01) * 0.35 * evidenceTrust);
        applied = true;
    }
    else {
        posteriorConfidence01 = Math.max(0.05, priorConfidence01 * (1 - 0.35 * evidenceTrust));
        applied = true;
    } if (independent && applied) {
        if (input.stance === 'supports')
            belief.sourceKeys = [...new Set([...belief.sourceKeys, key])].slice(-256);
        else
            belief.contradictingSourceKeys = [...new Set([...belief.contradictingSourceKeys, key])].slice(-256);
    } if (applied) {
        belief.confidence01 = posteriorConfidence01;
        belief.trust01 = clamp(Math.max(priorTrust01, evidenceTrust * 0.5));
        belief.updatedAt = at;
    } const base = { id: randomUUID(), memoryId: input.memoryId, stance: input.stance, evidence: structuredClone(input.evidence), priorConfidence01, posteriorConfidence01, priorTrust01, posteriorTrust01: belief.trust01, independent, applied, reason, policy: 'residual_v1' as const, context: input.context, at }; const audit: HexisBeliefRevisionAudit = { ...base, digest: digest(base) }; this.state.beliefAudit.push(audit); this.state.beliefAudit = this.state.beliefAudit.slice(-2048); this.state.metrics.beliefRevisions += 1; return structuredClone(audit); }
    recordTemporalAssertion(input: {
        memoryId: string;
        summary: string;
        confidence01: number;
        validFrom: number;
        source?: string;
        value?: unknown;
    }): HexisTemporalAssertion { const existing = this.state.temporal.find((x) => x.memoryId === input.memoryId && x.validUntil === null); const at = nowMs(); if (existing)
        existing.validUntil = Math.max(existing.validFrom, Number(input.validFrom)); const created: HexisTemporalAssertion = { id: randomUUID(), memoryId: String(input.memoryId), valueHash: digest(input.value ?? input.summary), summary: String(input.summary).slice(0, 2000), confidence01: clamp(input.confidence01), validFrom: Number(input.validFrom), validUntil: null, supersedesId: existing?.id, source: String(input.source ?? 'canonical-memory'), at }; this.state.temporal.push(created); this.state.temporal = this.state.temporal.slice(-4096); return structuredClone(created); }
    temporalAt(memoryId: string, at: number): HexisTemporalAssertion | null { this.state.metrics.temporalQueries += 1; const rows = this.state.temporal.filter((x) => x.memoryId === memoryId && x.validFrom <= at && (x.validUntil === null || at < x.validUntil)).sort((a, b) => b.validFrom - a.validFrom); return rows[0] ? structuredClone(rows[0]) : null; }
    temporalDiff(memoryId: string, fromAt: number, toAt: number) { this.state.metrics.temporalQueries += 1; const from = this.temporalAt(memoryId, fromAt); const to = this.temporalAt(memoryId, toAt); return { memoryId, from, to, changed: (from?.valueHash ?? null) !== (to?.valueHash ?? null) }; }
    createLearningReview(input: {
        periodStart: number;
        periodEnd: number;
        summary: string;
        items: Array<Omit<HexisLearningReviewItem, 'id' | 'status' | 'createdAt'>>;
    }): HexisLearningReview { const createdAt = nowMs(); const review: HexisLearningReview = { id: randomUUID(), periodStart: input.periodStart, periodEnd: input.periodEnd, summary: String(input.summary).slice(0, 2000), status: 'pending', items: input.items.slice(0, 50).map((item) => ({ ...item, id: randomUUID(), status: 'pending', createdAt })), createdAt }; this.state.learningReviews.push(review); this.state.learningReviews = this.state.learningReviews.slice(-96); this.state.metrics.reviewsCreated += 1; return structuredClone(review); }
    decideLearningReview(reviewId: string, itemId: string, decision: HexisReviewDecision, correction?: string): HexisLearningReviewItem | null { const review = this.state.learningReviews.find((x) => x.id === reviewId); const item = review?.items.find((x) => x.id === itemId); if (!item || item.status !== 'pending' || !['approve', 'correct', 'forget'].includes(decision) || (decision === 'correct' && !String(correction ?? '').trim()))
        return null; item.status = decision === 'approve' ? 'approved' : decision === 'correct' ? 'corrected' : 'forgotten'; if (correction)
        item.correction = String(correction).slice(0, 2000); item.decidedAt = nowMs(); if (review && review.items.every((x) => x.status !== 'pending')) {
        review.status = 'completed';
        review.completedAt = item.decidedAt;
    } this.state.metrics.reviewDecisions += 1; return structuredClone(item); }
    setRetentionStatus(proposalId: string, status: 'accepted' | 'rejected'): HexisRetentionProposal | null { const proposal = this.state.retentionProposals.find((x) => x.id === proposalId); if (!proposal)
        return null; proposal.status = status; return structuredClone(proposal); }
    proposeRetention(input: {
        memoryId: string;
        action: 'compress' | 'archive' | 'forget';
        sourceBytes: number;
        projectedBytes: number;
        fidelity01: number;
        regret01: number;
        reason: string;
    }): HexisRetentionProposal { const proposal: HexisRetentionProposal = { id: randomUUID(), memoryId: String(input.memoryId), action: input.action, reason: String(input.reason).slice(0, 500), sourceBytes: Math.max(0, Math.floor(input.sourceBytes)), projectedBytes: Math.max(0, Math.floor(input.projectedBytes)), estimatedFidelity01: clamp(input.fidelity01), estimatedRegret01: clamp(input.regret01), status: 'proposed', createdAt: nowMs() }; this.state.retentionProposals.push(proposal); this.state.retentionProposals = this.state.retentionProposals.slice(-512); this.state.metrics.retentionProposals += 1; return structuredClone(proposal); }
    recordFidelityReceipt(input: {
        operation: HexisFidelityReceipt['operation'];
        sourceCount: number;
        retainedCount: number;
        sourceBytes: number;
        retainedBytes: number;
        fidelity01: number;
        regret01: number;
        at?: number;
    }): HexisFidelityReceipt { const base = { operation: input.operation, sourceCount: Math.max(0, Math.floor(input.sourceCount)), retainedCount: Math.max(0, Math.floor(input.retainedCount)), sourceBytes: Math.max(0, Math.floor(input.sourceBytes)), retainedBytes: Math.max(0, Math.floor(input.retainedBytes)), fidelity01: clamp(input.fidelity01), regret01: clamp(input.regret01), at: Number.isFinite(input.at) ? Number(input.at) : nowMs() }; const receipt: HexisFidelityReceipt = { ...base, id: randomUUID(), digest: digest(base) }; this.state.fidelityReceipts.push(receipt); this.state.fidelityReceipts = this.state.fidelityReceipts.slice(-512); return structuredClone(receipt); }
    stageHmx(input: {
        document: unknown;
        intent: HexisHmxIntent;
        strategy: HexisHmxStrategy;
    }): HexisHmxStage {
        const conflicts: HexisHmxStage['conflicts'] = [];
        let document: Record<string, unknown> = Object.create(null);
        try {
            document = snapshotPlainData(input.document, { maxStringUnits: 4 * 1024 * 1024 }) as Record<string, unknown>;
        } catch (error) {
            conflicts.push({ path: 'document', kind: 'plain-data', detail: String((error as any)?.message ?? error).slice(0, 500) });
        }
        const isRecord = (value: unknown): value is Record<string, unknown> =>
            value !== null && typeof value === 'object' && !Array.isArray(value);
        const safeText = (value: unknown, max: number) =>
            typeof value === 'string' && value.trim().length > 0 && value.length <= max &&
            !HEXIS_SAFE_TEXT_CONTROL.test(value);
        const exportId = safeText(document.export_id, 64) ? String(document.export_id) : '';
        if (!/^exp_[0-9a-f]{16}$/.test(exportId)) {
            conflicts.push({ path: 'export_id', kind: 'schema', detail: 'HMX 1.7 export_id must match exp_ plus 16 lowercase hexadecimal characters' });
        }
        if (document.hmx_version !== '1.7') {
            conflicts.push({ path: 'hmx_version', kind: 'unsupported-version', detail: 'Only HMX 1.7 is accepted for canonical staging' });
        }
        if (!['port', 'duplicate', 'telepathy', 'analysis'].includes(String(input.intent)) ||
            !['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(String(input.strategy))) {
            conflicts.push({ path: 'intent', kind: 'policy', detail: 'HMX intent or import strategy is unsupported' });
        }
        if (document.export_intent !== input.intent) {
            conflicts.push({ path: 'export_intent', kind: 'intent-mismatch', detail: 'The requested intent must match the signed-in-document export_intent field' });
        }
        if (!safeText(document.exported_at, 64) || !Number.isFinite(Date.parse(String(document.exported_at)))) {
            conflicts.push({ path: 'exported_at', kind: 'schema', detail: 'HMX exported_at must be an ISO date-time' });
        }
        const source = isRecord(document.source) ? document.source : {};
        if (!safeText(source.instance_id, 256) || source.schema_version !== '1.7' ||
            !safeText(source.embedding_model, 256) ||
            !Number.isSafeInteger(source.embedding_dimension) || Number(source.embedding_dimension) < 1 ||
            !safeText(source.hexis_lineage_id, 256)) {
            conflicts.push({ path: 'source', kind: 'schema', detail: 'HMX source must include instance_id, schema_version 1.7, embedding_model, positive embedding_dimension and hexis_lineage_id' });
        }
        const capabilities = isRecord(document.capabilities) ? document.capabilities : null;
        if (!capabilities ||
            !Array.isArray(capabilities.formats) || !capabilities.formats.includes('json') ||
            !Array.isArray(capabilities.sections) || !Array.isArray(capabilities.hash_algorithms) ||
            !capabilities.hash_algorithms.includes('sha256') ||
            !Array.isArray(capabilities.relationship_edge_types) || !Array.isArray(capabilities.optional_features) ||
            capabilities.formats.length > 32 || capabilities.sections.length > 64 ||
            capabilities.hash_algorithms.length > 16 || capabilities.relationship_edge_types.length > 64 ||
            capabilities.optional_features.length > 64) {
            conflicts.push({ path: 'capabilities', kind: 'schema', detail: 'HMX 1.7 capabilities must declare bounded JSON, SHA-256, sections, relationship types and optional features' });
        }
        const privacy = isRecord(document.privacy) ? document.privacy : null;
        if (!privacy || !['none', 'basic', 'strict', 'custom'].includes(String(privacy.redaction_policy)) ||
            typeof privacy.contains_sensitive_content !== 'boolean' ||
            !['backup', 'migration', 'third_party_transfer', 'unspecified'].includes(String(privacy.consent_scope))) {
            conflicts.push({ path: 'privacy', kind: 'schema', detail: 'HMX privacy must declare redaction policy, sensitive-content flag and consent scope' });
        }
        if (input.intent === 'port' && input.strategy === 'additive' &&
            (!privacy || privacy.redaction_policy !== 'strict' ||
             privacy.contains_sensitive_content !== false || privacy.consent_scope !== 'migration')) {
            conflicts.push({ path: 'privacy', kind: 'canonical-import-consent', detail: 'Canonical memory import requires strict redaction, no unredacted sensitive content and explicit migration consent' });
        }
        const sections = isRecord(document.sections) ? document.sections : {};
        if (!Object.keys(sections).length) {
            conflicts.push({ path: 'sections', kind: 'schema', detail: 'HMX sections must be a non-empty object' });
        }
        const sectionCounts: Record<string, number> = {};
        const stagedSections: Record<string, unknown> = {};
        const names = Object.keys(sections);
        const supportedSections = new Set(['memories', 'episodes', 'relationships', 'narrative', 'identity', 'worldview', 'goals', 'drives', 'emotional_triggers', 'clusters', 'in_flight_work', 'audit_records', 'raw_units', 'config']);
        for (const [name, value] of Object.entries(sections)) {
            if (!supportedSections.has(name)) {
                conflicts.push({ path: 'sections.' + name, kind: 'unknown-section', detail: 'Unknown HMX section is retained only as inert deferred data' });
            }
            if (Array.isArray(value)) {
                const max = name === 'memories' ? 256 : name === 'relationships' ? 512 : 256;
                sectionCounts[name] = value.length;
                if (value.length > max) {
                    conflicts.push({ path: 'sections.' + name, kind: 'section-limit', detail: 'Section exceeds the bounded staging limit of ' + max + ' records' });
                    continue;
                }
                stagedSections[name] = structuredClone(value);
                continue;
            }
            if (isRecord(value)) {
                const keys = Object.keys(value);
                sectionCounts[name] = keys.length;
                if (keys.length > 128) {
                    conflicts.push({ path: 'sections.' + name, kind: 'section-limit', detail: 'Object section exceeds the bounded staging limit of 128 keys' });
                    continue;
                }
                stagedSections[name] = structuredClone(value);
                continue;
            }
            conflicts.push({ path: 'sections.' + name, kind: 'schema', detail: 'HMX section must be an array or plain object' });
        }
        const memories = Array.isArray(sections.memories) ? sections.memories : [];
        const refs = new Set<string>();
        for (let index = 0; index < memories.length && index < 257; index++) {
            const row = memories[index];
            const ref = isRecord(row) ? row.ref : undefined;
            const content = isRecord(row) ? row.content : undefined;
            const type = isRecord(row) ? row.type : undefined;
            const safeMemoryContent = typeof content === 'string' &&
                content.trim().length > 0 && content.length <= 12_000 &&
                !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(content);
            if (!safeText(ref, 512) || !String(ref).startsWith(exportId + ':') ||
                !safeMemoryContent || !safeText(type, 64)) {
                conflicts.push({ path: 'sections.memories[' + index + ']', kind: 'memory-record', detail: 'Each memory needs a source-scoped ref, type and non-empty bounded content' });
                continue;
            }
            if (refs.has(String(ref))) conflicts.push({ path: 'sections.memories[' + index + '].ref', kind: 'duplicate-ref', detail: 'Memory refs must be unique within an export' });
            refs.add(String(ref));
        }
        const relationships = Array.isArray(sections.relationships) ? sections.relationships : [];
        if (relationships.length > 512) {
            conflicts.push({ path: 'sections.relationships', kind: 'section-limit', detail: 'Relationships exceed 512 records' });
        }
        for (let index = 0; index < relationships.length && index < 513; index++) {
            const row = relationships[index];
            if (!isRecord(row) || !safeText(row.source_ref, 512) || !safeText(row.target_ref, 512) || !safeText(row.edge_type, 64)) {
                conflicts.push({ path: 'sections.relationships[' + index + ']', kind: 'relationship-record', detail: 'Each relationship needs source_ref, target_ref and edge_type' });
            }
        }
        // Analysis-only stages are reviewable, but their protected sections remain inert and can never pass the canonical apply gate.
        const blocked = input.intent === 'telepathy' ? names.filter(name => protectedSections.has(name)) : [];
        if (blocked.length) {
            conflicts.push({ path: 'sections', kind: 'protected-by-intent', detail: 'Protected sections are not allowed for ' + input.intent + ': ' + blocked.join(', ') });
        }
        const base = {
            exportId: exportId || 'invalid-export',
            intent: input.intent,
            strategy: input.strategy,
            sourceSubjectId: safeText(source.instance_id, 256) ? String(source.instance_id) : undefined,
            sourceLineageId: safeText(source.hexis_lineage_id, 256) ? String(source.hexis_lineage_id) : undefined,
            sourceSchemaVersion: safeText(source.schema_version, 64) ? String(source.schema_version) : undefined,
            privacy: privacy ? {
                redactionPolicy: privacy.redaction_policy as HexisHmxPrivacy['redactionPolicy'],
                containsSensitiveContent: privacy.contains_sensitive_content as boolean,
                consentScope: privacy.consent_scope as HexisHmxPrivacy['consentScope'],
            } : undefined,
            capabilitiesDigest: capabilities ? digest(capabilities) : undefined,
            sectionCounts,
            protectedSections: names.filter(name => protectedSections.has(name)),
            conflicts: conflicts.slice(0, 256),
            stagedSections,
        };
        const stage: HexisHmxStage = {
            ...base,
            stagingId: randomUUID(),
            status: 'staged',
            createdAt: nowMs(),
            digest: digest(base),
            applicationAttempts: 0,
        };
        this.state.hmxStages.push(stage);
        this.state.hmxStages = this.state.hmxStages.slice(-32);
        this.state.metrics.hmxStaged += 1;
        return structuredClone(stage);
    }

    decideHmx(stagingId: string, decision: 'accept' | 'reject' | 'apply', context: { tick?: number } = {}): HexisHmxStage | null {
        const stage = this.state.hmxStages.find(row => row.stagingId === stagingId);
        if (!stage) return null;
        if (decision === 'accept') {
            if (stage.status !== 'staged' || stage.conflicts.length > 0) return structuredClone(stage);
            stage.status = 'accepted';
            this.state.metrics.hmxAccepted += 1;
            return structuredClone(stage);
        }
        if (decision === 'reject') {
            if (stage.status !== 'staged') return structuredClone(stage);
            stage.status = 'rejected';
            return structuredClone(stage);
        }
        if (decision !== 'apply') throw new Error('hmx-decision-invalid');
        if (stage.status === 'applied' && stage.application) return structuredClone(stage);
        if (stage.status !== 'accepted') throw new Error('hmx-accept-required-before-apply');
        if (stage.intent !== 'port' || stage.strategy !== 'additive') {
            throw new Error('hmx-canonical-apply-requires-port-additive');
        }
        if (stage.conflicts.length > 0 || !stage.sourceLineageId) {
            throw new Error('hmx-stage-not-canonically-applicable');
        }
        if (!stage.privacy || stage.privacy.redactionPolicy !== 'strict' ||
            stage.privacy.containsSensitiveContent !== false || stage.privacy.consentScope !== 'migration' ||
            !stage.capabilitiesDigest) {
            throw new Error('hmx-canonical-import-consent-required');
        }
        const base = {
            exportId: stage.exportId,
            intent: stage.intent,
            strategy: stage.strategy,
            sourceSubjectId: stage.sourceSubjectId,
            sourceLineageId: stage.sourceLineageId,
            sourceSchemaVersion: stage.sourceSchemaVersion,
            privacy: stage.privacy,
            capabilitiesDigest: stage.capabilitiesDigest,
            sectionCounts: stage.sectionCounts,
            protectedSections: stage.protectedSections,
            conflicts: stage.conflicts,
            stagedSections: stage.stagedSections,
        };
        if (digest(base) !== stage.digest) throw new Error('hmx-stage-digest-mismatch');
        if (!this.canonicalMemoryApply) throw new Error('hmx-canonical-memory-projector-unavailable');
        stage.applicationAttempts = Math.min(1000, Number(stage.applicationAttempts ?? 0) + 1);
        const receipt = this.canonicalMemoryApply(structuredClone(stage), Math.max(0, Math.floor(Number(context.tick) || 0)));
        if (!isHexisHmxApplyReceipt(receipt) || receipt.exportId !== stage.exportId ||
            receipt.sourceLineageId !== stage.sourceLineageId || receipt.stageId !== stage.stagingId ||
            receipt.stageDigest !== stage.digest ||
            receipt.importedCount + receipt.deduplicatedCount !== receipt.uniqueMemoryRecords) {
            throw new Error('hmx-apply-receipt-invalid');
        }
        stage.application = structuredClone(receipt);
        stage.status = 'applied';
        this.state.metrics.hmxApplied += 1;
        return structuredClone(stage);
    }
    getHmxStage(stagingId: string) {
        const stage = this.state.hmxStages.find(row => row.stagingId === stagingId);
        return stage ? structuredClone(stage) : null;
    }
    enqueueOutbox(input: {
        idempotencyKey: string;
        kind: string;
        channel: string;
        payload: unknown;
    }): HexisOutboxEntry | { ok: false; error: 'idempotency-key-required' | 'idempotency-key-conflict'; idempotencyKey: string; existingId?: string } {
        const idempotencyKey = String(input.idempotencyKey ?? '').trim();
        if (!idempotencyKey) return { ok: false, error: 'idempotency-key-required', idempotencyKey };
        const kind = String(input.kind), channel = String(input.channel);
        const requestDigest = digest({ kind, channel, payload: input.payload });
        // Include failed rows too: a timeout/failure may have happened after the remote
        // side effect, so silently creating a new row with the same key can duplicate it.
        const existing = this.state.outbox.find((x) => x.idempotencyKey === idempotencyKey);
        if (existing) {
            const existingDigest = digest({ kind: existing.kind, channel: existing.channel, payload: existing.payload });
            if (existingDigest === requestDigest) return structuredClone(existing);
            this.state.metrics.outboxIdempotencyConflicts += 1;
            return { ok: false, error: 'idempotency-key-conflict', idempotencyKey, existingId: existing.id };
        }
        const at = nowMs(); const entry: HexisOutboxEntry = { id: randomUUID(), idempotencyKey, kind, channel, payload: structuredClone(input.payload), status: 'pending', attempts: 0, createdAt: at, updatedAt: at }; this.state.outbox.push(entry); this.state.outbox = this.state.outbox.slice(-512); this.state.metrics.outboxQueued += 1; return structuredClone(entry);
    }
    claimOutbox(id: string): HexisOutboxEntry | null { const entry = this.state.outbox.find((x) => x.id === id && x.status === 'pending'); if (!entry)
        return null; entry.status = 'publishing'; entry.attempts += 1; entry.updatedAt = nowMs(); return structuredClone(entry); }
    ackOutbox(id: string, published: boolean, error?: string): HexisOutboxEntry | null { const entry = this.state.outbox.find((x) => x.id === id); if (!entry)
        return null; entry.status = published ? 'published' : (entry.attempts >= 3 ? 'failed' : 'pending'); entry.updatedAt = nowMs(); if (published) {
        entry.publishedAt = entry.updatedAt;
        this.state.metrics.outboxPublished += 1;
    } if (error)
        entry.lastError = String(error).slice(0, 500); return structuredClone(entry); }
    reclaimOutbox(maxAgeMs = 60000): number { const cutoff = nowMs() - Math.max(1000, maxAgeMs); let count = 0; for (const entry of this.state.outbox)
        if (entry.status === 'publishing' && entry.updatedAt < cutoff) {
            entry.status = entry.attempts >= 3 ? 'failed' : 'pending';
            entry.updatedAt = nowMs();
            count += 1;
        } return count; }
    grantConnectorPolicy(input: {
        connectorId: string;
        actionKind: string;
        contexts?: string[];
        allowAutonomous?: boolean;
        requiresApproval?: boolean;
        allowedTargets?: string[];
        deniedTargets?: string[];
        maxPerWindow?: number;
        windowMs?: number;
        expiresAt?: number;
    }): HexisConnectorPolicy {
        if (typeof input.connectorId !== 'string' || typeof input.actionKind !== 'string') {
            throw new TypeError('connector policy identity must be strings');
        }
        if (!isHexisPolicyText(input.connectorId, 128) || !isHexisPolicyText(input.actionKind, 128)) {
            throw new TypeError('connector policy identity must be non-empty and bounded');
        }
        if (input.allowAutonomous !== undefined && typeof input.allowAutonomous !== 'boolean') {
            throw new TypeError('allowAutonomous must be a boolean');
        }
        if (input.requiresApproval !== undefined && typeof input.requiresApproval !== 'boolean') {
            throw new TypeError('requiresApproval must be a boolean');
        }
        const contexts = normalizeHexisPolicyStringList(input.contexts ?? ['chat'], 32, 128);
        const allowedTargets = normalizeHexisPolicyStringList(input.allowedTargets ?? [], HEXIS_POLICY_MAX_TARGETS, 512);
        const deniedTargets = normalizeHexisPolicyStringList(input.deniedTargets ?? [], HEXIS_POLICY_MAX_TARGETS, 512);
        if (!contexts || contexts.length === 0) throw new TypeError('contexts must be a bounded non-empty string list');
        if (!allowedTargets || !deniedTargets) throw new TypeError('connector targets must be bounded string lists');
        if (input.maxPerWindow !== undefined &&
            (!Number.isSafeInteger(input.maxPerWindow) || input.maxPerWindow < 1 || input.maxPerWindow > HEXIS_POLICY_MAX_RATE)) {
            throw new TypeError('maxPerWindow must be a positive safe integer');
        }
        const windowMs = input.windowMs ?? 86400000;
        if (!Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > HEXIS_POLICY_MAX_WINDOW_MS) {
            throw new TypeError('windowMs must be a safe integer between 1000 and one year');
        }
        if (input.expiresAt !== undefined &&
            (!Number.isSafeInteger(input.expiresAt) || input.expiresAt < 0)) {
            throw new TypeError('expiresAt must be a non-negative safe integer');
        }
        const at = nowMs();
        const policy: HexisConnectorPolicy = {
            id: randomUUID(),
            connectorId: input.connectorId.trim().normalize('NFKC').toLowerCase(),
            actionKind: input.actionKind.trim().normalize('NFKC').toLowerCase(),
            contexts,
            allowAutonomous: input.allowAutonomous ?? false,
            requiresApproval: input.requiresApproval ?? true,
            allowedTargets,
            deniedTargets,
            ...(input.maxPerWindow === undefined ? {} : { maxPerWindow: input.maxPerWindow }),
            windowMs,
            ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
            windowStartedAt: at,
            windowCount: 0,
            status: 'active',
            grantedAt: at,
        };
        this.state.connectorPolicies.push(policy);
        this.state.connectorPolicies = this.state.connectorPolicies.slice(-256);
        return structuredClone(policy);
    }
    revokeConnectorPolicy(id: string): boolean { const policy = this.state.connectorPolicies.find((x) => x.id === id); if (!policy)
        return false; policy.status = 'revoked'; return true; }
    evaluateConnectorAction(input: {
        connectorId: string;
        actionKind: string;
        context: string;
        target?: string;
        confirmed?: boolean;
        autonomous?: boolean;
    }): {
        allowed: boolean;
        reason: string;
        policyId?: string;
    } { const now = nowMs(); const policy = this.state.connectorPolicies.find((p) => p.status === 'active' && p.connectorId === String(input.connectorId).toLowerCase() && p.actionKind === String(input.actionKind).toLowerCase() && p.contexts.includes(input.context) && (p.expiresAt === undefined || p.expiresAt > now)); if (!policy) {
        this.state.metrics.policyDenials += 1;
        return { allowed: false, reason: 'no-active-policy' };
    } const target = String(input.target ?? ''); if (policy.deniedTargets.includes(target)) {
        this.state.metrics.policyDenials += 1;
        return { allowed: false, reason: 'target-denied', policyId: policy.id };
    } if (policy.allowedTargets.length && !policy.allowedTargets.includes(target)) {
        this.state.metrics.policyDenials += 1;
        return { allowed: false, reason: 'target-not-allowlisted', policyId: policy.id };
    } if (input.autonomous && !policy.allowAutonomous) {
        this.state.metrics.policyDenials += 1;
        return { allowed: false, reason: 'autonomous-not-allowed', policyId: policy.id };
    } if (policy.requiresApproval && input.confirmed !== true) {
        this.state.metrics.policyDenials += 1;
        return { allowed: false, reason: 'per-action-approval-required', policyId: policy.id };
    } if (policy.maxPerWindow !== undefined) {
        if (now - policy.windowStartedAt >= policy.windowMs) {
            policy.windowStartedAt = now;
            policy.windowCount = 0;
        }
        if (policy.windowCount >= policy.maxPerWindow) {
            this.state.metrics.policyDenials += 1;
            return { allowed: false, reason: 'policy-rate-limit', policyId: policy.id };
        }
    } if (policy.maxPerWindow !== undefined)
        policy.windowCount += 1; this.state.metrics.policyAllows += 1; return { allowed: true, reason: 'allowed', policyId: policy.id }; }
    planExecution(input: {
        actionKind: string;
        requestedPlacement?: HexisExecutionPlacement;
        risk01?: number;
        rationale?: string;
        requiresApproval?: boolean;
    }): HexisExecutionPlan { const risk01 = clamp(input.risk01 ?? 0); const requested = input.requestedPlacement ?? 'local'; const resolved = risk01 >= 0.8 ? 'sandbox' : requested; const plan: HexisExecutionPlan = { id: randomUUID(), actionKind: String(input.actionKind), requestedPlacement: requested, resolvedPlacement: resolved, risk01, requiresApproval: input.requiresApproval ?? risk01 >= 0.6, rationale: String(input.rationale ?? 'explicit execution placement from Hexis adaptation'), at: nowMs() }; this.state.executions.push(plan); this.state.executions = this.state.executions.slice(-512); this.state.metrics.executionPlans += 1; return structuredClone(plan); }
}
