import { createHash } from 'node:crypto';
import type { CognitiveEventFabricSnapshot, CognitiveEventNode } from '../system/CognitiveEventFabric.ts';
import type { InternalDialogueClaim, InternalDialogueEvidence } from './InternalDialogueEngine.ts';

export interface CognitiveEventEvidenceBinding {
  evidence: InternalDialogueEvidence[];
  claims: InternalDialogueClaim[];
  linkedOutcomeEvents: number;
  linkedIndependentObservations: number;
  ignoredUnlinkedEvents: number;
}

const actions = new Set(['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']);
const stages = new Set([
  'observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal', 'plan', 'action',
  'outcome', 'learning', 'self-update', 'tool-action', 'tool-outcome', 'tool-evidence',
  'external-evidence', 'tool-reconciliation',
]);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 180 && /^[A-Za-z0-9:_-]+$/.test(value);
const bounded01 = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
};
const identity = (prefix: string, value: string, max = 72): string =>
  (prefix + value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, max)).slice(0, 96);

function actionForNode(node: CognitiveEventNode, byId: Map<string, CognitiveEventNode>, visited = new Set<string>()): string | null {
  if (visited.has(node.id) || visited.size >= 8) return null;
  visited.add(node.id);
  for (const key of ['action', 'selectedAction', 'actionKind', 'decisionAction', 'intent']) {
    const value = node.payload[key];
    if (typeof value === 'string' && actions.has(value)) return value;
  }
  const decisionId = node.payload.decisionId;
  if (typeof decisionId === 'string') {
    const decision = byId.get(decisionId);
    if (decision) {
      const found = actionForNode(decision, byId, visited);
      if (found) return found;
    }
  }
  for (const parentId of node.parentIds) {
    const parent = byId.get(parentId);
    if (!parent || !['plan', 'action', 'prediction'].includes(parent.stage)) continue;
    const found = actionForNode(parent, byId, visited);
    if (found) return found;
  }
  return null;
}

function outcomePolarity(payload: Record<string, unknown>): boolean | null {
  for (const key of ['success', 'ok', 'passed']) {
    if (typeof payload[key] === 'boolean') return payload[key] as boolean;
  }
  for (const key of ['success01', 'reward01', 'reward']) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 0.65) return true;
      if (value <= 0.35) return false;
    }
  }
  return null;
}

function normalizeNodes(snapshot?: CognitiveEventFabricSnapshot | null): CognitiveEventNode[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const rows: unknown[] = [
    ...(Array.isArray(snapshot.recent) ? snapshot.recent : []),
    ...(Array.isArray(snapshot.receiptEvents) ? snapshot.receiptEvents : []),
  ];
  const unique = new Set<string>();
  const normalized: CognitiveEventNode[] = [];
  for (const raw of rows.slice(0, 192)) {
    if (!record(raw)) continue;
    if (!safeId(raw.id) || !stages.has(String(raw.stage)) ||
        typeof raw.tick !== 'number' || !Number.isSafeInteger(raw.tick) || raw.tick < 0 ||
        !Array.isArray(raw.parentIds) || !record(raw.payload)) continue;
    if (unique.has(raw.id)) continue;
    unique.add(raw.id);
    const parentIds = raw.parentIds.filter(safeId).slice(0, 12);
    normalized.push({
      id: raw.id,
      tick: raw.tick,
      at: typeof raw.at === 'number' && Number.isFinite(raw.at) && raw.at >= 0 ? raw.at : 0,
      stage: raw.stage as CognitiveEventNode['stage'],
      source: typeof raw.source === 'string' ? raw.source.slice(0, 120) : 'unknown',
      parentIds,
      external: raw.external === true,
      confidence01: bounded01(raw.confidence01),
      // The adapter only inspects known scalar keys and never forwards payload text.
      payload: { ...raw.payload },
    });
  }
  return normalized;
}

/**
 * Bridges the canonical CEF causal ledger into review evidence. Only outcome nodes with
 * a verified action parent and explicit action identity are bound to a candidate.
 * External observations must also carry independent source identity and a corroborated
 * or contradicted status. Raw event payloads never enter the language prompt.
 */
export function bindCognitiveEventEvidence(
  claimsInput: InternalDialogueClaim[],
  evidenceInput: InternalDialogueEvidence[],
  snapshot?: CognitiveEventFabricSnapshot | null,
): CognitiveEventEvidenceBinding {
  const claims = claimsInput.map(claim => ({ ...claim,
    supportingEvidenceIds: [...(claim.supportingEvidenceIds ?? [])],
    contradictingEvidenceIds: [...(claim.contradictingEvidenceIds ?? [])],
  }));
  const byAction = new Map<string, InternalDialogueClaim[]>();
  for (const claim of claims) {
    if (!claim.action || !actions.has(claim.action)) continue;
    const list = byAction.get(claim.action) ?? [];
    list.push(claim);
    byAction.set(claim.action, list);
  }
  const nodes = normalizeNodes(snapshot).sort((a, b) => b.tick - a.tick || b.at - a.at);
  const byId = new Map(nodes.map(node => [node.id, node] as const));
  const evidence: InternalDialogueEvidence[] = evidenceInput.map(row => ({ ...row }));
  const evidenceIds = new Set(evidence.map(row => row.id));
  let linkedOutcomeEvents = 0;
  let linkedIndependentObservations = 0;
  let ignoredUnlinkedEvents = 0;
  const linkedEventsPerClaim = new Map<string, number>();

  const attach = (eventNode: CognitiveEventNode, actionNode: CognitiveEventNode, kind: InternalDialogueEvidence['kind'], positive: boolean, sourceGroup: string, cap: number) => {
    const action = actionForNode(actionNode, byId);
    const matching = action ? byAction.get(action) : undefined;
    if (!matching?.length) { ignoredUnlinkedEvents++; return; }
    const eventHash = createHash('sha256').update(eventNode.id).digest('hex').slice(0, 32);
    const key = 'cef_' + eventNode.tick + '_' + eventNode.stage.replace(/-/g, '_') + '_' + eventHash;
    if (evidenceIds.has(key)) return;
    evidenceIds.add(key);
    evidence.push({
      id: key,
      kind,
      confidence01: Math.min(cap, bounded01(eventNode.confidence01)),
      sourceGroup: identity('src_', sourceGroup || eventNode.id, 72),
    });
    for (const claim of matching) {
      const count = linkedEventsPerClaim.get(claim.id) ?? 0;
      if (count >= 8) continue;
      const target = positive ? claim.supportingEvidenceIds! : claim.contradictingEvidenceIds!;
      if (!target.includes(key)) {
        target.push(key);
        linkedEventsPerClaim.set(claim.id, count + 1);
      }
    }
    if (kind === 'observation') linkedIndependentObservations++;
    else linkedOutcomeEvents++;
  };

  for (const node of nodes) {
    if (node.stage === 'outcome') {
      const parent = node.parentIds.map(id => byId.get(id)).find(row => row?.stage === 'action');
      if (!parent || parent.tick !== node.tick || !node.parentIds.includes(parent.id)) { ignoredUnlinkedEvents++; continue; }
      const polarity = outcomePolarity(node.payload);
      if (polarity === null) { ignoredUnlinkedEvents++; continue; }
      const action = actionForNode(parent, byId);
      if (!action || !byAction.has(action)) { ignoredUnlinkedEvents++; continue; }
      attach(node, parent, 'outcome', polarity, 'operational-tick-' + node.tick, node.external ? 0.95 : 0.7);
      continue;
    }

    if (node.stage === 'tool-outcome') {
      const parent = node.parentIds.map(id => byId.get(id)).find(row => row?.stage === 'tool-action');
      if (!parent || parent.tick !== node.tick || !node.parentIds.includes(parent.id)) { ignoredUnlinkedEvents++; continue; }
      const polarity = outcomePolarity(node.payload);
      if (polarity === null || !node.payload.executionId || node.payload.executionId !== parent.payload.executionId) {
        ignoredUnlinkedEvents++; continue;
      }
      const action = actionForNode(parent, byId);
      if (!action || !byAction.has(action)) { ignoredUnlinkedEvents++; continue; }
      attach(node, parent, 'tool', polarity, 'tool-execution-' + String(node.payload.executionId), node.payload.verified === true ? 0.72 : 0.55);
      continue;
    }

    if (node.stage === 'external-evidence') {
      const outcome = node.parentIds.map(id => byId.get(id)).find(row => row?.stage === 'tool-outcome');
      const action = outcome?.parentIds.map(id => byId.get(id)).find(row => row?.stage === 'tool-action');
      const hasExactLineage = Boolean(outcome && action && node.tick >= outcome.tick &&
        outcome.parentIds.includes(action.id) && outcome.payload.executionId === node.payload.executionId &&
        action.payload.executionId === node.payload.executionId);
      const independent = typeof node.payload.sourceId === 'string' && node.payload.sourceId.trim().length > 0 &&
        typeof node.payload.independenceKey === 'string' && node.payload.independenceKey.trim().length > 0 &&
        typeof node.payload.observationId === 'string' && node.payload.observationId.trim().length > 0;
      const status = node.payload.evidenceStatus;
      const verified = node.payload.verified === true && status === 'corroborated';
      const contradicted = status === 'contradicted' && node.payload.expectedPostconditionPresent === true &&
        node.payload.observedPostconditionPresent === true;
      if (!hasExactLineage || node.external !== true || !independent || (!verified && !contradicted) || !action) {
        ignoredUnlinkedEvents++; continue;
      }
      attach(node, action, 'observation', verified, String(node.payload.independenceKey), 0.95);
    }
  }

  return { evidence, claims, linkedOutcomeEvents, linkedIndependentObservations, ignoredUnlinkedEvents };
}
