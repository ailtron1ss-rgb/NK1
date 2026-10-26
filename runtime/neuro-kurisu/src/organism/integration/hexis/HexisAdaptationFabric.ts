import { randomUUID } from 'node:crypto';
import { sha256Stable } from '../../core/StableSerialization.ts';
import { snapshotAndValidateHmxV17Document, validateHmxV17Document } from './HexisHmxV17Adapter.ts';
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
export interface HexisHmxStage {
    stagingId: string;
    exportId: string;
    intent: HexisHmxIntent;
    strategy: HexisHmxStrategy;
    sourceSubjectId?: string;
    sectionCounts: Record<string, number>;
    protectedSections: string[];
    conflicts: Array<{
        path: string;
        kind: string;
        detail: string;
    }>;
    status: 'staged' | 'accepted' | 'rejected';
    createdAt: number;
    digest: string;
    stagedSections: Record<string, unknown>;
    /** Explicitly states whether operator acceptance can mutate canonical NK1 memory. */
    applicationMode: 'memory-merge' | 'preview-only';
    importResult?: {
        status: 'pending' | 'applied' | 'partial' | 'skipped' | 'uncertain';
        created: number;
        reused: number;
        skipped?: number;
        reason?: string;
        completedAt?: number;
    };
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
function hmxStageDigestInput(stage: HexisHmxStage) {
    return {
        exportId: stage.exportId,
        intent: stage.intent,
        strategy: stage.strategy,
        sourceSubjectId: stage.sourceSubjectId,
        sectionCounts: stage.sectionCounts,
        protectedSections: stage.protectedSections,
        conflicts: stage.conflicts,
        stagedSections: stage.stagedSections,
        applicationMode: stage.applicationMode,
    };
}

/**
 * Revalidate a pending HMX stage before any state transition. The original
 * source is never read again; only the bounded staged snapshot is rechecked.
 */
function pendingHmxStageIntegrityIssue(stage: HexisHmxStage): string | null {
    try {
        if (!stage || typeof stage !== 'object' ||
            typeof stage.stagingId !== 'string' ||
            typeof stage.exportId !== 'string' ||
            !/^exp_[0-9a-f]{16}$/.test(stage.exportId) ||
            !['port', 'duplicate', 'telepathy', 'analysis'].includes(stage.intent) ||
            !['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(stage.strategy) ||
            !Number.isFinite(stage.createdAt) ||
            !Array.isArray(stage.protectedSections) ||
            !Array.isArray(stage.conflicts) ||
            !stage.sectionCounts || typeof stage.sectionCounts !== 'object' || Array.isArray(stage.sectionCounts) ||
            !stage.stagedSections || typeof stage.stagedSections !== 'object' || Array.isArray(stage.stagedSections)) {
            return 'persisted-stage-shape-invalid';
        }

        const expectedMode = stage.intent === 'telepathy' && stage.strategy === 'additive'
            ? 'memory-merge'
            : 'preview-only';
        if (stage.applicationMode !== expectedMode) return 'persisted-stage-application-mode-mismatch';
        if (typeof stage.digest !== 'string' || digest(hmxStageDigestInput(stage)) !== stage.digest) {
            return 'persisted-stage-digest-mismatch';
        }
        // A correctly digested stage may already carry validation conflicts. Keep it staged for inspection/rejection; the existing accept gate blocks it without misclassifying expected validation failures as corrupted persistence.
        if (stage.conflicts.length > 0) return null;

        const countKeys = Object.keys(stage.sectionCounts).sort();
        const stagedKeys = Object.keys(stage.stagedSections).sort();
        if (countKeys.length !== stagedKeys.length ||
            countKeys.some((key, index) => key !== stagedKeys[index])) {
            return 'persisted-stage-section-count-keys-mismatch';
        }
        for (const key of stagedKeys) {
            const declaredCount = stage.sectionCounts[key];
            const value = stage.stagedSections[key];
            const actualCount = Array.isArray(value) ? value.length
                : value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length
                : 1;
            if (!Number.isSafeInteger(declaredCount) || declaredCount < 0 || declaredCount !== actualCount) {
                return 'persisted-stage-section-count-mismatch:' + key;
            }
        }

        const sourceSubjectId = typeof stage.sourceSubjectId === 'string' && stage.sourceSubjectId.trim()
            ? stage.sourceSubjectId
            : 'nk1-stage-validation';
        const validationIssues = validateHmxV17Document({
            hmx_version: '1.7',
            export_id: stage.exportId,
            export_intent: stage.intent,
            exported_at: '2026-10-26T00:00:00.000Z',
            source: {
                instance_id: sourceSubjectId,
                schema_version: '1.7',
                embedding_model: 'nk1-stage-validation',
                embedding_dimension: 1,
                hexis_lineage_id: sourceSubjectId,
            },
            sections: stage.stagedSections,
        }, stage.intent);
        if (validationIssues.length > 0) {
            return 'persisted-stage-schema-revalidation-failed:' + validationIssues[0].kind;
        }
        return null;
    } catch {
        return 'persisted-stage-integrity-check-failed';
    }
}
const sourceKey = (source: HexisEvidenceSource) => String(source.ref || source.label || source.contentHash || digest(source));
const nowMs = () => Date.now();
const protectedSections = new Set(['identity', 'worldview', 'drives', 'emotional_triggers', 'narrative', 'goals']);
export function defaultHexisAdaptationState(): HexisAdaptationState {
    return { version: 1, source: { name: 'Hexis-main', mode: 'canonical-adapter', integratedAt: '2026-10-08' }, beliefs: [], beliefAudit: [], temporal: [], learningReviews: [], retentionProposals: [], fidelityReceipts: [], hmxStages: [], outbox: [], connectorPolicies: [], executions: [], metrics: { beliefRevisions: 0, duplicateEvidence: 0, temporalQueries: 0, reviewsCreated: 0, reviewDecisions: 0, retentionProposals: 0, hmxStaged: 0, hmxAccepted: 0, outboxQueued: 0, outboxPublished: 0, outboxIdempotencyConflicts: 0, policyAllows: 0, policyDenials: 0, executionPlans: 0 } };
}
export class HexisAdaptationFabric {
    private state = defaultHexisAdaptationState();
    restore(raw?: Partial<HexisAdaptationState> | null): void {
        const defaults = defaultHexisAdaptationState();
        const value = raw ?? {};
        const normalizedPolicies = Array.isArray(value.connectorPolicies)
            ? value.connectorPolicies.slice(-256).map((policy: any) => ({
                ...policy,
                windowStartedAt: Number(policy?.windowStartedAt ?? policy?.grantedAt ?? 0),
                windowCount: Math.max(0, Math.floor(Number(policy?.windowCount ?? 0))),
              }))
            : [];
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
                ? value.hmxStages.slice(-32).map((rawStage: any) => {
                    const stage: HexisHmxStage = {
                        ...rawStage,
                        stagedSections: rawStage?.stagedSections && typeof rawStage.stagedSections === 'object' && !Array.isArray(rawStage.stagedSections)
                            ? rawStage.stagedSections
                            : Object.create(null),
                    };
                    // An accepted import can be interrupted after writes but before its receipt is persisted.
                    // Never replay accepted+pending memory-merge stages after restore: the side effects are unknown.
                    if (stage.status === 'accepted' &&
                        stage.applicationMode === 'memory-merge' &&
                        stage.importResult?.status === 'pending') {
                        const integrityIssue = pendingHmxStageIntegrityIssue(stage);
                        const conflicts = [...(Array.isArray(stage.conflicts) ? stage.conflicts : [])];
                        if (integrityIssue) {
                            conflicts.push({
                                path: '$',
                                kind: 'persisted-stage-integrity-failure',
                                detail: integrityIssue,
                            });
                        }
                        return {
                            ...stage,
                            conflicts: conflicts.slice(-64),
                            importResult: {
                                status: 'uncertain' as const,
                                created: 0,
                                reused: 0,
                                skipped: Math.max(0, Number(stage.sectionCounts?.memories) || 0),
                                reason: integrityIssue
                                    ? 'accepted-stage-import-interrupted-after-restore-integrity-failure'
                                    : 'accepted-stage-import-interrupted-after-restore',
                                completedAt: nowMs(),
                            },
                        };
                    }
                    if (stage.status !== 'staged') return stage;
                    const integrityIssue = pendingHmxStageIntegrityIssue(stage);
                    if (!integrityIssue) return stage;
                    const conflict = {
                        path: '$',
                        kind: 'persisted-stage-integrity-failure',
                        detail: integrityIssue,
                    };
                    return {
                        ...stage,
                        status: 'rejected' as const,
                        conflicts: [...(Array.isArray(stage.conflicts) ? stage.conflicts : []), conflict].slice(-64),
                        importResult: {
                            status: 'skipped' as const,
                            created: 0,
                            reused: 0,
                            skipped: Math.max(0, Number(stage.sectionCounts?.memories) || 0),
                            reason: 'persisted-stage-integrity-failure',
                            completedAt: nowMs(),
                        },
                    };
                  })
                : [],
            outbox: Array.isArray(value.outbox) ? value.outbox.slice(-512) : [],
            connectorPolicies: normalizedPolicies,
            executions: Array.isArray(value.executions) ? value.executions.slice(-512) : [],
            metrics: { ...defaults.metrics, ...(value.metrics ?? {}) },
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
    } if (independent) {
        if (input.stance === 'supports')
            belief.sourceKeys = [...new Set([...belief.sourceKeys, key])].slice(-256);
        else
            belief.contradictingSourceKeys = [...new Set([...belief.contradictingSourceKeys, key])].slice(-256);
    } if (applied)
        belief.confidence01 = posteriorConfidence01; belief.trust01 = clamp(Math.max(priorTrust01, evidenceTrust * 0.5)); belief.updatedAt = at; const base = { id: randomUUID(), memoryId: input.memoryId, stance: input.stance, evidence: structuredClone(input.evidence), priorConfidence01, posteriorConfidence01, priorTrust01, posteriorTrust01: belief.trust01, independent, applied, reason, policy: 'residual_v1' as const, context: input.context, at }; const audit: HexisBeliefRevisionAudit = { ...base, digest: digest(base) }; this.state.beliefAudit.push(audit); this.state.beliefAudit = this.state.beliefAudit.slice(-2048); this.state.metrics.beliefRevisions += 1; return structuredClone(audit); }
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
        // Capture the request envelope through own data descriptors before reading
        // any field. This prevents accessor-backed intent/strategy/document values
        // from running code or changing between validation and staging.
        let requestDescriptors: PropertyDescriptorMap;
        try {
            const prototype = Object.getPrototypeOf(input);
            const keys = Reflect.ownKeys(input);
            if ((prototype !== Object.prototype && prototype !== null) ||
                keys.length !== 3 ||
                keys.some((key) => typeof key !== 'string' ||
                    !['document', 'intent', 'strategy'].includes(key))) {
                throw new Error('invalid-stage-request-shape');
            }
            requestDescriptors = Object.getOwnPropertyDescriptors(input);
        } catch {
            throw new TypeError('hmx-unsafe-stage-request');
        }
        const documentDescriptor = requestDescriptors.document;
        const intentDescriptor = requestDescriptors.intent;
        const strategyDescriptor = requestDescriptors.strategy;
        if (!documentDescriptor || !documentDescriptor.enumerable || !('value' in documentDescriptor) ||
            !intentDescriptor || !intentDescriptor.enumerable || !('value' in intentDescriptor) ||
            !strategyDescriptor || !strategyDescriptor.enumerable || !('value' in strategyDescriptor)) {
            throw new TypeError('hmx-unsafe-stage-request');
        }
        const sourceDocument = documentDescriptor.value;
        const intent = intentDescriptor.value;
        const strategy = strategyDescriptor.value;

        // Keep the fabric's public mutation boundary strict as well as the HTTP
        // route: internal callers and tests must not stage unknown runtime enum values.
        if (!['port', 'duplicate', 'telepathy', 'analysis'].includes(intent as HexisHmxIntent)) {
            throw new TypeError('hmx-invalid-intent');
        }
        if (!['additive', 'authoritative', 'deliberative', 'analysis_only'].includes(strategy as HexisHmxStrategy)) {
            throw new TypeError('hmx-invalid-strategy');
        }
        // Snapshot and validate the same detached payload in one pass. The
        // public validator remains safe for arbitrary callers, while this staging
        // path avoids serializing and deep-copying the bounded tree a second time.
        const captured = snapshotAndValidateHmxV17Document(sourceDocument, intent as HexisHmxIntent);
        const capturedDocument = captured.ok ? captured.value : undefined;
        const document = capturedDocument && typeof capturedDocument === 'object' && !Array.isArray(capturedDocument)
            ? capturedDocument as Record<string, unknown>
            : {};
        const sections = document.sections && typeof document.sections === 'object' && !Array.isArray(document.sections)
            ? document.sections as Record<string, unknown>
            : {};
        const conflicts: HexisHmxStage['conflicts'] = captured.ok
            ? captured.issues.map((issue) => ({ path: issue.path, kind: issue.kind, detail: issue.detail }))
            : [{ path: captured.issue.path, kind: captured.issue.kind, detail: captured.issue.detail }];
        const names = Object.keys(sections);
        // Section names originate in untrusted HMX. Null-prototype dictionaries
        // keep "__proto__" and similar names as ordinary keys, never setters.
        const sectionCounts: Record<string, number> = Object.create(null);
        const stagedSections: Record<string, unknown> = Object.create(null);
        for (const [name, records] of Object.entries(sections)) {
            sectionCounts[name] = Array.isArray(records)
                ? records.length
                : records && typeof records === 'object'
                    ? Object.keys(records as Record<string, unknown>).length
                    : 1;

            if (Array.isArray(records)) {
                // A conflicted section is never represented by a truncated or
                // filtered prefix. Downstream consumers and diagnostics must
                // not mistake partial staging for a complete source section.
                const sectionPrefix = 'sections.' + name;
                const sectionHasConflict = conflicts.some((conflict) =>
                    conflict.path === sectionPrefix || conflict.path.startsWith(sectionPrefix + '[')
                );
                if (records.length > 256 || sectionHasConflict) {
                    // Preserve the original source count but omit the entire
                    // section. The retained conflict keeps the stage ineligible
                    // for acceptance until the caller narrows/fixes the export.
                    continue;
                }
                // The bounded document snapshot already owns this data; reuse
                // its detached section here and clone only the full stage returned
                // to the caller, avoiding one extra deep copy per accepted section.
                stagedSections[name] = records;
                continue;
            }

            // This object is also detached by snapshotHmxV17Document.
            stagedSections[name] = records;
        }
        const source = document.source && typeof document.source === 'object' && !Array.isArray(document.source)
            ? document.source as Record<string, unknown>
            : {};
        const base = {
            exportId: String(document.export_id ?? randomUUID()),
            intent: intent as HexisHmxIntent,
            strategy: strategy as HexisHmxStrategy,
            sourceSubjectId: String(source.hexis_lineage_id ?? source.instance_id ?? document.source_subject_id ?? '').slice(0, 180) || undefined,
            sectionCounts,
            protectedSections: names.filter((name) => protectedSections.has(name)),
            conflicts,
            stagedSections,
            applicationMode: intent === 'telepathy' && strategy === 'additive'
                ? 'memory-merge' as const
                : 'preview-only' as const,
        };
        const stage: HexisHmxStage = {
            ...base,
            stagingId: randomUUID(),
            status: 'staged',
            createdAt: nowMs(),
            digest: digest(base),
            importResult: {
                status: 'pending',
                created: 0,
                reused: 0,
                reason: 'awaiting-explicit-decision',
            },
        };
        this.state.hmxStages.push(stage);
        this.state.hmxStages = this.state.hmxStages.slice(-8);
        this.state.metrics.hmxStaged += 1;
        return structuredClone(stage);
    }
    decideHmx(stagingId: string, decision: 'accept' | 'reject'): HexisHmxStage | null {
        const stage = this.state.hmxStages.find((item) => item.stagingId === stagingId);
        if (!stage) return null;
        // Once accepted, a memory-merge operation may already have started even
        // if its final import receipt is still pending. Repeated accept or a later
        // reject cannot safely undo or replay unknown canonical side effects.
        if (stage.status === 'accepted' &&
            stage.applicationMode === 'memory-merge' &&
            stage.importResult?.status === 'pending') {
            stage.importResult = {
                status: 'uncertain',
                created: 0,
                reused: 0,
                skipped: Math.max(0, Number(stage.sectionCounts?.memories) || 0),
                reason: decision === 'reject'
                    ? 'reject-request-after-accept-before-import-receipt'
                    : 'repeat-accept-after-accept-before-import-receipt',
                completedAt: nowMs(),
            };
            return structuredClone(stage);
        }
        if (stage.status === 'staged') {
            const integrityIssue = pendingHmxStageIntegrityIssue(stage);
            if (integrityIssue) {
                const conflict = {
                    path: '$',
                    kind: 'persisted-stage-integrity-failure',
                    detail: integrityIssue,
                };
                stage.status = 'rejected';
                stage.conflicts = [...(Array.isArray(stage.conflicts) ? stage.conflicts : []), conflict].slice(-64);
                stage.importResult = {
                    status: 'skipped',
                    created: 0,
                    reused: 0,
                    skipped: Math.max(0, Number(stage.sectionCounts?.memories) || 0),
                    reason: 'persisted-stage-integrity-failure',
                    completedAt: nowMs(),
                };
                return structuredClone(stage);
            }
        }
        if (stage.status !== 'staged' || (decision === 'accept' && stage.conflicts.length)) {
            return structuredClone(stage);
        }
        stage.status = decision === 'accept' ? 'accepted' : 'rejected';
        if (decision === 'reject') {
            stage.importResult = {
                status: 'skipped',
                created: 0,
                reused: 0,
                reason: 'rejected-by-operator',
                completedAt: nowMs(),
            };
        } else if (stage.applicationMode === 'preview-only') {
            stage.importResult = {
                status: 'skipped',
                created: 0,
                reused: 0,
                reason: 'accepted-as-preview-only',
                completedAt: nowMs(),
            };
        }
        if (decision === 'accept') this.state.metrics.hmxAccepted += 1;
        return structuredClone(stage);
    }
    recordHmxImportResult(stagingId: string, result: {
        status: 'applied' | 'partial' | 'skipped';
        created: number;
        reused: number;
        skipped?: number;
        reason?: string;
    }): HexisHmxStage | null {
        const stage = this.state.hmxStages.find((item) => item.stagingId === stagingId);
        if (!stage || stage.status !== 'accepted' || stage.applicationMode !== 'memory-merge' ||
            !stage.importResult || stage.importResult.status !== 'pending') {
            return stage ? structuredClone(stage) : null;
        }

        // Import receipts are part of the persistent trust boundary. Never
        // coerce NaN/fractions/negative values or accept a count set which
        // cannot account for every source memory in this stage.
        if (!result || typeof result !== 'object' ||
            !['applied', 'partial', 'skipped'].includes(result.status) ||
            !Number.isSafeInteger(result.created) || result.created < 0 ||
            !Number.isSafeInteger(result.reused) || result.reused < 0 ||
            (result.skipped !== undefined && (!Number.isSafeInteger(result.skipped) || result.skipped < 0)) ||
            (result.reason !== undefined && (typeof result.reason !== 'string' || result.reason.length > 240))) {
            return structuredClone(stage);
        }
        const expectedSourceCount = stage.sectionCounts?.memories;
        // A failed rollback is not a normal partial success: the canonical store
        // may contain effects that the failed encoder did not return. In that
        // case, retain only positively returned created/reused counts, derive
        // the unaccounted source count, and persist a terminal 'uncertain'
        // receipt. This prevents a second accept from replaying a batch whose
        // first attempt may already have left side effects behind.
        const uncertainRollback = result.status === 'partial' &&
            result.reason === 'memory-encode-failed-rollback-incomplete';
        const skipped = uncertainRollback &&
            Number.isSafeInteger(expectedSourceCount) && expectedSourceCount >= 0
            ? expectedSourceCount - result.created - result.reused
            : result.skipped ?? 0;
        const storedStatus = uncertainRollback ? 'uncertain' : result.status;
        if (!Number.isSafeInteger(expectedSourceCount) || expectedSourceCount < 0 ||
            !Number.isSafeInteger(skipped) || skipped < 0 ||
            result.created + result.reused + skipped !== expectedSourceCount ||
            (storedStatus === 'applied' && skipped !== 0) ||
            (storedStatus === 'skipped' && (result.created !== 0 || result.reused !== 0)) ||
            (storedStatus === 'partial' && (skipped === 0 || result.created + result.reused === 0)) ||
            (storedStatus === 'uncertain' && (result.reason !== 'memory-encode-failed-rollback-incomplete' || expectedSourceCount === 0))) {
            return structuredClone(stage);
        }
        stage.importResult = {
            status: storedStatus,
            created: result.created,
            reused: result.reused,
            skipped,
            ...(result.reason ? { reason: result.reason } : {}),
            completedAt: nowMs(),
        };
        return structuredClone(stage);
    }
    getHmxStage(stagingId: string) { const stage = this.state.hmxStages.find((x) => x.stagingId === stagingId); return stage ? structuredClone(stage) : null; }
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
        const at = nowMs();
        const policy: HexisConnectorPolicy = {
            id: randomUUID(),
            connectorId: String(input.connectorId).toLowerCase(),
            actionKind: String(input.actionKind).toLowerCase(),
            contexts: [...new Set((input.contexts ?? ['chat']).map(String))],
            allowAutonomous: Boolean(input.allowAutonomous),
            requiresApproval: input.requiresApproval !== false,
            allowedTargets: [...new Set((input.allowedTargets ?? []).map(String))],
            deniedTargets: [...new Set((input.deniedTargets ?? []).map(String))],
            maxPerWindow: input.maxPerWindow === undefined ? undefined : Math.max(1, Math.floor(input.maxPerWindow)),
            windowMs: Math.max(1000, Math.floor(input.windowMs ?? 86400000)),
            expiresAt: input.expiresAt,
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
