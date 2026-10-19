import type { ActionKind } from '../core/types.ts';

const ACTIONS: ActionKind[] = ['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer'];
const D = 12;
const C = 6;
const clamp = (x: number, a = 0, b = 1): number => Math.max(a, Math.min(b, Number.isFinite(x) ? x : (a + b) / 2));
const finite = (x: number, fallback = 0): number => Number.isFinite(x) ? x : fallback;
const zeros = (n: number): number[] => new Array<number>(n).fill(0);
const norm = (values: number[]): number => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
const cosine = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const x = finite(a[i]);
    const y = finite(b[i]);
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return dot / ((Math.sqrt(na) * Math.sqrt(nb)) || 1);
};

export interface P2835State {
  version: 1;
  enabled: boolean;
  tick: number;
  outcomes: number;
  decisions: number;
  activeContextId: number;
  contextNovelty01: number;
  contextCompatibility01: number;
  positiveTransfer01: number;
  negativeTransfer01: number;
  orthogonalSafety01: number;
  replayUtility01: number;
  learningScale01: number;
  resourcePressure01: number;
  transferEvents: number;
  blockedTransferEvents: number;
  protectedUpdateEvents: number;
  plasticUpdateEvents: number;
  contextSwitches: number;
  lastContextId: number;
  lastContextSimilarity01: number;
  contextSamples: number[];
  contextPrototype: number[][];
  contextTransfer: number[];
  contextRisk: number[];
  protectedPrototype: number[];
  protectedNorm01: number;
  updateOrthogonality01: number;
  actionBias: Record<ActionKind, number>;
}

export interface P2835DecisionInput {
  tick: number;
  latent: number[];
  contextId: number;
  novelty01: number;
  uncertainty01: number;
  predictionError01: number;
  resource01: number;
  forgetting01: number;
  worldConfidence01: number;
  teacherConfidence01: number;
  replayPressure01: number;
  baseUtilities: Record<ActionKind, number>;
}

export interface P2835DecisionOutput {
  actionBias: Record<ActionKind, number>;
  contextId: number;
  contextCompatibility01: number;
  positiveTransfer01: number;
  negativeTransfer01: number;
  orthogonalSafety01: number;
  learningScale01: number;
  replayUtility01: number;
  exploration01: number;
}

const defaultState = (): P2835State => ({
  version: 1,
  enabled: true,
  tick: 0,
  outcomes: 0,
  decisions: 0,
  activeContextId: 0,
  contextNovelty01: 0.5,
  contextCompatibility01: 0.58,
  positiveTransfer01: 0.42,
  negativeTransfer01: 0.08,
  orthogonalSafety01: 0.72,
  replayUtility01: 0.5,
  learningScale01: 1,
  resourcePressure01: 0.2,
  transferEvents: 0,
  blockedTransferEvents: 0,
  protectedUpdateEvents: 0,
  plasticUpdateEvents: 0,
  contextSwitches: 0,
  lastContextId: 0,
  lastContextSimilarity01: 0.5,
  contextSamples: new Array<number>(C).fill(0),
  contextPrototype: Array.from({ length: C }, () => zeros(D)),
  contextTransfer: new Array<number>(C).fill(0.42),
  contextRisk: new Array<number>(C).fill(0.12),
  protectedPrototype: zeros(D),
  protectedNorm01: 0,
  updateOrthogonality01: 0.72,
  actionBias: Object.fromEntries(ACTIONS.map((action) => [action, 0])) as Record<ActionKind, number>,
});

export class P2835TransferSafetySynergyController {
  private state: P2835State = defaultState();

  snapshot(): P2835State {
    return structuredClone(this.state);
  }

  metrics(): P2835State {
    return structuredClone(this.state);
  }

  /** PASS 10: bounded scalar diagnostics for hot-path health probes. */
  metricsLite(): { tick:number; decisions:number; outcomes:number; contextCompatibility01:number; positiveTransfer01:number; negativeTransfer01:number; orthogonalSafety01:number; replayUtility01:number; learningScale01:number; transferEvents:number; blockedTransferEvents:number; protectedUpdateEvents:number; plasticUpdateEvents:number } {
    return {
      tick:this.state.tick, decisions:this.state.decisions, outcomes:this.state.outcomes,
      contextCompatibility01:this.state.contextCompatibility01, positiveTransfer01:this.state.positiveTransfer01,
      negativeTransfer01:this.state.negativeTransfer01, orthogonalSafety01:this.state.orthogonalSafety01,
      replayUtility01:this.state.replayUtility01, learningScale01:this.state.learningScale01,
      transferEvents:this.state.transferEvents, blockedTransferEvents:this.state.blockedTransferEvents,
      protectedUpdateEvents:this.state.protectedUpdateEvents, plasticUpdateEvents:this.state.plasticUpdateEvents,
    };
  }

  setEnabled(value: boolean): void {
    this.state.enabled = !!value;
  }

  restore(raw?: Partial<P2835State> | null): void {
    const source: any = raw ?? {};
    const arr = (value: any, length: number, fill: number): number[] => {
      if (!Array.isArray(value)) return new Array<number>(length).fill(fill);
      return value.slice(0, length).concat(new Array<number>(Math.max(0, length - value.length)).fill(fill)).slice(0, length);
    };
    const matrix = (value: any, rows: number, cols: number): number[][] => {
      return Array.from({ length: rows }, (_, index) => arr(value?.[index], cols, 0));
    };
    this.state = {
      ...defaultState(),
      ...structuredClone(source),
      version: 1,
      contextSamples: arr(source.contextSamples, C, 0),
      contextPrototype: matrix(source.contextPrototype, C, D),
      contextTransfer: arr(source.contextTransfer, C, 0.42),
      contextRisk: arr(source.contextRisk, C, 0.12),
      protectedPrototype: arr(source.protectedPrototype, D, 0),
      actionBias: {
        ...defaultState().actionBias,
        ...(source.actionBias ?? {}),
      },
    };
  }

  private contextSignature(latent: number[], novelty: number, uncertainty: number, error: number): number[] {
    const output = zeros(D);
    for (let index = 0; index < D; index += 1) output[index] = finite(latent[index]);
    output[8] = novelty;
    output[9] = uncertainty;
    output[10] = error;
    output[11] = clamp(1 - 0.5 * (uncertainty + error));
    const scale = norm(output);
    return output.map((value) => value / scale);
  }

  private nearest(signature: number[]): { id: number; similarity01: number } {
    let bestId = 0;
    let bestSimilarity = -1;
    for (let context = 0; context < C; context += 1) {
      if ((this.state.contextSamples[context] ?? 0) <= 0) continue;
      const similarity = cosine(signature, this.state.contextPrototype[context] ?? zeros(D));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestId = context;
      }
    }
    return {
      id: bestId,
      similarity01: bestSimilarity < 0 ? 0.35 : clamp((bestSimilarity + 1) / 2),
    };
  }

  private updatePrototype(contextId: number, signature: number[], rate: number): void {
    const count = this.state.contextSamples[contextId] ?? 0;
    const eta = clamp(rate / (count + rate));
    const prototype: number[] = this.state.contextPrototype[contextId] ?? zeros(D);
    for (let index = 0; index < D; index += 1) {
      const current = finite(prototype.at(index) ?? 0);
      const incoming = finite(signature.at(index) ?? 0);
      prototype.splice(index, 1, current * (1 - eta) + incoming * eta);
    }
    this.state.contextPrototype[contextId] = prototype;
    this.state.contextSamples[contextId] = count + rate;
  }

  beforeDecision(input: P2835DecisionInput): P2835DecisionOutput {
    if (!this.state.enabled) {
      return {
        actionBias: Object.fromEntries(ACTIONS.map((action) => [action, 0])) as Record<ActionKind, number>,
        contextId: input.contextId,
        contextCompatibility01: 1,
        positiveTransfer01: 0.5,
        negativeTransfer01: 0,
        orthogonalSafety01: 1,
        learningScale01: 1,
        replayUtility01: 1,
        exploration01: 0,
      };
    }

    this.state.tick = input.tick;
    this.state.decisions += 1;
    const signature = this.contextSignature(input.latent, input.novelty01, input.uncertainty01, input.predictionError01);
    const nearest = this.nearest(signature);
    const hinted = Math.max(0, Math.min(C - 1, Math.floor(input.contextId)));
    const contextId = this.state.contextSamples[hinted] > 0 ? hinted : nearest.id;
    const contextSimilarity = clamp(0.5 * nearest.similarity01 + 0.5 * (contextId === nearest.id ? nearest.similarity01 : 0.5));
    const shift = clamp(
      input.novelty01 * 0.42
        + input.predictionError01 * 0.28
        + input.uncertainty01 * 0.20
        + (1 - input.worldConfidence01) * 0.10,
    );
    const compatibility = clamp(
      0.38 + contextSimilarity * 0.44 + input.teacherConfidence01 * 0.10 + input.worldConfidence01 * 0.08 - 0.22 * shift,
    );
    if (this.state.activeContextId !== contextId && this.state.decisions > 1) this.state.contextSwitches += 1;
    this.state.lastContextId = this.state.activeContextId;
    this.state.activeContextId = contextId;
    this.state.lastContextSimilarity01 = contextSimilarity;
    this.state.contextCompatibility01 = clamp(this.state.contextCompatibility01 * 0.92 + compatibility * 0.08);
    this.state.contextNovelty01 = clamp(this.state.contextNovelty01 * 0.90 + shift * 0.10);
    this.updatePrototype(contextId, signature, input.resource01 > 0.45 ? 0.12 : 0.05);

    const transferOpportunity = clamp(
      0.34 * contextSimilarity
        + 0.28 * input.teacherConfidence01
        + 0.22 * input.worldConfidence01
        + 0.16 * (1 - input.forgetting01),
    );
    const negativeTransfer = clamp(
      0.44 * shift
        + 0.24 * (1 - compatibility)
        + 0.18 * input.replayPressure01
        + 0.14 * (1 - input.resource01),
    );
    const protectedNeed = clamp(
      0.40 * input.forgetting01
        + 0.25 * (1 - input.teacherConfidence01)
        + 0.20 * negativeTransfer
        + 0.15 * (1 - input.worldConfidence01),
    );
    const orthogonalSafety = clamp(1 - 0.52 * protectedNeed + 0.20 * (1 - input.uncertainty01));
    const resourcePressure = clamp(1 - input.resource01);
    const learningScale = clamp(0.72 + 0.34 * transferOpportunity - 0.24 * negativeTransfer + 0.10 * (1 - resourcePressure));
    const replayUtility = clamp(0.22 + 0.46 * transferOpportunity + 0.18 * (1 - negativeTransfer) + 0.14 * input.teacherConfidence01 - 0.12 * resourcePressure);

    this.state.positiveTransfer01 = clamp(this.state.positiveTransfer01 * 0.94 + transferOpportunity * 0.06);
    this.state.negativeTransfer01 = clamp(this.state.negativeTransfer01 * 0.94 + negativeTransfer * 0.06);
    this.state.orthogonalSafety01 = clamp(this.state.orthogonalSafety01 * 0.94 + orthogonalSafety * 0.06);
    this.state.learningScale01 = clamp(this.state.learningScale01 * 0.90 + learningScale * 0.10, 0.58, 1.14);
    this.state.replayUtility01 = clamp(this.state.replayUtility01 * 0.92 + replayUtility * 0.08);
    this.state.resourcePressure01 = clamp(this.state.resourcePressure01 * 0.90 + resourcePressure * 0.10);
    this.state.contextRisk[contextId] = clamp((this.state.contextRisk[contextId] ?? 0.12) * 0.93 + negativeTransfer * 0.07);
    this.state.contextTransfer[contextId] = clamp((this.state.contextTransfer[contextId] ?? 0.42) * 0.94 + transferOpportunity * 0.06);
    if (transferOpportunity > 0.62) this.state.transferEvents += 1;
    if (negativeTransfer > 0.62) this.state.blockedTransferEvents += 1;

    const actionBias: Record<ActionKind, number> = Object.fromEntries(ACTIONS.map((action) => {
      const value = action === 'explore'
        ? 0.02 + negativeTransfer * 0.04 + (1 - transferOpportunity) * 0.02
        : action === 'verify'
          ? 0.01 + negativeTransfer * 0.05 + (1 - input.worldConfidence01) * 0.02
          : action === 'reflect'
            ? 0.004 + protectedNeed * 0.02
            : action === 'defer'
              ? -negativeTransfer * 0.018
              : action === 'respond'
                ? transferOpportunity * 0.012
                : 0;
      return [action, clamp(value, -0.03, 0.04)];
    })) as Record<ActionKind, number>;
    this.state.actionBias = actionBias;

    return {
      actionBias,
      contextId,
      contextCompatibility01: compatibility,
      positiveTransfer01: transferOpportunity,
      negativeTransfer01: negativeTransfer,
      orthogonalSafety01: orthogonalSafety,
      learningScale01: learningScale,
      replayUtility01: replayUtility,
      exploration01: clamp(0.02 + negativeTransfer * 0.04 + (1 - transferOpportunity) * 0.02),
    };
  }

  replayGate(
    sourceContextId: number,
    targetContextId: number,
    sourceSignature: number[],
    targetSignature: number[],
    teacherConfidence01: number,
    worldConfidence01: number,
    resource01: number,
  ): number {
    if (!this.state.enabled) return 1;
    const compatibility = clamp((cosine(sourceSignature, targetSignature) + 1) / 2);
    const taskTransfer = clamp(0.52 * compatibility + 0.26 * teacherConfidence01 + 0.22 * worldConfidence01);
    const risk = clamp(
      0.54 * (1 - taskTransfer)
        + 0.22 * (1 - resource01)
        + 0.24 * (this.state.contextRisk[Math.max(0, Math.min(C - 1, Math.floor(targetContextId)))] ?? 0.12),
    );
    if (sourceContextId !== targetContextId && compatibility < 0.36) this.state.blockedTransferEvents += 1;
    return clamp(1 - 0.84 * risk, 0.08, 1);
  }

  gateUpdate(
    updateMagnitude01: number,
    importance01: number,
    contextCompatibility01: number,
    uncertainty01: number,
  ): { scale01: number; protected01: number; orthogonality01: number } {
    if (!this.state.enabled) return { scale01: 1, protected01: 0, orthogonality01: 1 };
    const magnitude = clamp(updateMagnitude01);
    const importance = clamp(importance01);
    const compatibility = clamp(contextCompatibility01);
    const uncertainty = clamp(uncertainty01);
    const protectedNeed = clamp(importance * 0.46 + (1 - compatibility) * 0.22 + uncertainty * 0.14 + this.state.negativeTransfer01 * 0.18);
    const safety = clamp(1 - 0.72 * protectedNeed + 0.08 * (1 - magnitude));
    const scale = clamp(0.56 + 0.40 * compatibility + 0.16 * (1 - protectedNeed) - 0.10 * uncertainty, 0.30, 1.12);
    if (protectedNeed > 0.60) this.state.protectedUpdateEvents += 1;
    else this.state.plasticUpdateEvents += 1;
    this.state.updateOrthogonality01 = clamp(this.state.updateOrthogonality01 * 0.95 + safety * 0.05);
    return { scale01: scale, protected01: protectedNeed, orthogonality01: safety };
  }

  observeOutcome(input: {
    contextId: number;
    latent: number[];
    reward01: number;
    predictionError01: number;
    verified01: number;
    transferUsed01: number;
    replayUsed: number;
  }): void {
    if (!this.state.enabled) return;
    const contextId = Math.max(0, Math.min(C - 1, Math.floor(input.contextId)));
    const outcome = clamp(0.34 * input.reward01 + 0.30 * (1 - input.predictionError01) + 0.20 * input.verified01 + 0.16 * input.transferUsed01);
    this.state.contextTransfer[contextId] = clamp((this.state.contextTransfer[contextId] ?? 0.42) * 0.90 + outcome * 0.10);
    this.state.outcomes += 1;
    const signature = this.contextSignature(input.latent, clamp(input.replayUsed / 12), input.predictionError01, input.predictionError01);
    if ((this.state.contextSamples[contextId] ?? 0) < 1) this.updatePrototype(contextId, signature, 0.5);
    const protectedNorm = this.state.protectedPrototype.reduce((sum, value) => sum + Math.abs(value), 0) / D;
    this.state.protectedNorm01 = clamp(this.state.protectedNorm01 * 0.95 + protectedNorm * 0.05);
    this.state.resourcePressure01 = clamp(this.state.resourcePressure01 * 0.96 + 0.04 * clamp(input.replayUsed / 12));
  }
}

export const defaultP2835TransferSafetySynergy = (): P2835State => defaultState();
