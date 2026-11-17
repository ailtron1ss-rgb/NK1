const MAX_TEXT = 2_000;
const MAX_LIST = 64;
const MAX_FACTS = 1_024;
const MAX_LOOPS = 512;
const MAX_ALTERNATIVES = 512;
const clamp01 = (value: unknown): number =>
  Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
const text = (value: unknown, max = 240): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const finiteTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const uniqueStrings = (values: unknown, max = MAX_LIST): string[] => {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values.slice(0, max)) {
    const item = text(value, 240);
    if (item && !result.includes(item)) result.push(item);
  }
  return result;
};

export interface OmeStroIntentInput {
  goal: string;
  context?: string;
  outputs?: string[];
  constraints?: string[];
  assumptions?: string[];
  acceptanceCriteria?: string[];
  allowedActions?: string[];
  forbiddenActions?: string[];
  stopConditions?: string[];
  irreversibleActions?: string[];
  requiresHumanApproval?: boolean;
  sourceRef?: string;
}
export interface OmeStroIntentContract {
  schemaVersion: 1;
  id: string;
  goal: string;
  context: string;
  outputs: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  stopConditions: string[];
  irreversibleActions: string[];
  requiresHumanApproval: boolean;
  sourceRef: string | null;
  status: 'ready' | 'needs-clarification';
  missing: string[];
}
export function compileOmeStroIntent(input: OmeStroIntentInput): OmeStroIntentContract {
  const goal = text(input?.goal, MAX_TEXT);
  const outputs = uniqueStrings(input?.outputs);
  const acceptanceCriteria = uniqueStrings(input?.acceptanceCriteria);
  const allowedActions = uniqueStrings(input?.allowedActions);
  const forbiddenActions = uniqueStrings(input?.forbiddenActions);
  const stopConditions = uniqueStrings(input?.stopConditions);
  const irreversibleActions = uniqueStrings(input?.irreversibleActions);
  const missing: string[] = [];
  if (!goal) missing.push('goal');
  if (!outputs.length) missing.push('outputs');
  if (!acceptanceCriteria.length) missing.push('acceptanceCriteria');
  if (!stopConditions.length) missing.push('stopConditions');
  if (!allowedActions.length) missing.push('allowedActions');
  const requiresHumanApproval = input?.requiresHumanApproval !== false || irreversibleActions.length > 0;
  return {
    schemaVersion: 1,
    id: 'intent-' + (text(input?.sourceRef, 120).replace(/[^a-zA-Z0-9._:-]/g, '-') || 'unbound'),
    goal,
    context: text(input?.context, MAX_TEXT),
    outputs,
    constraints: uniqueStrings(input?.constraints),
    assumptions: uniqueStrings(input?.assumptions),
    acceptanceCriteria,
    allowedActions,
    forbiddenActions,
    stopConditions,
    irreversibleActions,
    requiresHumanApproval,
    sourceRef: text(input?.sourceRef, 240) || null,
    status: missing.length ? 'needs-clarification' : 'ready',
    missing,
  };
}

export type ChronoTruthKind = 'assert' | 'correct' | 'retract';
export interface ChronoTruthRecord {
  id: string;
  key: string;
  value: string | null;
  kind: ChronoTruthKind;
  sourceRef: string;
  confidence01: number;
  validFrom: number;
  validTo: number | null;
  recordedAt: number;
  expiresAt: number | null;
  supersedesId: string | null;
  sensitivity: 'low-risk';
  consented: true;
}
export interface ChronoTruthInput {
  id: string;
  key: string;
  value?: string;
  kind?: ChronoTruthKind;
  sourceRef: string;
  confidence01: number;
  validFrom: number;
  validTo?: number | null;
  recordedAt: number;
  expiresAt?: number | null;
  supersedesId?: string | null;
  sensitivity: 'low-risk' | 'sensitive' | 'unknown';
  consented: boolean;
}
export interface ChronoTruthState { version: 1; records: ChronoTruthRecord[]; rejected: number; }
export class ChronoTruthLedger {
  private state: ChronoTruthState = { version: 1, records: [], rejected: 0 };

  restore(raw?: Partial<ChronoTruthState> | null): void {
    const records = Array.isArray(raw?.records) ? raw!.records.slice(-MAX_FACTS) : [];
    this.state = {
      version: 1,
      rejected: Math.max(0, Math.floor(Number(raw?.rejected) || 0)),
      records: records.filter((record): record is ChronoTruthRecord =>
        !!record && typeof record.id === 'string' && typeof record.key === 'string' &&
        typeof record.sourceRef === 'string' && finiteTime(record.validFrom) &&
        finiteTime(record.recordedAt) && ['assert', 'correct', 'retract'].includes(record.kind) &&
        record.sensitivity === 'low-risk' && record.consented === true),
    };
  }
  snapshot(): ChronoTruthState { return structuredClone(this.state); }

  append(input: ChronoTruthInput): { accepted: boolean; reason?: string; record?: ChronoTruthRecord } {
    const id = text(input?.id, 160);
    const key = text(input?.key, 160);
    const sourceRef = text(input?.sourceRef, 240);
    const kind = input?.kind ?? 'assert';
    const validTo = input?.validTo ?? null;
    const expiresAt = input?.expiresAt ?? null;
    const supersedesId = text(input?.supersedesId, 160) || null;
    const value = kind === 'retract' ? null : text(input?.value, MAX_TEXT);
    const reject = (reason: string) => { this.state.rejected += 1; return { accepted: false, reason }; };
    if (!id || !key || !sourceRef || !finiteTime(input?.validFrom) || !finiteTime(input?.recordedAt) ||
        !['assert', 'correct', 'retract'].includes(kind)) return reject('invalid-input');
    if (input.sensitivity !== 'low-risk' || input.consented !== true) return reject('consent-or-sensitivity-gate');
    if (!finiteTime(input.confidence01) && (typeof input.confidence01 !== 'number' || !Number.isFinite(input.confidence01))) return reject('invalid-confidence');
    if (!finiteTime(validTo) && validTo !== null) return reject('invalid-valid-to');
    if (!finiteTime(expiresAt) && expiresAt !== null) return reject('invalid-expiry');
    if (validTo !== null && validTo <= input.validFrom) return reject('invalid-valid-interval');
    if (expiresAt !== null && expiresAt <= input.recordedAt) return reject('already-expired');
    if (kind !== 'assert' && !supersedesId) return reject('missing-superseded-reference');
    if (kind !== 'retract' && !value) return reject('empty-value');
    if (this.state.records.some(record => record.id === id)) return reject('duplicate-id');
    if (supersedesId && !this.state.records.some(record => record.id === supersedesId && record.key === key)) return reject('unknown-superseded-reference');
    if (this.state.records.length >= MAX_FACTS) return reject('capacity-exhausted');
    const record: ChronoTruthRecord = {
      id, key, value, kind, sourceRef, confidence01: clamp01(input.confidence01),
      validFrom: input.validFrom, validTo, recordedAt: input.recordedAt, expiresAt,
      supersedesId, sensitivity: 'low-risk', consented: true,
    };
    this.state.records.push(record);
    return { accepted: true, record: structuredClone(record) };
  }

  query(key: string, validAt: number, knownAt: number): ChronoTruthRecord | null {
    const normalizedKey = text(key, 160);
    if (!normalizedKey || !finiteTime(validAt) || !finiteTime(knownAt)) return null;
    const known = this.state.records.filter(record => record.key === normalizedKey && record.recordedAt <= knownAt);
    const supersedingEvents = new Map<string, ChronoTruthRecord[]>();
    for (const event of known) {
      if (!event.supersedesId) continue;
      const events = supersedingEvents.get(event.supersedesId) ?? [];
      events.push(event);
      supersedingEvents.set(event.supersedesId, events);
    }
    const eligible = known.filter(record =>
      record.kind !== 'retract' && record.value !== null &&
      !(supersedingEvents.get(record.id) ?? []).some(event =>
        event.validFrom <= validAt && (event.validTo === null || validAt < event.validTo)) &&
      record.validFrom <= validAt && (record.validTo === null || validAt < record.validTo) &&
      (record.expiresAt === null || knownAt < record.expiresAt));
    eligible.sort((a, b) => b.validFrom - a.validFrom || b.recordedAt - a.recordedAt || a.id.localeCompare(b.id));
    return eligible[0] ? structuredClone(eligible[0]) : null;
  }

  history(key: string, knownAt: number): ChronoTruthRecord[] {
    const normalizedKey = text(key, 160);
    if (!normalizedKey || !finiteTime(knownAt)) return [];
    return this.state.records.filter(record => record.key === normalizedKey && record.recordedAt <= knownAt)
      .sort((a, b) => a.recordedAt - b.recordedAt).map(record => structuredClone(record));
  }
}

export interface NegativeSpaceEntry {
  id: string;
  option: string;
  reason: string;
  confidence01: number;
  rejectedAt: number;
  reopenAt: number | null;
  reopenWhenEvidenceRefs: string[];
  evidenceRefs: string[];
  status: 'rejected' | 'reopened';
}
export class NegativeSpaceLedger {
  private entries: NegativeSpaceEntry[] = [];
  record(input: Omit<NegativeSpaceEntry, 'status' | 'reopenWhenEvidenceRefs' | 'evidenceRefs'> & {
    reopenWhenEvidenceRefs?: string[]; evidenceRefs?: string[];
  }): { accepted: boolean; reason?: string } {
    if (!text(input?.id, 160) || !text(input?.option, 240) || !text(input?.reason, 500) ||
        !finiteTime(input?.rejectedAt) || this.entries.some(entry => entry.id === input.id)) return { accepted: false, reason: 'invalid-or-duplicate-entry' };
    if (input.reopenAt !== null && !finiteTime(input.reopenAt)) return { accepted: false, reason: 'invalid-reopen-time' };
    if (this.entries.length >= MAX_ALTERNATIVES) return { accepted: false, reason: 'capacity-exhausted' };
    this.entries.push({
      id: input.id, option: input.option, reason: input.reason, confidence01: clamp01(input.confidence01),
      rejectedAt: input.rejectedAt, reopenAt: input.reopenAt,
      reopenWhenEvidenceRefs: uniqueStrings(input.reopenWhenEvidenceRefs),
      evidenceRefs: uniqueStrings(input.evidenceRefs), status: 'rejected',
    });
    return { accepted: true };
  }
  reopen(id: string, evidenceRef: string, now: number): { reopened: boolean; reason?: string } {
    const entry = this.entries.find(candidate => candidate.id === id);
    const ref = text(evidenceRef, 240);
    if (!entry || entry.status !== 'rejected' || !ref || !finiteTime(now)) return { reopened: false, reason: 'invalid-or-closed-entry' };
    const timeTrigger = entry.reopenAt !== null && now >= entry.reopenAt;
    const evidenceTrigger = entry.reopenWhenEvidenceRefs.includes(ref);
    if (!timeTrigger && !evidenceTrigger) return { reopened: false, reason: 'reopen-trigger-not-met' };
    entry.status = 'reopened';
    entry.evidenceRefs = uniqueStrings([...entry.evidenceRefs, ref]);
    return { reopened: true };
  }
  snapshot(): NegativeSpaceEntry[] { return structuredClone(this.entries); }
  restore(entries: unknown): void {
    this.entries = Array.isArray(entries) ? structuredClone(entries).filter((entry: any) =>
      entry && typeof entry.id === 'string' && typeof entry.option === 'string' &&
      ['rejected', 'reopened'].includes(entry.status)).slice(-MAX_ALTERNATIVES) : [];
  }
}

export type OpenLoopStatus = 'open' | 'blocked' | 'done' | 'cancelled' | 'stale';
export interface OpenLoopItem {
  id: string;
  summary: string;
  owner: string;
  status: OpenLoopStatus;
  createdAt: number;
  dueAt: number | null;
  reviewAt: number | null;
  expiresAt: number | null;
  dependencyIds: string[];
  closeCondition: string;
  evidenceRefs: string[];
}
export class OpenLoopRadar {
  private items: OpenLoopItem[] = [];
  upsert(input: Omit<OpenLoopItem, 'status' | 'evidenceRefs'> & { status?: OpenLoopStatus; evidenceRefs?: string[] }): { accepted: boolean; reason?: string } {
    if (!text(input?.id, 160) || !text(input?.summary, 500) || !text(input?.owner, 120) ||
        !text(input?.closeCondition, 300) || !finiteTime(input?.createdAt)) return { accepted: false, reason: 'invalid-input' };
    for (const timestamp of [input.dueAt, input.reviewAt, input.expiresAt]) {
      if (timestamp !== null && !finiteTime(timestamp)) return { accepted: false, reason: 'invalid-timestamp' };
    }
    if (this.items.some(item => item.id === input.id)) return { accepted: false, reason: 'duplicate-id' };
    if (this.items.length >= MAX_LOOPS) return { accepted: false, reason: 'capacity-exhausted' };
    const dependencyIds = uniqueStrings(input.dependencyIds);
    if (dependencyIds.includes(input.id)) return { accepted: false, reason: 'self-dependency' };
    this.items.push({
      ...input, summary: text(input.summary, 500), owner: text(input.owner, 120),
      status: input.status ?? 'open', dependencyIds, evidenceRefs: uniqueStrings(input.evidenceRefs),
    });
    return { accepted: true };
  }
  close(id: string, status: 'done' | 'cancelled', evidenceRef: string): boolean {
    const item = this.items.find(candidate => candidate.id === id);
    if (!item || !text(evidenceRef, 240)) return false;
    item.status = status;
    item.evidenceRefs = uniqueStrings([...item.evidenceRefs, evidenceRef]);
    return true;
  }
  markExpired(now: number): number {
    if (!finiteTime(now)) return 0;
    let changed = 0;
    for (const item of this.items) {
      if ((item.status === 'open' || item.status === 'blocked') && item.expiresAt !== null && item.expiresAt <= now) {
        item.status = 'stale';
        changed += 1;
      }
    }
    return changed;
  }
  due(now: number): OpenLoopItem[] {
    if (!finiteTime(now)) return [];
    return this.items.filter(item => (item.status === 'open' || item.status === 'blocked') &&
      ((item.dueAt !== null && item.dueAt <= now) || (item.reviewAt !== null && item.reviewAt <= now)))
      .sort((a, b) => (a.dueAt ?? a.reviewAt ?? 0) - (b.dueAt ?? b.reviewAt ?? 0))
      .map(item => structuredClone(item));
  }
  snapshot(): OpenLoopItem[] { return structuredClone(this.items); }
  restore(items: unknown): void {
    this.items = Array.isArray(items) ? structuredClone(items).filter((item: any) =>
      item && typeof item.id === 'string' && typeof item.summary === 'string' &&
      ['open', 'blocked', 'done', 'cancelled', 'stale'].includes(item.status)).slice(-MAX_LOOPS) : [];
  }
}

export interface UndoFirstStep {
  id: string;
  action: string;
  idempotencyKey: string;
  reversible: boolean;
  compensation: string | null;
  irreversibleApprovalRequired?: boolean;
}
export interface UndoFirstPlan {
  id: string;
  sourceBranch: string;
  snapshotRef: string | null;
  readyToExecute: boolean;
  status: 'ready' | 'blocked';
  blockers: string[];
  orderedSteps: UndoFirstStep[];
  rollbackOrder: Array<{ stepId: string; compensation: string }>;
  irreversibleSteps: string[];
}
export function prepareUndoFirstPlan(input: {
  id: string; sourceBranch: string; snapshotRef?: string | null; steps: UndoFirstStep[]; approveIrreversible?: boolean;
}): UndoFirstPlan {
  const blockers: string[] = [];
  const id = text(input?.id, 160);
  const sourceBranch = text(input?.sourceBranch, 180);
  const steps = Array.isArray(input?.steps) ? structuredClone(input.steps).slice(0, 64) : [];
  if (!id || !sourceBranch || !steps.length) blockers.push('plan-identity-or-steps-missing');
  const stepIds = new Set<string>();
  const idempotencyKeys = new Set<string>();
  for (const step of steps) {
    if (!text(step.id, 120) || stepIds.has(step.id)) blockers.push('duplicate-or-invalid-step-id');
    if (!text(step.idempotencyKey, 180) || idempotencyKeys.has(step.idempotencyKey)) blockers.push('duplicate-or-invalid-idempotency-key');
    stepIds.add(step.id);
    idempotencyKeys.add(step.idempotencyKey);
    if (typeof step.reversible !== 'boolean' || !text(step.action, 240)) blockers.push('invalid-step:' + text(step.id, 120));
    if (step.reversible && !text(step.compensation, 240)) blockers.push('missing-compensation:' + text(step.id, 120));
  }
  const irreversibleSteps = steps.filter(step => !step.reversible).map(step => step.id);
  if (irreversibleSteps.length && input.approveIrreversible !== true) blockers.push('irreversible-approval-required');
  const rollbackOrder = steps.filter(step => step.reversible && text(step.compensation, 240))
    .reverse().map(step => ({ stepId: step.id, compensation: step.compensation! }));
  return {
    id, sourceBranch, snapshotRef: text(input.snapshotRef, 240) || null,
    readyToExecute: blockers.length === 0, status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers: [...new Set(blockers)], orderedSteps: steps, rollbackOrder, irreversibleSteps,
  };
}

export interface ConsequenceNode {
  id: string;
  stakeholder: string;
  description: string;
  delayMs: number;
  probability01: number;
  impact01: number;
  evidenceRef: string;
}
export interface ConsequenceEdge { from: string; to: string; confidence01: number; }
export interface ConsequencePath {
  nodeIds: string[];
  stakeholder: string;
  probability01: number;
  impact01: number;
  expectedExposure01: number;
  delayMs: number;
  evidenceRefs: string[];
}
export function assessConsequenceEcology(
  nodes: ConsequenceNode[], edges: ConsequenceEdge[], rootIds: string[], maxDepth = 3,
): { paths: ConsequencePath[]; expectedExposureByStakeholder: Record<string, number>; totalExpectedExposure01: number } {
  const byId = new Map((Array.isArray(nodes) ? nodes : []).filter(node => text(node.id, 120)).map(node => [node.id, node]));
  const adjacency = new Map<string, ConsequenceEdge[]>();
  for (const edge of Array.isArray(edges) ? edges : []) {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) continue;
    const list = adjacency.get(edge.from) ?? [];
    list.push({ ...edge, confidence01: clamp01(edge.confidence01) });
    adjacency.set(edge.from, list);
  }
  const depthLimit = Math.max(1, Math.min(3, Math.floor(Number(maxDepth) || 1)));
  const paths: ConsequencePath[] = [];
  const visit = (id: string, path: string[], probability: number, depth: number, evidenceRefs: string[]) => {
    const node = byId.get(id);
    if (!node || path.includes(id)) return;
    const nextPath = [...path, id];
    const nextProbability = probability * clamp01(node.probability01);
    const exposure = nextProbability * clamp01(node.impact01);
    paths.push({
      nodeIds: nextPath, stakeholder: text(node.stakeholder, 120) || 'unspecified',
      probability01: nextProbability, impact01: clamp01(node.impact01), expectedExposure01: exposure,
      delayMs: Math.max(0, Math.floor(Number(node.delayMs) || 0)),
      evidenceRefs: uniqueStrings([...evidenceRefs, node.evidenceRef]),
    });
    if (depth >= depthLimit) return;
    for (const edge of adjacency.get(id) ?? []) {
      if (nextPath.includes(edge.to)) continue;
      visit(edge.to, nextPath, nextProbability * edge.confidence01, depth + 1, [...evidenceRefs, node.evidenceRef]);
    }
  };
  for (const root of uniqueStrings(rootIds, 32)) visit(root, [], 1, 1, []);
  const grouped: Record<string, number> = {};
  for (const path of paths) grouped[path.stakeholder] = Math.min(1, (grouped[path.stakeholder] ?? 0) + path.expectedExposure01);
  const totalExpectedExposure01 = Object.values(grouped).reduce((sum, value) => sum + value, 0);
  return { paths, expectedExposureByStakeholder: grouped, totalExpectedExposure01: Math.min(1, totalExpectedExposure01) };
}

export function assessSubstrateMigration(input: {
  sourceFingerprint: string;
  targetFingerprint: string;
  stateSchemaCompatible: boolean;
  stateRoundTripPassed: boolean;
  benchmarkPairedSeeds: number;
  qualityDelta01: number;
  maximumAllowedRegression01: number;
  rollbackAvailable: boolean;
  calibrationEvidenceRef: string;
}): { eligible: boolean; blockers: string[]; mode: 'target' | 'base-fallback' } {
  const blockers: string[] = [];
  if (!text(input?.sourceFingerprint, 160) || !text(input?.targetFingerprint, 160) ||
      input.sourceFingerprint === input.targetFingerprint) blockers.push('distinct-substrate-fingerprints-required');
  if (input.stateSchemaCompatible !== true) blockers.push('state-schema-incompatible');
  if (input.stateRoundTripPassed !== true) blockers.push('state-roundtrip-not-verified');
  if (!Number.isSafeInteger(input.benchmarkPairedSeeds) || input.benchmarkPairedSeeds < 5) blockers.push('minimum-five-paired-seeds-required');
  if (typeof input.qualityDelta01 !== 'number' || !Number.isFinite(input.qualityDelta01)) blockers.push('quality-delta-invalid');
  if (input.qualityDelta01 < -clamp01(input.maximumAllowedRegression01)) blockers.push('quality-regression-exceeds-budget');
  if (input.rollbackAvailable !== true) blockers.push('base-substrate-fallback-required');
  if (!text(input.calibrationEvidenceRef, 240)) blockers.push('calibration-evidence-required');
  return { eligible: blockers.length === 0, blockers, mode: blockers.length === 0 ? 'target' : 'base-fallback' };
}
