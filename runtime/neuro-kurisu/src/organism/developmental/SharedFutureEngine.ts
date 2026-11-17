import type { ActionGateway, ToolDefinition, ToolExecutionContext } from '../system/ActionGateway.ts';

export type SharedFutureOwner = 'user' | 'system' | 'shared';
export type SharedFutureScenarioStatus = 'draft' | 'active' | 'contingency' | 'achieved' | 'invalidated' | 'superseded';
export type SharedFutureDecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type SharedFutureReviewAction = 'confirm' | 'defer' | 'revise' | 'invalidate';
export type SharedFutureSignalKind = 'manual' | 'metric-below' | 'metric-above' | 'date';

export interface SharedFutureAssumption {
  id: string;
  statement: string;
  source: string;
  confidence01: number;
  status: 'assumed' | 'supported' | 'challenged' | 'expired';
  checkedAt: number;
  expiresAt: number | null;
}

export interface SharedFutureGoalLink {
  id: string;
  owner: SharedFutureOwner;
  relationship: 'supports' | 'blocks' | 'depends-on';
}

export interface SharedFutureConsequence {
  id: string;
  description: string;
  probability01: number;
  impact01: number;
  horizonDays: number;
  reversible: boolean;
}

export interface SharedFuturePointOfNoReturn {
  id: string;
  description: string;
  mitigationPlan: string;
  compensationPlan: string;
  requiresExplicitConfirmation: boolean;
}

export interface SharedFutureRevisionSignal {
  id: string;
  kind: SharedFutureSignalKind;
  description: string;
  metricKey?: string;
  threshold?: number;
  dueAt?: number;
  lastTriggeredAt: number | null;
  triggerCount: number;
}

export interface SharedFutureForecast {
  source: 'WorldModel2.rollout';
  simulatedAt: number;
  expectedReward: number;
  uncertainty01: number;
  path: Array<{ action: string; reward: number; uncertainty: number; confidence: number }>;
  independentlyVerified: false;
}

export interface SharedFutureScenario {
  id: string;
  title: string;
  description: string;
  owner: SharedFutureOwner;
  status: SharedFutureScenarioStatus;
  parentId: string | null;
  alternativeGroupId: string | null;
  probability01: number;
  confidence01: number;
  uncertainty01: number;
  horizonDays: number;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt: number;
  nextReviewAt: number | null;
  reviewRequired: boolean;
  reviewReasons: string[];
  assumptions: SharedFutureAssumption[];
  goalLinks: SharedFutureGoalLink[];
  consequences: SharedFutureConsequence[];
  pointsOfNoReturn: SharedFuturePointOfNoReturn[];
  revisionSignals: SharedFutureRevisionSignal[];
  forecast: SharedFutureForecast | null;
}

export interface SharedFutureDecision {
  id: string;
  scenarioId: string;
  title: string;
  rationale: string;
  owner: SharedFutureOwner;
  status: SharedFutureDecisionStatus;
  dependsOn: string[];
  irreversible: boolean;
  pointOfNoReturnId: string | null;
  compensationPlan: string;
  proposedAt: number;
  confirmedAt: number | null;
  confirmedBy: 'user' | 'system' | null;
  executionStatus: 'not-executed';
}

export interface SharedFutureReviewRecord {
  id: string;
  scenarioId: string;
  at: number;
  action: SharedFutureReviewAction;
  actor: 'user' | 'system';
  note: string;
  successorScenarioId: string | null;
}

export interface SharedFutureSignalRecord {
  id: string;
  scenarioId: string;
  signalId: string;
  at: number;
  kind: SharedFutureSignalKind;
  source: 'caller-reported' | 'internal-clock';
  triggered: boolean;
  reason: string;
}

export interface SharedFutureState {
  version: 1;
  scenarios: SharedFutureScenario[];
  decisions: SharedFutureDecision[];
  reviewHistory: SharedFutureReviewRecord[];
  signalHistory: SharedFutureSignalRecord[];
  forecastUpdates: number;
  rejectedMutations: number;
}

export interface SharedFutureScenarioInput {
  id: string;
  title: string;
  description?: string;
  owner?: SharedFutureOwner;
  confirmUserOwned?: boolean;
  confirmShared?: boolean;
  status?: SharedFutureScenarioStatus;
  parentId?: string | null;
  alternativeGroupId?: string | null;
  probability01?: number;
  confidence01?: number;
  uncertainty01?: number;
  horizonDays?: number;
  at?: number;
  assumptions?: Array<Record<string, unknown>>;
  goalLinks?: Array<Record<string, unknown>>;
  consequences?: Array<Record<string, unknown>>;
  pointsOfNoReturn?: Array<Record<string, unknown>>;
  revisionSignals?: Array<Record<string, unknown>>;
}

export interface SharedFutureDecisionInput {
  id: string;
  scenarioId: string;
  title: string;
  rationale?: string;
  owner?: SharedFutureOwner;
  confirmUserOwned?: boolean;
  confirmShared?: boolean;
  dependsOn?: string[];
  irreversible?: boolean;
  pointOfNoReturnId?: string | null;
  compensationPlan?: string;
  at?: number;
}

const MAX_SCENARIOS = 48;
const MAX_DECISIONS = 128;
const MAX_REVIEW_HISTORY = 128;
const MAX_SIGNAL_HISTORY = 192;
const MAX_ASSUMPTIONS = 12;
const MAX_GOAL_LINKS = 16;
const MAX_CONSEQUENCES = 16;
const MAX_POINTS_OF_NO_RETURN = 8;
const MAX_REVISION_SIGNALS = 16;
const MAX_TEXT = 1200;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textField(value: unknown, field: string, limit = MAX_TEXT, required = true): string {
  if (typeof value !== 'string') {
    if (required) throw new Error(field + '-required');
    return '';
  }
  const result = value.trim();
  if (required && !result) throw new Error(field + '-required');
  if (result.length > limit) throw new Error(field + '-too-long');
  return result;
}

function restoredText(value: unknown, fallback = '', limit = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : fallback;
}

function idField(value: unknown, field: string): string {
  const id = textField(value, field, 96);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(id)) throw new Error(field + '-invalid');
  return id;
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function timestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function ownerField(value: unknown, fallback: SharedFutureOwner): SharedFutureOwner {
  return value === 'user' || value === 'system' || value === 'shared' ? value : fallback;
}

function statusField(value: unknown, fallback: SharedFutureScenarioStatus): SharedFutureScenarioStatus {
  return value === 'draft' || value === 'active' || value === 'contingency' ||
    value === 'achieved' || value === 'invalidated' || value === 'superseded' ? value : fallback;
}

function uniqueStrings(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string =>
    typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/.test(value)
  ))].slice(0, limit);
}

function reasonCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'shared-future-operation-failed';
  return raw.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 120) || 'shared-future-operation-failed';
}

export const defaultSharedFutureState = (): SharedFutureState => ({
  version: 1,
  scenarios: [],
  decisions: [],
  reviewHistory: [],
  signalHistory: [],
  forecastUpdates: 0,
  rejectedMutations: 0,
});

export class SharedFutureEngine {
  private state: SharedFutureState = defaultSharedFutureState();

  snapshot(): SharedFutureState {
    return structuredClone(this.state);
  }

  restore(raw?: Partial<SharedFutureState> | null): void {
    const base = defaultSharedFutureState();
    const source = isRecord(raw) ? raw : {};
    const scenarios = Array.isArray(source.scenarios)
      ? source.scenarios.slice(0, MAX_SCENARIOS).filter(isRecord).map((row) => this.restoreScenario(row))
      : [];
    const scenarioIds = new Set(scenarios.map((row) => row.id));
    for (const row of scenarios) {
      if (row.parentId && !scenarioIds.has(row.parentId)) row.parentId = null;
      if (row.parentId === row.id) row.parentId = null;
    }
    const decisions = Array.isArray(source.decisions)
      ? source.decisions.slice(0, MAX_DECISIONS).filter(isRecord)
          .map((row) => this.restoreDecision(row))
          .filter((row) => scenarioIds.has(row.scenarioId))
      : [];
    const decisionIds = new Set(decisions.map((row) => row.id));
    for (const decision of decisions) {
      decision.dependsOn = decision.dependsOn.filter((id) => decisionIds.has(id) && id !== decision.id);
    }
    const reviewHistory = Array.isArray(source.reviewHistory)
      ? source.reviewHistory.slice(0, MAX_REVIEW_HISTORY).filter(isRecord).map((row) => ({
          id: restoredText(row.id, 'restored-review', 96),
          scenarioId: restoredText(row.scenarioId, '', 96),
          at: timestamp(row.at, 0),
          action: row.action === 'confirm' || row.action === 'defer' || row.action === 'revise' || row.action === 'invalidate'
            ? row.action : 'defer',
          actor: row.actor === 'user' ? 'user' as const : 'system' as const,
          note: restoredText(row.note, '', 500),
          successorScenarioId: typeof row.successorScenarioId === 'string' ? row.successorScenarioId.slice(0, 96) : null,
        }))
      : [];
    const signalHistory = Array.isArray(source.signalHistory)
      ? source.signalHistory.slice(0, MAX_SIGNAL_HISTORY).filter(isRecord).map((row) => ({
          id: restoredText(row.id, 'restored-signal', 96),
          scenarioId: restoredText(row.scenarioId, '', 96),
          signalId: restoredText(row.signalId, '', 96),
          at: timestamp(row.at, 0),
          kind: row.kind === 'manual' || row.kind === 'metric-below' || row.kind === 'metric-above' || row.kind === 'date'
            ? row.kind : 'manual',
          source: row.source === 'internal-clock' ? 'internal-clock' as const : 'caller-reported' as const,
          triggered: row.triggered === true,
          reason: restoredText(row.reason, '', 500),
        }))
      : [];
    this.state = {
      ...base,
      scenarios,
      decisions,
      reviewHistory,
      signalHistory,
      forecastUpdates: timestamp(source.forecastUpdates, 0),
      rejectedMutations: timestamp(source.rejectedMutations, 0),
    };
  }

  private restoreScenario(row: Record<string, unknown>): SharedFutureScenario {
    const owner = ownerField(row.owner, 'system');
    const assumptions = Array.isArray(row.assumptions) ? row.assumptions.slice(0, MAX_ASSUMPTIONS).filter(isRecord).map((item, index) => ({
      id: restoredText(item.id, 'assumption-' + index, 96),
      statement: restoredText(item.statement, '', MAX_TEXT),
      source: restoredText(item.source, 'unknown', 160),
      confidence01: finite(item.confidence01, 0.25, 0, 1),
      status: item.status === 'supported' || item.status === 'challenged' || item.status === 'expired' ? item.status : 'assumed',
      checkedAt: timestamp(item.checkedAt, 0),
      expiresAt: item.expiresAt === null ? null : timestamp(item.expiresAt, 0),
    })) : [];
    const goalLinks = Array.isArray(row.goalLinks) ? row.goalLinks.slice(0, MAX_GOAL_LINKS).filter(isRecord).map((item) => ({
      id: restoredText(item.id, '', 96),
      owner: ownerField(item.owner, owner),
      relationship: item.relationship === 'blocks' || item.relationship === 'depends-on' ? item.relationship : 'supports',
    })).filter((item) => item.id) : [];
    const consequences = Array.isArray(row.consequences) ? row.consequences.slice(0, MAX_CONSEQUENCES).filter(isRecord).map((item, index) => ({
      id: restoredText(item.id, 'consequence-' + index, 96),
      description: restoredText(item.description, '', MAX_TEXT),
      probability01: finite(item.probability01, 0.5, 0, 1),
      impact01: finite(item.impact01, 0.5, 0, 1),
      horizonDays: Math.max(0, Math.floor(finite(item.horizonDays, 30, 0, 36500))),
      reversible: item.reversible !== false,
    })) : [];
    const pointsOfNoReturn = Array.isArray(row.pointsOfNoReturn) ? row.pointsOfNoReturn.slice(0, MAX_POINTS_OF_NO_RETURN).filter(isRecord).map((item, index) => ({
      id: restoredText(item.id, 'ponr-' + index, 96),
      description: restoredText(item.description, '', MAX_TEXT),
      mitigationPlan: restoredText(item.mitigationPlan, '', MAX_TEXT),
      compensationPlan: restoredText(item.compensationPlan, '', MAX_TEXT),
      requiresExplicitConfirmation: item.requiresExplicitConfirmation !== false,
    })) : [];
    const revisionSignals = Array.isArray(row.revisionSignals) ? row.revisionSignals.slice(0, MAX_REVISION_SIGNALS).filter(isRecord).map((item, index) => ({
      id: restoredText(item.id, 'signal-' + index, 96),
      kind: item.kind === 'metric-below' || item.kind === 'metric-above' || item.kind === 'date' ? item.kind : 'manual',
      description: restoredText(item.description, '', MAX_TEXT),
      ...(typeof item.metricKey === 'string' ? { metricKey: item.metricKey.slice(0, 100) } : {}),
      ...(typeof item.threshold === 'number' && Number.isFinite(item.threshold) ? { threshold: item.threshold } : {}),
      ...(typeof item.dueAt === 'number' && Number.isFinite(item.dueAt) ? { dueAt: timestamp(item.dueAt, 0) } : {}),
      lastTriggeredAt: item.lastTriggeredAt === null ? null : timestamp(item.lastTriggeredAt, 0),
      triggerCount: timestamp(item.triggerCount, 0),
    })) : [];
    const forecastRow = isRecord(row.forecast) ? row.forecast : null;
    const forecast: SharedFutureForecast | null = forecastRow ? {
      source: 'WorldModel2.rollout',
      simulatedAt: timestamp(forecastRow.simulatedAt, 0),
      expectedReward: finite(forecastRow.expectedReward, 0, -1, 1),
      uncertainty01: finite(forecastRow.uncertainty01, 1, 0, 1),
      path: Array.isArray(forecastRow.path) ? forecastRow.path.slice(0, 6).filter(isRecord).map((item) => ({
        action: restoredText(item.action, 'unknown-action', 100),
        reward: finite(item.reward, 0, -1, 1),
        uncertainty: finite(item.uncertainty, 1, 0, 1),
        confidence: finite(item.confidence, 0, 0, 1),
      })) : [],
      independentlyVerified: false,
    } : null;
    return {
      id: restoredText(row.id, 'restored-scenario', 96),
      title: restoredText(row.title, 'Untitled scenario', 180),
      description: restoredText(row.description, '', MAX_TEXT),
      owner,
      status: statusField(row.status, 'draft'),
      parentId: typeof row.parentId === 'string' ? row.parentId.slice(0, 96) : null,
      alternativeGroupId: typeof row.alternativeGroupId === 'string' ? row.alternativeGroupId.slice(0, 96) : null,
      probability01: finite(row.probability01, 0.5, 0, 1),
      confidence01: finite(row.confidence01, 0.25, 0, 1),
      uncertainty01: finite(row.uncertainty01, 0.75, 0, 1),
      horizonDays: Math.max(0, Math.floor(finite(row.horizonDays, 30, 0, 36500))),
      createdAt: timestamp(row.createdAt, 0),
      updatedAt: timestamp(row.updatedAt, 0),
      lastReviewedAt: timestamp(row.lastReviewedAt, 0),
      nextReviewAt: row.nextReviewAt === null ? null : timestamp(row.nextReviewAt, 0),
      reviewRequired: row.reviewRequired === true,
      reviewReasons: Array.isArray(row.reviewReasons) ? row.reviewReasons.filter((v): v is string => typeof v === 'string').slice(0, 12).map((v) => v.slice(0, 180)) : [],
      assumptions,
      goalLinks,
      consequences,
      pointsOfNoReturn,
      revisionSignals,
      forecast,
    };
  }

  private restoreDecision(row: Record<string, unknown>): SharedFutureDecision {
    return {
      id: restoredText(row.id, 'restored-decision', 96),
      scenarioId: restoredText(row.scenarioId, '', 96),
      title: restoredText(row.title, 'Untitled decision', 180),
      rationale: restoredText(row.rationale, '', MAX_TEXT),
      owner: ownerField(row.owner, 'system'),
      status: row.status === 'accepted' || row.status === 'rejected' || row.status === 'superseded' ? row.status : 'proposed',
      dependsOn: uniqueStrings(row.dependsOn, 24),
      irreversible: row.irreversible === true,
      pointOfNoReturnId: typeof row.pointOfNoReturnId === 'string' ? row.pointOfNoReturnId.slice(0, 96) : null,
      compensationPlan: restoredText(row.compensationPlan, '', MAX_TEXT),
      proposedAt: timestamp(row.proposedAt, 0),
      confirmedAt: row.confirmedAt === null ? null : timestamp(row.confirmedAt, 0),
      confirmedBy: row.confirmedBy === 'user' ? 'user' : row.confirmedBy === 'system' ? 'system' : null,
      executionStatus: 'not-executed',
    };
  }

  private assertOwner(owner: SharedFutureOwner, actor: 'user' | 'system', input: { confirmUserOwned?: boolean; confirmShared?: boolean }): void {
    if (owner === 'user' && (actor !== 'user' || input.confirmUserOwned !== true)) {
      throw new Error('user-owned-scenario-requires-human-confirmation');
    }
    if (owner === 'shared' && (actor !== 'user' || input.confirmShared !== true)) {
      throw new Error('shared-ownership-requires-human-confirmation');
    }
  }

  private requireScenario(id: string): SharedFutureScenario {
    const scenario = this.state.scenarios.find((row) => row.id === id);
    if (!scenario) throw new Error('scenario-not-found');
    return scenario;
  }

  private appendReview(row: SharedFutureReviewRecord): void {
    this.state.reviewHistory = [row, ...this.state.reviewHistory].slice(0, MAX_REVIEW_HISTORY);
  }

  private requireReview(scenario: SharedFutureScenario, reason: string, at: number, source: 'caller-reported' | 'internal-clock'): void {
    if (!scenario.reviewReasons.includes(reason)) {
      scenario.reviewReasons = [...scenario.reviewReasons, reason].slice(-12);
      scenario.reviewRequired = true;
      scenario.updatedAt = at;
      this.state.signalHistory = [{
        id: 'sf-signal-' + at.toString(36) + '-' + this.state.signalHistory.length.toString(36),
        scenarioId: scenario.id,
        signalId: reason,
        at,
        kind: source === 'internal-clock' ? 'date' : 'manual',
        source,
        triggered: true,
        reason,
      }, ...this.state.signalHistory].slice(0, MAX_SIGNAL_HISTORY);
    }
  }

  createScenario(input: SharedFutureScenarioInput, actor: 'user' | 'system' = 'system'): SharedFutureScenario {
    try {
      const id = idField(input.id, 'scenario-id');
      if (this.state.scenarios.some((row) => row.id === id)) throw new Error('scenario-id-conflict');
      if (this.state.scenarios.length >= MAX_SCENARIOS) throw new Error('scenario-capacity-reached');
      const owner = ownerField(input.owner, actor === 'user' ? 'user' : 'system');
      this.assertOwner(owner, actor, input);
      const at = timestamp(input.at, Date.now());
      const parentId = input.parentId ? idField(input.parentId, 'parent-scenario-id') : null;
      if (parentId) {
        if (!this.state.scenarios.some((row) => row.id === parentId)) throw new Error('parent-scenario-not-found');
        let depth = 1;
        let cursor = this.state.scenarios.find((row) => row.id === parentId) ?? null;
        while (cursor?.parentId) {
          depth++;
          if (depth > 8) throw new Error('scenario-tree-depth-limit');
          cursor = this.state.scenarios.find((row) => row.id === cursor!.parentId) ?? null;
        }
      }
      const alternativeGroupId = input.alternativeGroupId ? idField(input.alternativeGroupId, 'alternative-group-id') : null;
      const probability01 = finite(input.probability01, 0.5, 0, 1);
      if (alternativeGroupId) {
        const siblingProbability = this.state.scenarios
          .filter((row) => row.alternativeGroupId === alternativeGroupId && row.parentId === parentId &&
            row.status !== 'invalidated' && row.status !== 'superseded')
          .reduce((sum, row) => sum + row.probability01, 0);
        if (siblingProbability + probability01 > 1.001) throw new Error('alternative-probability-total-exceeded');
      }
      const assumptions = (input.assumptions ?? []).slice(0, MAX_ASSUMPTIONS).map((row, index) => ({
        id: idField(row.id ?? 'assumption-' + index, 'assumption-id'),
        statement: textField(row.statement, 'assumption-statement'),
        source: textField(row.source ?? 'unspecified', 'assumption-source', 160),
        confidence01: finite(row.confidence01, 0.5, 0, 1),
        status: row.status === 'supported' || row.status === 'challenged' ? row.status : 'assumed',
        checkedAt: timestamp(row.checkedAt, at),
        expiresAt: row.expiresAt === null || row.expiresAt === undefined ? null : timestamp(row.expiresAt, at),
      }));
      const goalLinks = (input.goalLinks ?? []).slice(0, MAX_GOAL_LINKS).map((row) => ({
        id: idField(row.id, 'goal-reference-id'),
        owner: ownerField(row.owner, 'system'),
        relationship: row.relationship === 'blocks' || row.relationship === 'depends-on' ? row.relationship : 'supports',
      }));
      const consequences = (input.consequences ?? []).slice(0, MAX_CONSEQUENCES).map((row, index) => ({
        id: idField(row.id ?? 'consequence-' + index, 'consequence-id'),
        description: textField(row.description, 'consequence-description'),
        probability01: finite(row.probability01, 0.5, 0, 1),
        impact01: finite(row.impact01, 0.5, 0, 1),
        horizonDays: Math.floor(finite(row.horizonDays, 30, 0, 36500)),
        reversible: row.reversible !== false,
      }));
      const pointsOfNoReturn = (input.pointsOfNoReturn ?? []).slice(0, MAX_POINTS_OF_NO_RETURN).map((row, index) => ({
        id: idField(row.id ?? 'ponr-' + index, 'point-of-no-return-id'),
        description: textField(row.description, 'point-of-no-return-description'),
        mitigationPlan: textField(row.mitigationPlan, 'point-of-no-return-mitigation'),
        compensationPlan: textField(row.compensationPlan ?? '', 'point-of-no-return-compensation', MAX_TEXT, false),
        requiresExplicitConfirmation: row.requiresExplicitConfirmation !== false,
      }));
      const revisionSignals = (input.revisionSignals ?? []).slice(0, MAX_REVISION_SIGNALS).map((row, index) => {
        const kind = row.kind === 'metric-below' || row.kind === 'metric-above' || row.kind === 'date' ? row.kind : 'manual';
        const signal: SharedFutureRevisionSignal = {
          id: idField(row.id ?? 'signal-' + index, 'revision-signal-id'),
          kind,
          description: textField(row.description ?? 'Review this scenario when the signal occurs', 'revision-signal-description'),
          lastTriggeredAt: null,
          triggerCount: 0,
        };
        if (kind === 'metric-below' || kind === 'metric-above') {
          signal.metricKey = textField(row.metricKey, 'revision-signal-metric-key', 100);
          if (typeof row.threshold !== 'number' || !Number.isFinite(row.threshold)) throw new Error('revision-signal-threshold-required');
          signal.threshold = row.threshold;
        }
        if (kind === 'date') {
          if (typeof row.dueAt !== 'number' || !Number.isFinite(row.dueAt)) throw new Error('revision-signal-date-required');
          signal.dueAt = Math.max(0, Math.floor(row.dueAt));
        }
        return signal;
      });
      const scenario: SharedFutureScenario = {
        id,
        title: textField(input.title, 'scenario-title', 180),
        description: textField(input.description ?? '', 'scenario-description', MAX_TEXT, false),
        owner,
        status: statusField(input.status, 'draft'),
        parentId,
        alternativeGroupId,
        probability01,
        confidence01: finite(input.confidence01, 0.5, 0, 1),
        uncertainty01: finite(input.uncertainty01, 0.5, 0, 1),
        horizonDays: Math.floor(finite(input.horizonDays, 90, 0, 36500)),
        createdAt: at,
        updatedAt: at,
        lastReviewedAt: 0,
        nextReviewAt: null,
        reviewRequired: false,
        reviewReasons: [],
        assumptions,
        goalLinks,
        consequences,
        pointsOfNoReturn,
        revisionSignals,
        forecast: null,
      };
      this.state.scenarios = [...this.state.scenarios, scenario];
      return structuredClone(scenario);
    } catch (error) {
      this.state.rejectedMutations++;
      throw error;
    }
  }

  listScenarios(filter: { owner?: SharedFutureOwner; status?: SharedFutureScenarioStatus } = {}): SharedFutureScenario[] {
    return this.state.scenarios
      .filter((row) => (!filter.owner || row.owner === filter.owner) && (!filter.status || row.status === filter.status))
      .map((row) => structuredClone(row));
  }

  getScenario(id: string): SharedFutureScenario | null {
    const row = this.state.scenarios.find((scenario) => scenario.id === id);
    return row ? structuredClone(row) : null;
  }

  proposeDecision(input: SharedFutureDecisionInput, actor: 'user' | 'system' = 'system'): SharedFutureDecision {
    try {
      if (this.state.decisions.length >= MAX_DECISIONS) throw new Error('decision-capacity-reached');
      const id = idField(input.id, 'decision-id');
      if (this.state.decisions.some((row) => row.id === id)) throw new Error('decision-id-conflict');
      const scenarioId = idField(input.scenarioId, 'decision-scenario-id');
      const scenario = this.requireScenario(scenarioId);
      if (scenario.status === 'achieved' || scenario.status === 'invalidated' || scenario.status === 'superseded') {
        throw new Error('scenario-not-open-for-decisions');
      }
      const owner = ownerField(input.owner, actor === 'user' ? scenario.owner : 'system');
      this.assertOwner(owner, actor, input);
      const dependsOn = uniqueStrings(input.dependsOn, 24);
      if (dependsOn.includes(id)) throw new Error('decision-self-dependency');
      if (dependsOn.some((dependencyId) => !this.state.decisions.some((row) => row.id === dependencyId))) {
        throw new Error('decision-dependency-not-found');
      }
      const pointOfNoReturnId = input.pointOfNoReturnId ? idField(input.pointOfNoReturnId, 'point-of-no-return-id') : null;
      const point = pointOfNoReturnId
        ? scenario.pointsOfNoReturn.find((row) => row.id === pointOfNoReturnId)
        : null;
      if (pointOfNoReturnId && !point) throw new Error('point-of-no-return-not-found');
      const irreversible = input.irreversible === true || Boolean(point?.requiresExplicitConfirmation);
      const decision: SharedFutureDecision = {
        id,
        scenarioId,
        title: textField(input.title, 'decision-title', 180),
        rationale: textField(input.rationale ?? '', 'decision-rationale', MAX_TEXT, false),
        owner,
        status: 'proposed',
        dependsOn,
        irreversible,
        pointOfNoReturnId,
        compensationPlan: textField(input.compensationPlan ?? point?.compensationPlan ?? '', 'decision-compensation-plan', MAX_TEXT, false),
        proposedAt: timestamp(input.at, Date.now()),
        confirmedAt: null,
        confirmedBy: null,
        executionStatus: 'not-executed',
      };
      this.state.decisions = [...this.state.decisions, decision];
      return structuredClone(decision);
    } catch (error) {
      this.state.rejectedMutations++;
      throw error;
    }
  }

  getDecision(id: string): SharedFutureDecision | null {
    const decision = this.state.decisions.find((row) => row.id === id);
    return decision ? structuredClone(decision) : null;
  }

  confirmDecision(input: { decisionId: string; confirmIrreversible?: boolean; at?: number }, actor: 'user' | 'system'): SharedFutureDecision {
    try {
      const decisionId = idField(input.decisionId, 'decision-id');
      const decision = this.state.decisions.find((row) => row.id === decisionId);
      if (!decision) throw new Error('decision-not-found');
      if (decision.status !== 'proposed') throw new Error('decision-not-pending');
      if (decision.owner !== 'system' && actor !== 'user') throw new Error('human-confirmation-required');
      if (decision.irreversible && actor !== 'user') throw new Error('irreversible-decision-requires-human');
      if (decision.dependsOn.some((id) => this.state.decisions.find((row) => row.id === id)?.status !== 'accepted')) {
        throw new Error('decision-dependencies-not-accepted');
      }
      if (decision.irreversible) {
        if (!decision.compensationPlan.trim()) throw new Error('compensation-plan-required');
        if (input.confirmIrreversible !== true) throw new Error('irreversible-confirmation-required');
      }
      const at = timestamp(input.at, Date.now());
      decision.status = 'accepted';
      decision.confirmedAt = at;
      decision.confirmedBy = actor;
      decision.executionStatus = 'not-executed';
      return structuredClone(decision);
    } catch (error) {
      this.state.rejectedMutations++;
      throw error;
    }
  }

  observeSignal(input: {
    scenarioId: string;
    signalId?: string;
    metricKey?: string;
    metricValue?: number;
    at?: number;
  }): { triggered: string[]; reviewRequired: boolean; reasons: string[] } {
    const scenario = this.requireScenario(idField(input.scenarioId, 'signal-scenario-id'));
    const at = timestamp(input.at, Date.now());
    this.refresh(at);
    const triggered: string[] = [];
    for (const signal of scenario.revisionSignals) {
      let didTrigger = false;
      let source: 'caller-reported' | 'internal-clock' = 'caller-reported';
      if (signal.kind === 'manual') {
        didTrigger = Boolean(input.signalId && input.signalId === signal.id);
      } else if (signal.kind === 'date') {
        didTrigger = signal.dueAt !== undefined && at >= signal.dueAt;
        source = 'internal-clock';
      } else if (signal.metricKey === input.metricKey && typeof input.metricValue === 'number' && Number.isFinite(input.metricValue)) {
        didTrigger = signal.kind === 'metric-below'
          ? input.metricValue < (signal.threshold ?? Number.NEGATIVE_INFINITY)
          : input.metricValue > (signal.threshold ?? Number.POSITIVE_INFINITY);
      }
      if (!didTrigger || signal.lastTriggeredAt !== null) continue;
      signal.lastTriggeredAt = at;
      signal.triggerCount++;
      const reason = 'signal:' + signal.id + ':' + signal.description.slice(0, 100);
      this.requireReview(scenario, reason, at, source);
      this.state.signalHistory = [{
        id: 'sf-observed-' + at.toString(36) + '-' + this.state.signalHistory.length.toString(36),
        scenarioId: scenario.id,
        signalId: signal.id,
        at,
        kind: signal.kind,
        source,
        triggered: true,
        reason,
      }, ...this.state.signalHistory].slice(0, MAX_SIGNAL_HISTORY);
      triggered.push(signal.id);
    }
    return { triggered, reviewRequired: scenario.reviewRequired, reasons: [...scenario.reviewReasons] };
  }

  refresh(at = Date.now()): { scenarioId: string; reason: string }[] {
    const due: Array<{ scenarioId: string; reason: string }> = [];
    for (const scenario of this.state.scenarios) {
      if (scenario.status === 'invalidated' || scenario.status === 'superseded' || scenario.status === 'achieved') continue;
      for (const assumption of scenario.assumptions) {
        if (assumption.status === 'assumed' && assumption.expiresAt !== null && at >= assumption.expiresAt) {
          assumption.status = 'expired';
          const reason = 'assumption-expired:' + assumption.id;
          this.requireReview(scenario, reason, at, 'internal-clock');
          due.push({ scenarioId: scenario.id, reason });
        }
      }
      for (const signal of scenario.revisionSignals) {
        if (signal.kind !== 'date' || signal.dueAt === undefined || signal.lastTriggeredAt !== null || at < signal.dueAt) continue;
        signal.lastTriggeredAt = at;
        signal.triggerCount++;
        const reason = 'date-signal:' + signal.id + ':' + signal.description.slice(0, 100);
        this.requireReview(scenario, reason, at, 'internal-clock');
        due.push({ scenarioId: scenario.id, reason });
      }
    }
    return due;
  }

  resolveReview(input: {
    scenarioId: string;
    action: SharedFutureReviewAction;
    note?: string;
    successorScenarioId?: string;
    deferDays?: number;
    at?: number;
  }, actor: 'user' | 'system'): SharedFutureScenario {
    try {
      const scenario = this.requireScenario(idField(input.scenarioId, 'review-scenario-id'));
      if (scenario.owner !== 'system' && actor !== 'user') throw new Error('human-review-resolution-required');
      if (!scenario.reviewRequired) throw new Error('scenario-review-not-required');
      const at = timestamp(input.at, Date.now());
      const note = textField(input.note ?? '', 'review-note', 500, false);
      let successorScenarioId: string | null = null;
      if (input.action === 'confirm') {
        scenario.reviewRequired = false;
        scenario.reviewReasons = [];
        scenario.nextReviewAt = null;
        scenario.lastReviewedAt = at;
        scenario.updatedAt = at;
      } else if (input.action === 'defer') {
        const days = Math.floor(finite(input.deferDays, 1, 1, 365));
        scenario.nextReviewAt = at + days * 86_400_000;
        scenario.lastReviewedAt = at;
        scenario.updatedAt = at;
      } else if (input.action === 'invalidate') {
        scenario.status = 'invalidated';
        scenario.reviewRequired = false;
        scenario.reviewReasons = [];
        scenario.lastReviewedAt = at;
        scenario.updatedAt = at;
      } else if (input.action === 'revise') {
        successorScenarioId = idField(input.successorScenarioId, 'successor-scenario-id');
        const successor = this.requireScenario(successorScenarioId);
        if (successor.parentId !== scenario.id || successor.owner !== scenario.owner) {
          throw new Error('revision-successor-must-be-owned-child-scenario');
        }
        if (successor.status === 'invalidated' || successor.status === 'superseded') {
          throw new Error('revision-successor-not-usable');
        }
        scenario.status = 'superseded';
        scenario.reviewRequired = false;
        scenario.reviewReasons = [];
        scenario.lastReviewedAt = at;
        scenario.updatedAt = at;
        successor.status = 'active';
        successor.updatedAt = at;
        successor.lastReviewedAt = at;
      } else {
        throw new Error('invalid-review-action');
      }
      this.appendReview({
        id: 'sf-review-' + at.toString(36) + '-' + this.state.reviewHistory.length.toString(36),
        scenarioId: scenario.id,
        at,
        action: input.action,
        actor,
        note,
        successorScenarioId,
      });
      return structuredClone(input.action === 'revise'
        ? this.requireScenario(successorScenarioId!)
        : scenario);
    } catch (error) {
      this.state.rejectedMutations++;
      throw error;
    }
  }

  recordRuntimeForecast(input: {
    path: Array<{ action: string; reward: number; uncertainty: number; confidence: number }>;
    expectedReward: number;
    uncertainty: number;
    horizon: number;
    at?: number;
  }): SharedFutureScenario | null {
    const at = timestamp(input.at, Date.now());
    const id = 'runtime-world-preview';
    const path = (Array.isArray(input.path) ? input.path : []).slice(0, 6).map((row) => ({
      action: textField(row.action, 'forecast-action', 100),
      reward: finite(row.reward, 0, -1, 1),
      uncertainty: finite(row.uncertainty, 1, 0, 1),
      confidence: finite(row.confidence, 0, 0, 1),
    }));
    const uncertainty01 = finite(input.uncertainty, 1, 0, 1);
    const forecast: SharedFutureForecast = {
      source: 'WorldModel2.rollout',
      simulatedAt: at,
      expectedReward: finite(input.expectedReward, 0, -1, 1),
      uncertainty01,
      path,
      independentlyVerified: false,
    };
    const existing = this.state.scenarios.find((row) => row.id === id);
    if (!existing && this.state.scenarios.length >= MAX_SCENARIOS) return null;
    if (existing) {
      existing.forecast = forecast;
      existing.confidence01 = 1 - uncertainty01;
      existing.uncertainty01 = uncertainty01;
      existing.updatedAt = at;
      existing.assumptions = [{
        id: 'world-model2-rollout',
        statement: 'Internal WorldModel2 rollout; not an observed external outcome',
        source: 'WorldModel2.rollout',
        confidence01: 1 - uncertainty01,
        status: 'assumed',
        checkedAt: at,
        expiresAt: at + 15 * 60_000,
      }];
    } else {
      this.state.scenarios.push({
        id,
        title: 'Runtime world preview',
        description: 'Ephemeral model-based scenario used as a planning hint, not as a factual prediction.',
        owner: 'system',
        status: 'draft',
        parentId: null,
        alternativeGroupId: null,
        probability01: 0.5,
        confidence01: 1 - uncertainty01,
        uncertainty01,
        horizonDays: Math.max(0, Math.floor(finite(input.horizon, 1, 0, 36500))),
        createdAt: at,
        updatedAt: at,
        lastReviewedAt: 0,
        nextReviewAt: null,
        reviewRequired: false,
        reviewReasons: [],
        assumptions: [{
          id: 'world-model2-rollout',
          statement: 'Internal WorldModel2 rollout; not an observed external outcome',
          source: 'WorldModel2.rollout',
          confidence01: 1 - uncertainty01,
          status: 'assumed',
          checkedAt: at,
          expiresAt: at + 15 * 60_000,
        }],
        goalLinks: [],
        consequences: [],
        pointsOfNoReturn: [],
        revisionSignals: [],
        forecast,
      });
    }
    this.state.forecastUpdates++;
    return structuredClone(existing ?? this.state.scenarios[this.state.scenarios.length - 1]!);
  }

  diagnostics(): {
    scenarios: number;
    decisions: number;
    pendingDecisions: number;
    reviewRequired: number;
    sharedScenarios: number;
    forecasts: number;
    rejectedMutations: number;
  } {
    return {
      scenarios: this.state.scenarios.length,
      decisions: this.state.decisions.length,
      pendingDecisions: this.state.decisions.filter((row) => row.status === 'proposed').length,
      reviewRequired: this.state.scenarios.filter((row) => row.reviewRequired).length,
      sharedScenarios: this.state.scenarios.filter((row) => row.owner === 'shared').length,
      forecasts: this.state.scenarios.filter((row) => row.forecast !== null).length,
      rejectedMutations: this.state.rejectedMutations,
    };
  }
}

function isHumanContext(context?: ToolExecutionContext): boolean {
  return Boolean(context && context.autonomous !== true);
}

function toolSuccess(value: Record<string, unknown>): Record<string, unknown> {
  return { ok: true, verified: false, verificationScope: 'local-future-ledger-only', ...value };
}

function toolFailure(error: unknown): Record<string, unknown> {
  return { ok: false, verified: false, error: reasonCode(error), verificationScope: 'local-future-ledger-only' };
}

function executeSafely(run: () => Record<string, unknown>): Record<string, unknown> {
  try { return toolSuccess(run()); } catch (error) { return toolFailure(error); }
}

export function registerSharedFutureTools(
  gateway: Pick<ActionGateway, 'registerTool'>,
  simulator: { sharedFuture: SharedFutureEngine },
): void {
  const future = simulator.sharedFuture;
  const register = (definition: ToolDefinition) => gateway.registerTool(definition);

  register({
    id: 'organism.future.scenarios.list',
    capability: 'planning.future.read',
    destructive: false,
    projectAllowed: true,
    execute: async (input) => executeSafely(() => ({
      scenarios: future.listScenarios({
        ...(input.owner === 'user' || input.owner === 'system' || input.owner === 'shared' ? { owner: input.owner } : {}),
        ...(input.status === 'draft' || input.status === 'active' || input.status === 'contingency' ||
          input.status === 'achieved' || input.status === 'invalidated' || input.status === 'superseded'
          ? { status: input.status } : {}),
      }),
      diagnostics: future.diagnostics(),
    })),
  });

  register({
    id: 'organism.future.scenarios.create-system',
    capability: 'planning.future.write',
    destructive: false,
    projectAllowed: true,
    execute: async (input) => executeSafely(() => {
      if (input.owner !== undefined && input.owner !== 'system') throw new Error('system-scenario-owner-only');
      return { scenario: future.createScenario(input as unknown as SharedFutureScenarioInput, 'system') };
    }),
  });

  register({
    id: 'organism.future.scenarios.create-collaborative',
    capability: 'planning.future.write',
    destructive: false,
    permissionClass: 'self-modification',
    projectAllowed: true,
    execute: async (input, context) => executeSafely(() => {
      if (!isHumanContext(context)) throw new Error('human-approval-context-required');
      if (input.owner !== 'user' && input.owner !== 'shared') throw new Error('collaborative-owner-required');
      return { scenario: future.createScenario(input as unknown as SharedFutureScenarioInput, 'user') };
    }),
  });

  register({
    id: 'organism.future.decisions.propose',
    capability: 'planning.future.write',
    destructive: false,
    projectAllowed: true,
    execute: async (input) => executeSafely(() => {
      if (input.owner !== undefined && input.owner !== 'system') throw new Error('system-decision-owner-only');
      return { decision: future.proposeDecision(input as unknown as SharedFutureDecisionInput, 'system') };
    }),
  });

  register({
    id: 'organism.future.decisions.propose-collaborative',
    capability: 'planning.future.write',
    destructive: false,
    permissionClass: 'self-modification',
    projectAllowed: true,
    execute: async (input, context) => executeSafely(() => {
      if (!isHumanContext(context)) throw new Error('human-approval-context-required');
      if (input.owner !== 'user' && input.owner !== 'shared') throw new Error('collaborative-owner-required');
      return { decision: future.proposeDecision(input as unknown as SharedFutureDecisionInput, 'user') };
    }),
  });

  register({
    id: 'organism.future.decisions.confirm',
    capability: 'planning.future.write',
    destructive: false,
    permissionClass: 'self-modification',
    projectAllowed: true,
    execute: async (input, context) => executeSafely(() => {
      const actor = isHumanContext(context) ? 'user' : 'system';
      return { decision: future.confirmDecision({
        decisionId: String(input.decisionId ?? ''),
        confirmIrreversible: input.confirmIrreversible === true,
        at: typeof input.at === 'number' ? input.at : undefined,
      }, actor) };
    }),
  });

  register({
    id: 'organism.future.signals.observe',
    capability: 'planning.future.read',
    destructive: false,
    projectAllowed: true,
    execute: async (input) => executeSafely(() => ({
      observation: future.observeSignal({
        scenarioId: String(input.scenarioId ?? ''),
        signalId: typeof input.signalId === 'string' ? input.signalId : undefined,
        metricKey: typeof input.metricKey === 'string' ? input.metricKey : undefined,
        metricValue: typeof input.metricValue === 'number' ? input.metricValue : undefined,
        at: typeof input.at === 'number' ? input.at : undefined,
      }),
      note: 'Signals can request review; they do not prove an external fact or execute a plan.',
    })),
  });

  register({
    id: 'organism.future.reviews.resolve',
    capability: 'planning.future.write',
    destructive: false,
    permissionClass: 'self-modification',
    projectAllowed: true,
    execute: async (input, context) => executeSafely(() => {
      const actor = isHumanContext(context) ? 'user' : 'system';
      const action = input.action;
      if (action !== 'confirm' && action !== 'defer' && action !== 'revise' && action !== 'invalidate') {
        throw new Error('invalid-review-action');
      }
      return { scenario: future.resolveReview({
        scenarioId: String(input.scenarioId ?? ''),
        action,
        note: typeof input.note === 'string' ? input.note : undefined,
        successorScenarioId: typeof input.successorScenarioId === 'string' ? input.successorScenarioId : undefined,
        deferDays: typeof input.deferDays === 'number' ? input.deferDays : undefined,
        at: typeof input.at === 'number' ? input.at : undefined,
      }, actor) };
    }),
  });
}
