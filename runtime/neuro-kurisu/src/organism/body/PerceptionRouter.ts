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
