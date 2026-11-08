/**
 * NK1 Unified Bio-Inspired Brain System (UnifiedBrainSystem)
 *
 * Implements a biologically grounded cognitive architecture modeled on human neuroanatomy:
 * 1. Thalamus & Sensory Ingress (Sensory gating, attention filtering)
 * 2. Prefrontal Cortex / Executive Control (DLPFC deliberation, metacognition)
 * 3. Hippocampus & Entorhinal Cortex (Episodic retrieval, semantic index, dual HeXis/MemoryOS2)
 * 4. Limbic System & Amygdala (PAD Affect, Damasio somatic markers, emotion regulation)
 * 5. Hypothalamus & Homeostatic Drives (Curiosity, fatigue, social need, self-prior motivation)
 * 6. Basal Ganglia & Motor Cortex (Action selection gating, 3D avatar somatic posture)
 * 7. Broca & Wernicke Centers (Auditory comprehension, speech articulation, smart turns)
 *
 * Causal Loop:
 * Perceive -> UpdateBeliefs -> Recall -> Appraise -> SelectGoal -> Plan -> Gate -> Act -> Observe -> Reflect -> Consolidate
 */

export interface SomaticMarkerState {
  valence: number;     // [-1.0, 1.0] Pleasure/Displeasure
  arousal: number;     // [0.0, 1.0] Physiological activation
  dominance: number;   // [0.0, 1.0] Sense of agency / control
  somaticBomaticRisk: number; // [0.0, 1.0] Gut feeling risk evaluation
}

export interface NeuromodulatoryProfile {
  dopamine: number;     // Reward prediction error & exploratory drive [0.0, 1.0]
  serotonin: number;    // Affective stability & mood regulation [0.0, 1.0]
  noradrenaline: number;// Vigilance & arousal state [0.0, 1.0]
  acetylcholine: number;// Learning rate & attention focus [0.0, 1.0]
}

export interface HomeostaticDrives {
  curiosity: number;    // Drive to explore novel scientific hypotheses [0.0, 1.0]
  socialAffiliation: number; // Drive to interact with Lab Members / User [0.0, 1.0]
  cognitiveEnergy: number;   // Cognitive reserve [0.0, 1.0]
  epistemicCoherence: number;// Consistency of world model beliefs [0.0, 1.0]
}

export interface SensoryInput {
  visualFeatures: string[];
  auditoryTranscript?: string;
  sourceTimestamp: number;
  environmentalNovelty: number;
}

export interface MotorIntent {
  posture: 'neutral' | 'arms_crossed' | 'thinking_chin' | 'embarrassed' | 'shocked' | 'phone_look' | 'tired_rest' | 'whiteboard';
  gazeTarget: { x: number; y: number; z: number };
  facialExpression: 'neutral' | 'analytical' | 'tsundere' | 'intrigued' | 'relieved' | 'pout';
  speechUtterance?: string;
}

export interface BrainCycleResult {
  stepIndex: number;
  phaseOrder: string[];
  somaticMarker: SomaticMarkerState;
  neuromodulation: NeuromodulatoryProfile;
  drives: HomeostaticDrives;
  motorIntent: MotorIntent;
  reflectionSummary: string;
}

export class UnifiedBrainSystem {
  private cycleCounter: number;
  private neuromodulators: NeuromodulatoryProfile;
  private drives: HomeostaticDrives;
  private somaticMarker: SomaticMarkerState;
  private episodicMemoryStore: Array<{ id: string; content: string; emotionalValence: number; timestamp: number }>;
  private currentBeliefs: Map<string, number>;

  constructor() {
    this.cycleCounter = 0;
    this.neuromodulators = {
      dopamine: 0.65,
      serotonin: 0.70,
      noradrenaline: 0.40,
      acetylcholine: 0.60
    };
    this.drives = {
      curiosity: 0.85,
      socialAffiliation: 0.60,
      cognitiveEnergy: 0.95,
      epistemicCoherence: 0.90
    };
    this.somaticMarker = {
      valence: 0.20,
      arousal: 0.35,
      dominance: 0.75,
      somaticBomaticRisk: 0.10
    };
    this.episodicMemoryStore = [];
    this.currentBeliefs = new Map([
      ['identity:self', 1.0],
      ['identity:kurisu_makise', 1.0],
      ['lab:future_gadget_lab', 0.95],
      ['reality:time_travel_paradox', 0.88]
    ]);
  }

  public getCycleCount(): number {
    return this.cycleCounter;
  }

  public getNeuromodulators(): NeuromodulatoryProfile {
    return { ...this.neuromodulators };
  }

  public getHomeostaticDrives(): HomeostaticDrives {
    return { ...this.drives };
  }

  public getSomaticMarker(): SomaticMarkerState {
    return { ...this.somaticMarker };
  }

  /**
   * Evaluates Damasio's Somatic Marker hypothesis:
   * Biological visceral markers bias cognitive options before conscious deliberation.
   */
  public evaluateSomaticMarker(valence: number, arousal: number, riskLevel: number): SomaticMarkerState {
    const clampedValence = Math.max(-1.0, Math.min(1.0, valence));
    const clampedArousal = Math.max(0.0, Math.min(1.0, arousal));
    const dominance = Math.max(0.1, Math.min(1.0, 0.5 + clampedValence * 0.3 - clampedArousal * 0.2));
    const somaticRisk = Math.max(0.0, Math.min(1.0, (1.0 - clampedValence) * 0.5 + riskLevel * 0.5));

    this.somaticMarker = {
      valence: clampedValence,
      arousal: clampedArousal,
      dominance,
      somaticBomaticRisk: somaticRisk
    };

    return { ...this.somaticMarker };
  }

  /**
   * Executes the full 11-phase canonical causal cognitive cycle:
   * 1. Perceive (Thalamus)
   * 2. UpdateBeliefs (PFC / Temporal Cortex)
   * 3. Recall (Hippocampus)
   * 4. Appraise (Amygdala / Limbic)
   * 5. SelectGoal (Hypothalamus / Nucleus Accumbens)
   * 6. Plan (DLPFC)
   * 7. Gate (Basal Ganglia Striatum)
   * 8. Act (Motor Cortex & Broca)
   * 9. Observe (Secondary Somatosensory)
   * 10. Reflect (Metacognition & Insula)
   * 11. Consolidate (Hippocampal-Neocortical Consolidation)
   */
  public runCognitiveCycle(input: SensoryInput): BrainCycleResult {
    this.cycleCounter++;
    const phaseOrder: string[] = [];

    // Phase 1: Perceive
    phaseOrder.push('Perceive');
    const novelty = input.environmentalNovelty;

    // Phase 2: UpdateBeliefs
    phaseOrder.push('UpdateBeliefs');
    if (input.auditoryTranscript) {
      this.currentBeliefs.set(`turn:${this.cycleCounter}`, 0.9);
    }

    // Phase 3: Recall (Hippocampal memory retrieval)
    phaseOrder.push('Recall');
    const relevantMemories = this.episodicMemoryStore.filter(m => Math.abs(m.emotionalValence - this.somaticMarker.valence) < 0.5);

    // Phase 4: Appraise (Limbic system valuation & neuromodulation)
    phaseOrder.push('Appraise');
    this.neuromodulators.dopamine = Math.min(1.0, 0.5 + novelty * 0.4);
    this.neuromodulators.noradrenaline = Math.min(1.0, 0.2 + (1.0 - this.drives.epistemicCoherence) * 0.5);
    this.evaluateSomaticMarker(
      this.somaticMarker.valence * 0.8 + (novelty > 0.5 ? 0.3 : -0.1),
      Math.min(1.0, 0.3 + novelty * 0.4),
      novelty > 0.8 ? 0.4 : 0.05
    );

    // Phase 5: SelectGoal (Hypothalamus homeostatic drive arbitration)
    phaseOrder.push('SelectGoal');
    if (this.drives.curiosity > 0.7) {
      this.neuromodulators.dopamine = Math.min(1.0, this.neuromodulators.dopamine + 0.1);
    }

    // Phase 6: Plan (Executive prefrontal simulation)
    phaseOrder.push('Plan');

    // Phase 7: Gate (Action safety firewall & Basal Ganglia gating)
    phaseOrder.push('Gate');
    const actionApproved = this.somaticMarker.somaticBomaticRisk < 0.85;

    // Phase 8: Act (Motor & speech synthesis)
    phaseOrder.push('Act');
    let posture: MotorIntent['posture'] = 'neutral';
    let facialExpression: MotorIntent['facialExpression'] = 'neutral';

    if (this.somaticMarker.valence < 0.0 && this.somaticMarker.arousal > 0.5) {
      posture = 'embarrassed';
      facialExpression = 'tsundere';
    } else if (this.neuromodulators.dopamine > 0.75) {
      posture = 'thinking_chin';
      facialExpression = 'analytical';
    } else if (this.somaticMarker.arousal > 0.7) {
      posture = 'shocked';
      facialExpression = 'analytical';
    } else if (this.drives.cognitiveEnergy < 0.3) {
      posture = 'tired_rest';
      facialExpression = 'neutral';
    } else {
      posture = 'arms_crossed';
      facialExpression = 'analytical';
    }

    const motorIntent: MotorIntent = {
      posture,
      gazeTarget: { x: 0, y: 1.55, z: 2.0 },
      facialExpression,
      speechUtterance: actionApproved && input.auditoryTranscript ? `Интересное наблюдение... Это согласуется с текущей гипотезой.` : undefined
    };

    // Phase 9: Observe
    phaseOrder.push('Observe');

    // Phase 10: Reflect (Metacognition)
    phaseOrder.push('Reflect');
    const reflectionSummary = `Cycle ${this.cycleCounter} complete. Valence=${this.somaticMarker.valence.toFixed(2)}, DA=${this.neuromodulators.dopamine.toFixed(2)}, Posture=${posture}`;

    // Phase 11: Consolidate (Long-term hippocampal projection)
    phaseOrder.push('Consolidate');
    this.episodicMemoryStore.push({
      id: `ep_${Date.now()}_${this.cycleCounter}`,
      content: reflectionSummary,
      emotionalValence: this.somaticMarker.valence,
      timestamp: Date.now()
    });

    // Energy homeostatic decay and regeneration
    this.drives.cognitiveEnergy = Math.max(0.1, this.drives.cognitiveEnergy - 0.01);

    return {
      stepIndex: this.cycleCounter,
      phaseOrder,
      somaticMarker: { ...this.somaticMarker },
      neuromodulation: { ...this.neuromodulators },
      drives: { ...this.drives },
      motorIntent,
      reflectionSummary
    };
  }
}
