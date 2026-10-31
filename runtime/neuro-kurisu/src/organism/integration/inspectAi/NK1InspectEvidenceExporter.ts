import { createHash } from 'node:crypto';
import {
  CognitiveEventFabric,
  type CognitiveEventFabricSnapshot,
  type CognitiveEventNode,
  type OperationalCycleLineageCheck,
  type OperationalCycleStageName,
} from '../../system/CognitiveEventFabric.ts';
import { stableJson } from '../../core/StableSerialization.ts';

export const NK1_INSPECT_EVIDENCE_SCHEMA = 'nk1.inspect-evidence/v1' as const;

const OPERATIONAL_STAGES: readonly OperationalCycleStageName[] = [
  'observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal',
  'plan', 'action', 'outcome', 'learning', 'self-update',
];

const safeId = (value: unknown, max = 180): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f-\u009f]/.test(normalized)) return undefined;
  return normalized;
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function mergeSnapshotEvents(snapshot: CognitiveEventFabricSnapshot): Map<string, CognitiveEventNode> {
  const events = new Map<string, CognitiveEventNode>();
  for (const event of [...(snapshot.recent ?? []), ...(snapshot.receiptEvents ?? [])]) {
    const id = safeId(event?.id);
    if (!id) continue;
    const prior = events.get(id);
    if (prior && stableJson(prior) !== stableJson(event)) {
      throw new Error(`inspect-evidence-conflicting-event-id:${id}`);
    }
    if (!prior) events.set(id, event);
  }
  return events;
}

function boundedPayload(event: CognitiveEventNode): Record<string, unknown> {
  // CEF payloads can contain application context and memory identifiers. The
  // evaluator needs lineage, not conversation text or retrieved memory content.
  const allowedByStage: Record<string, readonly string[]> = {
    'tool-action': ['executionId', 'tool', 'decisionId', 'decisionLinked'],
    'tool-outcome': ['executionId', 'tool', 'ok', 'verified', 'outcomeClass'],
    'tool-evidence': [
      'executionId', 'tool', 'verificationBasis', 'externalObservation', 'observationId',
      'observationIntegrated', 'expectedPostconditionPresent', 'observedPostconditionPresent',
    ],
    'external-evidence': [
      'executionId', 'toolId', 'observationId', 'verified', 'confidence01', 'sourceId',
      'sourceClass', 'channel', 'independenceKey', 'expectedPostconditionHash',
      'observedPostconditionHash', 'expectedPostconditionPresent',
      'observedPostconditionPresent', 'evidenceStatus', 'projectionHash',
    ],
    'tool-reconciliation': [
      'executionId', 'toolId', 'revisionId', 'revisionNumber', 'providerReceiptHash',
      'revisionFingerprint', 'outcomeClass', 'ok', 'verified', 'verificationBasis',
      'confidence01', 'observationId', 'status', 'projectionHash',
    ],
  };
  const allow = allowedByStage[event.stage] ?? [];
  const payload: Record<string, unknown> = {};
  for (const key of allow) {
    const value = event.payload?.[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      payload[key] = value;
    }
  }
  return payload;
}

function projectEvent(event: CognitiveEventNode | undefined) {
  if (!event) return null;
  return {
    id: event.id,
    tick: event.tick,
    at: event.at,
    stage: event.stage,
    source: event.source,
    parentIds: [...event.parentIds],
    external: event.external,
    confidence01: event.confidence01,
    payload: boundedPayload(event),
  };
}

function auditReceiptProjections(snapshot: CognitiveEventFabricSnapshot, events: Map<string, CognitiveEventNode>) {
  const rows = Array.isArray(snapshot.receiptProjectionIndex) ? snapshot.receiptProjectionIndex : [];
  const receipts = rows.slice(0, 256).map((entry) => {
    const issues: string[] = [];
    const action = events.get(entry.actionEventId);
    const outcome = events.get(entry.outcomeEventId);
    const evidence = events.get(entry.evidenceEventId);
    const executionId = safeId(entry.executionId);

    if (!executionId) issues.push('invalid-execution-id');
    if (!action || action.stage !== 'tool-action') issues.push('action-event-missing-or-wrong-stage');
    if (!outcome || outcome.stage !== 'tool-outcome') issues.push('outcome-event-missing-or-wrong-stage');
    if (!evidence || evidence.stage !== 'tool-evidence') issues.push('evidence-event-missing-or-wrong-stage');

    if (action && outcome && evidence) {
      const tool = safeId(action.payload?.tool, 64);
      if (action.payload?.executionId !== executionId || outcome.payload?.executionId !== executionId || evidence.payload?.executionId !== executionId) {
        issues.push('execution-id-mismatch');
      }
      if (!tool || outcome.payload?.tool !== tool || evidence.payload?.tool !== tool) issues.push('tool-id-mismatch');
      if (!outcome.parentIds.includes(action.id)) issues.push('outcome-not-child-of-action');
      if (!evidence.parentIds.includes(outcome.id)) issues.push('evidence-not-child-of-outcome');
      if (action.tick !== outcome.tick || outcome.tick !== evidence.tick) issues.push('receipt-tick-mismatch');
      if (action.payload?.decisionId && action.payload?.decisionLinked !== true) issues.push('decision-link-not-resolved');
      if (action.payload?.decisionId && action.payload?.decisionLinked === true && !action.parentIds.includes(String(action.payload.decisionId))) issues.push('decision-parent-link-missing');
    }

    if (entry.projectionHash !== undefined && !/^[a-f0-9]{64}\u0024/i.test(String(entry.projectionHash))) issues.push('receipt-projection-hash-invalid');

    const externalObservations = (Array.isArray(entry.externalObservations) ? entry.externalObservations : []).slice(-32).map((ref) => {
      const event = events.get(ref.eventId);
      const refIssues: string[] = [];
      if (!event || event.stage !== 'external-evidence') refIssues.push('external-event-missing-or-wrong-stage');
      if (event) {
        if (event.payload?.executionId !== executionId) refIssues.push('external-execution-id-mismatch');
        if (event.payload?.observationId !== ref.observationId) refIssues.push('external-observation-id-mismatch');
        if (event.payload?.projectionHash !== ref.projectionHash) refIssues.push('external-projection-hash-mismatch');
        if (outcome && !event.parentIds.includes(outcome.id)) refIssues.push('external-evidence-not-child-of-outcome');
        if (!event.payload?.independenceKey) refIssues.push('external-independence-key-missing');
      }
      return { observationId: ref.observationId, projectionHash: ref.projectionHash, event: projectEvent(event), issues: refIssues };
    });

    const receiptRevisions = (Array.isArray(entry.receiptRevisions) ? entry.receiptRevisions : []).slice(-32).map((ref) => {
      const event = events.get(ref.eventId);
      const refIssues: string[] = [];
      if (!event || event.stage !== 'tool-reconciliation') refIssues.push('revision-event-missing-or-wrong-stage');
      if (event) {
        if (event.payload?.executionId !== executionId) refIssues.push('revision-execution-id-mismatch');
        if (event.payload?.revisionId !== ref.revisionId) refIssues.push('revision-id-mismatch');
        if (event.payload?.projectionHash !== ref.projectionHash) refIssues.push('revision-projection-hash-mismatch');
        if (outcome && !event.parentIds.includes(outcome.id)) refIssues.push('revision-not-linked-to-outcome');
      }
      return { revisionId: ref.revisionId, projectionHash: ref.projectionHash, event: projectEvent(event), issues: refIssues };
    });

    const externalClaim = Boolean(
      evidence?.payload?.externalObservation === true &&
      evidence?.payload?.verificationBasis === 'external-postcondition'
    );
    let externalVerified = false;
    if (externalClaim) {
      externalVerified = Boolean(
        evidence?.payload?.observationIntegrated === true &&
        externalObservations.some((ref) => {
          const p = ref.event?.payload;
          return ref.issues.length === 0 && p?.verified === true &&
            p?.evidenceStatus === 'corroborated' &&
            p?.expectedPostconditionPresent === true &&
            p?.observedPostconditionPresent === true &&
            typeof p?.expectedPostconditionHash === 'string' &&
            p.expectedPostconditionHash.length === 64 &&
            p.expectedPostconditionHash === p.observedPostconditionHash;
        })
      );
      if (!externalVerified) issues.push('external-postcondition-not-corroborated');
    }

    for (const ref of externalObservations) issues.push(...ref.issues);
    for (const ref of receiptRevisions) issues.push(...ref.issues);
    return {
      executionId: executionId ?? 'invalid',
      actionEventId: entry.actionEventId,
      outcomeEventId: entry.outcomeEventId,
      evidenceEventId: entry.evidenceEventId,
      projectionHash: typeof entry.projectionHash === 'string' ? entry.projectionHash : null,
      action: projectEvent(action),
      outcome: projectEvent(outcome),
      evidence: projectEvent(evidence),
      externalObservations,
      receiptRevisions,
      externalPostconditionClaim: externalClaim,
      externalPostconditionVerified: externalVerified,
      integrity01: issues.length === 0 ? 1 : 0,
      issues: [...new Set(issues)],
    };
  });

  const externalClaims = receipts.filter((receipt) => receipt.externalPostconditionClaim).length;
  const externalVerified = receipts.filter((receipt) => receipt.externalPostconditionVerified).length;
  const intact = receipts.filter((receipt) => receipt.integrity01 === 1).length;
  return {
    receiptCount: receipts.length,
    intactReceiptCount: intact,
    invalidReceiptCount: receipts.length - intact,
    externalPostconditionClaimCount: externalClaims,
    externallyCorroboratedCount: externalVerified,
    receipts,
  };
}

export interface NK1InspectEvidenceRecord {
  schemaVersion: typeof NK1_INSPECT_EVIDENCE_SCHEMA;
  sampleId: string;
  exportedAt: number;
  tick: number;
  sourceCommit?: string;
  snapshot: {
    total: number;
    buffered: number;
    recentCount: number;
    receiptEventCount: number;
    recentWindowAtCapacity: boolean;
  };
  cycle: {
    stageIds: Partial<Record<OperationalCycleStageName, string>>;
    ambiguousStages: OperationalCycleStageName[];
    verdict: OperationalCycleLineageCheck;
    events: ReturnType<typeof projectEvent>[];
  };
  receiptAudit: ReturnType<typeof auditReceiptProjections>;
}

/**
 * Build a privacy-reduced, deterministic Inspect AI input record from NK1's
 * existing CognitiveEventFabric snapshot. The function is read-only: it restores
 * an isolated verifier and never mutates the running organism or its memory.
 *
 * Only the newest operational tick is exported by default. This avoids treating
 * a bounded 96-event diagnostic window as a complete historical archive.
 */
export function buildNK1InspectEvidenceRecord(
  snapshot: CognitiveEventFabricSnapshot,
  options: { tick?: number; exportedAt?: number; sourceCommit?: string } = {},
): NK1InspectEvidenceRecord {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.recent) || !Array.isArray(snapshot.receiptEvents)) {
    throw new TypeError('inspect-evidence-requires-cognitive-event-fabric-snapshot-v1');
  }
  const events = mergeSnapshotEvents(snapshot);
  const operationalEvents = [...events.values()].filter((event) => OPERATIONAL_STAGES.includes(event.stage as OperationalCycleStageName));
  const latestTick = operationalEvents.reduce((max, event) => Math.max(max, event.tick), -1);
  const tick = options.tick ?? latestTick;
  if (!Number.isSafeInteger(tick) || tick < 0 || !operationalEvents.some((event) => event.tick === tick)) {
    throw new RangeError('inspect-evidence-tick-not-present-in-snapshot');
  }

  const stageIds: Partial<Record<OperationalCycleStageName, string>> = {};
  const ambiguousStages: OperationalCycleStageName[] = [];
  for (const stage of OPERATIONAL_STAGES) {
    const matching = operationalEvents.filter((event) => event.tick === tick && event.stage === stage);
    if (matching.length === 1) stageIds[stage] = matching[0].id;
    else if (matching.length > 1) ambiguousStages.push(stage);
  }

  const isolatedFabric = new CognitiveEventFabric(snapshot.capacity);
  isolatedFabric.restore(snapshot);
  const verdict = isolatedFabric.verifyOperationalCycle(stageIds);
  const exportedAt = options.exportedAt ?? Date.now();
  if (!Number.isSafeInteger(exportedAt) || exportedAt < 0) throw new RangeError('inspect-evidence-export-time-invalid');
  const sourceCommit = options.sourceCommit?.trim();
  if (sourceCommit && !/^[a-f0-9]{40}\u0024/i.test(sourceCommit)) throw new TypeError('inspect-evidence-source-commit-invalid');

  const projectedCycleEvents = operationalEvents
    .filter((event) => event.tick === tick)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .map((event) => projectEvent(event));
  const receiptAudit = auditReceiptProjections(snapshot, events);
  const body = {
    schemaVersion: NK1_INSPECT_EVIDENCE_SCHEMA,
    sampleId: `nk1-cycle-${tick}-${sha256(stableJson({ tick, stageIds, ambiguousStages })).slice(0, 16)}`,
    exportedAt,
    tick,
    ...(sourceCommit ? { sourceCommit } : {}),
    snapshot: {
      total: Math.max(0, Math.floor(Number(snapshot.total) || 0)),
      buffered: Math.max(0, Math.floor(Number(snapshot.buffered) || 0)),
      recentCount: snapshot.recent.length,
      receiptEventCount: snapshot.receiptEvents.length,
      recentWindowAtCapacity: snapshot.recent.length >= 96,
    },
    cycle: {
      stageIds,
      ambiguousStages,
      verdict,
      events: projectedCycleEvents,
    },
    receiptAudit,
  };
  return structuredClone(body);
}

export function toNK1InspectEvidenceJsonLine(record: NK1InspectEvidenceRecord): string {
  if (record?.schemaVersion !== NK1_INSPECT_EVIDENCE_SCHEMA) throw new TypeError('inspect-evidence-schema-mismatch');
  return JSON.stringify(record) + '\n';
}
