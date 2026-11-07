import type { ActionKind, WorldContext, WorldTransitionForOrganism } from '../core/types.ts';

export interface InternalWorldState {
  energy: number;
  uncertainty: number;
  cognitiveLoad: number;
  novelty: number;
}

export interface PredictedOutcome {
  action: ActionKind;
  next: InternalWorldState;
  utility: number;
  confidence: number;
  reasons: string[];
  worldEvidence: string[];
}

export interface WorldTransition {
  action: ActionKind;
  before: WorldContext;
  after: WorldContext;
  reward: number;
  surprise: number;
  at: number;
}

export interface WorldModelSnapshot {
  belief: WorldContext | null;
  transitions: WorldTransition[];
}

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

const ACTION_KINDS: readonly ActionKind[] = ['respond','explore','verify','rest','reflect','wait','defer'];
const TRANSITION_LIMIT = 1000;
/** Copy own data properties only; accessors, exotic prototypes and hostile traps fail closed. */
function ownDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const output: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return null;
      const descriptor = (descriptors as Record<string, PropertyDescriptor>)[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch { return null; }
}
function ownDataArray(value: unknown, max: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = (descriptors as Record<string, PropertyDescriptor>).length?.value;
    if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > max) return null;
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) return null;
    const result: unknown[] = [];
    for (let index = 0; index < (length as number); index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          descriptor.get !== undefined || descriptor.set !== undefined) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch { return null; }
}
const boundedText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
function boundedStringList(value: unknown, max: number, itemMax: number): string[] | null {
  const rows = ownDataArray(value, max);
  if (!rows) return null;
  const result: string[] = [];
  for (const row of rows) { const text = boundedText(row, itemMax); if (text === null) return null; result.push(text); }
  return result;
}
function sanitizeWorldContext(value: unknown): WorldContext | null {
  const row = ownDataRecord(value);
  if (!row) return null;
  const location = boundedText(row.location, 128);
  const facts = boundedStringList(row.facts, 240, 512);
  const events = boundedStringList(row.events, 80, 512);
  if (location === null || facts === null || events === null) return null;
  const number = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? input : 0);
  const energy = clamp(number(row.energy)); const attention = clamp(number(row.attention)); const uncertainty = clamp(number(row.uncertainty));
  const rawObjects = ownDataArray(row.objects, 2000);
  if (rawObjects === null) return null;
  const objects: WorldContext['objects'] = [];
  for (const raw of rawObjects) {
    const item = ownDataRecord(raw);
    if (!item) return null;
    const id = boundedText(item.id, 128); const label = boundedText(item.label, 256); const itemLocation = boundedText(item.location, 128);
    if (id === null || label === null || itemLocation === null) return null;
    objects.push({
      ...(item as unknown as WorldContext['objects'][number]),
      id, label, location: itemLocation, value: number(item.value),
      visible: item.visible === true, collected: item.collected === true,
    });
  }
  const tick = typeof row.tick === 'number' && Number.isSafeInteger(row.tick) && row.tick >= 0 ? row.tick : 0;
  return { tick, location, energy, attention, uncertainty, facts: facts.slice(-120), objects, events: events.slice(-40) };
}
function sanitizeTransition(value: unknown): WorldTransition | null {
  const row = ownDataRecord(value);
  if (!row) return null;
  if (typeof row.action !== 'string' || !(ACTION_KINDS as readonly string[]).includes(row.action)) return null;
  const before = sanitizeWorldContext(row.before); const after = sanitizeWorldContext(row.after);
  if (!before || !after) return null;
  if (typeof row.reward !== 'number' || !Number.isFinite(row.reward)) return null;
  if (typeof row.surprise !== 'number' || !Number.isFinite(row.surprise)) return null;
  if (typeof row.at !== 'number' || !Number.isFinite(row.at) || row.at < 0) return null;
  return { action: row.action as ActionKind, before, after, reward: clamp(row.reward), surprise: clamp(row.surprise), at: row.at };
}

export class WorldModel {
  private readonly transitions: WorldTransition[] = [];
  private beliefState: WorldContext | null = null;

  restore(snapshot: WorldModelSnapshot | undefined): void {
    const root = ownDataRecord(snapshot);
    const belief = root ? sanitizeWorldContext(root.belief) : null;
    const rows = root ? ownDataArray(root.transitions, TRANSITION_LIMIT) : null;
    this.beliefState = belief;
    this.transitions.length = 0;
    for (const row of (rows ?? []).slice().reverse()) {
      const transition = sanitizeTransition(row);
      if (transition) this.transitions.push(transition);
    }
  }

  snapshot(): WorldTransition[] { return this.transitions.slice(0, 1000).map(x => structuredClone(x)); }
  persisted(): WorldModelSnapshot { return { belief: this.beliefState ? structuredClone(this.beliefState) : null, transitions: this.snapshot() }; }
  currentBelief(): WorldContext | null { return this.beliefState ? structuredClone(this.beliefState) : null; }
  transitionCount(): number { return this.transitions.length; }
  beliefAvailable(): boolean { return this.beliefState !== null; }
  beliefSignature(): string {
    const b=this.beliefState;
    if(!b) return 'none';
    return `${b.location}|${Number(b.energy).toFixed(3)}|${Number(b.attention).toFixed(3)}|${Number(b.uncertainty).toFixed(3)}|${(b.facts??[]).slice(-4).join('|')}|${(b.events??[]).slice(-4).join('|')}`;
  }

  observeContext(context: WorldContext): void {
    const row = ownDataRecord(context);
    // A malformed observation is rejected without wiping the last good belief.
    if (!row) return;
    const rawFacts = ownDataArray(row.facts, 240) ?? [];
    const rawEvents = ownDataArray(row.events, 80) ?? [];
    const rawObjects = ownDataArray(row.objects, 2000) ?? [];
    const facts = rawFacts.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 512);
    const events = rawEvents.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 512);
    const objects: WorldContext['objects'] = [];
    for (const raw of rawObjects) {
      const item = ownDataRecord(raw);
      if (!item) continue;
      const id = boundedText(item.id, 128); const label = boundedText(item.label, 256); const itemLocation = boundedText(item.location, 128);
      if (id === null || label === null || itemLocation === null) continue;
      objects.push({
        ...(item as unknown as WorldContext['objects'][number]),
        id, label, location: itemLocation,
        value: typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 0,
        visible: item.visible === true, collected: item.collected === true,
      });
    }
    const unit = (input: unknown): number => typeof input === 'number' && Number.isFinite(input) ? clamp(input) : 0;
    const tick = typeof row.tick === 'number' && Number.isSafeInteger(row.tick) && row.tick >= 0 ? row.tick : 0;
    this.beliefState = {
      ...(row as unknown as WorldContext),
      tick,
      location: boundedText(row.location, 128) ?? 'unknown',
      energy: unit(row.energy), attention: unit(row.attention), uncertainty: unit(row.uncertainty),
      facts: Array.from(new Set(facts)).slice(-120),
      events: Array.from(new Set(events)).slice(-40),
      objects,
    };
  }

  observeTransition(transition: WorldTransitionForOrganism): void {
    const row = ownDataRecord(transition);
    if (!row) return;
    const before = sanitizeWorldContext(row.before);
    const after = sanitizeWorldContext(row.after);
    // A transition that cannot be represented faithfully is rejected rather than stored partially.
    if (!before || !after || typeof row.action !== 'string' || !(ACTION_KINDS as readonly string[]).includes(row.action)) return;
    this.transitions.unshift({
      action: row.action as ActionKind,
      before,
      after,
      reward: clamp(typeof row.reward === 'number' ? row.reward : 0),
      surprise: clamp(typeof row.surprise === 'number' ? row.surprise : 0),
      at: typeof row.at === 'number' && Number.isFinite(row.at) && row.at >= 0 ? row.at : 0,
    });
    if (this.transitions.length > 1000) this.transitions.length = 1000;
    this.observeContext(row.after as unknown as WorldContext);
  }

  predict(state: InternalWorldState, action: ActionKind): PredictedOutcome {
    const next = { ...state };
    const reasons: string[] = [];
    const worldEvidence: string[] = [];
    switch (action) {
      case 'explore':
        next.energy -= 0.09; next.cognitiveLoad += 0.11; next.uncertainty -= 0.15; next.novelty += 0.12;
        reasons.push('exploration can reduce uncertainty and increase novelty');
        break;
      case 'verify':
        next.energy -= 0.07; next.cognitiveLoad += 0.09; next.uncertainty -= 0.20;
        reasons.push('verification targets prediction error');
        break;
      case 'reflect':
        next.energy -= 0.04; next.cognitiveLoad += 0.04; next.uncertainty -= 0.07;
        reasons.push('reflection updates internal models');
        break;
      case 'rest':
        next.energy += 0.18; next.cognitiveLoad -= 0.22;
        reasons.push('rest restores resources');
        break;
      case 'respond':
        next.energy -= 0.03; next.cognitiveLoad += 0.05;
        reasons.push('response consumes modest resources');
        break;
      case 'wait':
        next.energy -= 0.012; next.cognitiveLoad -= 0.01; next.uncertainty += 0.01;
        reasons.push('waiting is cheap but does not resolve uncertainty');
        break;
      case 'defer':
        next.energy -= 0.01; next.cognitiveLoad -= 0.03; next.uncertainty += 0.04;
        reasons.push('deferral reduces immediate load but leaves uncertainty');
        break;
    }
    next.energy = clamp(next.energy); next.uncertainty = clamp(next.uncertainty); next.cognitiveLoad = clamp(next.cognitiveLoad); next.novelty = clamp(next.novelty);

    let worldAdjustment = 0;
    if (this.beliefState) {
      const b = this.beliefState;
      const visibleAtLocation = b.objects.filter(o => o.location === b.location && o.visible && !o.collected);
      if (action === 'explore' && b.location === 'home') { worldAdjustment += 0.06; worldEvidence.push('home has a reachable lab transition'); }
      if (action === 'verify' && visibleAtLocation.length > 0) { worldAdjustment += 0.08; worldEvidence.push(`verifiable objects at ${b.location}: ${visibleAtLocation.map(o => o.id).join(', ')}`); }
      if (action === 'explore' && b.location === 'lab' && b.objects.some(o => o.location === 'lab' && !o.visible)) { worldAdjustment += 0.12; worldEvidence.push('lab contains an unresolved hidden object'); }
      if (action === 'rest' && b.energy < 0.35) { worldAdjustment += 0.14; worldEvidence.push('environmental energy is low'); }
      if (action === 'respond' && b.facts.some(f => f.includes('communication'))) { worldAdjustment += 0.05; worldEvidence.push('communication channel has prior successful use'); }
      if (action === 'wait' && b.uncertainty > 0.8) { worldAdjustment -= 0.08; worldEvidence.push('waiting leaves a highly uncertain world unresolved'); }
    }

    const relief = clamp((state.uncertainty - next.uncertainty) * 0.45 + (next.energy - state.energy) * 0.18 + (state.cognitiveLoad - next.cognitiveLoad) * 0.22 + (next.novelty - state.novelty) * 0.08);
    const learned = this.learnedActionBias(action);
    const utility = clamp(relief + learned * 0.22 + worldAdjustment);
    const confidence = clamp(0.40 + Math.min(0.35, this.count(action) * 0.02) + (this.beliefState ? 0.10 : 0));
    return { action, next, utility, confidence, reasons, worldEvidence };
  }

  private learnedActionBias(action: ActionKind): number {
    const rows = this.transitions.filter(x => x.action === action).slice(0, 32);
    if (!rows.length) return 0.5;
    return rows.reduce((sum, row) => sum + row.reward, 0) / rows.length;
  }
  private count(action: ActionKind): number { return this.transitions.reduce((n, x) => n + (x.action === action ? 1 : 0), 0); }
}
