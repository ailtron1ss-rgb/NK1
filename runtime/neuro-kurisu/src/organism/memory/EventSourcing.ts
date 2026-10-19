import type { ActionKind, OrganismState, OrganismGoal, WorldContext } from '../core/types.ts';

export type OrganismEventType =
  | 'cycle'
  | 'decision'
  | 'world-transition'
  | 'goal-created'
  | 'autonomous-goal-created'
  | 'goal-updated'
  | 'memory-created'
  | 'memory-lifecycle'
  | 'self-update'
  | 'attention'
  | 'social-update'
  | 'value-update'
  | 'experiment'
  | 'self-project'
  | 'action-authorized'
  | 'temporal-gap'
  | 'recovery'
  | 'session'
  | 'self-development-proposal'
  | 'self-development-experiment'
  | 'autonomous-causal-research-proposal'
  | 'autonomous-causal-research-trial'
  | 'project-tool-execution'
  | 'project-completed'
  | 'project-switch'
  | 'external-outcome-verified'
  | 'value-attribution'
  | 'compound-skill-step-verified'
  | 'compound-skill-execution'
  | 'developmental-executive'
  | 'policy-replay'
  | 'skill-development-candidate'
  | 'causal-development-update'
  | 'embodiment-sample'
  | 'developmental-synthesis'
  | 'memory-world-causal-link';

export interface OrganismEvent {
  id: string;
  tick: number;
  at: number;
  type: OrganismEventType;
  payload: Record<string, unknown>;
}

export class EventLog {
  private events: OrganismEvent[] = [];
  private readonly max: number;
  constructor(max = 320) { this.max = Math.max(128, max); }
  restore(events: OrganismEvent[] | undefined) { this.events = (events ?? []).slice(-this.max).map(e => structuredClone(e)); }
  append(event: OrganismEvent) { this.events.push(structuredClone(event)); if (this.events.length > this.max) this.events.splice(0, this.events.length-this.max); }
  batch(events: OrganismEvent[]) { for (const e of events) this.append(e); }
  size() { return this.events.length; }
  list() { return this.events.map(e => structuredClone(e)); }
  recent(n=64, clone=true) { const rows=this.events.slice(-n); return clone ? rows.map(e => structuredClone(e)) : rows; }
}

export function makeEvent(type: OrganismEventType, tick: number, payload: Record<string, unknown>, at=Date.now()): OrganismEvent {
  return { id: `${type}-${at}-${Math.random().toString(16).slice(2)}`, tick, at, type, payload };
}
