import { createHash } from 'node:crypto';
import type { CognitiveEventNode } from './CognitiveEventFabric.ts';
import type { RealityEvidenceLedgerState } from './RealityEvidenceLedger.ts';
import type { UnifiedCognitiveCycleState } from './UnifiedCognitiveCycle.ts';

/**
 * WorkPass72 — privacy-minimal, independently scorable evidence export.
 *
 * This projection is intentionally NOT a second event ledger. It is a bounded,
 * read-only view over the canonical CognitiveEventFabric, RealityEvidenceLedger
 * and UnifiedCognitiveCycle snapshots. Raw event payloads, source names, claims
 * and independence keys are never exported.
 */
export const INDEPENDENT_EVIDENCE_SCHEMA = 'nk1.independent-evaluation-evidence.v2' as const;

export const OPERATIONAL_CYCLE_STAGES = [
  'observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal',
  'plan', 'action', 'outcome', 'learning', 'self-update',
] as const;

const OPERATIONAL_STAGE_SET = new Set<string>(OPERATIONAL_CYCLE_STAGES);
const REALITY_CLASSES = [
  'external-observation', 'device-observation', 'simulator', 'derived',
  'model-generated', 'user-reported',
] as const;
const EXTERNAL_REALITY_CLASSES = new Set<string>([
  'external-observation', 'device-observation', 'user-reported',
]);
const MAX_EVENTS = 256;
const MAX_REALITY_RECORDS = 96;

export interface IndependentEvaluationEvent {
  idDigest: string;
  tick: number;
  stage: typeof OPERATIONAL_CYCLE_STAGES[number];
  parentIdDigests: string[];
  external: boolean;
  confidenceBps: number;
  atMs: number;
}

export interface IndependentEvaluationCycle {
  cycleIdDigest: string;
  tick: number;
  events: IndependentEvaluationEvent[];
  sequenceIndex: number;
  previousChainDigest: string | null;
  cycleDigest: string;
  chainDigest: string;
}

export interface IndependentEvaluationEvidenceBundle {
  schemaVersion: typeof INDEPENDENT_EVIDENCE_SCHEMA;
  exportedAtMs: number;
  eventWindow: {
    limit: number;
    total: number;
    buffered: number;
    exportedOperationalEvents: number;
    oldestTick: number | null;
    newestTick: number | null;
  };
  cycles: IndependentEvaluationCycle[];
  realityEvidence: {
    total: number;
    observedRecent: number;
    classes: Record<typeof REALITY_CLASSES[number], number>;
    independentSourcesByClass: Record<typeof REALITY_CLASSES[number], number>;
    externalIndependentSources: number;
    simulatorIndependentSources: number;
  };
  cycleCounters: {
    version: 2;
    cycles: number;
    coreCompleteCycles: number;
    fullCompleteCycles: number;
    incompleteCycles: number;
    brokenLineages: number;
    lastTick: number;
  };
  bundleDigest: string;
}

export interface IndependentEvaluationEvidenceInput {
  events: readonly CognitiveEventNode[];
  eventTotal: number;
  eventBuffered: number;
  realityEvidence: RealityEvidenceLedgerState;
  cycleCounters: UnifiedCognitiveCycleState;
  exportedAtMs?: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(source).sort().map(key => [key, canonicalValue(source[key])]));
  }
  return value;
}

export function canonicalIndependentEvidenceJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function independentEvidenceDigest(value: Omit<IndependentEvaluationEvidenceBundle, 'bundleDigest'> | Record<string, unknown>): string {
  return sha256(canonicalIndependentEvidenceJson(value));
}

function safeCounter(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`independent-evidence-${label}-invalid`);
  }
  return value;
}

function clampConfidenceBps(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value * 10_000)));
}

export function buildIndependentEvaluationEvidenceBundle(
  input: IndependentEvaluationEvidenceInput,
): IndependentEvaluationEvidenceBundle {
  if (!input || typeof input !== 'object' || !Array.isArray(input.events)) {
    throw new TypeError('independent-evidence-input-invalid');
  }
  const exportedAtMs = input.exportedAtMs ?? Date.now();
  if (!Number.isSafeInteger(exportedAtMs) || exportedAtMs < 0) {
    throw new RangeError('independent-evidence-export-time-invalid');
  }
  const eventTotal = safeCounter(input.eventTotal, 'event-total');
  const eventBuffered = safeCounter(input.eventBuffered, 'event-buffered');
  if (eventTotal < eventBuffered || input.events.length > eventBuffered) {
    throw new RangeError('independent-evidence-event-counts-inconsistent');
  }

  const boundedEvents = input.events.slice(0, MAX_EVENTS).filter(event =>
    Boolean(event) && OPERATIONAL_STAGE_SET.has(String(event.stage)),
  );
  const cyclesByTick = new Map<number, IndependentEvaluationEvent[]>();
  for (const event of boundedEvents) {
    const tick = safeCounter(event.tick, 'event-tick');
    const id = typeof event.id === 'string' ? event.id.trim() : '';
    if (!id || id.length > 180) throw new TypeError('independent-evidence-event-id-invalid');
    const stage = event.stage as typeof OPERATIONAL_CYCLE_STAGES[number];
    const parentIds: string[] = [];
    const rawParentIds: unknown = event.parentIds;
    if (Array.isArray(rawParentIds)) {
      for (const candidate of rawParentIds as unknown[]) {
        if (typeof candidate !== 'string' || !candidate.trim()) continue;
        parentIds.push(candidate.trim());
        if (parentIds.length >= 12) break;
      }
    }
    const row: IndependentEvaluationEvent = {
      idDigest: sha256(id),
      tick,
      stage,
      parentIdDigests: [...new Set(parentIds.map(parent => sha256(parent)))].sort(),
      external: event.external === true,
      confidenceBps: clampConfidenceBps(event.confidence01),
      atMs: Number.isSafeInteger(event.at) && event.at >= 0 ? event.at : 0,
    };
    const rows = cyclesByTick.get(tick) ?? [];
    rows.push(row);
    cyclesByTick.set(tick, rows);
  }

  const orderedCycles = [...cyclesByTick.entries()]
    .sort(([left], [right]) => left - right)
    .map(([tick, events]) => ({
      cycleIdDigest: sha256(`nk1-cycle:${tick}`),
      tick,
      events: events.sort((left, right) =>
        OPERATIONAL_CYCLE_STAGES.indexOf(left.stage) - OPERATIONAL_CYCLE_STAGES.indexOf(right.stage)
        || left.idDigest.localeCompare(right.idDigest),
      ),
    }));

  // A deterministic, ordered hash chain makes multi-tick omissions, duplicates,
  // and reorderings independently detectable by the external verifier. It is
  // an integrity structure, not a signature or proof of source authenticity.
  let previousChainDigest: string | null = null;
  const cycles: IndependentEvaluationCycle[] = orderedCycles.map((cycle, sequenceIndex) => {
    const cycleDigest = sha256(canonicalIndependentEvidenceJson(cycle));
    const chainRecord = { sequenceIndex, tick: cycle.tick, cycleDigest, previousChainDigest };
    const chainDigest = sha256(canonicalIndependentEvidenceJson(chainRecord));
    const chained: IndependentEvaluationCycle = {
      ...cycle,
      sequenceIndex,
      previousChainDigest,
      cycleDigest,
      chainDigest,
    };
    previousChainDigest = chainDigest;
    return chained;
  });

  const recentReality = Array.isArray(input.realityEvidence?.recent)
    ? input.realityEvidence.recent.slice(0, MAX_REALITY_RECORDS)
    : [];
  const classes = Object.fromEntries(REALITY_CLASSES.map(value => [value, 0])) as Record<typeof REALITY_CLASSES[number], number>;
  const sourceSets = new Map<string, Set<string>>();
  for (const value of REALITY_CLASSES) sourceSets.set(value, new Set<string>());
  const externalSourceKeys = new Set<string>();
  const simulatorSourceKeys = new Set<string>();
  for (const row of recentReality) {
    if (!row || !REALITY_CLASSES.includes(row.realityClass)) continue;
    classes[row.realityClass] += 1;
    if (typeof row.independenceKey === 'string' && row.independenceKey.trim()) {
      sourceSets.get(row.realityClass)!.add(row.independenceKey);
      if (EXTERNAL_REALITY_CLASSES.has(row.realityClass)) externalSourceKeys.add(row.independenceKey);
      if (row.realityClass === 'simulator') simulatorSourceKeys.add(row.independenceKey);
    }
  }
  const independentSourcesByClass = Object.fromEntries(
    REALITY_CLASSES.map(value => [value, sourceSets.get(value)!.size]),
  ) as Record<typeof REALITY_CLASSES[number], number>;

  const cycleCounters = input.cycleCounters;
  if (!cycleCounters || cycleCounters.version !== 2) {
    throw new TypeError('independent-evidence-cycle-counters-v2-required');
  }
  const counterProjection = {
    version: 2 as const,
    cycles: safeCounter(cycleCounters.cycles, 'cycles'),
    coreCompleteCycles: safeCounter(cycleCounters.coreCompleteCycles, 'core-complete-cycles'),
    fullCompleteCycles: safeCounter(cycleCounters.fullCompleteCycles, 'full-complete-cycles'),
    incompleteCycles: safeCounter(cycleCounters.incompleteCycles, 'incomplete-cycles'),
    brokenLineages: safeCounter(cycleCounters.brokenLineages, 'broken-lineages'),
    lastTick: Number.isSafeInteger(cycleCounters.lastTick) && cycleCounters.lastTick >= -1 ? cycleCounters.lastTick : -1,
  };
  if (counterProjection.fullCompleteCycles > counterProjection.cycles
      || counterProjection.coreCompleteCycles > counterProjection.cycles
      || counterProjection.incompleteCycles > counterProjection.cycles) {
    throw new RangeError('independent-evidence-cycle-counters-inconsistent');
  }

  const ticks = cycles.map(cycle => cycle.tick);
  const payload = {
    schemaVersion: INDEPENDENT_EVIDENCE_SCHEMA,
    exportedAtMs,
    eventWindow: {
      limit: MAX_EVENTS,
      total: eventTotal,
      buffered: eventBuffered,
      exportedOperationalEvents: boundedEvents.length,
      oldestTick: ticks.length ? ticks[0] : null,
      newestTick: ticks.length ? ticks[ticks.length - 1] : null,
    },
    cycles,
    timeline: {
      version: 1 as const,
      algorithm: 'sha256-canonical-json-v1' as const,
      cycleCount: cycles.length,
      firstTick: cycles.length ? cycles[0].tick : null,
      lastTick: cycles.length ? cycles[cycles.length - 1].tick : null,
      headDigest: cycles.length ? cycles[cycles.length - 1].chainDigest : null,
    },
    realityEvidence: {
      total: safeCounter(input.realityEvidence.total, 'reality-total'),
      observedRecent: recentReality.length,
      classes,
      independentSourcesByClass,
      externalIndependentSources: externalSourceKeys.size,
      simulatorIndependentSources: simulatorSourceKeys.size,
    },
    cycleCounters: counterProjection,
  };
  const bundleDigest = independentEvidenceDigest(payload);
  return { ...payload, bundleDigest };
}
