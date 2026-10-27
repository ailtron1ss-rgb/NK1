import { randomUUID } from 'node:crypto';
import { sha256Stable } from '../../core/StableSerialization.ts';
import { isValidHmxApplyReceipt } from './HexisCanonicalMemoryProjector.mjs';
import { computeHmxStageDigest, isValidHmxStageDigest, refreshHmxStageLifecycleDigest } from './HexisStageIntegrity.mjs';
const hasHmxControlCharacters = (value: string): boolean => {
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code <= 31 || (code >= 127 && code <= 159)) return true;
    }
    return false;
};
export type HexisEvidenceStance = 'supports' | 'contradicts';
export type HexisReviewDecision = 'approve' | 'correct' | 'forget';
export type HexisHmxIntent = 'port' | 'duplicate' | 'telepathy' | 'analysis';
export type HexisHmxDecision = 'accept' | 'reject' | 'apply';
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
export interface HexisCanonicalBeliefProjection {
    auditId: string;
    memoryId: string;
    priorConfidence01: number;
    posteriorConfidence01: number;
    trust01: number;
    evidenceTrust01: number;
    at: number;
    stance: HexisEvidenceStance;
    evidenceKey: string;
}
export type HexisCanonicalBeliefProjectionResult = 'projected' | 'unavailable' | 'duplicate';
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
    /** Canonical NK1 memory/revision materialized by the integrated review decision. */
    canonicalMemoryId?: string;
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
    attempt: number;
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
export interface HexisHmxStage {
    stagingId: string;
    exportId: string;
    intent: HexisHmxIntent;
    strategy: HexisHmxStrategy;
    sourceSubjectId?: string;
    sourceLineageId?: string;
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
    /** Independent seal for lifecycle/status and apply-attempt replay protection. */
    lifecycleDigest: string;
    stagedSections: Record<string, unknown>;
    applicationAttempts: number;
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
export interface HexisGoalRelationshipReceipt {
    sourceStageFound: boolean;
    candidateRelationships: number;
    projected: number;
    deferred: number;
    semanticEdgeIds: string[];
    at: number;
}
export interface HexisGoalProposal {
    id: string;
    stageId: string;
    exportId: string;
    sourceLineageId: string;
    sourceRef: string;
    title: string;
    description: string;
    importance: number;
    urgency: number;
    confidence: number;
    status: 'pending' | 'approved' | 'rejected' | 'materialized';
    canonicalGoalId?: string;
    goalRelationshipReceipt?: HexisGoalRelationshipReceipt;
    createdAt: number;
    decidedAt?: number;
    decisionReason?: string;
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
    goalProposals: HexisGoalProposal[];
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
        hmxGoalProposalsCreated: number;
        hmxGoalProposalsApproved: number;
        hmxGoalProposalsRejected: number;
        hmxGoalProposalsActivated: number;
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
const protectedSections = new Set(['identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals']);
const HMX_INTENTS = new Set<HexisHmxIntent>(['port', 'duplicate', 'telepathy', 'analysis']);
const HMX_STRATEGIES = new Set<HexisHmxStrategy>(['additive', 'authoritative', 'deliberative', 'analysis_only']);
const HMX_SECTION_NAMES = new Set([
    'memories', 'episodes', 'relationships', 'narrative', 'identity', 'worldview', 'goals',
    'drives', 'emotional_triggers', 'clusters', 'in_flight_work', 'audit_records', 'raw_units', 'config',
]);
const HMX_ARRAY_SECTIONS = new Set([
    'memories', 'episodes', 'relationships', 'identity', 'worldview', 'goals', 'drives',
    'emotional_triggers', 'clusters', 'raw_units',
]);
const HMX_OBJECT_SECTIONS = new Set(['narrative', 'in_flight_work', 'audit_records', 'config']);
const HMX_MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const HMX_MAX_SECTION_RECORDS = 256;
const HMX_MAX_TOTAL_RECORDS = 1_024;
const isHmxRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const isHmxText = (value: unknown, max = 256): value is string =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value);
const HEXIS_POLICY_MAX_ENTRIES = 256;
const HEXIS_POLICY_MAX_TARGETS = 256;
const HEXIS_POLICY_MAX_WINDOW_MS = 31_536_000_000;
const HEXIS_POLICY_MAX_RATE = 1_000_000;

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
        if (!isHmxText(item, maxStringLength)) return null;
        const normalized = (lowercase ? item.trim().toLowerCase() : item.trim()).normalize('NFKC');
        if (!normalized) return null;
        if (!seen.has(normalized)) {
            seen.add(normalized);
            result.push(normalized);
        }
    }
    return result;
}

/** Persisted connector policy is a security boundary: invalid rows must never
 * survive restore with NaN/Infinity counters or malformed matching constraints.
 */
function normalizeHexisConnectorPolicy(value: unknown): HexisConnectorPolicy | null {
    if (!isHmxRecord(value)) return null;
    const row = value;
    if (!isHmxText(row.id, 256) || !isHmxText(row.connectorId, 128) ||
        !isHmxText(row.actionKind, 128) ||
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
    // Duplicate policy IDs are ambiguous for revocation and should not be runnable.
    return candidates.filter((policy) => counts.get(policy.id) === 1);
}

export function defaultHexisAdaptationState(): HexisAdaptationState {
    return { version: 1, source: { name: 'Hexis-main', mode: 'canonical-adapter', integratedAt: '2026-10-08' }, beliefs: [], beliefAudit: [], temporal: [], learningReviews: [], retentionProposals: [], fidelityReceipts: [], hmxStages: [], goalProposals: [], outbox: [], connectorPolicies: [], executions: [], metrics: { beliefRevisions: 0, duplicateEvidence: 0, temporalQueries: 0, reviewsCreated: 0, reviewDecisions: 0, retentionProposals: 0, hmxStaged: 0, hmxAccepted: 0, hmxApplied: 0, hmxGoalProposalsCreated: 0, hmxGoalProposalsApproved: 0, hmxGoalProposalsRejected: 0, hmxGoalProposalsActivated: 0, outboxQueued: 0, outboxPublished: 0, outboxIdempotencyConflicts: 0, policyAllows: 0, policyDenials: 0, executionPlans: 0 } };
}
export class HexisAdaptationFabric {
    private state = defaultHexisAdaptationState();
    private mutationRevision = 0;
    private readonly mutationJournal: Array<{ revision: number; ownerToken: string | null; undo?: () => boolean; undone?: boolean }> = [];
    private recordScopedMutation(ownerToken?: string, undo?: () => boolean): void {
        const token = typeof ownerToken === 'string' && ownerToken ? ownerToken : null;
        this.mutationJournal.push({
            revision: ++this.mutationRevision,
            ownerToken: token,
            ...(token && undo ? { undo } : {}),
            undone: false,
        });
        if (this.mutationJournal.length > 8192) this.mutationJournal.splice(0, this.mutationJournal.length - 8192);
    }
    mutationCheckpoint(): number { return this.mutationRevision; }
    private hasForeignMutationSince(checkpoint: number, ownerToken: string): boolean {
        if (!Number.isSafeInteger(checkpoint) || checkpoint < 0 || checkpoint > this.mutationRevision) return true;
        const earliest = this.mutationJournal[0]?.revision;
        // A lost journal window is ambiguous; never restore over an unknown mutation.
        if (earliest !== undefined && checkpoint < earliest - 1) return true;
        return this.mutationJournal.some(entry => entry.revision > checkpoint && entry.ownerToken !== ownerToken);
    }
    rollbackOwnedMutations(checkpoint: number, ownerToken: string): { rolledBack: number; conflicts: number; historyLost: boolean } {
        const earliest = this.mutationJournal[0]?.revision;
        const invalid = !Number.isSafeInteger(checkpoint) || checkpoint < 0 || checkpoint > this.mutationRevision;
        const historyLost = invalid || (earliest !== undefined && checkpoint < earliest - 1);
        let rolledBack = 0, conflicts = historyLost ? 1 : 0;
        const owned = this.mutationJournal
            .filter(entry => Number.isSafeInteger(checkpoint) && entry.revision > checkpoint && entry.ownerToken === ownerToken && !entry.undone)
            .reverse();
        for (const entry of owned) {
            entry.undone = true;
            try {
                if (entry.undo && entry.undo()) rolledBack++;
                else conflicts++;
            } catch { conflicts++; }
        }
        return { rolledBack, conflicts, historyLost };
    }
    restoreIfUnchanged(raw: Partial<HexisAdaptationState> | null | undefined, checkpoint: number, ownerToken: string): boolean {
        if (this.hasForeignMutationSince(checkpoint, ownerToken)) return false;
        this.restore(raw, ownerToken);
        return true;
    }
    private canonicalMemoryApply?: (stage: HexisHmxStage) => HexisHmxApplyReceipt;
    private canonicalBeliefProjection?: (projection: HexisCanonicalBeliefProjection) => HexisCanonicalBeliefProjectionResult;
    restore(raw?: Partial<HexisAdaptationState> | null, ownerToken?: string): void {
        const defaults = defaultHexisAdaptationState();
        const value = raw ?? {};
        const normalizedPolicies = normalizeHexisConnectorPolicies(value.connectorPolicies);
        this.state = {
            ...defaults, ...value,
            source: { ...defaults.source, ...(value.source ?? {}) },
            beliefs: Array.isArray(value.beliefs) ? value.beliefs.slice(-1024) : [],
            beliefAudit: Array.isArray(value.beliefAudit) ? value.beliefAudit.slice(-2048) : [],
            temporal: Array.isArray(value.temporal) ? value.temporal.slice(-4096) : [],
            learningReviews: Array.isArray(value.learningReviews) ? value.learningReviews.slice(-96) : [],
            retentionProposals: Array.isArray(value.retentionProposals) ? value.retentionProposals.slice(-512) : [],
            fidelityReceipts: Array.isArray(value.fidelityReceipts) ? value.fidelityReceipts.slice(-512) : [],
            hmxStages: Array.isArray(value.hmxStages)
                ? value.hmxStages.slice(-32).map((stage: any) => ({
                    ...stage,
                    stagedSections: stage?.stagedSections && typeof stage.stagedSections === 'object' ? stage.stagedSections : {},
                  }))
                : [],
            goalProposals: Array.isArray((value as any).goalProposals) ? (value as any).goalProposals.slice(-256) : [],
            outbox: Array.isArray(value.outbox) ? value.outbox.slice(-512) : [],
            connectorPolicies: normalizedPolicies,
            executions: Array.isArray(value.executions) ? value.executions.slice(-512) : [],
            metrics: { ...defaults.metrics, ...(value.metrics ?? {}) },
        };
        this.recordScopedMutation(ownerToken);
    }
    snapshot(): HexisAdaptationState { return structuredClone(this.state); }
    bindCanonicalMemoryApply(handler: (stage: HexisHmxStage) => HexisHmxApplyReceipt): void {
        if (typeof handler !== 'function') throw new TypeError('canonical-memory-apply-handler-required');
        this.canonicalMemoryApply = handler;
    }
    bindCanonicalBeliefProjection(handler: (projection: HexisCanonicalBeliefProjection) => HexisCanonicalBeliefProjectionResult): void {
        if (typeof handler !== 'function') throw new TypeError('canonical-belief-projection-handler-required');
        this.canonicalBeliefProjection = handler;
    }
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
                goalProposals: this.state.goalProposals.length,
                pendingGoalProposals: this.state.goalProposals.filter((proposal) => proposal.status === 'pending').length,
                approvedGoalProposals: this.state.goalProposals.filter((proposal) => proposal.status === 'approved').length,
                materializedGoalProposals: this.state.goalProposals.filter((proposal) => proposal.status === 'materialized').length,
                pendingOutbox,
                connectorPolicies: activePolicies,
                executions: this.state.executions.length,
            },
            metrics: this.state.metrics,
        };
    }
    removeBeliefProjection(memoryId: string, ownerToken?: string): boolean {
        const id = String(memoryId);
        const removed = this.state.beliefs.filter(belief => belief.memoryId === id).map(belief => structuredClone(belief));
        if (!removed.length) return false;
        this.state.beliefs = this.state.beliefs.filter(belief => belief.memoryId !== id);
        this.recordScopedMutation(ownerToken, () => {
            const current = this.state.beliefs.filter(belief => belief.memoryId === id);
            if (current.length) {
                return current.length === removed.length &&
                    current.every(row => removed.some(old => JSON.stringify(old) === JSON.stringify(row)));
            }
            this.state.beliefs.push(...removed.map(row => structuredClone(row)));
            this.state.beliefs = this.state.beliefs.slice(-1024);
            return true;
        });
        return true;
    }
    registerOrUpdateBelief(input: {
        memoryId: string;
        confidence01: number;
        trust01?: number;
        at?: number;
    }, ownerToken?: string): HexisBeliefState {
        const id = String(input.memoryId);
        const existing = this.state.beliefs.find((row) => row.memoryId === id);
        if (existing) {
            // Re-import is not independent evidence. It may only tighten a stale mirror
            // against the current canonical memory; it must never raise posterior trust.
            const nextConfidence01 = Math.min(clamp(existing.confidence01), clamp(input.confidence01));
            const nextTrust01 = input.trust01 === undefined
                ? clamp(existing.trust01)
                : Math.min(clamp(existing.trust01), clamp(input.trust01));
            if (nextConfidence01 === existing.confidence01 && nextTrust01 === existing.trust01) {
                return structuredClone(existing);
            }
            const before = structuredClone(existing);
            existing.confidence01 = nextConfidence01;
            existing.trust01 = nextTrust01;
            existing.updatedAt = Number.isFinite(input.at) ? Number(input.at) : nowMs();
            const expected = structuredClone(existing);
            this.recordScopedMutation(ownerToken, () => {
                const current = this.state.beliefs.find((row) => row.memoryId === id);
                if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
                Object.assign(current, before);
                return true;
            });
            return structuredClone(existing);
        }
        const evicted = this.state.beliefs.length >= 1024
            ? structuredClone(this.state.beliefs.slice(0, this.state.beliefs.length - 1023))
            : [];
        const created: HexisBeliefState = { memoryId: id, confidence01: clamp(input.confidence01), trust01: clamp(input.trust01 ?? 0.5), sourceKeys: [], contradictingSourceKeys: [], updatedAt: Number.isFinite(input.at) ? Number(input.at) : nowMs() };
        this.state.beliefs.push(created);
        this.state.beliefs = this.state.beliefs.slice(-1024);
        const expected = structuredClone(created);
        this.recordScopedMutation(ownerToken, () => {
            const current = this.state.beliefs.find(row => row.memoryId === id);
            if (!current || JSON.stringify(current) !== JSON.stringify(expected)) return false;
            for (const prior of evicted) {
                const duplicate = this.state.beliefs.find(row => row.memoryId === prior.memoryId);
                if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(prior)) return false;
            }
            const next = this.state.beliefs.filter(row => row.memoryId !== id);
            for (const prior of evicted) {
                if (!next.some(row => row.memoryId === prior.memoryId)) next.push(structuredClone(prior));
            }
            this.state.beliefs = next;
            return true;
        });
        return structuredClone(created);
    }
    reviseBelief(input: {
        memoryId: string;
        confidence01: number;
        trust01?: number;
        evidence: HexisEvidenceSource;
        stance: HexisEvidenceStance;
        context?: string;
        at?: number;
        protectedBelief?: boolean;
    }): HexisBeliefRevisionAudit {
        const at = Number.isFinite(input.at) ? Number(input.at) : nowMs();
        const memoryId = String(input.memoryId);
        const existingIndex = this.state.beliefs.findIndex((candidate) => candidate.memoryId === memoryId);
        const stored = existingIndex >= 0 ? structuredClone(this.state.beliefs[existingIndex]) : null;
        const priorBelief: HexisBeliefState = stored ?? {
            memoryId,
            confidence01: clamp(input.confidence01),
            trust01: clamp(input.trust01 ?? 0.5),
            sourceKeys: [],
            contradictingSourceKeys: [],
            updatedAt: at,
        };
        const key = sourceKey(input.evidence);
        // Clone all caller-owned evidence before any canonical write can occur.
        const evidenceSnapshot = structuredClone(input.evidence);
        let independent = !priorBelief.sourceKeys.includes(key) && !priorBelief.contradictingSourceKeys.includes(key);
        const evidenceTrust01 = clamp(input.evidence.trust01 ?? 0.5);
        const priorConfidence01 = clamp(priorBelief.confidence01);
        const priorTrust01 = clamp(priorBelief.trust01);
        let posteriorConfidence01 = priorConfidence01;
        let applied = false;
        let reason = 'applied';

        if (!independent) {
            reason = 'duplicate_source';
        } else if (input.protectedBelief && input.stance === 'contradicts') {
            reason = 'protected';
        } else if (input.stance === 'supports') {
            posteriorConfidence01 = Math.min(0.99, priorConfidence01 + (1 - priorConfidence01) * 0.35 * evidenceTrust01);
            applied = true;
        } else {
            posteriorConfidence01 = Math.max(0.05, priorConfidence01 * (1 - 0.35 * evidenceTrust01));
            applied = true;
        }

        const auditId = randomUUID();
        let projectionResult: HexisCanonicalBeliefProjectionResult | undefined;
        // Project before changing local beliefs/audits. A canonical failure therefore
        // cannot leave a belief posterior committed without its corresponding memory update.
        if (applied && this.canonicalBeliefProjection) {
            projectionResult = this.canonicalBeliefProjection({
                auditId,
                memoryId,
                priorConfidence01,
                posteriorConfidence01,
                trust01: clamp(Math.max(priorTrust01, evidenceTrust01 * 0.5)),
                evidenceTrust01,
                at,
                stance: input.stance,
                evidenceKey: key,
            });
            if (projectionResult === 'unavailable') throw new Error('hexis-canonical-belief-projection-unavailable');
            if (projectionResult === 'duplicate') {
                // The canonical memory may outlive/reset the Hexis ledger. Its lineage
                // tombstone remains authoritative against cross-store replays.
                independent = false;
                applied = false;
                reason = 'duplicate_source';
                posteriorConfidence01 = priorConfidence01;
            }
        }

        const sourceKeys = [...priorBelief.sourceKeys];
        const contradictingSourceKeys = [...priorBelief.contradictingSourceKeys];
        // If the canonical memory detected a cross-ledger replay, remember the key in
        // Hexis too so subsequent calls take the fast duplicate path.
        if (independent || projectionResult === 'duplicate') {
            if (input.stance === 'supports') sourceKeys.push(key);
            else contradictingSourceKeys.push(key);
        }
        const posteriorTrust01 = clamp(Math.max(priorTrust01, evidenceTrust01 * 0.5));
        const nextBelief: HexisBeliefState = {
            ...priorBelief,
            confidence01: applied ? posteriorConfidence01 : priorConfidence01,
            trust01: posteriorTrust01,
            sourceKeys: [...new Set(sourceKeys)].slice(-256),
            contradictingSourceKeys: [...new Set(contradictingSourceKeys)].slice(-256),
            updatedAt: at,
        };
        const base = {
            id: auditId,
            memoryId,
            stance: input.stance,
            evidence: evidenceSnapshot,
            priorConfidence01,
            posteriorConfidence01,
            priorTrust01,
            posteriorTrust01,
            independent,
            applied,
            reason,
            policy: 'residual_v1' as const,
            context: input.context,
            at,
        };
        const audit: HexisBeliefRevisionAudit = { ...base, digest: digest(base) };

        if (!independent) this.state.metrics.duplicateEvidence += 1;
        if (existingIndex >= 0) this.state.beliefs[existingIndex] = nextBelief;
        else this.state.beliefs.push(nextBelief);
        this.state.beliefs = this.state.beliefs.slice(-1024);
        this.state.beliefAudit.push(audit);
        this.state.beliefAudit = this.state.beliefAudit.slice(-2048);
        this.state.metrics.beliefRevisions += 1;
        this.recordScopedMutation();
        return structuredClone(audit);
    }
    recordTemporalAssertion(input: {
        memoryId: string;
        summary: string;
        confidence01: number;
        validFrom: number;
        source?: string;
        value?: unknown;
    }, ownerToken?: string): HexisTemporalAssertion { const existing = this.state.temporal.find((x) => x.memoryId === input.memoryId && x.validUntil === null); const existingBefore = existing ? structuredClone(existing) : null; const at = nowMs(); if (existing)
        existing.validUntil = Math.max(existing.validFrom, Number(input.validFrom)); const existingAfter = existing ? structuredClone(existing) : null; const created: HexisTemporalAssertion = { id: randomUUID(), memoryId: String(input.memoryId), valueHash: digest(input.value ?? input.summary), summary: String(input.summary).slice(0, 2000), confidence01: clamp(input.confidence01), validFrom: Number(input.validFrom), validUntil: null, supersedesId: existing?.id, source: String(input.source ?? 'canonical-memory'), at }; this.state.temporal.push(created); this.state.temporal = this.state.temporal.slice(-4096); const expectedCreated = structuredClone(created); this.recordScopedMutation(ownerToken, () => { const currentCreated = this.state.temporal.find(row => row.id === created.id); if (currentCreated && JSON.stringify(currentCreated) !== JSON.stringify(expectedCreated)) return false; let currentPrior: HexisTemporalAssertion | undefined; if (existingBefore) { currentPrior = this.state.temporal.find(row => row.id === existingBefore.id); if (!currentPrior || JSON.stringify(currentPrior) !== JSON.stringify(existingAfter)) return false; } if (currentCreated) this.state.temporal = this.state.temporal.filter(row => row.id !== created.id); if (existingBefore && currentPrior) { const index = this.state.temporal.findIndex(row => row.id === existingBefore.id); if (index < 0) return false; this.state.temporal[index] = structuredClone(existingBefore); } return true; }); return structuredClone(created); }
    temporalAt(memoryId: string, at: number): HexisTemporalAssertion | null { this.recordScopedMutation(); this.state.metrics.temporalQueries += 1; const rows = this.state.temporal.filter((x) => x.memoryId === memoryId && x.validFrom <= at && (x.validUntil === null || at < x.validUntil)).sort((a, b) => b.validFrom - a.validFrom); return rows[0] ? structuredClone(rows[0]) : null; }
    temporalDiff(memoryId: string, fromAt: number, toAt: number) { this.recordScopedMutation(); this.state.metrics.temporalQueries += 1; const from = this.temporalAt(memoryId, fromAt); const to = this.temporalAt(memoryId, toAt); return { memoryId, from, to, changed: (from?.valueHash ?? null) !== (to?.valueHash ?? null) }; }
    createLearningReview(input: {
        periodStart: number;
        periodEnd: number;
        summary: string;
        items: Array<Omit<HexisLearningReviewItem, 'id' | 'status' | 'createdAt'>>;
    }): HexisLearningReview { this.recordScopedMutation(); const createdAt = nowMs(); const review: HexisLearningReview = { id: randomUUID(), periodStart: input.periodStart, periodEnd: input.periodEnd, summary: String(input.summary).slice(0, 2000), status: 'pending', items: input.items.slice(0, 50).map((item) => ({ ...item, id: randomUUID(), status: 'pending', createdAt })), createdAt }; this.state.learningReviews.push(review); this.state.learningReviews = this.state.learningReviews.slice(-96); this.state.metrics.reviewsCreated += 1; return structuredClone(review); }
    decideLearningReview(reviewId: string, itemId: string, decision: HexisReviewDecision, correction?: string, canonicalMemoryId?: string): HexisLearningReviewItem | null { this.recordScopedMutation(); const review = this.state.learningReviews.find((x) => x.id === reviewId); const item = review?.items.find((x) => x.id === itemId); if (!item || item.status !== 'pending' || !['approve', 'correct', 'forget'].includes(decision) || (decision === 'correct' && !String(correction ?? '').trim()))
        return null; item.status = decision === 'approve' ? 'approved' : decision === 'correct' ? 'corrected' : 'forgotten'; if (correction)
        item.correction = String(correction).slice(0, 2000); if (canonicalMemoryId) item.canonicalMemoryId = String(canonicalMemoryId).slice(0, 160); item.decidedAt = nowMs(); if (review && review.items.every((x) => x.status !== 'pending')) {
        review.status = 'completed';
        review.completedAt = item.decidedAt;
    } this.state.metrics.reviewDecisions += 1; return structuredClone(item); }
    setRetentionStatus(proposalId: string, status: 'accepted' | 'rejected'): HexisRetentionProposal | null { this.recordScopedMutation(); const proposal = this.state.retentionProposals.find((x) => x.id === proposalId); if (!proposal)
        return null; proposal.status = status; return structuredClone(proposal); }
    proposeRetention(input: {
        memoryId: string;
        action: 'compress' | 'archive' | 'forget';
        sourceBytes: number;
        projectedBytes: number;
        fidelity01: number;
        regret01: number;
        reason: string;
    }): HexisRetentionProposal { this.recordScopedMutation(); const proposal: HexisRetentionProposal = { id: randomUUID(), memoryId: String(input.memoryId), action: input.action, reason: String(input.reason).slice(0, 500), sourceBytes: Math.max(0, Math.floor(input.sourceBytes)), projectedBytes: Math.max(0, Math.floor(input.projectedBytes)), estimatedFidelity01: clamp(input.fidelity01), estimatedRegret01: clamp(input.regret01), status: 'proposed', createdAt: nowMs() }; this.state.retentionProposals.push(proposal); this.state.retentionProposals = this.state.retentionProposals.slice(-512); this.state.metrics.retentionProposals += 1; return structuredClone(proposal); }
    recordFidelityReceipt(input: {
        operation: HexisFidelityReceipt['operation'];
        sourceCount: number;
        retainedCount: number;
        sourceBytes: number;
        retainedBytes: number;
        fidelity01: number;
        regret01: number;
        at?: number;
    }): HexisFidelityReceipt { this.recordScopedMutation(); const base = { operation: input.operation, sourceCount: Math.max(0, Math.floor(input.sourceCount)), retainedCount: Math.max(0, Math.floor(input.retainedCount)), sourceBytes: Math.max(0, Math.floor(input.sourceBytes)), retainedBytes: Math.max(0, Math.floor(input.retainedBytes)), fidelity01: clamp(input.fidelity01), regret01: clamp(input.regret01), at: Number.isFinite(input.at) ? Number(input.at) : nowMs() }; const receipt: HexisFidelityReceipt = { ...base, id: randomUUID(), digest: digest(base) }; this.state.fidelityReceipts.push(receipt); this.state.fidelityReceipts = this.state.fidelityReceipts.slice(-512); return structuredClone(receipt); }
    stageHmx(input: {
        document: unknown;
        intent: HexisHmxIntent;
        strategy: HexisHmxStrategy;
    }): HexisHmxStage {
        this.recordScopedMutation();
        const conflicts: HexisHmxStage['conflicts'] = [];
        let document: Record<string, unknown> = {};
        try {
            const encoded = JSON.stringify(input?.document);
            if (typeof encoded !== 'string') throw new Error('document is not JSON-serializable');
            if (new TextEncoder().encode(encoded).byteLength > HMX_MAX_DOCUMENT_BYTES) {
                conflicts.push({
                    path: '$',
                    kind: 'size-limit',
                    detail: `HMX document exceeds the ${HMX_MAX_DOCUMENT_BYTES}-byte size limit`,
                });
            } else {
                const parsed: unknown = JSON.parse(encoded);
                if (!isHmxRecord(parsed)) {
                    conflicts.push({ path: '$', kind: 'schema', detail: 'HMX document must be a JSON object' });
                } else {
                    document = parsed;
                }
            }
        } catch {
            conflicts.push({ path: '$', kind: 'schema', detail: 'HMX document must be valid JSON data' });
        }

        const intent = HMX_INTENTS.has(input.intent) ? input.intent : 'analysis';
        const strategy = HMX_STRATEGIES.has(input.strategy) ? input.strategy : 'analysis_only';
        if (!HMX_INTENTS.has(input.intent)) {
            conflicts.push({ path: 'intent', kind: 'schema', detail: 'unknown import intent; expected a supported HMX intent' });
        }
        if (!HMX_STRATEGIES.has(input.strategy)) {
            conflicts.push({ path: 'strategy', kind: 'schema', detail: 'unknown import strategy; expected a supported HMX strategy' });
        }

        const version = document.hmx_version;
        const versionMatch = typeof version === 'string' ? /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version) : null;
        if (!versionMatch) {
            conflicts.push({ path: 'hmx_version', kind: 'schema', detail: 'hmx_version is required and must be a numeric major.minor version' });
        } else if (versionMatch[1] !== '1') {
            conflicts.push({ path: 'hmx_version', kind: 'unsupported-major', detail: `Hexis adapter accepts HMX 1.x, got ${version}` });
        }

        const exportId = document.export_id;
        if (typeof exportId !== 'string' || !/^exp_[a-f0-9]{16}$/.test(exportId)) {
            conflicts.push({ path: 'export_id', kind: 'schema', detail: 'export_id must match the HMX 1.x exp_<16 lowercase hex> format' });
        }
        if (!HMX_INTENTS.has(document.export_intent as HexisHmxIntent)) {
            conflicts.push({ path: 'export_intent', kind: 'schema', detail: 'export_intent must be port, duplicate, telepathy, or analysis' });
        }
        if (typeof document.exported_at !== 'string' || !Number.isFinite(Date.parse(document.exported_at))) {
            conflicts.push({ path: 'exported_at', kind: 'schema', detail: 'exported_at must be a parseable date-time string' });
        }
        const sourceValue = document.source;
        const source: Record<string, unknown> = isHmxRecord(sourceValue) ? sourceValue : {};
        const sourceRequired = ['instance_id', 'schema_version', 'embedding_model', 'hexis_lineage_id'];
        if (!isHmxRecord(sourceValue) ||
            sourceRequired.some((field) => !isHmxText(source[field], 512)) ||
            !Number.isSafeInteger(source.embedding_dimension) ||
            Number(source.embedding_dimension) < 1) {
            conflicts.push({
                path: 'source',
                kind: 'schema',
                detail: 'source must carry instance_id, schema_version, embedding_model, positive embedding_dimension, and hexis_lineage_id',
            });
        }

        const rawSections = document.sections;
        const sections = isHmxRecord(rawSections) ? rawSections : {};
        if (!Object.keys(sections).length) {
            conflicts.push({ path: 'sections', kind: 'schema', detail: 'sections must be a non-empty object' });
        }
        const names = Object.keys(sections);
        const stagedSections: Record<string, unknown> = {};
        const sectionCounts: Record<string, number> = {};
        let totalRecords = 0;

        for (const [name, value] of Object.entries(sections)) {
            if (!HMX_SECTION_NAMES.has(name)) {
                conflicts.push({ path: `sections.${name}`, kind: 'unknown-section', detail: 'section is not supported by this NK1 HMX adapter and will not be imported' });
                continue;
            }
            if (HMX_ARRAY_SECTIONS.has(name)) {
                if (!Array.isArray(value)) {
                    conflicts.push({ path: `sections.${name}`, kind: 'schema', detail: 'section must be an array of records' });
                    continue;
                }
                const remainingTotal = Math.max(0, HMX_MAX_TOTAL_RECORDS - totalRecords);
                // Never stage a truncated prefix of a section. Conflicts block acceptance,
                // but retaining partial payload beside the original count is ambiguous.
                if (value.length > HMX_MAX_SECTION_RECORDS) {
                    conflicts.push({
                        path: `sections.${name}`,
                        kind: 'size-limit',
                        detail: `section exceeds the ${HMX_MAX_SECTION_RECORDS}-record staging limit; the entire section was omitted`,
                    });
                    sectionCounts[name] = value.length;
                    continue;
                }
                if (value.length > remainingTotal) {
                    conflicts.push({
                        path: `sections.${name}`,
                        kind: 'size-limit',
                        detail: `section exceeds the remaining aggregate ${HMX_MAX_TOTAL_RECORDS}-record staging budget; the entire section was omitted`,
                    });
                    sectionCounts[name] = value.length;
                    continue;
                }
                if (value.some((record) => !isHmxRecord(record))) {
                    conflicts.push({ path: `sections.${name}`, kind: 'schema', detail: 'each section entry must be a JSON object; the entire section was omitted' });
                    sectionCounts[name] = value.length;
                    continue;
                }
                const safeRows = value;
                const sectionConflictStart = conflicts.length;
                if (name === 'memories') {
                    safeRows.forEach((record, index) => {
                        const ref = record.ref;
                        const type = record.type;
                        const content = record.content;
                        if (typeof ref !== 'string' || !/^exp_[a-f0-9]{16}:.+$/.test(ref)) {
                            conflicts.push({ path: `sections.memories[${index}].ref`, kind: 'schema', detail: 'memory ref must use the HMX exp_<16 lowercase hex>:<record> namespace' });
                        } else if (typeof exportId === 'string' && /^exp_[a-f0-9]{16}$/.test(exportId) && !ref.startsWith(exportId + ':')) {
                            conflicts.push({ path: `sections.memories[${index}].ref`, kind: 'reference-export-mismatch', detail: 'memory ref belongs to a different HMX export namespace' });
                        }
                        if (!isHmxText(type, 128)) {
                            conflicts.push({ path: `sections.memories[${index}].type`, kind: 'schema', detail: 'memory type must be a non-empty string' });
                        }
                        if (!isHmxText(content, 250000)) {
                            conflicts.push({ path: `sections.memories[${index}].content`, kind: 'schema', detail: 'memory content must be a non-empty string within the per-record limit' });
                        }
                        if (record.status !== undefined && record.status !== null &&
                            (typeof record.status !== 'string' || record.status.length > 64 ||
                             (typeof record.status === 'string' && hasHmxControlCharacters(record.status)))) {
                            conflicts.push({ path: `sections.memories[${index}].status`, kind: 'schema', detail: 'memory status, when supplied, must be a bounded string without control characters' });
                        }
                        if (record.metadata !== undefined && !isHmxRecord(record.metadata)) {
                            conflicts.push({ path: `sections.memories[${index}].metadata`, kind: 'schema', detail: 'memory metadata, when supplied, must be an object' });
                        }
                        if (record.provenance !== undefined && record.provenance !== null && !isHmxRecord(record.provenance)) {
                            conflicts.push({ path: `sections.memories[${index}].provenance`, kind: 'schema', detail: 'memory provenance, when supplied, must be an object or null' });
                        }
                    });
                } else if (name === 'relationships') {
                    safeRows.forEach((record, index) => {
                        const sourceRef = record.source_ref;
                        const targetRef = record.target_ref;
                        const edgeType = record.edge_type;
                        const exportIdIsValid = typeof exportId === 'string' && /^exp_[a-f0-9]{16}$/.test(exportId);
                        for (const [field, candidate] of [['source_ref', sourceRef], ['target_ref', targetRef]] as const) {
                            if (!isHmxText(candidate, 512) || !/^exp_[a-f0-9]{16}:.+$/.test(candidate)) {
                                conflicts.push({
                                    path: `sections.relationships[${index}].${field}`,
                                    kind: 'schema',
                                    detail: `relationship ${field} must be an export-scoped HMX reference`,
                                });
                            } else if (exportIdIsValid && !candidate.startsWith(exportId + ':')) {
                                conflicts.push({
                                    path: `sections.relationships[${index}].${field}`,
                                    kind: 'reference-export-mismatch',
                                    detail: `relationship ${field} belongs to a different HMX export namespace`,
                                });
                            }
                        }
                        if (!isHmxText(edgeType, 128)) {
                            conflicts.push({
                                path: `sections.relationships[${index}].edge_type`,
                                kind: 'schema',
                                detail: 'relationship edge_type must be a non-empty string',
                            });
                        }
                        if (record.properties !== undefined && !isHmxRecord(record.properties)) {
                            conflicts.push({
                                path: `sections.relationships[${index}].properties`,
                                kind: 'schema',
                                detail: 'relationship properties, when supplied, must be an object',
                            });
                        }
                    });
                }
                // A schema-invalid row poisons its entire section. Never leave a mixed
                // valid/invalid payload available for review or future consumers.
                if (conflicts.length > sectionConflictStart) {
                    sectionCounts[name] = value.length;
                    continue;
                }
                totalRecords += safeRows.length;
                sectionCounts[name] = value.length;
                stagedSections[name] = structuredClone(safeRows);
                continue;
            }
            if (HMX_OBJECT_SECTIONS.has(name)) {
                if (!isHmxRecord(value)) {
                    conflicts.push({ path: `sections.${name}`, kind: 'schema', detail: 'section must be a JSON object' });
                    continue;
                }
                sectionCounts[name] = 1;
                totalRecords += 1;
                stagedSections[name] = structuredClone(value);
            }
        }
        const blocked = (intent === 'telepathy' || intent === 'analysis')
            ? names.filter((name) => protectedSections.has(name))
            : [];
        if (blocked.length) {
            conflicts.push({
                path: 'sections',
                kind: 'protected-by-intent',
                detail: `protected sections require an explicit replacement protocol: ${blocked.join(', ')}`,
            });
        }

        const base = {
            exportId: typeof exportId === 'string' ? exportId : 'invalid-export-id',
            intent,
            strategy,
            sourceSubjectId: isHmxText(document.source_subject_id, 256) ? document.source_subject_id : undefined,
            sourceLineageId: isHmxText(source.hexis_lineage_id, 512) ? source.hexis_lineage_id : undefined,
            sectionCounts,
            protectedSections: names.filter((name) => protectedSections.has(name)),
            conflicts,
            stagedSections,
        };
        const stage: HexisHmxStage = {
            ...base,
            stagingId: randomUUID(),
            status: 'staged',
            createdAt: nowMs(),
            digest: computeHmxStageDigest(base),
            lifecycleDigest: '',
            applicationAttempts: 0,
        };
        refreshHmxStageLifecycleDigest(stage);
        this.state.hmxStages.push(stage);
        this.state.hmxStages = this.state.hmxStages.slice(-32);
        this.state.metrics.hmxStaged += 1;
        return structuredClone(stage);
    }
    prepareGoalProposals(stagingId: string) { this.recordScopedMutation();
        const stage = this.state.hmxStages.find((candidate) => candidate.stagingId === stagingId);
        if (!stage) throw new Error('hmx-goal-stage-not-found');
        if (!isValidHmxStageDigest(stage)) throw new Error('hmx-stage-digest-invalid');
        if (stage.status === 'applied' && !isValidHmxApplyReceipt(stage, stage.application)) {
            throw new Error('hmx-applied-receipt-invalid');
        }
        if (stage.status !== 'accepted' && stage.status !== 'applied') throw new Error('hmx-goal-stage-must-be-accepted');
        if (stage.conflicts.length) throw new Error('hmx-goal-stage-has-conflicts');
        if (stage.intent !== 'port' || stage.strategy !== 'additive') throw new Error('hmx-goal-import-requires-port-additive-strategy');
        const goalRows = Array.isArray(stage.stagedSections?.goals) ? stage.stagedSections.goals : [];
        if (goalRows.length > 64) throw new Error('hmx-goal-proposal-batch-limit');
        const rows = goalRows;
        const lineage = String(stage.sourceLineageId ?? '').trim();
        if (!lineage) throw new Error('hmx-goal-source-lineage-required');
        const validated = rows.map((row: any, index) => {
            if (!isHmxRecord(row)) throw new Error('hmx-goal-row-not-object:' + index);
            const ref = String(row.ref ?? '').trim();
            const title = String(row.title ?? row.name ?? '').trim();
            const description = String(row.description ?? row.summary ?? '').trim();
            const rowMetadata: Record<string, unknown> = isHmxRecord(row.metadata) ? row.metadata : {};
            const nativeGoalMetadata: Record<string, unknown> = isHmxRecord(rowMetadata.nk1NativeGoal) ? rowMetadata.nk1NativeGoal : {};
            if (!ref || !ref.startsWith(stage.exportId + ':') || ref.length > 512) throw new Error('hmx-goal-ref-invalid:' + index);
            if (!isHmxText(title, 300)) throw new Error('hmx-goal-title-invalid:' + index);
            if (description.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description)) throw new Error('hmx-goal-description-invalid:' + index);
            // HMX refs are export-scoped. Prefer the original NK1 goal ID
            // preserved by the adapter, falling back to the stable ref suffix.
            const stableRef = String(nativeGoalMetadata.id ?? nativeGoalMetadata.goalId ?? nativeGoalMetadata.goal_id ?? ref.slice(stage.exportId.length + 1)).trim();
            // External exports may prefix the same source ref with a fresh export ID.
            // Stable lineage + source ref + normalized content makes re-exports idempotent.
            const id = 'hexgoal:' + digest({ lineage, stableRef, title: title.normalize('NFKC'), description: description.normalize('NFKC') }).slice(0, 32);
            return {
                id, stageId: stage.stagingId, exportId: stage.exportId, sourceLineageId: lineage,
                sourceRef: ref, title: title.slice(0, 300), description: description.slice(0, 2000),
                importance: clamp(Number(nativeGoalMetadata.importance ?? row.importance ?? 0.48), 0.1, 0.9),
                urgency: clamp(Number(nativeGoalMetadata.urgency ?? row.urgency ?? 0.32), 0.05, 0.78),
                confidence: clamp(Number(nativeGoalMetadata.confidence ?? row.confidence ?? 0.42), 0.05, 0.8),
            };
        });
        const existingIds = new Set(this.state.goalProposals.map((proposal) => proposal.id));
        const newIds = new Set(validated.map((candidate) => candidate.id).filter((id) => !existingIds.has(id)));
        if (this.state.goalProposals.length + newIds.size > 256) {
            throw new Error('hmx-goal-proposal-capacity-reached');
        }
        // Capacity and all rows are validated before the first mutation; never evict
        // a pending or previously reviewed proposal merely to admit a new batch.
        const results: HexisGoalProposal[] = [];
        let created = 0, duplicates = 0;
        for (const candidate of validated) {
            const existing = this.state.goalProposals.find((proposal) => proposal.id === candidate.id);
            if (existing) { results.push(structuredClone(existing)); duplicates++; continue; }
            const proposal: HexisGoalProposal = { ...candidate, status: 'pending', createdAt: nowMs() };
            this.state.goalProposals.push(proposal);
            results.push(structuredClone(proposal));
            created++;
        }
        this.state.metrics.hmxGoalProposalsCreated += created;
        return { stageId: stage.stagingId, created, duplicates, proposals: results };
    }
    listGoalProposals(input: { status?: HexisGoalProposal['status']; limit?: number } = {}) {
        const limit = Math.max(1, Math.min(128, Math.floor(Number(input.limit ?? 64))));
        return this.state.goalProposals.filter((proposal) => !input.status || proposal.status === input.status).slice(-limit).reverse().map((proposal) => structuredClone(proposal));
    }
    getGoalProposal(id: string) {
        const proposal = this.state.goalProposals.find((candidate) => candidate.id === String(id));
        return proposal ? structuredClone(proposal) : null;
    }
    decideGoalProposal(id: string, decision: 'approve' | 'reject') { this.recordScopedMutation();
        const proposal = this.state.goalProposals.find((candidate) => candidate.id === String(id));
        if (!proposal) return null;
        if (decision !== 'approve' && decision !== 'reject') throw new Error('invalid-hmx-goal-decision');
        if (proposal.status !== 'pending') {
            const sameDecisionReplay = (decision === 'approve' && (proposal.status === 'approved' || proposal.status === 'materialized')) ||
                (decision === 'reject' && proposal.status === 'rejected');
            if (sameDecisionReplay) return structuredClone(proposal);
            throw new Error('hmx-goal-proposal-already-reviewed');
        }
        proposal.status = decision === 'approve' ? 'approved' : 'rejected';
        proposal.decidedAt = nowMs();
        proposal.decisionReason = decision === 'approve' ? 'explicit-review-approval' : 'explicit-review-rejection';
        if (decision === 'approve') this.state.metrics.hmxGoalProposalsApproved++;
        else this.state.metrics.hmxGoalProposalsRejected++;
        return structuredClone(proposal);
    }
    markGoalProposalMaterialized(id: string, canonicalGoalId: string) { this.recordScopedMutation();
        const proposal = this.state.goalProposals.find((candidate) => candidate.id === String(id));
        if (!proposal) return null;
        const target = String(canonicalGoalId ?? '').trim();
        if (!target) throw new Error('canonical-goal-id-required');
        if (proposal.status === 'materialized' && proposal.canonicalGoalId === target) return structuredClone(proposal);
        if (proposal.status !== 'approved') throw new Error('hmx-goal-must-be-approved-before-materialization');
        proposal.status = 'materialized';
        proposal.canonicalGoalId = target;
        proposal.decidedAt = nowMs();
        return structuredClone(proposal);
    }
    markGoalProposalActivated(id: string, canonicalGoalId: string, receipt?: HexisGoalRelationshipReceipt) { this.recordScopedMutation();
        const proposal = this.state.goalProposals.find((candidate) => candidate.id === String(id));
        if (!proposal) return null;
        if (proposal.status !== 'materialized' || proposal.canonicalGoalId !== String(canonicalGoalId)) throw new Error('hmx-goal-must-be-materialized-before-activation');
        if (proposal.goalRelationshipReceipt) return structuredClone(proposal);
        proposal.goalRelationshipReceipt = structuredClone(receipt ?? {
            sourceStageFound: false, candidateRelationships: 0, projected: 0, deferred: 0, semanticEdgeIds: [], at: nowMs(),
        });
        this.state.metrics.hmxGoalProposalsActivated++;
        return structuredClone(proposal);
    }

    decideHmx(stagingId: string, decision: HexisHmxDecision): HexisHmxStage | null { this.recordScopedMutation();
        const stage = this.state.hmxStages.find((candidate) => candidate.stagingId === stagingId);
        if (!stage) return null;
        if (!isValidHmxStageDigest(stage)) throw new Error('hmx-stage-digest-invalid');
        if (decision === 'apply') {
            if (stage.status === 'applied') {
                if (!isValidHmxApplyReceipt(stage, stage.application)) throw new Error('hmx-applied-receipt-invalid');
                return structuredClone(stage);
            }
            if (stage.status !== 'accepted' || stage.conflicts.length) return structuredClone(stage);
            if (stage.intent !== 'port' || stage.strategy !== 'additive') {
                throw new Error('hmx-canonical-apply-requires-port-additive-strategy');
            }
            if (!this.canonicalMemoryApply) throw new Error('canonical-memory-apply-not-bound');
            if (stage.applicationAttempts >= 10000) throw new Error('hmx-apply-attempt-limit');
            stage.applicationAttempts = Math.max(0, Math.floor(Number(stage.applicationAttempts ?? 0))) + 1;
            // Seal the attempt before passing the stage to the canonical projector.
            // If the handler fails, a retry remains valid but gets a distinct attempt ID.
            refreshHmxStageLifecycleDigest(stage);
            const receipt = this.canonicalMemoryApply(structuredClone(stage));
            // Validate the same stage/export/lineage/digest contract on first apply
            // that is required when the persisted receipt is replayed after restore.
            if (!isValidHmxApplyReceipt(stage, receipt)) throw new Error('hmx-apply-receipt-invalid');
            stage.application = structuredClone(receipt);
            stage.status = 'applied';
            refreshHmxStageLifecycleDigest(stage);
            this.state.metrics.hmxApplied += 1;
            return structuredClone(stage);
        }
        if (decision !== 'accept' && decision !== 'reject') return structuredClone(stage);
        if (stage.status !== 'staged' || (decision === 'accept' && stage.conflicts.length)) return structuredClone(stage);
        stage.status = decision === 'accept' ? 'accepted' : 'rejected';
        refreshHmxStageLifecycleDigest(stage);
        if (decision === 'accept') this.state.metrics.hmxAccepted += 1;
        return structuredClone(stage);
    }
    getHmxStage(stagingId: string) { const stage = this.state.hmxStages.find((x) => x.stagingId === stagingId); return stage ? structuredClone(stage) : null; }
    enqueueOutbox(input: {
        idempotencyKey: string;
        kind: string;
        channel: string;
        payload: unknown;
    }): HexisOutboxEntry | { ok: false; error: 'idempotency-key-required' | 'idempotency-key-conflict'; idempotencyKey: string; existingId?: string } { this.recordScopedMutation();
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
    claimOutbox(id: string): HexisOutboxEntry | null { this.recordScopedMutation(); const entry = this.state.outbox.find((x) => x.id === id && x.status === 'pending'); if (!entry)
        return null; entry.status = 'publishing'; entry.attempts += 1; entry.updatedAt = nowMs(); return structuredClone(entry); }
    ackOutbox(id: string, published: boolean, error?: string): HexisOutboxEntry | null { this.recordScopedMutation(); const entry = this.state.outbox.find((x) => x.id === id); if (!entry)
        return null; entry.status = published ? 'published' : (entry.attempts >= 3 ? 'failed' : 'pending'); entry.updatedAt = nowMs(); if (published) {
        entry.publishedAt = entry.updatedAt;
        this.state.metrics.outboxPublished += 1;
    } if (error)
        entry.lastError = String(error).slice(0, 500); return structuredClone(entry); }
    reclaimOutbox(maxAgeMs = 60000): number { this.recordScopedMutation(); const cutoff = nowMs() - Math.max(1000, maxAgeMs); let count = 0; for (const entry of this.state.outbox)
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
    }): HexisConnectorPolicy { this.recordScopedMutation();
        if (!isHmxText(input.connectorId, 128)) throw new Error('invalid-connector-id');
        if (!isHmxText(input.actionKind, 128)) throw new Error('invalid-connector-action-kind');
        if (input.allowAutonomous !== undefined && typeof input.allowAutonomous !== 'boolean') {
            throw new Error('invalid-connector-autonomy-policy');
        }
        if (input.requiresApproval !== undefined && typeof input.requiresApproval !== 'boolean') {
            throw new Error('invalid-connector-approval-policy');
        }
        const contexts = normalizeHexisPolicyStringList(input.contexts ?? ['chat'], 32, 128);
        const allowedTargets = normalizeHexisPolicyStringList(input.allowedTargets ?? [], HEXIS_POLICY_MAX_TARGETS, 512);
        const deniedTargets = normalizeHexisPolicyStringList(input.deniedTargets ?? [], HEXIS_POLICY_MAX_TARGETS, 512);
        if (!contexts || contexts.length === 0) throw new Error('invalid-connector-policy-contexts');
        if (!allowedTargets || !deniedTargets) throw new Error('invalid-connector-policy-targets');
        if (input.maxPerWindow !== undefined &&
            (typeof input.maxPerWindow !== 'number' || !Number.isSafeInteger(input.maxPerWindow) ||
                input.maxPerWindow < 1 || input.maxPerWindow > HEXIS_POLICY_MAX_RATE)) {
            throw new Error('invalid-connector-policy-rate-limit');
        }
        const windowMs = input.windowMs ?? 86400000;
        if (typeof windowMs !== 'number' || !Number.isSafeInteger(windowMs) ||
            windowMs < 1000 || windowMs > HEXIS_POLICY_MAX_WINDOW_MS) {
            throw new Error('invalid-connector-policy-window');
        }
        if (input.expiresAt !== undefined &&
            (typeof input.expiresAt !== 'number' || !Number.isSafeInteger(input.expiresAt) || input.expiresAt < 0)) {
            throw new Error('invalid-connector-policy-expiry');
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
    revokeConnectorPolicy(id: string): boolean { this.recordScopedMutation(); const policy = this.state.connectorPolicies.find((x) => x.id === id); if (!policy)
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
    } { this.recordScopedMutation(); const now = nowMs(); const policy = this.state.connectorPolicies.find((p) => p.status === 'active' && p.connectorId === String(input.connectorId).toLowerCase() && p.actionKind === String(input.actionKind).toLowerCase() && p.contexts.includes(input.context) && (p.expiresAt === undefined || p.expiresAt > now)); if (!policy) {
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
    }): HexisExecutionPlan { this.recordScopedMutation(); const risk01 = clamp(input.risk01 ?? 0); const requested = input.requestedPlacement ?? 'local'; const resolved = risk01 >= 0.8 ? 'sandbox' : requested; const plan: HexisExecutionPlan = { id: randomUUID(), actionKind: String(input.actionKind), requestedPlacement: requested, resolvedPlacement: resolved, risk01, requiresApproval: input.requiresApproval === true || risk01 >= 0.6, rationale: String(input.rationale ?? 'explicit execution placement from Hexis adaptation'), at: nowMs() }; this.state.executions.push(plan); this.state.executions = this.state.executions.slice(-512); this.state.metrics.executionPlans += 1; return structuredClone(plan); }
}
