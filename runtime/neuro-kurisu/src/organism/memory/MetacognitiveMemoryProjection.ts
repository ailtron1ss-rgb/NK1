import { CognitiveEventFabric, type CognitiveEventNode } from '../system/CognitiveEventFabric.ts';
import { MemoryOS2, type MemoryItem2 } from '../developmental/MemoryOS2.ts';
import {
  MemoryConsolidationController,
  type ConsolidationDecision,
} from './MemoryConsolidationController.ts';

const HASH = /^[a-f0-9]{64}$/i;
const REFLECTION_KINDS = new Set(['none', 'calibration', 'contradiction', 'limitation', 'insight']);
const CORRECTION_DISPOSITIONS = new Set(['none', 'staged', 'accepted', 'rejected', 'rolled-back']);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

type EpisodeProjection = {
  id: string;
  tick: number;
  at: number;
  parentIds: string[];
  cycleIdHash: string;
  actionEventId: string;
  observationEventId: string | null;
  predictionEventId: string | null;
  outcomeEventId: string;
  learningEventId: string;
  predictedOutcomeHash: string;
  observedOutcomeHash: string;
  decisionRationaleHash: string;
  projectionHash: string;
  predictionError01: number;
  confidence01: number;
  reflectionKind: 'none' | 'calibration' | 'contradiction' | 'limitation' | 'insight';
  correctionDisposition: 'none' | 'staged' | 'accepted' | 'rejected' | 'rolled-back';
};

function ownData(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readEpisode(raw: unknown): EpisodeProjection | null {
  if (!isPlainRecord(raw) || ownData(raw, 'stage') !== 'metacognition') return null;
  const id = ownData(raw, 'id');
  const tick = ownData(raw, 'tick');
  const at = ownData(raw, 'at');
  const parents = ownData(raw, 'parentIds');
  const payload = ownData(raw, 'payload');
  if (typeof id !== 'string' || !id.trim() || id.length > 140
    || !Number.isSafeInteger(tick) || (tick as number) < 0
    || typeof at !== 'number' || !Number.isFinite(at) || at < 0
    || !Array.isArray(parents) || !isPlainRecord(payload)) return null;

  const parentIds: string[] = [];
  const parentLength = ownData(parents, 'length');
  if (!Number.isSafeInteger(parentLength) || (parentLength as number) > 8) return null;
  for (let index = 0; index < (parentLength as number); index += 1) {
    const parent = ownData(parents, String(index));
    if (typeof parent !== 'string' || !parent.trim() || parent.length > 180) return null;
    parentIds.push(parent);
  }

  const fields = {
    cycleIdHash: ownData(payload, 'cycleIdHash'),
    actionEventId: ownData(payload, 'actionEventId'),
    observationEventId: ownData(payload, 'observationEventId'),
    predictionEventId: ownData(payload, 'predictionEventId'),
    outcomeEventId: ownData(payload, 'outcomeEventId'),
    learningEventId: ownData(payload, 'learningEventId'),
    predictedOutcomeHash: ownData(payload, 'predictedOutcomeHash'),
    observedOutcomeHash: ownData(payload, 'observedOutcomeHash'),
    decisionRationaleHash: ownData(payload, 'decisionRationaleHash'),
    projectionHash: ownData(payload, 'projectionHash'),
    predictionError01: ownData(payload, 'predictionError01'),
    confidence01: ownData(payload, 'confidence01'),
    reflectionKind: ownData(payload, 'reflectionKind'),
    correctionDisposition: ownData(payload, 'correctionDisposition'),
  };
  if (![fields.cycleIdHash, fields.predictedOutcomeHash, fields.observedOutcomeHash,
    fields.decisionRationaleHash, fields.projectionHash].every(value => typeof value === 'string' && HASH.test(value))
    || ![fields.actionEventId, fields.outcomeEventId, fields.learningEventId].every(value =>
      typeof value === 'string' && value.length > 0 && value.length <= 180)
    || typeof fields.predictionError01 !== 'number' || !Number.isFinite(fields.predictionError01)
    || fields.predictionError01 < 0 || fields.predictionError01 > 1
    || typeof fields.confidence01 !== 'number' || !Number.isFinite(fields.confidence01)
    || fields.confidence01 < 0 || fields.confidence01 > 1
    || typeof fields.reflectionKind !== 'string' || !REFLECTION_KINDS.has(fields.reflectionKind)
    || typeof fields.correctionDisposition !== 'string' || !CORRECTION_DISPOSITIONS.has(fields.correctionDisposition)) {
    return null;
  }
  if (!parentIds.includes(fields.learningEventId as string)
    || !parentIds.includes(fields.outcomeEventId as string)) return null;
  const observationEventId = typeof fields.observationEventId === 'string' ? fields.observationEventId : null;
  const predictionEventId = typeof fields.predictionEventId === 'string' ? fields.predictionEventId : null;
  if ((observationEventId && !parentIds.includes(observationEventId))
    || (predictionEventId && !parentIds.includes(predictionEventId))) return null;

  return {
    id, tick: tick as number, at, parentIds,
    cycleIdHash: fields.cycleIdHash as string,
    actionEventId: fields.actionEventId as string,
    observationEventId,
    predictionEventId,
    outcomeEventId: fields.outcomeEventId as string,
    learningEventId: fields.learningEventId as string,
    predictedOutcomeHash: fields.predictedOutcomeHash as string,
    observedOutcomeHash: fields.observedOutcomeHash as string,
    decisionRationaleHash: fields.decisionRationaleHash as string,
    projectionHash: fields.projectionHash as string,
    predictionError01: fields.predictionError01,
    confidence01: fields.confidence01,
    reflectionKind: fields.reflectionKind as EpisodeProjection['reflectionKind'],
    correctionDisposition: fields.correctionDisposition as EpisodeProjection['correctionDisposition'],
  };
}

export interface MetacognitiveMemoryProjectionResult {
  stored: boolean;
  replayed: boolean;
  memory: MemoryItem2;
  consolidation: ConsolidationDecision | null;
}

/**
 * Projects a privacy-minimised CEF episode into canonical episodic memory.
 * MemoryOS2 remains the only writable memory owner; the consolidation controller
 * ranks the episode but cannot promote a policy, skill, or self-model revision.
 */
export function persistMetacognitiveEpisode(
  rawEpisode: CognitiveEventNode | unknown,
  memory: MemoryOS2,
  consolidation: MemoryConsolidationController,
): MetacognitiveMemoryProjectionResult {
  const episode = readEpisode(rawEpisode);
  if (!episode) throw new Error('metacognitive-memory-projection-invalid-episode');

  const memoryId = 'meta:' + episode.id;
  const existing = memory.snapshot({ clone: false }).items.find(item => item.id === memoryId);
  if (existing) {
    if (existing.context?.projectionHash !== episode.projectionHash) {
      throw new Error('metacognitive-memory-projection-conflict');
    }
    return { stored: false, replayed: true, memory: existing, consolidation: null };
  }

  const reflectionNovelty = episode.reflectionKind === 'none' ? 0.18 : 0.62;
  const novelty01 = clamp01(episode.predictionError01 * 0.72 + reflectionNovelty * 0.28);
  const salience01 = clamp01(0.24 + episode.predictionError01 * 0.52
    + (episode.reflectionKind === 'none' ? 0 : 0.16));
  const reinforcementGate01 = episode.correctionDisposition === 'accepted' ? 0.82
    : episode.correctionDisposition === 'rejected' || episode.correctionDisposition === 'rolled-back' ? 0.22
      : episode.correctionDisposition === 'staged' ? 0.42 : 0.5;

  const decision = consolidation.rank([{
    id: memoryId,
    kind: 'episodic',
    salience01,
    novelty01,
    predictionError01: episode.predictionError01,
    uncertainty01: 1 - episode.confidence01,
    outcome01: 1 - episode.predictionError01,
    recency01: 1,
    reinforcementGate01,
    redundancy01: 0,
    semanticCompression01: 0,
  }], { batchSize: 1, pressure01: episode.predictionError01, awake01: 1 })[0] ?? null;

  const content = [
    'Metacognitive episode at tick ' + episode.tick + '.',
    'Prediction error ' + (episode.predictionError01 * 100).toFixed(1) + '%.',
    'Confidence ' + (episode.confidence01 * 100).toFixed(1) + '%.',
    'Reflection ' + episode.reflectionKind + '.',
    'Correction disposition ' + episode.correctionDisposition + '.',
  ].join(' ');

  const stored = memory.encode({
    id: memoryId,
    content,
    kind: 'episodic',
    tags: ['metacognition', 'episodic-learning', episode.reflectionKind, episode.correctionDisposition],
    context: {
      topic: 'metacognitive-episode',
      category: 'self-monitoring',
      sourceEventId: episode.id,
      cycleIdHash: episode.cycleIdHash,
      actionEventId: episode.actionEventId,
      observationId: episode.observationEventId ?? '',
      decisionId: episode.actionEventId,
      outcomeDirection: episode.predictionError01 >= 0.5 ? 'prediction-mismatch' : 'prediction-aligned',
      predictionEventId: episode.predictionEventId ?? '',
      outcomeEventId: episode.outcomeEventId,
      learningEventId: episode.learningEventId,
      projectionHash: episode.projectionHash,
      predictedOutcomeHash: episode.predictedOutcomeHash,
      observedOutcomeHash: episode.observedOutcomeHash,
      decisionRationaleHash: episode.decisionRationaleHash,
      consolidationRoute: decision?.route ?? 'defer',
    },
    salience: clamp01(salience01 * (decision?.retention01 ?? 0.5)),
    emotionalWeight: 0,
    identityRelevance: episode.reflectionKind === 'insight' || episode.reflectionKind === 'limitation' ? 0.18 : 0.08,
    goalRelevance: 0.12,
    socialRelevance: 0,
    predictionError: episode.predictionError01,
    confidence: episode.confidence01,
    epistemicStatus: 'hypothesis',
    source: 'derived:metacognitive-memory-projection',
    provenanceClass: 'derived',
    sourceAuthority01: 0.52,
    independenceKey: 'cef-metacognition:' + episode.id,
    observedAt: episode.at,
    evidenceFreshnessAt: episode.at,
    entities: [],
    semanticLinks: [],
    temporalLinks: [],
    causalLinks: [],
  }, { clone: false, forceDistinct: true });

  return {
    stored: true,
    replayed: false,
    memory: stored,
    consolidation: decision,
  };
}


/**
 * One-call bridge for the runtime cycle: append/replay the causal episode, then
 * project it into MemoryOS2 and the existing consolidation ranker. If memory
 * persistence is interrupted, repeating the same input safely completes it.
 */
export function recordAndPersistMetacognitiveEpisode(
  fabric: CognitiveEventFabric,
  input: Parameters<CognitiveEventFabric['recordMetacognitiveEpisode']>[0],
  memory: MemoryOS2,
  consolidation: MemoryConsolidationController,
): {
  episode: ReturnType<CognitiveEventFabric['recordMetacognitiveEpisode']>;
  projection: MetacognitiveMemoryProjectionResult | null;
} {
  const episode = fabric.recordMetacognitiveEpisode(input);
  if (!episode.resolved || !episode.eventId) return { episode, projection: null };
  const event = fabric.recent(256).find(row => row.id === episode.eventId);
  if (!event) throw new Error('metacognitive-memory-projection-event-not-retained');
  return { episode, projection: persistMetacognitiveEpisode(event, memory, consolidation) };
}
