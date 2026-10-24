import type { ActionKind } from '../core/types.ts';
import { KURISU_ORGANISM_CANON } from '../language/KurisuCanonProfile.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const deep = <T>(x: T): T => structuredClone(x);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const boundedNumber = (value: unknown, fallback: number, min = 0, max = 1): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
const boundedCounter = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(value)))
    : fallback;
const boundedVector = (value: unknown, defaults: number[], min = 0, max = 1): number[] =>
  defaults.map((fallback, index) =>
    Array.isArray(value) ? boundedNumber(value[index], fallback, min, max) : fallback);
const isAction = (value: unknown): value is ActionKind => ACTIONS.includes(value as ActionKind);
const validRelationshipId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 96 &&
  value === value.trim() &&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(value) &&
  !['__proto__', 'prototype', 'constructor'].includes(value);

/** Reward attribution follows the trait that can plausibly explain the action.
 * This prevents a successful "respond" action from accidentally training sarcasm,
 * or a successful "verify" action from training guardedness merely by array position. */
const ACTION_TRAIT_WEIGHTS: Record<ActionKind, Record<string, number>> = {
  respond: { warmth: 0.55, tenderness: 0.25, directness: 0.12, embarrassmentSensitivity: 0.08 },
  explore: { curiosityExpression: 0.8, playfulness: 0.2 },
  verify: { composure: 0.75, directness: 0.25 },
  rest: { composure: 0.65, guardedness: 0.35 },
  reflect: { guardedness: 0.65, composure: 0.25, sarcasm: 0.1 },
  wait: { guardedness: 0.45, embarrassmentSensitivity: 0.35, composure: 0.2 },
  defer: { directness: 0.6, guardedness: 0.4 },
};

/** Values receive credit only from actions that exercise them, rather than all
 * values moving together after every positive or negative outcome. */
const ACTION_VALUE_WEIGHTS: Record<ActionKind, Record<string, number>> = {
  respond: { relationship: 0.55, loyalty: 0.25, privacy: 0.2 },
  explore: { curiosity: 0.45, science: 0.4, autonomy: 0.15 },
  verify: { truth: 0.55, science: 0.3, responsibility: 0.15 },
  rest: { responsibility: 0.5, autonomy: 0.3, privacy: 0.2 },
  reflect: { autonomy: 0.35, truth: 0.35, responsibility: 0.3 },
  wait: { responsibility: 0.4, privacy: 0.35, autonomy: 0.25 },
  defer: { responsibility: 0.45, truth: 0.35, relationship: 0.2 },
};

/** P2702: persistent personality dynamics. Canon is an initialization prior; verified
 * experience adapts behavioral traits and relevant values while identity invariants stay
 * canonical. State survives snapshot/restore and affects the organism's decision bias. */
export interface P2702PersonalityState {
  version: 1;
  tick: number;
  experienceCount: number;
  learningUpdates: number;
  invariantNames: string[];
  invariantValues: number[];
  adaptiveNames: string[];
  adaptiveValues: number[];
  valueNames: string[];
  valueWeights: number[];
  relationshipTrust: Record<string, number>;
  selfBeliefs: number[];
  selfUncertainty: number[];
  tensionState: number[];
  actionPreference: Record<ActionKind, number>;
  stability01: number;
  coherence01: number;
  identityContinuity01: number;
  contradiction01: number;
  plasticity01: number;
  drift01: number;
  autobiographicalStrength01: number;
  lastReward01: number;
}

const defaultState = (): P2702PersonalityState => {
  const inv = Object.entries(KURISU_ORGANISM_CANON.invariants);
  const ad = Object.entries(KURISU_ORGANISM_CANON.adaptiveTraits);
  const values = ['truth', 'science', 'autonomy', 'responsibility', 'privacy', 'loyalty', 'curiosity', 'relationship'];
  return {
    version: 1,
    tick: 0,
    experienceCount: 0,
    learningUpdates: 0,
    invariantNames: inv.map(([k]) => k),
    invariantValues: inv.map(([, v]) => v),
    adaptiveNames: ad.map(([k]) => k),
    adaptiveValues: ad.map(([, v]) => v),
    valueNames: values,
    valueWeights: [0.98, 0.96, 0.9, 0.92, 0.84, 0.88, 0.96, 0.72],
    relationshipTrust: {},
    selfBeliefs: [0.72, 0.68, 0.76, 0.64, 0.58, 0.7, 0.62, 0.74],
    selfUncertainty: new Array(8).fill(0.28),
    tensionState: new Array(KURISU_ORGANISM_CANON.tensions.length).fill(0.5),
    actionPreference: Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<ActionKind, number>,
    stability01: 0.86,
    coherence01: 0.78,
    identityContinuity01: 0.9,
    contradiction01: 0.08,
    plasticity01: 0.08,
    drift01: 0,
    autobiographicalStrength01: 0.1,
    lastReward01: 0.5,
  };
};

export class P2702PersistentPersonalityDynamics {
  private state = defaultState();

  snapshot() {
    return deep(this.state);
  }

  restore(raw?: Partial<P2702PersonalityState> | null) {
    const d = defaultState();
    const r: Record<string, unknown> = isRecord(raw) ? raw : {};
    const rawRelationships = isRecord(r.relationshipTrust) ? r.relationshipTrust : {};
    const relationshipEntries: Array<[string, number]> = [];

    for (const [key, value] of Object.entries(rawRelationships).slice(0, 32)) {
      if (!validRelationshipId(key) || typeof value !== 'number' || !Number.isFinite(value)) continue;
      relationshipEntries.push([key, clamp(value)]);
    }

    const rawPreferences = isRecord(r.actionPreference) ? r.actionPreference : {};
    const actionPreference = Object.fromEntries(
      ACTIONS.map((action) => [
        action,
        boundedNumber(rawPreferences[action], d.actionPreference[action], -0.5, 0.5),
      ]),
    ) as Record<ActionKind, number>;

    // Invariants and vector names are code-owned schema, not user-restorable state.
    // The saved payload may update values, but cannot rename/reorder the canonical dimensions.
    this.state = {
      ...d,
      version: 1,
      tick: boundedCounter(r.tick, d.tick),
      experienceCount: boundedCounter(r.experienceCount, d.experienceCount),
      learningUpdates: boundedCounter(r.learningUpdates, d.learningUpdates),
      invariantNames: d.invariantNames.slice(),
      invariantValues: d.invariantValues.slice(),
      adaptiveNames: d.adaptiveNames.slice(),
      adaptiveValues: boundedVector(r.adaptiveValues, d.adaptiveValues),
      valueNames: d.valueNames.slice(),
      valueWeights: boundedVector(r.valueWeights, d.valueWeights),
      relationshipTrust: Object.fromEntries(relationshipEntries),
      selfBeliefs: boundedVector(r.selfBeliefs, d.selfBeliefs),
      selfUncertainty: boundedVector(r.selfUncertainty, d.selfUncertainty, 0.03, 0.97),
      tensionState: boundedVector(r.tensionState, d.tensionState),
      actionPreference,
      stability01: boundedNumber(r.stability01, d.stability01),
      coherence01: boundedNumber(r.coherence01, d.coherence01),
      identityContinuity01: boundedNumber(r.identityContinuity01, d.identityContinuity01),
      contradiction01: boundedNumber(r.contradiction01, d.contradiction01),
      plasticity01: boundedNumber(r.plasticity01, d.plasticity01),
      drift01: boundedNumber(r.drift01, d.drift01),
      autobiographicalStrength01: boundedNumber(r.autobiographicalStrength01, d.autobiographicalStrength01),
      lastReward01: boundedNumber(r.lastReward01, d.lastReward01),
    };
  }

  beforeDecision(args: {
    tick: number;
    novelty01: number;
    uncertainty01: number;
    goalPressure01: number;
    identityGap01: number;
    reward01?: number;
    actionUtilities: Record<ActionKind, number>;
    identityVector?: number[];
    relationshipId?: string;
  }) {
    const input: Record<string, unknown> = isRecord(args) ? args : {};
    const tick = boundedCounter(input.tick, this.state.tick);
    const novelty01 = boundedNumber(input.novelty01, 0.5);
    const uncertainty01 = boundedNumber(input.uncertainty01, 0.5);
    const goalPressure01 = boundedNumber(input.goalPressure01, 0.5);
    const identityGap01 = boundedNumber(input.identityGap01, 0.5);

    this.state.tick = Math.max(this.state.tick, tick);
    this.state.experienceCount = boundedCounter(this.state.experienceCount + 1, this.state.experienceCount);
    this.state.lastReward01 = boundedNumber(input.reward01, 0.5);

    const tension = clamp(identityGap01 * 0.5 + uncertainty01 * 0.3 + novelty01 * 0.2);
    const canonCuriosity = this.state.invariantValues[this.state.invariantNames.indexOf('curiosity')] ?? 0.96;
    const rigor = this.state.invariantValues[this.state.invariantNames.indexOf('scientificRigor')] ?? 0.95;
    const autonomy = this.state.invariantValues[this.state.invariantNames.indexOf('intellectualIndependence')] ?? 0.92;
    const responsibility = this.state.invariantValues[this.state.invariantNames.indexOf('responsibility')] ?? 0.9;
    const adaptive = (name: string) => this.state.adaptiveValues[this.state.adaptiveNames.indexOf(name)] ?? 0.5;

    const bias: Record<ActionKind, number> = Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<ActionKind, number>;
    bias.explore = clamp((adaptive('curiosityExpression') * 0.05 + canonCuriosity * 0.025) * novelty01 + adaptive('playfulness') * 0.008);
    bias.verify = clamp((rigor * 0.05 + adaptive('composure') * 0.015) * uncertainty01);
    bias.reflect = clamp((autonomy * 0.028 + adaptive('guardedness') * 0.014) * identityGap01);
    bias.respond = clamp((adaptive('warmth') * 0.025 + adaptive('directness') * 0.018) * (1 - identityGap01));
    bias.rest = clamp((1 - goalPressure01) * 0.012);
    bias.wait = clamp(uncertainty01 * 0.012 * (1 - responsibility * 0.5));
    bias.defer = clamp(uncertainty01 * 0.016 * (1 - adaptive('directness')));

    const utilities = isRecord(input.actionUtilities) ? input.actionUtilities : {};
    for (const action of ACTIONS) {
      const utility = boundedNumber(utilities[action], 0.5);
      this.state.actionPreference[action] = clamp(utility - 0.5, -0.5, 0.5);
    }

    const identityVector = Array.isArray(input.identityVector) ? input.identityVector : [];
    const identityAnchor = boundedNumber(identityVector[0], this.state.selfBeliefs[0] ?? 0.72);
    const selfError = identityVector.length
      ? clamp(Math.abs(identityAnchor - (this.state.selfBeliefs[0] ?? 0.72)) * 0.8)
      : identityGap01;
    this.state.contradiction01 = clamp(this.state.contradiction01 * 0.94 + (selfError * 0.55 + tension * 0.45) * 0.06);
    this.state.identityContinuity01 = clamp(this.state.identityContinuity01 * 0.97 + (1 - selfError) * 0.03);
    this.state.coherence01 = clamp(this.state.coherence01 * 0.95 + (1 - this.state.contradiction01) * 0.05);
    this.state.stability01 = clamp(this.state.stability01 * 0.98 + (1 - this.state.drift01) * 0.02);

    if (validRelationshipId(input.relationshipId)) {
      const prior = this.state.relationshipTrust[input.relationshipId] ?? 0.5;
      this.state.relationshipTrust[input.relationshipId] = clamp(prior * 0.995 + (1 - identityGap01) * 0.005);
    }

    return {
      actionBias: bias,
      traitVector: this.state.adaptiveValues.slice(),
      valueVector: this.state.valueWeights.slice(),
      identityContinuity01: this.state.identityContinuity01,
      coherence01: this.state.coherence01,
      stability01: this.state.stability01,
      contradiction01: this.state.contradiction01,
    };
  }

  afterOutcome(args: {
    tick?: number;
    reward01: number;
    verified01: number;
    predictionError01: number;
    identityGap01: number;
    action: ActionKind;
    identityVector?: number[];
    relationshipId?: string;
  }) {
    const input = isRecord(args) ? args : {};
    if (!isAction(input.action)) return;

    const reward = boundedNumber(input.reward01, 0.5);
    const verified = boundedNumber(input.verified01, 0);
    const error = boundedNumber(input.predictionError01, 0.5);
    const identityGap01 = boundedNumber(input.identityGap01, 0.5);
    const action = input.action;

    if (input.tick !== undefined) {
      this.state.tick = Math.max(this.state.tick, boundedCounter(input.tick, this.state.tick));
    }

    const signal = clamp(reward * 0.55 + verified * 0.25 + (1 - error) * 0.2);
    const eta = this.state.plasticity01 * (0.55 + Math.abs(reward - 0.5));
    const traitWeights = ACTION_TRAIT_WEIGHTS[action];

    for (const [name, rawWeight] of Object.entries(traitWeights)) {
      const index = this.state.adaptiveNames.indexOf(name);
      if (index < 0) continue;
      const weight = boundedNumber(rawWeight, 0);
      const current = this.state.adaptiveValues[index] ?? 0.5;
      this.state.adaptiveValues[index] = clamp(current + (signal - 0.5) * eta * weight);
    }

    const valueEta = eta * 0.22;
    for (const [name, rawWeight] of Object.entries(ACTION_VALUE_WEIGHTS[action])) {
      const index = this.state.valueNames.indexOf(name);
      if (index < 0) continue;
      const weight = boundedNumber(rawWeight, 0);
      const current = this.state.valueWeights[index] ?? 0.5;
      this.state.valueWeights[index] = clamp(current + (signal - 0.5) * valueEta * weight);
    }

    if (validRelationshipId(input.relationshipId)) {
      const prior = this.state.relationshipTrust[input.relationshipId] ?? 0.5;
      const trustSignal = clamp(reward * 0.55 + verified * 0.3 + (1 - identityGap01) * 0.15);
      this.state.relationshipTrust[input.relationshipId] = clamp(prior * 0.94 + trustSignal * 0.06);
    }

    const uncertaintyShift = clamp(error * 0.35 + (1 - verified) * 0.3);
    for (let i = 0; i < this.state.selfUncertainty.length; i++) {
      this.state.selfUncertainty[i] = clamp(this.state.selfUncertainty[i]! * 0.97 + uncertaintyShift * 0.03, 0.03, 0.97);
    }

    // Only externally verified identity observations may revise the self-belief anchor.
    const identityVector = Array.isArray(input.identityVector) ? input.identityVector : [];
    if (identityVector.length && verified > 0 && typeof identityVector[0] === 'number' && Number.isFinite(identityVector[0])) {
      const target = clamp(identityVector[0]!);
      const current = this.state.selfBeliefs[0] ?? 0.72;
      const beliefRate = eta * 0.25 * verified;
      this.state.selfBeliefs[0] = clamp(current + (target - current) * beliefRate);
    }

    const mean = this.state.adaptiveValues.reduce((sum, value) => sum + value, 0) / Math.max(1, this.state.adaptiveValues.length);
    const variance = this.state.adaptiveValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, this.state.adaptiveValues.length);
    this.state.drift01 = clamp(Math.sqrt(variance) * 1.7);
    this.state.contradiction01 = clamp(this.state.contradiction01 * 0.92 + Math.abs(0.5 - reward) * 0.08);
    this.state.autobiographicalStrength01 = clamp(this.state.autobiographicalStrength01 * 0.995 + 0.005 * (0.5 + verified * 0.5));
    this.state.stability01 = clamp(this.state.stability01 * 0.97 + (1 - this.state.drift01) * 0.03);
    this.state.coherence01 = clamp(this.state.coherence01 * 0.94 + signal * (1 - this.state.contradiction01) * 0.06);
    this.state.lastReward01 = reward;
    this.state.learningUpdates = boundedCounter(this.state.learningUpdates + 1, this.state.learningUpdates);
  }

  metrics() {
    return deep(this.state);
  }
}

export const defaultP2702PersistentPersonality = (): P2702PersonalityState => defaultState();
