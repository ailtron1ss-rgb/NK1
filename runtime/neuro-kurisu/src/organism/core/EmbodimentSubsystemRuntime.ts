import { probeOrganismSystem, type OrganismSystemHealthSnapshot } from './OrganismSystemContract.ts';
import { MultimodalPerception } from '../body/MultimodalPerception.ts';
import { PerceptionEngine } from '../cognition/PerceptionEngine.ts';
import { P35SemanticWorldBodyEngine } from '../body/P35SemanticWorldBody.ts';
import { P37EmbodiedSensoriumEngine } from '../body/P37EmbodiedSensorium.ts';
import { P40SemanticIntelligenceEngine } from '../cognition/P40SemanticIntelligence.ts';
import { P41SemanticPerceptionEngine } from '../cognition/P41SemanticPerception.ts';
import { P41NativePerceptionEngine } from '../cognition/P41NativePerception.ts';
import { P41TemporalPerceptionModel } from '../cognition/P41TemporalPerceptionModel.ts';
import { P42UnifiedEmbodiedExperienceEngine } from '../cognition/P42UnifiedEmbodiedExperience.ts';
import { P43EmbodiedImageryWorkspace } from '../cognition/P43EmbodiedImageryWorkspace.ts';
import { P66InteroceptiveHomeostasis } from '../cognition/P66InteroceptiveHomeostasis.ts';
import { defaultPerceptionRoutingState, routePerception, type PerceptionRoutingState } from '../body/PerceptionRouter.ts';
import type { PerceptionEvent } from '../cognition/PerceptionEngine.ts';
import type { OrganismBodyState } from '../body/EmbodiedBody.ts';
import { defaultCameraEvidenceState, type CameraEvidence } from '../body/CameraEvidenceProcessor.ts';
import { InteroceptiveStateEstimator } from '../system/InteroceptiveStateEstimator.ts';
import { ActivePerceptionExecutor, defaultActivePerceptionExecutor, type ActivePerceptionModality } from '../system/ActivePerceptionExecutor.ts';
import { ActivePerceptionNeuralSubstrate } from '../cognition/ActivePerceptionNeuralSubstrate.ts';
import { PerceptualEvidenceCompiler, defaultPerceptualEvidence } from '../body/PerceptualEvidenceCompiler.ts';

/** BIG PASS 51: physical owner for sensor, perception and embodied-experience state. */
export class EmbodimentSubsystemRuntime {
  readonly systemName='embodiment' as const;
  readonly dependencies=[] as const;
  readonly systemCapabilities=['state', 'perception', 'embodiment', 'persistence'] as const;
  health(): OrganismSystemHealthSnapshot { return probeOrganismSystem(this); }

  readonly multimodal = new MultimodalPerception();
  readonly perception = new PerceptionEngine();
  readonly p35SemanticWorldBody = new P35SemanticWorldBodyEngine();
  readonly p37EmbodiedSensorium = new P37EmbodiedSensoriumEngine();
  readonly p40SemanticIntelligence = new P40SemanticIntelligenceEngine();
  readonly p41SemanticPerception = new P41SemanticPerceptionEngine();
  readonly p41NativePerception = new P41NativePerceptionEngine();
  readonly p41TemporalPerception = new P41TemporalPerceptionModel();
  readonly p42Experience = new P42UnifiedEmbodiedExperienceEngine();
  readonly p43Imagery = new P43EmbodiedImageryWorkspace();
  readonly p66InteroceptiveHomeostasis = new P66InteroceptiveHomeostasis();
  private perceptionRouting: PerceptionRoutingState = defaultPerceptionRoutingState();


  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly interoceptiveStateEstimator = new InteroceptiveStateEstimator();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly activePerceptionExecutor = new ActivePerceptionExecutor();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly activePerceptionNeural = new ActivePerceptionNeuralSubstrate();
  /** Ownership extraction: retained algorithm/state, moved out of OrganismCore. */
  readonly perceptualEvidence = new PerceptualEvidenceCompiler();
  /** Ownership extraction: camera evidence belongs to the embodied sensor boundary. */
  readonly cameraEvidence = {
    state: defaultCameraEvidenceState(),
    snapshot: () => structuredClone(this.cameraEvidence.state),
    restore: (raw:any) => { this.cameraEvidence.state = { ...defaultCameraEvidenceState(), ...(raw ?? {}), last: raw?.last ?? null }; },
    record: (e:CameraEvidence) => { const st=this.cameraEvidence.state; st.captures++; st.lastAt=e.at; st.previousHash=st.last?.sha256 ?? st.previousHash; st.last=e; st.cumulativeNovelty01=Math.max(0,Math.min(1,Number.isFinite(st.cumulativeNovelty01*.9+e.novelty01*.1)?st.cumulativeNovelty01*.9+e.novelty01*.1:0)); }
  };

  restoreFromPersisted(input: { cognition?: any; embodiment?: any; advanced?: any }) {
    const cognition=input.cognition ?? {}; const embodiment=input.embodiment ?? {}; const advanced=input.advanced ?? {};
    this.perception.restore(cognition.perception);
    this.multimodal.restore(embodiment.multimodal);
    this.p35SemanticWorldBody.restore(embodiment.p35);
    this.p37EmbodiedSensorium.restore(embodiment.p37);
    this.p40SemanticIntelligence.restore(embodiment.p40SemanticIntelligence);
    this.p41SemanticPerception.restore(embodiment.p41SemanticPerception);
    this.p41NativePerception.restore(embodiment.p41NativePerception);
    this.p41TemporalPerception.restore(embodiment.p41TemporalPerception);
    this.p42Experience.restore(embodiment.p42Experience);
    this.p43Imagery.restore(embodiment.p43Imagery);
    this.p66InteroceptiveHomeostasis.restore(advanced.p66InteroceptiveHomeostasis);
  }

  routePerception(event: PerceptionEvent, body?: OrganismBodyState) { this.perceptionRouting = routePerception(event, body); return this.perceptionRouting; }
  perceptionRoutingSnapshot(){ return { ...this.perceptionRouting }; }

  snapshot() { return {
    multimodal:this.multimodal.snapshot(), perception:this.perception.snapshot(), p35:this.p35SemanticWorldBody.snapshot(),
    p37:this.p37EmbodiedSensorium.snapshot(), p40SemanticIntelligence:this.p40SemanticIntelligence.snapshot(),
    p41Semantic:this.p41SemanticPerception.snapshot(), p41Native:this.p41NativePerception.snapshot(),
    p41Temporal:this.p41TemporalPerception.snapshot(), p42:this.p42Experience.snapshot(), p43:this.p43Imagery.snapshot(), p66InteroceptiveHomeostasis:this.p66InteroceptiveHomeostasis.snapshot(), perceptionRouting:this.perceptionRoutingSnapshot(),
  }; }
}
