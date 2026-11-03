import type { OrganismBodyState, OrganismBodyEvent } from './EmbodiedBody.ts';
import type { PerceptionEvent } from '../cognition/PerceptionEngine.ts';

export interface PerceptionRoutingState {
  version: 1;
  lastRoutedAt: number;
  routedCount: number;
  droppedCount: number;
  lastRoute: 'workspace'|'attention'|'homeostasis'|'memory'|'none';
}

export function defaultPerceptionRoutingState(): PerceptionRoutingState {
  return { version:1, lastRoutedAt:0, routedCount:0, droppedCount:0, lastRoute:'none' };
}

const ROUTES = new Set<PerceptionRoutingState['lastRoute']>(['workspace','attention','homeostasis','memory','none']);
const nonNegativeInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

/**
 * Validate a persisted routing state before it re-enters live state. Malformed or
 * hostile input (non-integer counters, unknown route, missing version) falls back to
 * the default rather than trusting persisted fields. Routing counters are evidence,
 * so a partial merge is not acceptable here.
 */
export function sanitizePerceptionRoutingState(raw: unknown): PerceptionRoutingState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultPerceptionRoutingState();
  const r = raw as Record<string, unknown>;
  const routedCount = nonNegativeInt(r.routedCount);
  const droppedCount = nonNegativeInt(r.droppedCount);
  const lastRoutedAt = nonNegativeInt(r.lastRoutedAt);
  if (r.version !== 1 || routedCount === null || droppedCount === null || lastRoutedAt === null
    || typeof r.lastRoute !== 'string' || !ROUTES.has(r.lastRoute as PerceptionRoutingState['lastRoute'])) {
    return defaultPerceptionRoutingState();
  }
  return { version:1, lastRoutedAt, routedCount, droppedCount, lastRoute: r.lastRoute as PerceptionRoutingState['lastRoute'] };
}

export function routePerception(event: PerceptionEvent, body?: OrganismBodyState): PerceptionRoutingState {
  if (!event) {
    return { ...defaultPerceptionRoutingState(), lastRoutedAt:Date.now(), droppedCount:1, lastRoute:'none' };
  }
  if (body && body.awake === false && event.salience < 0.55) {
    return { ...defaultPerceptionRoutingState(), lastRoutedAt:Date.now(), droppedCount:1, lastRoute:'none' };
  }
  const route: PerceptionRoutingState['lastRoute'] = event.kind === 'resource' ? 'homeostasis' : event.kind === 'motion' || event.kind === 'proximity' ? 'attention' : event.kind === 'text-input' || event.kind === 'world-surprise' ? 'workspace' : event.kind === 'quiet' ? 'none' : 'memory';
  return { version:1, lastRoutedAt:Date.now(), routedCount:1, droppedCount:0, lastRoute:route };
}

export function eventToExternalDetail(event: PerceptionEvent): OrganismBodyEvent {
  return { at:event.at, kind:'external', detail:`perception:${event.kind}:${event.detail}`, importance:event.salience };
}
