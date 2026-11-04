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

function ownDataValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
  return descriptor.value;
}

function incrementSafeCounter(value: number): number {
  return value < Number.MAX_SAFE_INTEGER ? value + 1 : value;
}

/**
 * Validate a persisted routing state before it re-enters live state.
 *
 * Only plain records with own data properties are accepted. Accessors are never
 * invoked; prototype-backed values and hostile Proxy reflection failures fall
 * back to the default. Counter values saturate at MAX_SAFE_INTEGER so a long-lived
 * process cannot turn a valid counter into an unsafe integer during increment.
 */
export function sanitizePerceptionRoutingState(raw: unknown): PerceptionRoutingState {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultPerceptionRoutingState();
    const prototype = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) return defaultPerceptionRoutingState();

    const version = ownDataValue(raw, 'version');
    const routedCount = nonNegativeInt(ownDataValue(raw, 'routedCount'));
    const droppedCount = nonNegativeInt(ownDataValue(raw, 'droppedCount'));
    const lastRoutedAt = nonNegativeInt(ownDataValue(raw, 'lastRoutedAt'));
    const lastRoute = ownDataValue(raw, 'lastRoute');

    if (version !== 1 || routedCount === null || droppedCount === null || lastRoutedAt === null
      || typeof lastRoute !== 'string' || !ROUTES.has(lastRoute as PerceptionRoutingState['lastRoute'])) {
      return defaultPerceptionRoutingState();
    }
    return { version:1, lastRoutedAt, routedCount, droppedCount, lastRoute: lastRoute as PerceptionRoutingState['lastRoute'] };
  } catch {
    // Proxy traps and revoked proxies must not escape the persistence boundary.
    return defaultPerceptionRoutingState();
  }
}

/**
 * Route one perception event and fold it into the running counters.
 *
 * The persisted state is written every tick, so the counters must accumulate from
 * the previous state: returning a fixed `1` resets the durable totals on the very
 * next tick and makes the restore path meaningless. `previous` is sanitized first,
 * so a malformed prior state restarts from zero rather than propagating garbage.
 */
export function routePerception(event: PerceptionEvent, body?: OrganismBodyState, previous?: unknown): PerceptionRoutingState {
  const prior = sanitizePerceptionRoutingState(previous);
  const routedCount = prior.routedCount;
  const droppedCount = prior.droppedCount;
  if (!event) {
    return { version:1, lastRoutedAt:Date.now(), routedCount, droppedCount:incrementSafeCounter(droppedCount), lastRoute:'none' };
  }
  if (body && body.awake === false && event.salience < 0.55) {
    return { version:1, lastRoutedAt:Date.now(), routedCount, droppedCount:incrementSafeCounter(droppedCount), lastRoute:'none' };
  }
  const route: PerceptionRoutingState['lastRoute'] = event.kind === 'resource' ? 'homeostasis' : event.kind === 'motion' || event.kind === 'proximity' ? 'attention' : event.kind === 'text-input' || event.kind === 'world-surprise' ? 'workspace' : event.kind === 'quiet' ? 'none' : 'memory';
  return { version:1, lastRoutedAt:Date.now(), routedCount:incrementSafeCounter(routedCount), droppedCount, lastRoute:route };
}

export function eventToExternalDetail(event: PerceptionEvent): OrganismBodyEvent {
  return { at:event.at, kind:'external', detail:`perception:${event.kind}:${event.detail}`, importance:event.salience };
}
