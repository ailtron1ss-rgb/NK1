import { AdaptiveExperienceConsolidator, type ExperienceRecord, type ConsolidatedExperience } from '../memory/AdaptiveExperienceConsolidator.ts';
import { B502ContinuousIdentityLifecycleEngine, type IdentityEvent, type IdentityState } from '../cognition/B502ContinuousIdentityLifecycleEngine.ts';
import { B503ExperienceIntegrationLayer, type ExperienceSignal, type ExperienceResult } from '../cognition/B503ExperienceIntegrationLayer.ts';
import { DreamConsolidationLayer, type MemoryTrace } from '../cognition/b504/DreamConsolidationLayer.ts';
import { PersonalityConflictEngine, type Belief, type Conflict } from '../cognition/b504/PersonalityConflictEngine.ts';
import { UnifiedCognitiveSpine, type CognitiveSignal } from '../cognition/b504/UnifiedCognitiveSpine.ts';

const clamp01 = (value:number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const finite = (value:number, fallback=0) => Number.isFinite(value) ? value : fallback;

export interface ContinuousCognitiveSnapshot {
  version: 1;
  tick: number;
  processed: number;
  lastAt: number;
  lastResult: ExperienceResult | null;
  lastIdentity: IdentityState;
  lastConsolidated: ConsolidatedExperience[];
  lastDreamStrengthMean01: number;
  lastConflict: Conflict | null;
  lastSpine01: number;
  continuity01: number;
  memoryRetention01: number;
  health: { malformedInputs: number; rejectedInputs: number };
  recentIds: string[];
  memoryBuffer: ExperienceRecord[];
  integrationProcessed: number;
}

export interface ContinuousCognitiveInput {
  tick: number;
  at: number;
  signal: ExperienceSignal;
  identityEvent: IdentityEvent;
  belief?: Belief;
  evidenceSupport01?: number;
  allowDream?: boolean;
}

/**
 * Mobile-first bridge that makes B502/B503/B501/B504 a single executable path.
 * The fabric intentionally stays compact: it persists derived state and a small
 * recent window, while larger historical evidence remains in the organism's
 * existing memory/event systems.
 */
export class ContinuousCognitiveFabric {
  private readonly integration = new B503ExperienceIntegrationLayer();
  private readonly identity = new B502ContinuousIdentityLifecycleEngine();
  private readonly memory = new AdaptiveExperienceConsolidator(256);
  private readonly dream = new DreamConsolidationLayer();
  private readonly conflict = new PersonalityConflictEngine();
  private readonly spine = new UnifiedCognitiveSpine();

  private state: ContinuousCognitiveSnapshot = {
    version: 1,
    tick: 0,
    processed: 0,
    lastAt: 0,
    lastResult: null,
    lastIdentity: this.identity.snapshot(),
    lastConsolidated: [],
    lastDreamStrengthMean01: 0,
    lastConflict: null,
    lastSpine01: 0.5,
    continuity01: 0.5,
    memoryRetention01: 0,
    health: { malformedInputs: 0, rejectedInputs: 0 },
    recentIds: [],
    memoryBuffer: [],
    integrationProcessed: 0,
  };

  restore(snapshot?: Partial<ContinuousCognitiveSnapshot> | null): void {
    if (!snapshot || snapshot.version !== 1) return;
    this.state = {
      ...this.state,
      ...snapshot,
      health: { ...this.state.health, ...(snapshot.health ?? {}) },
      recentIds: Array.isArray(snapshot.recentIds) ? snapshot.recentIds.slice(-64) : [],
      lastConsolidated: Array.isArray(snapshot.lastConsolidated) ? snapshot.lastConsolidated.slice(0, 24) : [],
      memoryBuffer: Array.isArray(snapshot.memoryBuffer) ? snapshot.memoryBuffer.slice(-64) : [],
      integrationProcessed: Math.max(0, Math.floor(Number.isFinite(snapshot.integrationProcessed) ? snapshot.integrationProcessed! : 0)),
    };
    if (snapshot.lastIdentity) this.identity.restore(snapshot.lastIdentity);
    this.integration.restore({ processed: this.state.integrationProcessed });
    this.memory.restore(this.state.memoryBuffer);
  }

  step(input: ContinuousCognitiveInput): ContinuousCognitiveSnapshot {
    if (!this.validate(input)) {
      this.state.health.rejectedInputs += 1;
      return this.snapshot();
    }
    const signalId=String(input.signal.id);
    const signalAt=Math.max(0,finite(input.signal.timestamp,input.at));
    const outOfOrder=input.tick<=this.state.tick || signalAt<this.state.lastAt;
    if (this.state.recentIds.includes(signalId)||outOfOrder) {
      this.state.health.rejectedInputs += 1;
      return this.snapshot();
    }

    const normalizedSignal: ExperienceSignal = {
      ...input.signal,
      meaning: clamp01(input.signal.meaning),
      novelty: clamp01(input.signal.novelty),
      emotionalImpact: clamp01(input.signal.emotionalImpact),
      tags: Array.isArray(input.signal.tags) ? input.signal.tags.slice(0, 24) : [],
    };
    const normalizedIdentity: IdentityEvent = {
      ...input.identityEvent,
      significance: clamp01(input.identityEvent.significance),
      emotionalWeight: clamp01(input.identityEvent.emotionalWeight),
      tags: Array.isArray(input.identityEvent.tags) ? input.identityEvent.tags.slice(0, 24) : [],
    };

    const integration = this.integration.process(normalizedSignal);
    const experience: ExperienceRecord = {
      id: normalizedSignal.id,
      timestamp: signalAt,
      novelty: normalizedSignal.novelty,
      utility: clamp01(integration.importance * 0.65 + integration.learningPressure * 0.35),
      uncertainty: clamp01(1 - normalizedSignal.meaning),
      tags: normalizedSignal.tags,
    };
    this.memory.ingest(experience);
    this.identity.absorb(normalizedIdentity);

    const consolidated = this.memory.consolidate().slice(0, 12);
    const shouldDream = Boolean(input.allowDream) || input.tick % 8 === 0;
    const dreamResult = shouldDream
      ? this.dream.consolidate(consolidated.map((entry): MemoryTrace => ({
          id: entry.id,
          importance: entry.retentionScore,
          strength: clamp01(entry.retentionScore),
        })))
      : [];

    let conflict: Conflict | null = null;
    if (input.belief) {
      conflict = this.conflict.analyze(input.belief, {
        support01: clamp01(input.evidenceSupport01 ?? integration.importance),
        contradicts: integration.identityPressure > integration.importance && integration.learningPressure > 0.55,
      });
    }

    const identitySnapshot = this.identity.snapshot();
    const retention = consolidated.length
      ? consolidated.reduce((sum, entry) => sum + entry.retentionScore, 0) / consolidated.length
      : 0;
    const signals: CognitiveSignal[] = [
      { source: 'experience-importance', value: integration.importance },
      { source: 'learning-pressure', value: integration.learningPressure },
      { source: 'identity-pressure', value: integration.identityPressure },
      { source: 'memory-retention', value: retention },
      { source: 'identity-continuity', value: identitySnapshot.continuityScore },
      { source: 'conflict-control', value: conflict ? 1 - conflict.intensity : 0.5 },
    ];
    const spine01 = clamp01(this.spine.integrate(signals));

    this.state = {
      version: 1,
      tick: input.tick,
      processed: this.state.processed + 1,
      lastAt: input.at,
      lastResult: integration,
      lastIdentity: identitySnapshot,
      lastConsolidated: consolidated,
      lastDreamStrengthMean01: dreamResult.length
        ? dreamResult.reduce((sum, item) => sum + item.strength, 0) / dreamResult.length
        : this.state.lastDreamStrengthMean01,
      lastConflict: conflict,
      lastSpine01: spine01,
      continuity01: clamp01(identitySnapshot.continuityScore * 0.65 + spine01 * 0.35),
      memoryRetention01: clamp01(retention),
      health: this.state.health,
      recentIds: [...this.state.recentIds, normalizedSignal.id].slice(-64),
      memoryBuffer: this.memory.snapshot().slice(-64),
      integrationProcessed: this.integration.stats().processed,
    };
    return this.snapshot();
  }

  snapshot(): ContinuousCognitiveSnapshot {
    return structuredClone(this.state);
  }

  diagnostics() {
    return {
      tick: this.state.tick,
      processed: this.state.processed,
      continuity01: this.state.continuity01,
      memoryRetention01: this.state.memoryRetention01,
      spine01: this.state.lastSpine01,
      lastConflictIntensity01: this.state.lastConflict?.intensity ?? 0,
      dreamStrengthMean01: this.state.lastDreamStrengthMean01,
      malformedInputs: this.state.health.malformedInputs,
      rejectedInputs: this.state.health.rejectedInputs,
    };
  }

  private validate(input: ContinuousCognitiveInput): boolean {
    const valid = Boolean(input)
      && Number.isFinite(input.tick)
      && Number.isFinite(input.at)
      && Boolean(input.signal?.id)
      && Boolean(input.identityEvent?.id);
    if (!valid) this.state.health.malformedInputs += 1;
    return valid;
  }
}
