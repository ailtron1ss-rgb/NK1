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

export class WorldModel {
  private readonly transitions: WorldTransition[] = [];
  private beliefState: WorldContext | null = null;

  restore(snapshot: WorldModelSnapshot | undefined): void {
    this.beliefState = snapshot?.belief ? structuredClone(snapshot.belief) : null;
    this.transitions.length = 0;
    for (const row of (snapshot?.transitions ?? []).slice().reverse().slice(0, 1000)) this.transitions.push(structuredClone(row));
  }

  snapshot(): WorldTransition[] { return this.transitions.slice(0, 1000).map(x => structuredClone(x)); }
  persisted(): WorldModelSnapshot { return { belief: this.beliefState ? structuredClone(this.beliefState) : null, transitions: this.snapshot() }; }
  currentBelief(): WorldContext | null { return this.beliefState ? structuredClone(this.beliefState) : null; }

  observeContext(context: WorldContext): void {
    const facts=Array.isArray(context.facts)?context.facts:[];
    const events=Array.isArray(context.events)?context.events:[];
    const objects=Array.isArray(context.objects)?context.objects:[];
    this.beliefState = {
      ...structuredClone(context),
      facts: Array.from(new Set(facts)).slice(-120),
      events: Array.from(new Set(events)).slice(-40),
      objects: structuredClone(objects),
    };
  }

  observeTransition(transition: WorldTransitionForOrganism): void {
    const action = transition.action as ActionKind;
    const row: WorldTransition = {
      action,
      before: structuredClone(transition.before),
      after: structuredClone(transition.after),
      reward: clamp(transition.reward),
      surprise: clamp(transition.surprise),
      at: transition.at,
    };
    this.transitions.unshift(row);
    if (this.transitions.length > 1000) this.transitions.length = 1000;
    this.observeContext(transition.after);
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
