import type { ActionKind } from '../core/types.ts';

export type MetacognitiveProvenance = 'observed' | 'simulated' | 'inferred' | 'generated';
export type MetacognitiveReflectionStatus = 'not-evaluated' | 'staged' | 'accepted' | 'rejected' | 'rolled-back';

export interface MetacognitiveEpisode {
  version: 1;
  id: string;
  cycleId: string;
  cognitiveEventId: string;
  tick: number;
  at: number;
  parentEventIds: string[];
  belief: { summary: string; confidence01: number; uncertainty01: number; provenance: 'inferred' };
  prediction: { summary: string; expectedOutcome01: number; confidence01: number; provenance: 'inferred' };
  selection: {
    goalId: string | null;
    action: ActionKind;
    rationale: string[];
    consumedFeatures: Record<string, number>;
  };
  outcome: {
    observedOutcome01: number;
    predictionError01: number;
    provenance: 'observed' | 'simulated';
    verified: boolean;
    independent: boolean;
  };
  contradictions: string[];
  limitations: string[];
  reflection: {
    status: MetacognitiveReflectionStatus;
    proposalId: string | null;
    disposition: 'none' | 'staged' | 'accepted' | 'rejected' | 'rolled-back';
    summary: string;
  };
}

const ACTIONS = new Set<ActionKind>(['respond', 'explore', 'verify', 'rest', 'reflect', 'wait', 'defer']);

function record(value: unknown, allowed: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const allowedSet = new Set(allowed);
  const keys = Reflect.ownKeys(descriptors);
  const copied: Record<string, unknown> = {};
  for (const key of keys) {
    // JSON-like episode records cannot carry hidden symbol-keyed state. Reject it
    // rather than silently normalizing away data that does not survive persistence.
    if (typeof key !== 'string' || !allowedSet.has(key)) return null;
    const descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) return null;
    copied[key] = descriptor.value;
  }
  return copied;
}

function stringValue(value: unknown, max: number, optional = false): string | null {
  if (optional && value === null) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  if ((!normalized && !optional) || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) return null;
  return normalized;
}

function number01(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function stringArray(value: unknown, max: number, exact?: number): string[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor && Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ? lengthDescriptor.value : undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!Number.isSafeInteger(length) || length < 0 || length > max || (exact !== undefined && length !== exact)) return null;
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string')) return null;
  const keys = (ownKeys as string[]).filter(key => key !== 'length');
  if (keys.length !== length) return null;
  const result: string[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) return null;
    const text = stringValue(descriptor.value, 240);
    if (!text) return null;
    result.push(text);
  }
  return result;
}

function featureMap(value: unknown): Record<string, number> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some(key => typeof key !== 'string')) return null;
  const keys = ownKeys as string[];
  if (keys.length > 24) return null;
  const result: Record<string, number> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!/^[a-z][a-zA-Z0-9_]{0,47}$/u.test(key) || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) return null;
    if (typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value) || descriptor.value < -10_000 || descriptor.value > 10_000) return null;
    result[key] = descriptor.value;
  }
  return result;
}

/**
 * Strict, bounded, accessor-free normalizer for one completed eleven-stage cycle.
 * It copies only own JSON-like data and returns null on any malformed or hostile input.
 */
export function normalizeMetacognitiveEpisode(value: unknown): MetacognitiveEpisode | null {
  try {
    const raw = record(value, ['version','id','cycleId','cognitiveEventId','tick','at','parentEventIds','belief','prediction','selection','outcome','contradictions','limitations','reflection']);
    if (!raw || raw.version !== 1 || typeof raw.tick !== 'number' || !Number.isSafeInteger(raw.tick) || raw.tick < 0 ||
        typeof raw.at !== 'number' || !Number.isFinite(raw.at) || raw.at < 0) return null;
    const id = stringValue(raw.id, 180), cycleId = stringValue(raw.cycleId, 180), cognitiveEventId = stringValue(raw.cognitiveEventId, 180);
    const parentEventIds = stringArray(raw.parentEventIds, 11, 11);
    if (!id || !cycleId || !cognitiveEventId || id !== `meta-cycle:${raw.tick}` || cycleId !== `cycle:${raw.tick}` || cognitiveEventId !== `cef:metacognitive:${raw.tick}` || !parentEventIds || new Set(parentEventIds).size !== 11) return null;

    const belief = record(raw.belief, ['summary','confidence01','uncertainty01','provenance']);
    const prediction = record(raw.prediction, ['summary','expectedOutcome01','confidence01','provenance']);
    const selection = record(raw.selection, ['goalId','action','rationale','consumedFeatures']);
    const outcome = record(raw.outcome, ['observedOutcome01','predictionError01','provenance','verified','independent']);
    const reflection = record(raw.reflection, ['status','proposalId','disposition','summary']);
    if (!belief || !prediction || !selection || !outcome || !reflection) return null;

    const beliefSummary = stringValue(belief.summary, 600);
    const beliefConfidence = number01(belief.confidence01), beliefUncertainty = number01(belief.uncertainty01);
    const predictionSummary = stringValue(prediction.summary, 600);
    const expectedOutcome = number01(prediction.expectedOutcome01), predictionConfidence = number01(prediction.confidence01);
    const goalId = stringValue(selection.goalId, 180, true);
    const action = selection.action;
    const rationale = stringArray(selection.rationale, 8);
    const consumedFeatures = featureMap(selection.consumedFeatures);
    const observedOutcome = number01(outcome.observedOutcome01), predictionError = number01(outcome.predictionError01);
    const outcomeProvenance = outcome.provenance;
    const verified = outcome.verified, independent = outcome.independent;
    const contradictions = stringArray(raw.contradictions, 8), limitations = stringArray(raw.limitations, 8);
    const status = reflection.status, proposalId = stringValue(reflection.proposalId, 180, true);
    const disposition = reflection.disposition, reflectionSummary = stringValue(reflection.summary, 400);

    if (!beliefSummary || beliefConfidence === null || beliefUncertainty === null || belief.provenance !== 'inferred' ||
        !predictionSummary || expectedOutcome === null || predictionConfidence === null || prediction.provenance !== 'inferred' ||
        goalId === null || typeof action !== 'string' || !ACTIONS.has(action as ActionKind) ||
        !rationale || !consumedFeatures || observedOutcome === null || predictionError === null ||
        (outcomeProvenance !== 'observed' && outcomeProvenance !== 'simulated') || typeof verified !== 'boolean' || typeof independent !== 'boolean' ||
        (independent && !verified) || !contradictions || !limitations ||
        !['not-evaluated','staged','accepted','rejected','rolled-back'].includes(String(status)) ||
        !['none','staged','accepted','rejected','rolled-back'].includes(String(disposition)) || !reflectionSummary) return null;

    if (Math.abs(predictionError - Math.abs(expectedOutcome - observedOutcome)) > 0.015) return null;
    if (status === 'not-evaluated' && (proposalId !== '' || disposition !== 'none')) return null;
    if (status !== 'not-evaluated' && (!proposalId || disposition !== status)) return null;
    if (outcomeProvenance === 'simulated' && (verified || independent)) return null;

    return {
      version: 1, id, cycleId, cognitiveEventId, tick: raw.tick, at: raw.at, parentEventIds,
      belief: { summary: beliefSummary, confidence01: beliefConfidence, uncertainty01: beliefUncertainty, provenance: 'inferred' },
      prediction: { summary: predictionSummary, expectedOutcome01: expectedOutcome, confidence01: predictionConfidence, provenance: 'inferred' },
      selection: { goalId: goalId || null, action: action as ActionKind, rationale, consumedFeatures },
      outcome: { observedOutcome01: observedOutcome, predictionError01: predictionError, provenance: outcomeProvenance, verified, independent },
      contradictions, limitations,
      reflection: { status: status as MetacognitiveReflectionStatus, proposalId: proposalId || null, disposition: disposition as MetacognitiveEpisode['reflection']['disposition'], summary: reflectionSummary },
    };
  } catch {
    return null;
  }
}

export function metacognitiveEpisodeSummary(episode: MetacognitiveEpisode): string {
  return [
    `Cycle ${episode.tick}: ${episode.selection.action}${episode.selection.goalId ? ` toward ${episode.selection.goalId}` : ''}.`,
    `Belief confidence ${episode.belief.confidence01.toFixed(3)}; uncertainty ${episode.belief.uncertainty01.toFixed(3)}.`,
    `Predicted ${episode.prediction.expectedOutcome01.toFixed(3)}; observed ${episode.outcome.observedOutcome01.toFixed(3)}; error ${episode.outcome.predictionError01.toFixed(3)}.`,
    `Outcome provenance ${episode.outcome.provenance}; reflection ${episode.reflection.status}.`,
  ].join(' ');
}

export function metacognitiveEpisodeFingerprint(episode: MetacognitiveEpisode): string {
  return JSON.stringify(episode);
}
