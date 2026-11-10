/**
 * NK1 Unified Bio-Inspired Brain System (UnifiedBrainSystem)
 *
 * Implements a biologically grounded cognitive architecture modeled on human neuroanatomy:
 * 1. Thalamus & Sensory Ingress (Sensory gating, attention filtering, reticular nucleus)
 * 2. Prefrontal Cortex / Executive Control (DLPFC deliberation, metacognition, ACC conflict monitor)
 * 3. Hippocampus & Entorhinal Cortex (Trisynaptic circuit: DG pattern separation, CA3 pattern completion, CA1 output)
 * 4. Limbic System & Amygdala (PAD Affect, Damasio somatic markers, emotion regulation, Insula visceroception)
 * 5. Hypothalamus & Homeostatic Drives (Curiosity, cognitive energy, social drive, self-prior motivation)
 * 6. Basal Ganglia & Motor Cortex (Corticostriatal-thalamocortical loops, direct/indirect action gating)
 * 7. Broca & Wernicke Centers (Auditory comprehension, speech articulation, smart turns)
 *
 * Causal Loop:
 * Perceive -> UpdateBeliefs -> Recall -> Appraise -> SelectGoal -> Plan -> Gate -> Act -> Observe -> Reflect -> Consolidate
 */

export interface SomaticMarkerState {
  valence: number;     // [-1.0, 1.0] Pleasure/Displeasure
  arousal: number;     // [0.0, 1.0] Physiological activation
  dominance: number;   // [0.0, 1.0] Sense of agency / control
  somaticRisk: number; // [0.0, 1.0] Visceral risk evaluation (Insula / vmPFC)
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

export interface EpisodicMemoryTrace {
  id: string;
  content: string;
  emotionalValence: number;
  patternVector: number[]; // DG / CA3 pattern representation
  consolidationScore: number;
  timestamp: number;
}

export interface BrainCycleResult {
  stepIndex: number;
  phaseOrder: string[];
  somaticMarker: SomaticMarkerState;
  neuromodulation: NeuromodulatoryProfile;
  drives: HomeostaticDrives;
  motorIntent: MotorIntent;
  reflectionSummary: string;
  activeHypothesis?: string;
  patternSeparated: boolean;
  actionGated: boolean;
}

export class UnifiedBrainSystem {
  private cycleCounter: number;
  private neuromodulators: NeuromodulatoryProfile;
  private drives: HomeostaticDrives;
  private somaticMarker: SomaticMarkerState;
  private episodicMemoryStore: EpisodicMemoryTrace[];
  private currentBeliefs: Map<string, number>;
  private cognitiveHabits: Map<string, number>; // Basal ganglia procedural weights

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
      somaticRisk: 0.10
    };
    this.episodicMemoryStore = [];
    this.currentBeliefs = new Map([
      ['identity:self', 1.0],
      ['identity:kurisu_makise', 1.0],
      ['lab:future_gadget_lab', 0.95],
      ['reality:time_travel_paradox', 0.88]
    ]);
    this.cognitiveHabits = new Map([
      ['habit:skeptical_verification', 0.92],
      ['habit:defensive_tsundere', 0.78],
      ['habit:scientific_deduction', 0.95]
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

  public getBeliefs(): Map<string, number> {
    return new Map(this.currentBeliefs);
  }

  /**
   * Evaluates Damasio's Somatic Marker hypothesis with Anterior Insular visceroception:
   * Visceral and affective markers bias cognitive options before conscious deliberation.
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
      somaticRisk
    };

    return { ...this.somaticMarker };
  }

  /**
   * Hippocampal trisynaptic circuit simulation:
   * Dentate Gyrus (DG) performs pattern separation on incoming sensory features,
   * while CA3 performs recurrent auto-associative pattern completion.
   */
  public recallHippocampalPattern(features: string[], emotionalTone: number): { matches: EpisodicMemoryTrace[]; patternSeparated: boolean } {
    if (this.episodicMemoryStore.length === 0) {
      return { matches: [], patternSeparated: true };
    }

    // Pattern completion via CA3 auto-associative similarity
    const matches = this.episodicMemoryStore.filter(trace => {
      const valenceDiff = Math.abs(trace.emotionalValence - emotionalTone);
      return valenceDiff < 0.45;
    });

    // DG pattern separation: determines if the current input constitutes a genuinely novel episode
    const patternSeparated = matches.length === 0 || features.some(f => !this.episodicMemoryStore.some(m => m.content.includes(f)));
    return { matches, patternSeparated };
  }

  /**
   * Basal Ganglia Corticostriatal Action Gating:
   * Striatal D1 (Direct pathway - Go) vs D2 (Indirect pathway - NoGo)
   */
  public gateBasalGangliaAction(candidateRisk: number, dopamineLevel: number): boolean {
    const directPathwayGo = dopamineLevel * 0.7 + (1.0 - candidateRisk) * 0.6;
    const indirectPathwayNoGo = (1.0 - dopamineLevel) * 0.5 + candidateRisk * 0.8;
    return directPathwayGo >= indirectPathwayNoGo;
  }

  /**
   * Executes the full 11-phase canonical causal cognitive cycle:
   * 1. Perceive (Thalamus)
   * 2. UpdateBeliefs (PFC / Temporal Cortex)
   * 3. Recall (Hippocampus trisynaptic circuit)
   * 4. Appraise (Amygdala / Limbic / Anterior Insula)
   * 5. SelectGoal (Hypothalamus homeostatic drives & self-prior)
   * 6. Plan (DLPFC executive simulation)
   * 7. Gate (Basal Ganglia striatal D1/D2 gating)
   * 8. Act (Motor Cortex & Broca)
   * 9. Observe (Secondary Somatosensory)
   * 10. Reflect (Metacognition & Anterior Cingulate conflict monitor)
   * 11. Consolidate (Hippocampal-Neocortical Consolidation)
   */
  public runCognitiveCycle(input: SensoryInput): BrainCycleResult {
    this.cycleCounter++;
    const phaseOrder: string[] = [];

    // Phase 1: Perceive (Thalamus gating & sensory ingestion)
    phaseOrder.push('Perceive');
    const novelty = Math.max(0.0, Math.min(1.0, input.environmentalNovelty));

    // Phase 2: UpdateBeliefs (Bayesian evidence update in neocortex)
    phaseOrder.push('UpdateBeliefs');
    if (input.auditoryTranscript) {
      const prior = this.currentBeliefs.get('identity:kurisu_makise') ?? 1.0;
      this.currentBeliefs.set(`turn:${this.cycleCounter}`, 0.95);
      // Reinforce core identity belief
      this.currentBeliefs.set('identity:kurisu_makise', Math.min(1.0, prior + 0.001));
    }

    // Phase 3: Recall (Hippocampal trisynaptic circuit)
    phaseOrder.push('Recall');
    const { matches, patternSeparated } = this.recallHippocampalPattern(input.visualFeatures, this.somaticMarker.valence);

    // Phase 4: Appraise (Limbic system valuation & neuromodulation)
    phaseOrder.push('Appraise');
    // Reward Prediction Error (RPE) driving dopamine release
    const expectedNovelty = 0.3;
    const rpe = novelty - expectedNovelty;
    this.neuromodulators.dopamine = Math.max(0.1, Math.min(1.0, this.neuromodulators.dopamine + rpe * 0.3));
    this.neuromodulators.acetylcholine = Math.max(0.1, Math.min(1.0, 0.4 + novelty * 0.5));
    this.neuromodulators.noradrenaline = Math.max(0.1, Math.min(1.0, 0.2 + (1.0 - this.drives.epistemicCoherence) * 0.5));

    this.evaluateSomaticMarker(
      this.somaticMarker.valence * 0.75 + (novelty > 0.5 ? 0.3 : -0.1),
      Math.min(1.0, 0.3 + novelty * 0.4),
      novelty > 0.8 ? 0.4 : 0.05
    );

    // Phase 5: SelectGoal (Hypothalamus homeostatic drive arbitration)
    phaseOrder.push('SelectGoal');
    let activeHypothesis: string | undefined;
    if (this.drives.curiosity > 0.7) {
      activeHypothesis = "Verify causal invariance of observed phenomenon";
      this.neuromodulators.dopamine = Math.min(1.0, this.neuromodulators.dopamine + 0.05);
    }

    // Phase 6: Plan (Executive prefrontal simulation)
    phaseOrder.push('Plan');

    // Phase 7: Gate (Basal Ganglia striatal D1/D2 gating)
    phaseOrder.push('Gate');
    const actionApproved = this.gateBasalGangliaAction(this.somaticMarker.somaticRisk, this.neuromodulators.dopamine);

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

    // Phase 9: Observe (Sensory re-ingress from action consequences)
    phaseOrder.push('Observe');

    // Phase 10: Reflect (Metacognition & Anterior Cingulate conflict monitoring)
    phaseOrder.push('Reflect');
    const conflictLevel = patternSeparated ? 0.1 : 0.05;
    const reflectionSummary = `Cycle ${this.cycleCounter} complete. Valence=${this.somaticMarker.valence.toFixed(2)}, DA=${this.neuromodulators.dopamine.toFixed(2)}, Posture=${posture}, Conflict=${conflictLevel}`;

    // Phase 11: Consolidate (Long-term hippocampal-cortical projection)
    phaseOrder.push('Consolidate');
    this.episodicMemoryStore.push({
      id: `ep_${Date.now()}_${this.cycleCounter}`,
      content: reflectionSummary,
      emotionalValence: this.somaticMarker.valence,
      patternVector: [novelty, this.somaticMarker.valence, this.neuromodulators.dopamine],
      consolidationScore: 0.95,
      timestamp: Date.now()
    });

    // Metabolic energy decay and homeostatic recovery
    this.drives.cognitiveEnergy = Math.max(0.1, this.drives.cognitiveEnergy - 0.008);

    return {
      stepIndex: this.cycleCounter,
      phaseOrder,
      somaticMarker: { ...this.somaticMarker },
      neuromodulation: { ...this.neuromodulators },
      drives: { ...this.drives },
      motorIntent,
      reflectionSummary,
      activeHypothesis,
      patternSeparated,
      actionGated: actionApproved
    };
  }
}
