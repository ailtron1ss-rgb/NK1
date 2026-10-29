import { randomUUID } from 'node:crypto';
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
                ? value.hmxStages.slice(-32).map((stage: any) => ({
                    ...stage,
                    stagedSections: stage?.stagedSections && typeof stage.stagedSections === 'object' ? stage.stagedSections : {},
                  }))
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
        throw new Error('belief_registration_failed'); const belief = stored; const key = sourceKey(input.evidence); const alreadyAudited = this.state.beliefAudit.some(row => row.memoryId === String(input.memoryId) && sourceKey(row.evidence) === key); const independent = !belief.sourceKeys.includes(key) && !belief.contradictingSourceKeys.includes(key) && !alreadyAudited; const evidenceTrust = clamp(input.evidence.trust01 ?? 0.5); const priorConfidence01 = clamp(belief.confidence01); const priorTrust01 = clamp(belief.trust01); let posteriorConfidence01 = priorConfidence01; let applied = false; let reason = 'applied'; if (!independent) {
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
        belief.confidence01 = posteriorConfidence01; if (independent) { belief.trust01 = clamp(Math.max(priorTrust01, evidenceTrust * 0.5)); belief.updatedAt = at; } const base = { id: randomUUID(), memoryId: input.memoryId, stance: input.stance, evidence: structuredClone(input.evidence), priorConfidence01, posteriorConfidence01, priorTrust01, posteriorTrust01: belief.trust01, independent, applied, reason, policy: 'residual_v1' as const, context: input.context, at }; const audit: HexisBeliefRevisionAudit = { ...base, digest: digest(base) }; this.state.beliefAudit.push(audit); this.state.beliefAudit = this.state.beliefAudit.slice(-2048); this.state.metrics.beliefRevisions += 1; return structuredClone(audit); }
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
    }): HexisHmxStage { const document = input.document && typeof input.document === 'object' ? input.document as Record<string, unknown> : {}; const sections = document.sections && typeof document.sections === 'object' && !Array.isArray(document.sections) ? document.sections as Record<string, unknown> : {}; const conflicts: HexisHmxStage['conflicts'] = []; if (document.hmx_version && !String(document.hmx_version).startsWith('1.'))
        conflicts.push({ path: 'hmx_version', kind: 'unsupported-major', detail: `Hexis adapter accepts HMX 1.x, got ${String(document.hmx_version)}` }); if (!Object.keys(sections).length)
        conflicts.push({ path: 'sections', kind: 'schema', detail: 'sections must be a non-empty object' }); const names = Object.keys(sections); const blocked = (input.intent === 'telepathy' || input.intent === 'analysis') ? names.filter((name) => protectedSections.has(name)) : []; if (blocked.length)
        conflicts.push({ path: 'sections', kind: 'protected-by-intent', detail: `protected sections require explicit replacement protocol: ${blocked.join(', ')}` }); const sectionCounts: Record<string, number> = {}; const stagedSections: Record<string, unknown> = {}; for (const [name, records] of Object.entries(sections)) {
        sectionCounts[name] = Array.isArray(records) ? records.length : 1;
        stagedSections[name] = Array.isArray(records) ? structuredClone(records.slice(0, 64)) : structuredClone(records);
    } const base = { exportId: String(document.export_id ?? randomUUID()), intent: input.intent, strategy: input.strategy, sourceSubjectId: document.source_subject_id ? String(document.source_subject_id) : undefined, sectionCounts, protectedSections: names.filter((name) => protectedSections.has(name)), conflicts, stagedSections }; const stage: HexisHmxStage = { ...base, stagingId: randomUUID(), status: 'staged', createdAt: nowMs(), digest: digest(base) }; this.state.hmxStages.push(stage); this.state.hmxStages = this.state.hmxStages.slice(-32); this.state.metrics.hmxStaged += 1; return structuredClone(stage); }
    decideHmx(stagingId: string, decision: 'accept' | 'reject'): HexisHmxStage | null { const stage = this.state.hmxStages.find((x) => x.stagingId === stagingId); if (!stage || stage.status !== 'staged' || (decision === 'accept' && stage.conflicts.length))
        return stage ? structuredClone(stage) : null; stage.status = decision === 'accept' ? 'accepted' : 'rejected'; if (decision === 'accept')
        this.state.metrics.hmxAccepted += 1; return structuredClone(stage); }
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
